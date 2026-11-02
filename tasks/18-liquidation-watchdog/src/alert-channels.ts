import {
  AlertNotificationChannel,
  LiquidationAlertPayload,
} from './types.js';

/**
 * Terminal Console Notification Channel.
 * Formats rich alert cards with ISO timestamps, risk level emojis, and action advice.
 */
export class ConsoleNotificationChannel implements AlertNotificationChannel {
  readonly channelName = 'Console';

  async sendAlert(alert: LiquidationAlertPayload): Promise<boolean> {
    const isCritical = alert.riskLevel === 'CRITICAL' || alert.riskLevel === 'LIQUIDATION_IMMINENT';
    const alertHeader = isCritical
      ? '🚨 [CRITICAL ALERT] LENDING POSITION LIQUIDATION RISK'
      : '⚠️ [WARNING ALERT] LENDING POSITION HEALTH FACTOR DEGRADATION';

    console.log('\n================================================================================');
    console.log(alertHeader);
    console.log('================================================================================');
    console.log(`Alert ID:        ${alert.alertId}`);
    console.log(`Timestamp (UTC): ${alert.timestamp}`);
    console.log(`Protocol:        ${alert.protocol}`);
    console.log(`Borrower:        ${alert.borrowerAddress}`);
    console.log(`Health Factor:   ${alert.healthFactor.toFixed(3)} (Current LTV: ${alert.currentLtvPercent})`);
    console.log(`Collateral Val:  ${alert.collateralValueUsdFormatted}`);
    console.log(`Debt Val:        ${alert.debtValueUsdFormatted}`);
    console.log(`Liq. Price:      ${alert.liquidationPriceFormatted} (Buffer: ${alert.bufferToLiquidationPercent})`);
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log(`💡 RECOMMENDED MITIGATION ACTION (Requirement 04):`);
    console.log(`   ${alert.recommendedAction.actionSummary}`);
    console.log('================================================================================\n');

    return true;
  }
}

/**
 * Discord Webhook Notification Channel.
 */
export class DiscordNotificationChannel implements AlertNotificationChannel {
  readonly channelName = 'Discord';
  private readonly webhookUrl?: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(alert: LiquidationAlertPayload): Promise<boolean> {
    const isCritical = alert.riskLevel === 'CRITICAL' || alert.riskLevel === 'LIQUIDATION_IMMINENT';
    const embedColor = isCritical ? 0xff0000 : 0xffaa00; // Red or Orange

    const discordPayload = {
      username: 'Pharos Liquidation Watchdog',
      embeds: [
        {
          title: `${isCritical ? '🚨 CRITICAL' : '⚠️ WARNING'}: Health Factor ${alert.healthFactor.toFixed(2)} on ${alert.protocol}`,
          color: embedColor,
          timestamp: alert.timestamp,
          fields: [
            { name: 'Borrower', value: `\`${alert.borrowerAddress}\``, inline: false },
            { name: 'Collateral', value: alert.collateralValueUsdFormatted, inline: true },
            { name: 'Debt', value: alert.debtValueUsdFormatted, inline: true },
            { name: 'Liq. Price', value: alert.liquidationPriceFormatted, inline: true },
            { name: 'Action Needed', value: alert.recommendedAction.actionSummary, inline: false },
          ],
        },
      ],
    };

    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        });
      } catch {
        // Fallback or offline mock
      }
    }

    return true;
  }
}

/**
 * In-memory ledger tracking all dispatched alerts for audit & testing.
 */
export class InMemoryAlertLedger implements AlertNotificationChannel {
  readonly channelName = 'InMemoryLedger';
  readonly dispatchedAlerts: LiquidationAlertPayload[] = [];

  async sendAlert(alert: LiquidationAlertPayload): Promise<boolean> {
    this.dispatchedAlerts.push(alert);
    return true;
  }

  clear(): void {
    this.dispatchedAlerts.length = 0;
  }
}
