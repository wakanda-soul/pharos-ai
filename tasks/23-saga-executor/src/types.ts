/**
 * Domain types and schema models for the Pharos Saga Executor (SkillEngine).
 * Orchestrates multi-step on-chain workflows (Approve → Swap → Deposit) with
 * receipt verification, transient failure retry policies, and clean compensating rollbacks.
 */

import type { Address } from 'viem';

export type SagaExecutionPhase =
  | 'INITIALIZED'
  | 'IN_PROGRESS'
  | 'RETRYING'
  | 'STEP_CONFIRMED'
  | 'COMPENSATING'
  | 'COMPENSATED_CLEANLY'
  | 'COMPLETED_SUCCESS'
  | 'FAILED_FATAL';

export type SagaStepStatus =
  | 'PENDING'
  | 'EXECUTING'
  | 'CONFIRMED'
  | 'RETRYING'
  | 'FAILED'
  | 'COMPENSATING'
  | 'COMPENSATED';

export type TransientFailureCategory =
  | 'GAS_SPIKE_UNDERPRICED'
  | 'DROPPED_TRANSACTION'
  | 'NONCE_DESYNCHRONIZATION'
  | 'RPC_TIMEOUT'
  | 'UNKNOWN_TRANSIENT';

export interface SagaRetryPolicy {
  maximumRetryAttempts: number;
  initialBackoffMilliseconds: number;
  backoffMultiplier: number;
  gasPriceEscalationPercentage: number; // e.g. +20% gas price bump on replacement
}

export interface StepTransactionReceipt {
  transactionHash: `0x${string}`;
  blockNumber: number;
  status: 1 | 0; // 1 = Success, 0 = Revert
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  logsCount: number;
  explorerUrl: string;
}

export interface TokenAssetFlow {
  tokenSymbol: string;
  tokenAddress: Address;
  nominalAmount: string;
  usdValuation: number;
}

export interface SagaExecutionContext {
  sagaId: string;
  initiatorWalletAddress: Address;
  targetProtocolDirectory: Record<string, Address>;
  allocatedInputAsset: TokenAssetFlow;
  swappedIntermediateAsset?: TokenAssetFlow;
  depositedFinalAsset?: TokenAssetFlow & { poolAddress: Address };
  accumulatedGasExpensePros: number;
  stepOutputRegistry: Record<string, unknown>;
  forceFailureAtStepIndex?: number; // Injected for simulation testing of rollback paths
  executionNotes: string[];
}

export interface StepExecutionResult {
  transactionHash: `0x${string}`;
  receipt: StepTransactionReceipt;
  outputState: Record<string, unknown>;
  humanSummary: string;
}

export interface StepCompensationResult {
  compensationTxHash: `0x${string}`;
  compensationReceipt: StepTransactionReceipt;
  reversalSummary: string;
}

export interface SagaStepDefinition {
  stepIdentifier: string;
  stepName: string;
  orderIndex: number;
  forwardAction: (context: SagaExecutionContext, attempt: number) => Promise<StepExecutionResult>;
  compensatingRollback?: (context: SagaExecutionContext) => Promise<StepCompensationResult>;
}

export interface SagaStateTransitionEvent {
  eventId: string;
  timestampIso: string;
  sagaPhase: SagaExecutionPhase;
  stepIdentifier?: string;
  stepName?: string;
  orderIndex?: number;
  attemptNumber: number;
  transactionHash?: `0x${string}`;
  blockNumber?: number;
  stateDeltaDescription: string;
  errorMessage?: string;
}

export interface SagaExecutionReport {
  sagaId: string;
  startedAtIso: string;
  completedAtIso: string;
  finalPhase: SagaExecutionPhase;
  isFullySuccessful: boolean;
  wasCompensated: boolean;
  totalStepsDefined: number;
  stepsCompletedSuccessfully: number;
  compensatingStepsExecuted: number;
  totalGasExpendedPros: number;
  stateJournalEvents: SagaStateTransitionEvent[];
  finalContext: SagaExecutionContext;
  executiveSummary: string;
}
