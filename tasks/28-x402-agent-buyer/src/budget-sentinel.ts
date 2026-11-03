/**
 * Task 28: x402 Agent Buyer
 * Budget Sentinel: strict financial governance engine enforcing per-call caps,
 * cumulative expenditure limits, currency validation, and challenge expiration.
 */

import {
  PHAROS_ATLANTIC_CHAIN,
  SpendBudgetPolicy,
  X402PaymentRequirement,
  BudgetClearanceVerdict,
  BudgetRejectionReason,
} from './types.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Normalizes floating-point numbers to standard 6-decimal micro-dollar precision
 * to prevent IEEE 754 floating-point drift (e.g., 0.1 + 0.2 !== 0.3).
 */
export function roundToMicroUnits(amountUsdc: number): number {
  return Math.round(amountUsdc * 1_000_000) / 1_000_000;
}

export class SpendBudgetSentinel {
  private readonly policy: SpendBudgetPolicy;

  constructor(policy: SpendBudgetPolicy) {
    // Defensively enforce positive boundaries
    if (policy.totalSpendBudgetUsdc <= 0) {
      throw new Error(`Total spend budget must be greater than zero. Received: ${policy.totalSpendBudgetUsdc}`);
    }
    if (policy.maxPerCallLimitUsdc <= 0) {
      throw new Error(`Per-call limit must be greater than zero. Received: ${policy.maxPerCallLimitUsdc}`);
    }
    this.policy = {
      ...policy,
      totalSpendBudgetUsdc: roundToMicroUnits(policy.totalSpendBudgetUsdc),
      maxPerCallLimitUsdc: roundToMicroUnits(policy.maxPerCallLimitUsdc),
    };
  }

  public getPolicy(): SpendBudgetPolicy {
    return this.policy;
  }

  /**
   * Pre-flight clearance gate: evaluates whether a proposed payment requirement conforms
   * to all spend guardrails BEFORE signing calldata or committing on-chain gas.
   */
  public evaluatePreFlight(
    requirement: X402PaymentRequirement,
    currentCumulativeSpendUsdc: number,
    currentEpochSeconds: number = Math.floor(Date.now() / 1000)
  ): BudgetClearanceVerdict {
    const parsedCostUsdc = roundToMicroUnits(parseFloat(requirement.price));
    const safeHistoricalSpend = roundToMicroUnits(currentCumulativeSpendUsdc);
    const projectedCumulativeSpend = roundToMicroUnits(safeHistoricalSpend + parsedCostUsdc);
    const remainingBudgetBeforePurchase = roundToMicroUnits(
      Math.max(0, this.policy.totalSpendBudgetUsdc - safeHistoricalSpend)
    );

    // Guard 1: Verify token currency matches policy (strictly USDC)
    if (requirement.currency.toUpperCase() !== this.policy.currency) {
      return {
        isApproved: false,
        rejectionReason: 'UNSUPPORTED_CURRENCY_TOKEN',
        detailedDiagnostic: `Endpoint demanded payment in ${requirement.currency}, but agent is strictly configured for ${this.policy.currency}.`,
        proposedCostUsdc: parsedCostUsdc,
        authorizedPerCallLimitUsdc: this.policy.maxPerCallLimitUsdc,
        historicalSpendTallyUsdc: safeHistoricalSpend,
        projectedCumulativeSpendUsdc: projectedCumulativeSpend,
        remainingBudgetUsdc: remainingBudgetBeforePurchase,
      };
    }

    // Guard 2: Disallow zero address payment targets (prevents burning tokens or rogue redirects)
    if (!requirement.payTo || requirement.payTo.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return {
        isApproved: false,
        rejectionReason: 'RECIPIENT_ZERO_ADDRESS_FORBIDDEN',
        detailedDiagnostic: 'Payment requirement specifies 0x0 recipient address, which constitutes an unsafe burn.',
        proposedCostUsdc: parsedCostUsdc,
        authorizedPerCallLimitUsdc: this.policy.maxPerCallLimitUsdc,
        historicalSpendTallyUsdc: safeHistoricalSpend,
        projectedCumulativeSpendUsdc: projectedCumulativeSpend,
        remainingBudgetUsdc: remainingBudgetBeforePurchase,
      };
    }

    // Guard 3: Challenge expiration check (reject stale challenges to avoid expired nonces)
    if (requirement.validUntilTimestamp <= currentEpochSeconds) {
      return {
        isApproved: false,
        rejectionReason: 'CHALLENGE_TIMELOCK_EXPIRED',
        detailedDiagnostic: `Payment challenge expired at timestamp ${requirement.validUntilTimestamp} (current: ${currentEpochSeconds}). Refusing stale payment request.`,
        proposedCostUsdc: parsedCostUsdc,
        authorizedPerCallLimitUsdc: this.policy.maxPerCallLimitUsdc,
        historicalSpendTallyUsdc: safeHistoricalSpend,
        projectedCumulativeSpendUsdc: projectedCumulativeSpend,
        remainingBudgetUsdc: remainingBudgetBeforePurchase,
      };
    }

    // Guard 4: Enforce Per-Call Price Cap
    if (parsedCostUsdc > this.policy.maxPerCallLimitUsdc) {
      return {
        isApproved: false,
        rejectionReason: 'PER_CALL_PRICE_CAP_EXCEEDED',
        detailedDiagnostic: `Endpoint price $${parsedCostUsdc.toFixed(4)} USDC exceeds per-call safety ceiling of $${this.policy.maxPerCallLimitUsdc.toFixed(4)} USDC. Call refused.`,
        proposedCostUsdc: parsedCostUsdc,
        authorizedPerCallLimitUsdc: this.policy.maxPerCallLimitUsdc,
        historicalSpendTallyUsdc: safeHistoricalSpend,
        projectedCumulativeSpendUsdc: projectedCumulativeSpend,
        remainingBudgetUsdc: remainingBudgetBeforePurchase,
      };
    }

    // Guard 5: Enforce Total Spend Budget Ceiling
    if (projectedCumulativeSpend > this.policy.totalSpendBudgetUsdc) {
      return {
        isApproved: false,
        rejectionReason: 'BUDGET_CEILING_EXHAUSTED',
        detailedDiagnostic: `Executing payment ($${parsedCostUsdc.toFixed(4)} USDC) would breach total spend ceiling ($${projectedCumulativeSpend.toFixed(4)} > $${this.policy.totalSpendBudgetUsdc.toFixed(4)} USDC). Remaining budget is only $${remainingBudgetBeforePurchase.toFixed(4)} USDC. Agent halting.`,
        proposedCostUsdc: parsedCostUsdc,
        authorizedPerCallLimitUsdc: this.policy.maxPerCallLimitUsdc,
        historicalSpendTallyUsdc: safeHistoricalSpend,
        projectedCumulativeSpendUsdc: projectedCumulativeSpend,
        remainingBudgetUsdc: remainingBudgetBeforePurchase,
      };
    }

    // All financial guardrails passed
    const remainingBudgetAfterPurchase = roundToMicroUnits(
      this.policy.totalSpendBudgetUsdc - projectedCumulativeSpend
    );

    return {
      isApproved: true,
      detailedDiagnostic: `Payment of $${parsedCostUsdc.toFixed(4)} USDC cleared within bounds (cap: $${this.policy.maxPerCallLimitUsdc.toFixed(4)}, remaining after call: $${remainingBudgetAfterPurchase.toFixed(4)} USDC).`,
      proposedCostUsdc: parsedCostUsdc,
      authorizedPerCallLimitUsdc: this.policy.maxPerCallLimitUsdc,
      historicalSpendTallyUsdc: safeHistoricalSpend,
      projectedCumulativeSpendUsdc: projectedCumulativeSpend,
      remainingBudgetUsdc: remainingBudgetAfterPurchase,
    };
  }
}
