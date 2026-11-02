/**
/**
 * Task 10: Dry-Run Executor Types & Data Models
 * Pre-flight transaction simulation and state-diff inspection engine for SkillEngine.
 */

export interface TransactionSimulationRequest {
  from?: `0x${string}`;
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint | string;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  description?: string;
}

export interface StateSnapshot {
  address: `0x${string}`;
  nativeBalanceWei: bigint;
  nativeBalanceFormatted: string;
  tokenBalanceRaw?: bigint;
  tokenBalanceFormatted?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  allowanceRaw?: bigint;
  allowanceFormatted?: string;
  nonce: number;
}

export interface StateDiff {
  senderPre: StateSnapshot;
  senderPost: StateSnapshot;
  recipientPre?: StateSnapshot;
  recipientPost?: StateSnapshot;
  netNativeDeltaWei: bigint;
  netNativeDeltaFormatted: string;
  netTokenDeltaRaw?: bigint;
  netTokenDeltaFormatted?: string;
  tokenSymbol?: string;
}

export interface GasEstimationBreakdown {
  gasLimitEstimated: bigint;
  gasPriceWei: bigint;
  gasPriceGwei: number;
  totalGasFeeWei: bigint;
  totalGasFeePros: string;
  totalGasFeeUsd?: number;
  oraclePriceUsd?: number;
}

export type RevertCategory =
  | 'INSUFFICIENT_FUNDS'
  | 'TRANSFER_EXCEEDS_BALANCE'
  | 'INSUFFICIENT_ALLOWANCE'
  | 'CUSTOM_REVERT'
  | 'INVALID_OPCODE'
  | 'OUT_OF_GAS'
  | 'UNKNOWN';

export interface PreparedExecution {
  castCommand: string;
  recommendedGasLimit: bigint;
  executionTicketHash: string;
  simulatedAtBlock: number;
}

export interface SimulationResult {
  simulationId: string;
  timestamp: string;
  network: string;
  chainId: number;
  blockNumber: number;
  status: 'SIMULATION_PASSED' | 'SIMULATION_REVERTED';
  gateVerdict: 'PROCEED_CLEARED' | 'EXECUTION_BLOCKED';
  canExecute: boolean;
  request: {
    from: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
    description?: string;
  };
  gasBreakdown?: GasEstimationBreakdown;
  revertReason?: string;
  revertData?: `0x${string}`;
  revertCategory?: RevertCategory;
  stateDiff?: StateDiff;
  preparedExecution?: PreparedExecution;
  diagnostics: string[];
}
