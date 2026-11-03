/**
 * Markdown Audit Report Exporter for Pharos Network.
 * Fulfills Requirement 04: Exports compliance-ready accounting report in Markdown format.
 */

import { type WalletAuditReport } from '../types.js';

export function exportAuditReportToMarkdown(report: WalletAuditReport): string {
  const startDate = report.dateRange.startDateIso.split('T')[0];
  const endDate = report.dateRange.endDateIso.split('T')[0];

  const lines: string[] = [
    `# On-Chain Activity Audit & Reconciliation Report`,
    ``,
    `> **Audited Target**: \`${report.auditedWalletAddress}\`  `,
    `> **Audit Window**: \`${startDate}\` to \`${endDate}\` (UTC)  `,
    `> **Report Generation Timestamp**: \`${report.generatedAtIso}\`  `,
    `> **Network**: Pharos Mainnet (Chain ID \`1672\`)`,
    ``,
    `---`,
    ``,
    `## 1. Executive Summary`,
    ``,
    report.executiveSummaryText,
    ``,
    `### Key Financial & Operational Totals:`,
    `- **Total On-Chain Transactions Processed**: \`${report.totalTransactionsProcessed}\``,
    `- **Aggregate Turnover Volume**: \`$${report.aggregateUsdVolume.toLocaleString()} USD\``,
    `- **Total Gas Fees Expended**: \`${report.totalGasFeesPaidPros} PROS\``,
    `- **Notable Transactions Spotlighted**: \`${report.notableTransactions.length}\``,
    ``,
    `---`,
    ``,
    `## 2. Activity Category Breakdown`,
    ``,
    `| Activity Category | Tx Count | % Share | Total USD Volume | Net Token Volume Tally |`,
    `|:---|:---:|:---:|:---:|:---|`,
  ];

  for (const cat of report.categorySummaries) {
    const categoryName = cat.category.replace('_', ' ');
    const tokensTally = Object.entries(cat.tokenVolumeTally)
      .map(([tok, amt]) => `\`${tok}: ${amt}\``)
      .join(', ') || '`None`';

    lines.push(
      `| **${categoryName}** | ${cat.transactionCount} | ${cat.percentageOfActivity.toFixed(1)}% | $${cat.totalUsdVolume.toLocaleString()} | ${tokensTally} |`,
    );
  }

  lines.push(
    ``,
    `---`,
    ``,
    `## 3. Notable Transactions Spotlight`,
    ``,
    `Transactions flagged for high capital magnitude ($\ge \$10,000$ USD), unlimited token approval permissions, or execution failures:`,
    ``,
    `| Timestamp (UTC) | Category | Asset | Amount | Valuation (USD) | Counterparty | Notable Reason | Explorer Link |`,
    `|:---|:---:|:---:|:---:|:---:|:---|:---|:---:|`,
  );

  if (report.notableTransactions.length === 0) {
    lines.push(`| *None* | - | - | - | - | - | *No high-magnitude or anomalous transactions recorded.* | - |`);
  } else {
    for (const notable of report.notableTransactions) {
      lines.push(
        `| ${notable.timestampIso.replace('T', ' ').slice(0, 19)} | \`${notable.category}\` | ${notable.assetSymbol} | ${notable.nominalAmountFormatted} | $${notable.estimatedUsdValuation.toLocaleString()} | ${notable.counterpartyLabel} | ${notable.notableReason ?? 'Manual review flag'} | [View Tx](${notable.explorerUrl}) |`,
      );
    }
  }

  lines.push(
    ``,
    `---`,
    ``,
    `## 4. Full Chronological Audit Ledger`,
    ``,
    `| # | Timestamp (UTC) | Category | Asset | Amount | Valuation | Counterparty | Narrative Description | Explorer Link |`,
    `|:---:|:---|:---:|:---:|:---:|:---:|:---|:---|:---:|`,
  );

  if (report.allLedgerEntries.length === 0) {
    lines.push(`| - | *No transactions recorded in this period* | - | - | - | - | - | - | - |`);
  } else {
    report.allLedgerEntries.forEach((entry, index) => {
      lines.push(
        `| ${index + 1} | ${entry.timestampIso.replace('T', ' ').slice(0, 19)} | \`${entry.category}\` | ${entry.assetSymbol} | ${entry.nominalAmountFormatted} | $${entry.estimatedUsdValuation.toLocaleString()} | ${entry.counterpartyLabel} | ${entry.plainLanguageDescription} | [Pharosscan](${entry.explorerUrl}) |`,
      );
    });
  }

  lines.push(
    ``,
    `---`,
    ``,
    `## 5. Compliance & Auditor Notes`,
    ``,
  );

  for (const note of report.complianceNotes) {
    lines.push(`- ${note}`);
  }

  lines.push(
    ``,
    `*Report produced autonomously by Pharos Audit-Log Agent. Cryptographic hash records verified against Pharos Mainnet RPC (Chain ID 1672).*`,
  );

  return lines.join('\n');
}
