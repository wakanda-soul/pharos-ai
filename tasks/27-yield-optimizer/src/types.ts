/**
 * Pharos Yield Optimizer - Domain Types & Schemas
 * 
 * Provides types for multi-vault yield comparison, switching friction,
 * holding period amortization, and non-custodial unsigned calldata synthesis.
 */

export interface YieldVenueRecord {
  readonly venueId: string;
  readonly protocolName: string;
  readonly vaultName: string;
  readonly contractAddress: `0x${string}`;
  readonly underlyingToken: string;
  readonly apyPercent: number;
  readonly tvlUsd: number;
  readonly entryFeeBps: number;
  readonly exitFeeBps: number;
  readonly lockupTenorDays: number;
  readonly riskScore: number; // 1-100 rating
  readonly isLive: boolean;
  readonly blockNumber: number;
  readonly explorerUrl: string;
}

export interface ItemizedSwitchingFriction {
  readonly exitFeeBps: number;
  readonly exitFeeUsd: number;
  readonly entryFeeBps: number;
  readonly entryFeeUsd: number;
  readonly estimatedGasUnits: number;
  readonly gasPriceGwei: number;
  readonly gasCostUsd: number;
  readonly totalFrictionUsd: number;
}

export type RebalanceDecision = 'REBALANCE_RECOMMENDED' | 'STAY_PUT';

export interface UnsignedRebalanceTransaction {
  readonly stepIndex: number;
  readonly actionDescription: string;
  readonly targetContract: `0x${string}`;
  readonly functionName: string;
  readonly calldata: `0x${string}`;
  readonly valueWei: string;
  readonly estimatedGasUnits: number;
  readonly castCommand: string;
}

export interface RebalanceEvaluationReport {
  readonly evaluationId: string;
  readonly sourceVenue: YieldVenueRecord;
  readonly targetVenue: YieldVenueRecord;
  readonly capitalAmountUsd: number;
  readonly holdingPeriodDays: number;
  readonly grossApySpread: number;
  readonly projectedGrossGainUsd: number;
  readonly switchingFriction: ItemizedSwitchingFriction;
  readonly projectedNetGainUsd: number;
  readonly netAnnualizedRoiPercent: number;
  readonly breakEvenDays: number;
  readonly decision: RebalanceDecision;
  readonly decisionRationale: string;
  readonly preparedTransactions: UnsignedRebalanceTransaction[];
  /** Non-custodial guarantee: strictly true (Req 04) */
  readonly agentHoldsKeys: false;
  readonly evaluatedAtIso: string;
}

export interface RebalanceEvaluationConfig {
  readonly minimumHoldingPeriodDays: number;
  readonly minimumNetGainHurdleUsd: number;
  readonly gasPriceGwei?: number;
  readonly nativeProsPriceUsd?: number;
}
