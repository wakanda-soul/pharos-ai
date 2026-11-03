/**
 * Domain types and schemas for Pharos Wallet Audit-Log Agent.
 * Generates accounting-grade, plain-language activity summaries for compliance officers,
 * categorizing transfers, swaps, approvals, and contract calls over arbitrary date ranges.
 */

import { type Address, type Hash } from 'viem';

export type AuditActivityCategory =
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'DEX_SWAP'
  | 'TOKEN_APPROVAL'
  | 'CONTRACT_INTERACTION';

export interface AuditDateRange {
  readonly startDateIso: string;
  readonly endDateIso: string;
  readonly startTimestampMs: number;
  readonly endTimestampMs: number;
}

export interface Erc20TransferSubEvent {
  readonly tokenSymbol: string;
  readonly contractAddress: Address;
  readonly fromAddress: Address;
  readonly toAddress: Address;
  readonly rawAmount: bigint;
  readonly decimals: number;
  readonly fallbackUsdPrice?: number;
}

export interface Erc20ApprovalSubEvent {
  readonly tokenSymbol: string;
  readonly contractAddress: Address;
  readonly ownerAddress: Address;
  readonly spenderAddress: Address;
  readonly rawAllowance: bigint;
  readonly isUnlimited: boolean;
}

export interface RawTransactionRecord {
  readonly txHash: Hash;
  readonly blockNumber: bigint;
  readonly blockTimestamp: number; // Unix seconds
  readonly fromAddress: Address;
  readonly toAddress: Address;
  readonly valueWei: bigint;
  readonly gasPriceGwei?: number;
  readonly gasUsed?: bigint;
  readonly isSuccess: boolean;
  readonly functionMethodName?: string;
  readonly inputData?: `0x${string}`;
  readonly tokenTransfers?: readonly Erc20TransferSubEvent[];
  readonly tokenApprovals?: readonly Erc20ApprovalSubEvent[];
}

export interface CategorizedLedgerEntry {
  readonly entryId: string;
  readonly txHash: Hash;
  readonly blockNumber: bigint;
  readonly timestampIso: string;
  readonly category: AuditActivityCategory;
  readonly counterpartyAddress: Address;
  readonly counterpartyLabel: string;
  readonly assetSymbol: string;
  readonly nominalAmountFormatted: string;
  readonly estimatedUsdValuation: number;
  readonly gasFeePaidPros: string;
  readonly isNotable: boolean;
  readonly notableReason?: string;
  readonly plainLanguageDescription: string;
  readonly explorerUrl: string;
}

export interface CategoryAccountingSummary {
  readonly category: AuditActivityCategory;
  readonly transactionCount: number;
  readonly totalUsdVolume: number;
  readonly percentageOfActivity: number;
  readonly tokenVolumeTally: Record<string, string>;
}

export interface WalletAuditReport {
  readonly reportId: string;
  readonly auditedWalletAddress: Address;
  readonly dateRange: AuditDateRange;
  readonly generatedAtIso: string;
  readonly totalTransactionsProcessed: number;
  readonly aggregateUsdVolume: number;
  readonly totalGasFeesPaidPros: string;
  readonly categorySummaries: readonly CategoryAccountingSummary[];
  readonly notableTransactions: readonly CategorizedLedgerEntry[];
  readonly allLedgerEntries: readonly CategorizedLedgerEntry[];
  readonly executiveSummaryText: string;
  readonly complianceNotes: readonly string[];
}
