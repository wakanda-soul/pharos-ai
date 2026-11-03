/**
 * Task 28: x402 Agent Buyer
 * Core protocol types, budget governance models, and audit journal schemas.
 * 
 * Implements strict financial guardrails for autonomous agents consuming
 * HTTP-402 micro-payment metered endpoints on Pharos Atlantic Testnet.
 */

export const PHAROS_ATLANTIC_CHAIN = {
  chainId: 688689,
  networkIdentifier: 'eip155:688689',
  networkName: 'Pharos Atlantic Testnet',
  rpcUrl: 'https://atlantic.dplabs-internal.com',
  explorerBaseUrl: 'https://atlantic-scan.pharos.xyz',
  testUsdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  usdcDecimals: 6,
} as const;

export type PaymentScheme = 'exact';

/**
 * Challenge payload returned by x402 paywall servers in the 402 Payment Required response.
 */
export interface X402PaymentRequirement {
  readonly scheme: PaymentScheme;
  readonly network: string; // e.g. "eip155:688689"
  readonly price: string; // decimal string e.g. "0.05"
  readonly currency: string; // "USDC"
  readonly tokenAddress: `0x${string}`;
  readonly payTo: `0x${string}`;
  readonly validUntilTimestamp: number; // Unix epoch seconds
  readonly paymentMemoId: string;
  readonly resourceDescription: string;
}

/**
 * Financial boundaries enforced before any signature or payment calldata is minted.
 */
export interface SpendBudgetPolicy {
  readonly totalSpendBudgetUsdc: number; // Maximum cumulative budget e.g. 0.20
  readonly maxPerCallLimitUsdc: number; // Hard ceiling for any single endpoint invocation e.g. 0.10
  readonly currency: 'USDC';
  readonly maxSafeRetries: number; // Default 3 retries
  readonly retryBackoffMs: number; // Base backoff delay
}

/**
 * Rejection reason codes when pre-flight budget or safety evaluation fails.
 */
export type BudgetRejectionReason =
  | 'PER_CALL_PRICE_CAP_EXCEEDED'
  | 'BUDGET_CEILING_EXHAUSTED'
  | 'UNSUPPORTED_CURRENCY_TOKEN'
  | 'CHALLENGE_TIMELOCK_EXPIRED'
  | 'RECIPIENT_ZERO_ADDRESS_FORBIDDEN';

/**
 * Pre-flight financial clearance report.
 */
export interface BudgetClearanceVerdict {
  readonly isApproved: boolean;
  readonly rejectionReason?: BudgetRejectionReason;
  readonly detailedDiagnostic: string;
  readonly proposedCostUsdc: number;
  readonly authorizedPerCallLimitUsdc: number;
  readonly historicalSpendTallyUsdc: number;
  readonly projectedCumulativeSpendUsdc: number;
  readonly remainingBudgetUsdc: number;
}

/**
 * Cryptographic receipt generated upon successful on-chain settlement and verification.
 */
export interface ItemizedPaymentReceipt {
  readonly receiptId: string;
  readonly idempotencyKey: string;
  readonly endpointUrl: string;
  readonly whatItBought: string;
  readonly chargedPriceUsdc: number;
  readonly currency: string;
  readonly transactionHash: `0x${string}`;
  readonly explorerUrl: string;
  readonly payerAddress: `0x${string}`;
  readonly recipientAddress: `0x${string}`;
  readonly settledAtIso: string;
  readonly runningTotalSpendUsdc: number;
  readonly remainingBudgetUsdc: number;
  readonly retryAttemptsUsed: number;
}

/**
 * Audit journal lifecycle state for each interaction.
 */
export type JournalEntryDisposition =
  | 'SETTLED'
  | 'REJECTED_PRICE_CAP'
  | 'HALTED_BUDGET_EXHAUSTED'
  | 'FAILED_RPC_ABORTED'
  | 'DEDUPLICATED_REPLAY_SKIPPED';

/**
 * Ledger entry persisted in the agent's spending journal.
 */
export interface SpendAuditJournalRecord {
  readonly sequenceIndex: number;
  readonly timestampIso: string;
  readonly endpointUrl: string;
  readonly whatItBought: string;
  readonly chargedPriceUsdc: number;
  readonly runningTotalSpendUsdc: number;
  readonly remainingBudgetUsdc: number;
  readonly disposition: JournalEntryDisposition;
  readonly transactionHash?: `0x${string}`;
  readonly idempotencyKey: string;
  readonly diagnosticNote: string;
}

/**
 * Caller intention to purchase an API resource.
 */
export interface APIPurchaseRequest {
  readonly endpointUrl: string;
  readonly intendedPurpose: string;
  readonly idempotencyKey: string;
  readonly requestBody?: Record<string, unknown>;
  readonly queryParameters?: Record<string, string>;
  readonly timeoutMs?: number;
}

/**
 * Final outcome returned to the high-level agent.
 */
export interface APIPurchaseOutcome<T = unknown> {
  readonly isSuccess: boolean;
  readonly httpStatusCode: number;
  readonly payload?: T;
  readonly paymentReceipt?: ItemizedPaymentReceipt;
  readonly failureReason?: string;
  readonly retryCount: number;
  readonly isReplayDeduplicated: boolean;
}
