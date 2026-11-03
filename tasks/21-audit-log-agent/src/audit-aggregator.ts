/**
 * Accounting Ledger Aggregator & Audit Report Synthesizer for Pharos Network.
 * Fulfills Requirement 03: Produces category accounting totals, compiles notable transactions
 * with explorer links, and generates executive compliance summaries.
 */

import { type Address, getAddress } from 'viem';
import {
  type AuditActivityCategory,
  type AuditDateRange,
  type CategorizedLedgerEntry,
  type CategoryAccountingSummary,
  type RawTransactionRecord,
  type WalletAuditReport,
} from './types.js';
import { isWithinDateRange } from './date-filter.js';
import { ActivityCategorizer } from './activity-categorizer.js';

export const ALL_AUDIT_CATEGORIES: readonly AuditActivityCategory[] = [
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'DEX_SWAP',
  'TOKEN_APPROVAL',
  'CONTRACT_INTERACTION',
];

export class WalletAuditEngine {
  private readonly categorizer: ActivityCategorizer;

  constructor(customCategorizer?: ActivityCategorizer) {
    this.categorizer = customCategorizer ?? new ActivityCategorizer();
  }

  /**
   * Evaluates all historical transactions for the target wallet,
   * applies the temporal date window filter, groups into categories,
   * and compiles the final compliance audit report.
   */
  public generateAuditReport(
    targetWallet: Address,
    transactionHistory: readonly RawTransactionRecord[],
    dateRange: AuditDateRange,
  ): WalletAuditReport {
    const checksummedWallet = getAddress(targetWallet);

    // 1. Apply date range filter (Requirement 01)
    const inRangeTransactions = transactionHistory.filter((tx) =>
      isWithinDateRange(tx.blockTimestamp, dateRange),
    );

    // 2. Categorize all qualifying transactions (Requirement 02)
    const allLedgerEntries: CategorizedLedgerEntry[] = inRangeTransactions.map((tx) =>
      this.categorizer.categorizeTransaction(tx, checksummedWallet),
    );

    // Sort entries chronologically (oldest to newest for accounting ledger)
    allLedgerEntries.sort(
      (a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime(),
    );

    // 3. Compute Category Totals (Requirement 03)
    const categorySummaries = this.computeCategoryAccountingSummaries(
      allLedgerEntries,
      inRangeTransactions.length,
    );

    // 4. Extract Notable Transactions with links (Requirement 03)
    const notableTransactions = allLedgerEntries.filter((e) => e.isNotable);

    // 5. Aggregate totals
    let aggregateUsdVolume = 0;
    let totalGasFeesFloat = 0;

    for (const entry of allLedgerEntries) {
      aggregateUsdVolume += entry.estimatedUsdValuation;
      totalGasFeesFloat += parseFloat(entry.gasFeePaidPros || '0');
    }

    const executiveSummaryText = this.formulateExecutiveSummary({
      wallet: checksummedWallet,
      totalTxs: inRangeTransactions.length,
      aggregateUsd: aggregateUsdVolume,
      categorySummaries,
      notableCount: notableTransactions.length,
      dateRange,
    });

    const complianceNotes = this.formulateComplianceNotes(
      allLedgerEntries,
      notableTransactions,
    );

    return {
      reportId: `audit-rpt-${checksummedWallet.slice(0, 8)}-${Date.now()}`,
      auditedWalletAddress: checksummedWallet,
      dateRange,
      generatedAtIso: new Date().toISOString(),
      totalTransactionsProcessed: inRangeTransactions.length,
      aggregateUsdVolume: Math.round(aggregateUsdVolume * 100) / 100,
      totalGasFeesPaidPros: totalGasFeesFloat.toFixed(6),
      categorySummaries,
      notableTransactions,
      allLedgerEntries,
      executiveSummaryText,
      complianceNotes,
    };
  }

  private computeCategoryAccountingSummaries(
    entries: readonly CategorizedLedgerEntry[],
    totalTxs: number,
  ): readonly CategoryAccountingSummary[] {
    const map = new Map<
      AuditActivityCategory,
      { count: number; usdVolume: number; tokens: Map<string, number> }
    >();

    for (const cat of ALL_AUDIT_CATEGORIES) {
      map.set(cat, { count: 0, usdVolume: 0, tokens: new Map() });
    }

    for (const entry of entries) {
      const stats = map.get(entry.category)!;
      stats.count += 1;
      stats.usdVolume += entry.estimatedUsdValuation;

      if (entry.assetSymbol && entry.assetSymbol !== 'N/A') {
        const cleanNominal = parseFloat(entry.nominalAmountFormatted.replace(/[^0-9.-]/g, '')) || 0;
        const currentTokenSum = stats.tokens.get(entry.assetSymbol) ?? 0;
        stats.tokens.set(entry.assetSymbol, currentTokenSum + cleanNominal);
      }
    }

    return ALL_AUDIT_CATEGORIES.map((category) => {
      const stats = map.get(category)!;
      const percentage =
        totalTxs > 0 ? Math.round((stats.count / totalTxs) * 1000) / 10 : 0;

      const tokenVolumeTally: Record<string, string> = {};
      for (const [token, amount] of stats.tokens.entries()) {
        const sign = amount > 0 ? '+' : '';
        tokenVolumeTally[token] = `${sign}${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
      }

      return {
        category,
        transactionCount: stats.count,
        totalUsdVolume: Math.round(stats.usdVolume * 100) / 100,
        percentageOfActivity: percentage,
        tokenVolumeTally,
      };
    });
  }

  private formulateExecutiveSummary(params: {
    wallet: Address;
    totalTxs: number;
    aggregateUsd: number;
    categorySummaries: readonly CategoryAccountingSummary[];
    notableCount: number;
    dateRange: AuditDateRange;
  }): string {
    const startDate = params.dateRange.startDateIso.split('T')[0];
    const endDate = params.dateRange.endDateIso.split('T')[0];

    const activeCategories = params.categorySummaries
      .filter((c) => c.transactionCount > 0)
      .map((c) => `${c.category.replace('_', ' ')} (${c.transactionCount} txs, $${c.totalUsdVolume.toLocaleString()} USD)`)
      .join('; ');

    return `Compliance Audit Report for wallet ${params.wallet} covering the period from ${startDate} to ${endDate}. Total on-chain activity comprises ${params.totalTxs} transactions representing an aggregate turnover of $${params.aggregateUsd.toLocaleString()} USD. Breakdown by category: ${activeCategories || 'None'}. Spotlighted ${params.notableCount} notable event(s) requiring compliance review.`;
  }

  private formulateComplianceNotes(
    entries: readonly CategorizedLedgerEntry[],
    notable: readonly CategorizedLedgerEntry[],
  ): readonly string[] {
    const notes: string[] = [];

    const approvalEntries = entries.filter((e) => e.category === 'TOKEN_APPROVAL');
    if (approvalEntries.some((e) => e.nominalAmountFormatted.includes('Unlimited'))) {
      notes.push(
        'Audit Observation: Wallet maintains active unlimited (MaxUint256) ERC-20 allowances. Recommended security action: review and revoke unneeded spender permissions.',
      );
    }

    const highValueEntries = notable.filter((e) => e.estimatedUsdValuation >= 10000);
    if (highValueEntries.length > 0) {
      notes.push(
        `Financial Materiality: Detected ${highValueEntries.length} high-value transaction(s) >= $10,000 USD requiring ledger reconciliation for fiscal compliance.`,
      );
    }

    const failedEntries = entries.filter((e) => e.plainLanguageDescription.includes('failed'));
    if (failedEntries.length > 0) {
      notes.push(
        `Operational Integrity: Recorded ${failedEntries.length} reverted/failed transaction execution(s) on-chain during this audit window.`,
      );
    }

    if (notes.length === 0) {
      notes.push('Clean Audit Posture: All transactions reconciled within standard operating risk parameters.');
    }

    return notes;
  }
}
