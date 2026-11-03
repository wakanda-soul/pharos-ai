/**
 * Comprehensive Automated Verification Suite for Pharos Wallet Audit-Log Agent.
 * Validates Requirements 01-04:
 * 01: Accepts wallet address and arbitrary date range with strict temporal filtering
 * 02: Classifies transactions into 5 canonical categories (Transfers In/Out, Swaps, Approvals, Contract Calls)
 * 03: Calculates totals per category and spotlights notable transactions with explorer links
 * 04: Exports accounting reports to Markdown and CSV formats
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { type Address, parseEther } from 'viem';
import { WalletAuditEngine } from '../src/audit-aggregator.js';
import { parseAuditDateRange } from '../src/date-filter.js';
import { exportAuditReportToMarkdown } from '../src/exporters/markdown-exporter.js';
import { exportAuditReportToCsv } from '../src/exporters/csv-exporter.js';
import { type RawTransactionRecord } from '../src/types.js';

describe('Task 21: Audit-Log Agent Specification', () => {
  let engine: WalletAuditEngine;
  const targetWallet: Address = '0x1111222233334444555566667777888899990000';

  // Sample transactions spanning February 2026
  const MOCK_TRANSACTIONS: readonly RawTransactionRecord[] = [
    // Tx 1: Feb 5, 2026 - Transfer In: Received 10,000 USDC
    {
      txHash: '0xaaaa000100000000000000000000000000000000000000000000000000000001',
      blockNumber: 1500100n,
      blockTimestamp: 1770288000, // 2026-02-05T10:40:00Z
      fromAddress: '0x6000000000000000000000000000000000000001' as Address, // Binance
      toAddress: targetWallet,
      valueWei: 0n,
      gasUsed: 45000n,
      gasPriceGwei: 1.5,
      isSuccess: true,
      tokenTransfers: [
        {
          tokenSymbol: 'USDC',
          contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
          fromAddress: '0x6000000000000000000000000000000000000001' as Address,
          toAddress: targetWallet,
          rawAmount: 10_000n * 10n ** 6n, // 10,000 USDC ($10k - Notable)
          decimals: 6,
        },
      ],
    },
    // Tx 2: Feb 8, 2026 - Approval: Unlimited USDC approval to FaroSwap Router
    {
      txHash: '0xaaaa000200000000000000000000000000000000000000000000000000000002',
      blockNumber: 1500200n,
      blockTimestamp: 1770547200, // 2026-02-08T10:40:00Z
      fromAddress: targetWallet,
      toAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address, // USDC contract
      valueWei: 0n,
      gasUsed: 35000n,
      gasPriceGwei: 1.5,
      isSuccess: true,
      functionMethodName: 'approve',
      tokenApprovals: [
        {
          tokenSymbol: 'USDC',
          contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
          ownerAddress: targetWallet,
          spenderAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap Router
          rawAllowance: 2n ** 256n - 1n,
          isUnlimited: true,
        },
      ],
    },
    // Tx 3: Feb 10, 2026 - Swap: Swapped 5,000 USDC for 3,333 PROS on FaroSwap
    {
      txHash: '0xaaaa000300000000000000000000000000000000000000000000000000000003',
      blockNumber: 1500300n,
      blockTimestamp: 1770720000, // 2026-02-10T10:40:00Z
      fromAddress: targetWallet,
      toAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap Router
      valueWei: 0n,
      gasUsed: 120000n,
      gasPriceGwei: 2.0,
      isSuccess: true,
      functionMethodName: 'swapExactTokensForTokens',
      tokenTransfers: [
        {
          tokenSymbol: 'USDC',
          contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
          fromAddress: targetWallet,
          toAddress: '0x1000000000000000000000000000000000000001' as Address,
          rawAmount: 5_000n * 10n ** 6n,
          decimals: 6,
        },
        {
          tokenSymbol: 'PROS',
          contractAddress: '0x0000000000000000000000000000000000000003' as Address,
          fromAddress: '0x1000000000000000000000000000000000000001' as Address,
          toAddress: targetWallet,
          rawAmount: 3333n * 10n ** 18n,
          decimals: 18,
        },
      ],
    },
    // Tx 4: Feb 15, 2026 - Transfer Out: Native transfer of 1,000 PROS to external account
    {
      txHash: '0xaaaa000400000000000000000000000000000000000000000000000000000004',
      blockNumber: 1500400n,
      blockTimestamp: 1771152000, // 2026-02-15T10:40:00Z
      fromAddress: targetWallet,
      toAddress: '0x8888000000000000000000000000000000008888' as Address,
      valueWei: parseEther('1000'), // 1,000 PROS ($1,500 USD)
      gasUsed: 21000n,
      gasPriceGwei: 1.5,
      isSuccess: true,
    },
    // Tx 5: Feb 20, 2026 - Contract Interaction: Staking delegation on Pharos Foundation Reserve
    {
      txHash: '0xaaaa000500000000000000000000000000000000000000000000000000000005',
      blockNumber: 1500500n,
      blockTimestamp: 1771584000, // 2026-02-20T10:40:00Z
      fromAddress: targetWallet,
      toAddress: '0x4000000000000000000000000000000000000001' as Address, // Staking Reserve
      valueWei: parseEther('500'), // 500 PROS staked
      gasUsed: 65000n,
      gasPriceGwei: 1.5,
      functionMethodName: 'delegateStake',
      isSuccess: true,
    },
    // Tx 6: OUTSIDE RANGE: Jan 10, 2026 (Should be filtered out)
    {
      txHash: '0xaaaa000600000000000000000000000000000000000000000000000000000006',
      blockNumber: 1480000n,
      blockTimestamp: 1768041600, // 2026-01-10T10:40:00Z
      fromAddress: targetWallet,
      toAddress: '0x8888000000000000000000000000000000008888' as Address,
      valueWei: parseEther('100'),
      gasUsed: 21000n,
      gasPriceGwei: 1.5,
      isSuccess: true,
    },
  ];

  beforeEach(() => {
    engine = new WalletAuditEngine();
  });

  describe('Requirement 01: Accepts a wallet address and a date range', () => {
    it('parses valid ISO-8601 and YYYY-MM-DD date ranges accurately', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      expect(range.startDateIso).toBe('2026-02-01T00:00:00.000Z');
      expect(range.endDateIso).toBe('2026-02-28T23:59:59.999Z');
      expect(range.startTimestampMs).toBeLessThan(range.endTimestampMs);
    });

    it('rejects inverted or malformed date ranges with descriptive errors', () => {
      expect(() => parseAuditDateRange('2026-03-01', '2026-02-01')).toThrow(
        /Invalid date range: Start date.*cannot be after end date/,
      );
      expect(() => parseAuditDateRange('invalid-date', '2026-02-28')).toThrow(
        /Unrecognized date format/,
      );
    });

    it('filters transactions strictly within the target date range', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      // Total 6 mock txs, but Tx 6 occurred in January (outside range)
      expect(report.totalTransactionsProcessed).toBe(5);
      const txHashes = report.allLedgerEntries.map((e) => e.txHash);
      expect(txHashes).not.toContain(MOCK_TRANSACTIONS[5].txHash);
    });
  });

  describe('Requirement 02: Groups activity into 5 distinct categories', () => {
    it('categorizes transfers in, transfers out, swaps, approvals, and contract interactions', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      const categoriesPresent = report.allLedgerEntries.map((e) => e.category);
      expect(categoriesPresent).toContain('TRANSFER_IN');
      expect(categoriesPresent).toContain('TOKEN_APPROVAL');
      expect(categoriesPresent).toContain('DEX_SWAP');
      expect(categoriesPresent).toContain('TRANSFER_OUT');
      expect(categoriesPresent).toContain('CONTRACT_INTERACTION');
    });

    it('correctly classifies multi-token swaps with input/output pair labeling', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      const swapEntry = report.allLedgerEntries.find((e) => e.category === 'DEX_SWAP');
      expect(swapEntry).toBeDefined();
      expect(swapEntry?.counterpartyLabel).toContain('FaroSwap Router v1');
      expect(swapEntry?.assetSymbol).toBe('USDC ➔ PROS');
      expect(swapEntry?.plainLanguageDescription).toContain('Swapped 5000 USDC for 3333 PROS');
    });

    it('classifies token approvals as non-cashflow permissions', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      const approvalEntry = report.allLedgerEntries.find((e) => e.category === 'TOKEN_APPROVAL');
      expect(approvalEntry).toBeDefined();
      expect(approvalEntry?.nominalAmountFormatted).toContain('Unlimited');
      expect(approvalEntry?.estimatedUsdValuation).toBe(0); // Zero valuation impact
      expect(approvalEntry?.plainLanguageDescription).toContain('Granted unlimited USDC spending allowance');
    });
  });

  describe('Requirement 03: Category totals and notable transactions with links', () => {
    it('computes accurate category accounting summaries with transaction counts and USD volume', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      expect(report.categorySummaries.length).toBe(5);

      const transferInSummary = report.categorySummaries.find((c) => c.category === 'TRANSFER_IN');
      expect(transferInSummary?.transactionCount).toBe(1);
      expect(transferInSummary?.totalUsdVolume).toBe(10000); // 10k USDC

      const swapSummary = report.categorySummaries.find((c) => c.category === 'DEX_SWAP');
      expect(swapSummary?.transactionCount).toBe(1);
      expect(swapSummary?.totalUsdVolume).toBe(5000); // 5k USDC in

      const approvalSummary = report.categorySummaries.find((c) => c.category === 'TOKEN_APPROVAL');
      expect(approvalSummary?.transactionCount).toBe(1);
      expect(approvalSummary?.totalUsdVolume).toBe(0); // Non-cashflow
    });

    it('spotlights notable transactions with reasons and canonical Pharosscan links', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      expect(report.notableTransactions.length).toBeGreaterThanOrEqual(2);

      // Notable Tx 1: $10,000 capital magnitude
      const highValNotable = report.notableTransactions.find((n) => n.estimatedUsdValuation >= 10000);
      expect(highValNotable).toBeDefined();
      expect(highValNotable?.notableReason).toContain('High capital movement exceeding $10,000 threshold');
      expect(highValNotable?.explorerUrl).toBe(
        `https://pharosscan.xyz/tx/${highValNotable?.txHash}`,
      );

      // Notable Tx 2: Unlimited approval
      const approvalNotable = report.notableTransactions.find((n) => n.category === 'TOKEN_APPROVAL');
      expect(approvalNotable).toBeDefined();
      expect(approvalNotable?.notableReason).toContain('Unlimited token allowance');
      expect(approvalNotable?.explorerUrl).toMatch(/^https:\/\/pharosscan\.xyz\/tx\/0x[a-f0-9]{64}$/i);
    });
  });

  describe('Requirement 04: Exports the report as Markdown and CSV', () => {
    it('exports audit report in structured Markdown format', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      const markdown = exportAuditReportToMarkdown(report);

      expect(markdown).toContain('# On-Chain Activity Audit & Reconciliation Report');
      expect(markdown).toContain(targetWallet);
      expect(markdown).toContain('Executive Summary');
      expect(markdown).toContain('Activity Category Breakdown');
      expect(markdown).toContain('Notable Transactions Spotlight');
      expect(markdown).toContain('Full Chronological Audit Ledger');
      expect(markdown).toContain('https://pharosscan.xyz/tx/');
    });

    it('exports audit report in RFC-4180 compliant CSV format', () => {
      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      const csv = exportAuditReportToCsv(report);

      expect(csv).toContain('EntryId,TxHash,BlockNumber,TimestampIso,Category');
      expect(csv).toContain('TRANSFER_IN');
      expect(csv).toContain('DEX_SWAP');
      expect(csv).toContain('TOKEN_APPROVAL');
      expect(csv).toContain('https://pharosscan.xyz/tx/');

      const rows = csv.split('\r\n');
      expect(rows.length).toBe(1 + report.allLedgerEntries.length); // Header + entries
    });
  });

  describe('Edge Cases: Reverted transactions and empty date intervals', () => {
    it('tracks gas fees for reverted transactions with zero net turnover', () => {
      const revertedTx: RawTransactionRecord = {
        txHash: '0xaaaa009900000000000000000000000000000000000000000000000000000099',
        blockNumber: 1500999n,
        blockTimestamp: 1771900000, // 2026-02-24T00:00:00Z
        fromAddress: targetWallet,
        toAddress: '0x1000000000000000000000000000000000000001' as Address,
        valueWei: parseEther('50'),
        gasUsed: 80000n,
        gasPriceGwei: 2.0,
        isSuccess: false, // Reverted!
      };

      const range = parseAuditDateRange('2026-02-01', '2026-02-28');
      const report = engine.generateAuditReport(targetWallet, [revertedTx], range);

      expect(report.totalTransactionsProcessed).toBe(1);
      const entry = report.allLedgerEntries[0];
      expect(entry.estimatedUsdValuation).toBe(0); // Zero asset shift
      expect(entry.plainLanguageDescription).toContain('Failed / reverted transaction');
      expect(entry.isNotable).toBe(true);
      expect(entry.notableReason).toContain('reverted on-chain');
    });

    it('handles an empty date interval gracefully', () => {
      const range = parseAuditDateRange('2026-05-01', '2026-05-31'); // No transactions in May
      const report = engine.generateAuditReport(targetWallet, MOCK_TRANSACTIONS, range);

      expect(report.totalTransactionsProcessed).toBe(0);
      expect(report.aggregateUsdVolume).toBe(0);
      expect(report.allLedgerEntries).toHaveLength(0);
      expect(report.notableTransactions).toHaveLength(0);

      const md = exportAuditReportToMarkdown(report);
      expect(md).toContain('No transactions recorded in this period');
    });
  });
});
