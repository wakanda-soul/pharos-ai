/**
 * Transient Fault Classifier & Gas Escalation Policy for Pharos Saga Executor (Requirement 02).
 * Differentiates transient network anomalies (gas spikes, dropped txs, RPC timeouts, nonce desyncs)
 * from fatal execution reverts, and computes exponential backoff delays with gas price escalation.
 */

import type { SagaRetryPolicy, TransientFailureCategory } from './types.js';

export const DEFAULT_SAGA_RETRY_POLICY: SagaRetryPolicy = {
  maximumRetryAttempts: 3,
  initialBackoffMilliseconds: 400,
  backoffMultiplier: 1.8,
  gasPriceEscalationPercentage: 20, // Bumps gas price by +20% on replacement transactions
};

export class FaultClassifier {
  private retryPolicy: SagaRetryPolicy;

  constructor(customPolicy?: Partial<SagaRetryPolicy>) {
    this.retryPolicy = {
      ...DEFAULT_SAGA_RETRY_POLICY,
      ...customPolicy,
    };
  }

  /**
   * Inspects error message and categorizes whether it can be retried as a transient failure.
   */
  public evaluateFailureSeverity(error: unknown): {
    isTransient: boolean;
    failureCategory?: TransientFailureCategory;
    remediationAdvice: string;
  } {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // 1. Gas spike / replacement underpriced
    if (
      message.includes('replacement transaction underpriced') ||
      message.includes('gas price too low') ||
      message.includes('max fee per gas less than block base fee') ||
      message.includes('intrinsic gas too low')
    ) {
      return {
        isTransient: true,
        failureCategory: 'GAS_SPIKE_UNDERPRICED',
        remediationAdvice: `Gas spike detected on Pharos Mainnet. Escalating gas price by +${this.retryPolicy.gasPriceEscalationPercentage}% and retrying with replacement tx.`,
      };
    }

    // 2. Dropped transaction / mempool eviction
    if (
      message.includes('transaction was not mined') ||
      message.includes('transaction pool is full') ||
      message.includes('dropped') ||
      message.includes('transaction indexing failed')
    ) {
      return {
        isTransient: true,
        failureCategory: 'DROPPED_TRANSACTION',
        remediationAdvice: 'Transaction dropped from mempool. Re-broadcasting with fresh nonce and higher tip.',
      };
    }

    // 3. Nonce desynchronization
    if (
      message.includes('nonce too low') ||
      message.includes('nonce has already been used') ||
      message.includes('invalid transaction nonce')
    ) {
      return {
        isTransient: true,
        failureCategory: 'NONCE_DESYNCHRONIZATION',
        remediationAdvice: 'Mempool nonce desync. Fetching latest on-chain transaction count and re-signing.',
      };
    }

    // 4. RPC network timeout or rate limit
    if (
      message.includes('timeout') ||
      message.includes('etimedout') ||
      message.includes('econnreset') ||
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('server error') ||
      message.includes('504 gateway timeout')
    ) {
      return {
        isTransient: true,
        failureCategory: 'RPC_TIMEOUT',
        remediationAdvice: 'RPC node rate-limit or network latency. Applying exponential backoff delay before retry.',
      };
    }

    // 5. Fatal errors (EVM reverts, insufficient balances, explicit slippage ceiling breaches)
    return {
      isTransient: false,
      remediationAdvice: 'Fatal on-chain execution error or EVM contract revert. Triggering compensating saga rollback to preserve funds.',
    };
  }

  /**
   * Calculates exponential backoff delay with millisecond jitter for a retry attempt.
   */
  public computeBackoffDelayMilliseconds(attemptNumber: number): number {
    const base = this.retryPolicy.initialBackoffMilliseconds;
    const factor = Math.pow(this.retryPolicy.backoffMultiplier, attemptNumber - 1);
    const jitter = Math.floor(Math.random() * 50); // 0-50ms jitter to avoid thundering herds
    return Math.floor(base * factor) + jitter;
  }

  /**
   * Computes the escalated gas price for a replacement transaction after a gas spike.
   */
  public computeEscalatedGasPrice(currentEffectiveGasPrice: bigint): bigint {
    const escalationNumerator = BigInt(100 + this.retryPolicy.gasPriceEscalationPercentage);
    return (currentEffectiveGasPrice * escalationNumerator) / 100n;
  }

  public getRetryPolicy(): SagaRetryPolicy {
    return { ...this.retryPolicy };
  }
}
