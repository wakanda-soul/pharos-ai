/**
 * Task 18: Liquidation Watchdog
 * Types, interfaces, and mathematical schemas for monitoring on-chain lending positions,
 * tracking health factors, and dispatching actionable mitigation alerts.
 */

export type RiskLevel = 'SAFE' | 'WARNING' | 'CRITICAL' | 'LIQUIDATION_IMMINENT';

export interface LendingAssetMetadata {
  readonly symbol: string;
  readonly name: string;
  readonly address: `0x${string}`;
  readonly decimals: number;
}

export interface LendingPositionSnapshot {
  readonly protocol: string; // e.g. "Morpho Blue" or "Harbor Lending"
  readonly borrowerAddress: `0x${string}`;
  readonly collateralAsset: LendingAssetMetadata;
  readonly debtAsset: LendingAssetMetadata;
  readonly collateralAmountRaw: bigint;
  readonly debtAmountRaw: bigint;
  readonly collateralAmountFormatted: number;
  readonly debtAmountFormatted: number;
  readonly collateralPriceUsd: number;
  readonly debtPriceUsd: number;
  readonly collateralValueUsd: number;
  readonly debtValueUsd: number;
  readonly liquidationThreshold: number; // e.g. 0.85 (85% LTV)
  readonly healthFactor: number;
  readonly currentLtv: number;
  readonly liquidationPriceUsd: number; // Price of collateral where HF = 1.0
  readonly queriedAtBlockNumber: number;
  readonly timestamp: string;
}

export interface WatchdogThresholdConfig {
  readonly warningHealthFactor: number; // e.g. 1.30
  readonly criticalHealthFactor: number; // e.g. 1.10
  readonly targetSafeHealthFactor: number; // e.g. 1.50 (used for remediation sizing)
  readonly minPollIntervalMs: number;
}

export interface RemediationActionPlan {
  readonly targetSafeHealthFactor: number;
  readonly debtRepaymentNeededUsd: number;
  readonly debtRepaymentUnits: number;
  readonly debtAssetSymbol: string;
  readonly additionalCollateralNeededUsd: number;
  readonly additionalCollateralUnits: number;
  readonly collateralAssetSymbol: string;
  readonly actionSummary: string;
}

export interface LiquidationAlertPayload {
  readonly alertId: string;
  readonly timestamp: string;
  readonly riskLevel: RiskLevel;
  readonly protocol: string;
  readonly borrowerAddress: `0x${string}`;
  readonly healthFactor: number;
  readonly currentLtvPercent: string;
  readonly collateralValueUsdFormatted: string;
  readonly debtValueUsdFormatted: string;
  readonly liquidationPriceFormatted: string;
  readonly bufferToLiquidationPercent: string;
  readonly recommendedAction: RemediationActionPlan;
}

export interface AlertNotificationChannel {
  readonly channelName: string;
  sendAlert(alert: LiquidationAlertPayload): Promise<boolean>;
}
