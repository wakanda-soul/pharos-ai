/**
 * Task 13: Gas Fee Optimizer Data Types & Interfaces
 * Temporal Volatility & Deadline Decay Dispatcher for Pharos Mainnet.
 */

export interface GasSnapshot {
  blockNumber: bigint;
  timestamp: string; // ISO 8601
  gasPriceGwei: number;
  baseFeeGwei?: number;
  priorityFeeGwei?: number;
}

export interface GasMarketStats {
  sampleCount: number;
  currentGwei: number;
  minGwei: number;
  maxGwei: number;
  avgGwei: number;
  medianGwei: number;
  p10Gwei: number;
  p25Gwei: number;
  p75Gwei: number;
  p90Gwei: number;
  stdDevGwei: number;
  trend: 'RISING' | 'FALLING' | 'STABLE';
  volatilityPercentage: number;
}

export interface QueuedTransaction {
  txId: string;
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gasLimit: bigint;
  description?: string;
  createdAt: number; // Unix ms
  deadline: number; // Unix ms
  requestGasPriceGwei: number;
  strategy: OptimizationStrategy;
}

export interface OptimizationStrategy {
  type: 'DYNAMIC_DECAY' | 'FIXED_THRESHOLD' | 'PERCENTILE_TARGET';
  targetPercentile?: number; // e.g. 20 (wait for bottom 20% gas price)
  fixedThresholdGwei?: number;
  maxAcceptableGwei?: number;
  decayExponent?: number; // gamma factor for reservation curve
  safetyMarginMs?: number; // default: 2000ms before deadline
}

export type ExecutionTrigger =
  | 'OPPORTUNISTIC_DIP' // Gas dropped below decaying threshold curve
  | 'DEADLINE_FORCED' // Deadline reached; submitted immediately regardless of gas
  | 'IMMEDIATE_MATCH'; // Current gas at request was already optimal

export interface ExecutionPostMortem {
  txId: string;
  trigger: ExecutionTrigger;
  status: 'SUBMITTED' | 'CONFIRMED' | 'REVERTED';
  requestTimestamp: string;
  executionTimestamp: string;
  durationWaitingMs: number;
  deadlineMs: number;
  timeRemainingAtExecutionMs: number;
  requestGasPriceGwei: number;
  executedGasPriceGwei: number;
  gasUnitsUsed: bigint;
  
  // Cost analysis
  costAtRequestPros: string;
  actualCostPaidPros: string;
  gasSavedGwei: number;
  gasSavedPercentage: number;
  prosSaved: string;
  usdSaved?: number;
  oraclePriceUsd?: number;

  // Audit trace & Command
  castCommand: string;
  priceTrajectory: Array<{
    timestamp: string;
    gasPriceGwei: number;
    reservationTargetGwei: number;
    isExecutionPoint?: boolean;
  }>;
}
