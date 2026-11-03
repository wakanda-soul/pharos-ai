/**
 * Terminal UI Formatter for Pharos Wallet Audit-Log Agent.
 * Renders executive accounting summaries, category volume breakdowns,
 * and chronological ledger tables with ANSI color highlighting.
 */

import { type WalletAuditReport } from './types.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
};

export function formatAuditReportTerminal(report: WalletAuditReport): string {
  const startDate = report.dateRange.startDateIso.split('T')[0];
  const endDate = report.dateRange.endDateIso.split('T')[0];

  const lines: string[] = [
    `┌─────────────────────────────────────────────────────────────────────────────┐`,
    `│ ${c.bold}${c.cyan}📋 PHAROS ON-CHAIN WALLET AUDIT & RECONCILIATION LEDGER${c.reset}`.padEnd(85) + '│',
    `│ ${c.dim}Audit Window: ${startDate} to ${endDate} (UTC) · Pharos Mainnet (Chain ID 1672)${c.reset}`.padEnd(85) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}Audited Wallet:${c.reset}  ${c.bold}${report.auditedWalletAddress}${c.reset}`.padEnd(85) + '│',
    `│  ${c.bold}Transactions:${c.reset}    ${report.totalTransactionsProcessed} in-scope txs (Gas Expended: ${report.totalGasFeesPaidPros} PROS)`.padEnd(85) + '│',
    `│  ${c.bold}Turnover Volume:${c.reset} ${c.bold}${c.green}$${report.aggregateUsdVolume.toLocaleString()} USD${c.reset}`.padEnd(95) + '│',
    `│  ${c.bold}Notable Events:${c.reset}  ${c.yellow}${report.notableTransactions.length} transaction(s) flagged for compliance review${c.reset}`.padEnd(95) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}Activity Breakdown by Category:${c.reset}`.padEnd(85) + '│',
  ];

  for (const cat of report.categorySummaries) {
    const barBlocks = Math.max(0, Math.round(cat.percentageOfActivity / 5));
    const bar = '█'.repeat(barBlocks).padEnd(20, '░');
    const catName = cat.category.padEnd(20);
    const usd = `$${cat.totalUsdVolume.toLocaleString()} USD`.padStart(15);
    lines.push(
      `│   • ${c.bold}${catName}${c.reset} [${bar}] ${cat.percentageOfActivity.toFixed(1)}% (${cat.transactionCount} txs, ${usd})`.padEnd(95) + '│',
    );
  }

  lines.push(
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}${c.magenta}Notable Transactions Spotlight (${report.notableTransactions.length} Flagged):${c.reset}`.padEnd(85) + '│',
  );

  if (report.notableTransactions.length === 0) {
    lines.push(`│   ${c.dim}No high-magnitude or anomalous transactions recorded.${c.reset}`.padEnd(85) + '│');
  } else {
    for (const notable of report.notableTransactions) {
      lines.push(
        `│   • ${c.bold}${notable.timestampIso.split('T')[0]}${c.reset} [${c.yellow}${notable.category}${c.reset}] ${notable.plainLanguageDescription}`.padEnd(95) + '│',
        `│     ${c.dim}Reason: ${notable.notableReason} · ${notable.explorerUrl}${c.reset}`.padEnd(95) + '│',
        `│`.padEnd(78) + '│',
      );
    }
  }

  lines.push(
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}Executive Summary & Compliance Notes:${c.reset}`.padEnd(85) + '│',
    `│  ${report.executiveSummaryText}`.padEnd(85) + '│',
    `│`.padEnd(78) + '│',
  );

  for (const note of report.complianceNotes) {
    lines.push(`│  • ${c.white}${note}${c.reset}`.padEnd(85) + '│');
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
  return lines.join('\n');
}
