/**
 * Task 11: Batch Executor Types & Data Models
 * Multi-action bundling and gas-optimized execution engine for SkillEngine.
 */

export interface BatchAction {
  id: string;
  name: string;
  target: `0x${string}`;
  allowFailure: boolean;
  data: `0x${string}`;
  value?: bigint | string;
  description?: string;
}

export type ActionStatus = 'COMPLETED' | 'FAILED_ALLOWED' | 'FAILED_FATAL' | 'SKIPPED';

export interface ActionExecutionResult {
  index: number;
  actionId: string;
  actionName: string;
  target: `0x${string}`;
  allowFailure: boolean;
  success: boolean;
  returnData: `0x${string}`;
  decodedReturn?: string;
  revertReason?: string;
  status: ActionStatus;
}

export interface ActionGasItem {
  index: number;
  name: string;
  gasUnits: bigint;
}

export interface BatchGasEconomics {
  individualEstimatedGasTotal: bigint;
  individualStepCount: number;
  batchEstimatedGas: bigint;
  batchStepCount: number;
  gasSavedUnits: bigint;
  gasSavedPercentage: number;
  stepReductionPercentage: number;
  gasPriceGwei: number;
  nativeProsSaved: string;
  usdSaved?: number;
  oraclePriceUsd?: number;
  perActionGas: ActionGasItem[];
}

export interface PartialFailurePostMortem {
  failedIndex: number;
  failedActionId: string;
  failedActionName: string;
  target: `0x${string}`;
  revertReason: string;
  impactOnSubsequentActions: string;
}

export interface PreparedBatchTransaction {
  to: `0x${string}`;
  calldata: `0x${string}`;
  castCommand: string;
  recommendedGasLimit: bigint;
  totalCallsCount: number;
}

export interface BatchExecutionResult {
  batchId: string;
  timestamp: string;
  network: string;
  chainId: number;
  blockNumber: number;
  strategy: 'MULTICALL3_AGGREGATE3' | 'ATOMIC_PIPELINE';
  mode: 'FAULT_TOLERANT' | 'STRICT_ATOMIC';
  totalActions: number;
  successfulCount: number;
  failedCount: number;
  overallStatus: 'ALL_SUCCEEDED' | 'PARTIAL_FAILURE_HANDLED' | 'BATCH_REVERTED';
  actionResults: ActionExecutionResult[];
  partialFailurePostMortem?: PartialFailurePostMortem;
  gasEconomics: BatchGasEconomics;
  preparedBatchTransaction: PreparedBatchTransaction;
}
