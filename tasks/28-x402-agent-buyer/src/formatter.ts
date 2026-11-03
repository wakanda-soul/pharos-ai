/**
 * Task 28: x402 Agent Buyer
 * Terminal Formatter: visually expressive tables, ledger cards, budget gauges,
 * and dual demo presentation formatters.
 */

import {
  SpendAuditJournalRecord,
  ItemizedPaymentReceipt,
  SpendBudgetPolicy,
} from './types.js';

export function formatProgressBar(current: number, total: number, width: number = 24): string {
  const ratio = Math.min(1, Math.max(0, current / total));
  const filledChars = Math.round(ratio * width);
  const emptyChars = width - filledChars;
  const percentage = (ratio * 100).toFixed(1);
  return `[${'█'.repeat(filledChars)}${'░'.repeat(emptyChars)}] ${percentage}% ($${current.toFixed(2)} / $${total.toFixed(2)} USDC)`;
}

export function formatSpendJournalTable(records: readonly SpendAuditJournalRecord[]): string {
  if (records.length === 0) {
    return '  (No entries recorded in audit journal)';
  }

  const lines: string[] = [];
  lines.push('  ┌─────┬───────────────────────────┬─────────┬───────────┬───────────┬──────────────────────┬──────────────────────┐');
  lines.push('  │ Seq │ Endpoint                  │ Price   │ Running   │ Remaining │ Status               │ Tx Hash / Note       │');
  lines.push('  ├─────┼───────────────────────────┼─────────┼───────────┼───────────┼──────────────────────┼──────────────────────┤');

  for (const rec of records) {
    const seq = rec.sequenceIndex.toString().padStart(3, ' ');
    const ep = rec.endpointUrl.padEnd(25, ' ').slice(0, 25);
    const price = `$${rec.chargedPriceUsdc.toFixed(2)}`.padStart(7, ' ');
    const running = `$${rec.runningTotalSpendUsdc.toFixed(2)}`.padStart(9, ' ');
    const remaining = `$${rec.remainingBudgetUsdc.toFixed(2)}`.padStart(9, ' ');

    let statusCol: string = rec.disposition;
    if (rec.disposition === 'SETTLED') statusCol = '🟢 SETTLED';
    else if (rec.disposition === 'HALTED_BUDGET_EXHAUSTED') statusCol = '🛑 HALTED (BUDGET)';
    else if (rec.disposition === 'REJECTED_PRICE_CAP') statusCol = '⚠️ REJECTED (CAP)';
    else if (rec.disposition === 'DEDUPLICATED_REPLAY_SKIPPED') statusCol = '♻️ REPLAY SKIPPED';
    statusCol = statusCol.padEnd(20, ' ').slice(0, 20);

    const note = (rec.transactionHash ? `${rec.transactionHash.slice(0, 10)}...${rec.transactionHash.slice(-6)}` : rec.disposition)
      .padEnd(20, ' ')
      .slice(0, 20);

    lines.push(`  │ ${seq} │ ${ep} │ ${price} │ ${running} │ ${remaining} │ ${statusCol} │ ${note} │`);
  }

  lines.push('  └─────┴───────────────────────────┴─────────┴───────────┴───────────┴──────────────────────┴──────────────────────┘');
  return lines.join('\n');
}

export function formatDemoHeader(demoTitle: string, description: string): string {
  const bar = '═'.repeat(74);
  return [
    `\n${bar}`,
    `  🤖 PHAROS x402 AGENT BUYER — ${demoTitle.toUpperCase()}`,
    `  ${description}`,
    `${bar}\n`,
  ].join('\n');
}
