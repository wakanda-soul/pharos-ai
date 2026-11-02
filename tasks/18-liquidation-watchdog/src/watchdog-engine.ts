import { randomBytes } from 'node:crypto';
import {
  AlertNotificationChannel,
  LendingPositionSnapshot,
  LiquidationAlertPayload,
  RiskLevel,
  WatchdogThresholdConfig,
} from './types.js';
import { DEFAULT_WATCHDOG_CONFIG } from './config.js';
import { LendingMathCalculator } from './position-calculator.js';

export class LiquidationWatchdogEngine {
  private readonly config: WatchdogThresholdConfig;
  private readonly channels: AlertNotificationChannel[] = [];
  private readonly evaluationHistory: {
    snapshot: LendingPositionSnapshot;
    alert?: LiquidationAlertPayload;
  }[] = [];

  constructor(
    customConfig?: Partial<WatchdogThresholdConfig>,
    initialChannels?: AlertNotificationChannel[]
  ) {
    this.config = {
      ...DEFAULT_WATCHDOG_CONFIG,
      ...customConfig,
    };
    if (initialChannels) {
      this.channels.push(...initialChannels);
    }
  }

  registerChannel(channel: AlertNotificationChannel): void {
    this.channels.push(channel);
  }

  getConfig(): WatchdogThresholdConfig {
    return this.config;
  }

  getChannels(): readonly AlertNotificationChannel[] {
    return this.channels;
  }

  getHistory(): readonly { snapshot: LendingPositionSnapshot; alert?: LiquidationAlertPayload }[] {
    return this.evaluationHistory;
  }

  /**
   * Evaluates position risk against configured warning and critical thresholds.
   * Dispatches alerts to all registered channels if thresholds are breached.
   */
  async evaluatePosition(position: LendingPositionSnapshot): Promise<{
    riskLevel: RiskLevel;
    alertDispatched: boolean;
    alertPayload?: LiquidationAlertPayload;
  }> {
    const { warningHealthFactor, criticalHealthFactor } = this.config;
    const hf = position.healthFactor;

    let riskLevel: RiskLevel = 'SAFE';

    if (hf < 1.0) {
      riskLevel = 'LIQUIDATION_IMMINENT';
    } else if (hf < criticalHealthFactor) {
      riskLevel = 'CRITICAL';
    } else if (hf < warningHealthFactor) {
      riskLevel = 'WARNING';
    }

    if (riskLevel === 'SAFE') {
      this.evaluationHistory.push({ snapshot: position });
      return {
        riskLevel: 'SAFE',
        alertDispatched: false,
      };
    }

    // Threshold breached: Calculate concrete remediation plan (Requirement 04)
    const remediationPlan = LendingMathCalculator.calculateRemediationPlan(position, this.config);

    // Compute price buffer to liquidation
    let bufferPercent = 'N/A';
    if (position.collateralPriceUsd > 0 && position.liquidationPriceUsd > 0) {
      const dropToLiquidation = ((position.collateralPriceUsd - position.liquidationPriceUsd) / position.collateralPriceUsd) * 100;
      bufferPercent = `${Math.max(0, dropToLiquidation).toFixed(1)}% price drop remaining`;
    }

    const alertPayload: LiquidationAlertPayload = {
      alertId: `alert-${Date.now()}-${randomBytes(4).toString('hex')}`,
      timestamp: new Date().toISOString(),
      riskLevel,
      protocol: position.protocol,
      borrowerAddress: position.borrowerAddress,
      healthFactor: position.healthFactor,
      currentLtvPercent: `${(position.currentLtv * 100).toFixed(1)}%`,
      collateralValueUsdFormatted: `$${position.collateralValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${position.collateralAmountFormatted} ${position.collateralAsset.symbol})`,
      debtValueUsdFormatted: `$${position.debtValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${position.debtAsset.symbol}`,
      liquidationPriceFormatted: `$${position.liquidationPriceUsd.toFixed(2)}`,
      bufferToLiquidationPercent: bufferPercent,
      recommendedAction: remediationPlan,
    };

    // Broadcast to all notification channels (Requirement 03)
    for (const channel of this.channels) {
      try {
        await channel.sendAlert(alertPayload);
      } catch (err) {
        console.error(`Failed to send alert on channel ${channel.channelName}:`, err);
      }
    }

    this.evaluationHistory.push({
      snapshot: position,
      alert: alertPayload,
    });

    return {
      riskLevel,
      alertDispatched: true,
      alertPayload,
    };
  }
}
