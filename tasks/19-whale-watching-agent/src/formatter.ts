/**
 * Terminal UI Formatter for Pharos Whale-Watching Agent.
 * Renders high-impact capital flow alerts, entity tags, and cross-whale activity tables.
 */

import {
  type CounterpartyEntityCategory,
  type WatchedWhaleAddress,
  type WhaleActivityDigest,
  type WhaleCapitalFlowEvent,
} from './types.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

function getCategoryColor(category: CounterpartyEntityCategory): string {
  switch (category) {
    case 'DEX':
      return c.cyan;
    case 'LENDING':
      return c.green;
    case 'CEX':
      return c.yellow;
    case 'TREASURY':
      return c.magenta;
    case 'BRIDGE':
      return c.blue;
    case 'SYSTEM_NULL':
      return c.red;
    default:
      return c.dim;
  }
}

export function formatWhaleFlowBanner(event: WhaleCapitalFlowEvent): string {
  const categoryColor = getCategoryColor(event.counterpartyCategory);
  const formattedUsd =
    event.estimatedUsdValuation > 0
      ? ` [$${event.estimatedUsdValuation.toLocaleString()} USD]`
      : '';

  const lines = [
    `┌─────────────────────────────────────────────────────────────────────────────┐`,
    `│ ${c.bold}${c.magenta}🐋 WHALE CAPITAL FLOW DETECTED${c.reset}  ${c.dim}${event.timestampIso}${c.reset}`.padEnd(85) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}Whale:${c.reset}        ${c.bold}${event.whaleMoniker}${c.reset} (${c.dim}${event.whaleAddress.slice(0, 8)}...${event.whaleAddress.slice(-6)}${c.reset})`.padEnd(95) + '│',
    `│  ${c.bold}Asset:${c.reset}        ${c.bold}${c.green}${event.formattedAmount} ${event.token.symbol}${c.reset}${c.yellow}${formattedUsd}${c.reset}`.padEnd(95) + '│',
    `│  ${c.bold}Flow Action:${c.reset}  ${c.bold}${event.flowDirection}${c.reset}`.padEnd(85) + '│',
    `│  ${c.bold}Destination:${c.reset}  ${categoryColor}${c.bold}[${event.counterpartyCategory}]${c.reset} ${event.counterpartyLabel}`.padEnd(95) + '│',
    `│  ${c.bold}Tx Hash:${c.reset}      ${c.dim}${event.txHash.slice(0, 18)}...${event.txHash.slice(-8)}${c.reset}`.padEnd(85) + '│',
    `│  ${c.bold}Trigger:${c.reset}      ${c.dim}${event.significanceReason}${c.reset}`.padEnd(85) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}${c.cyan}Context & Market Explanation:${c.reset}`.padEnd(85) + '│',
    `│  ${c.white}${event.narrativeExplanation}${c.reset}`.padEnd(85) + '│',
    `└─────────────────────────────────────────────────────────────────────────────┘`,
  ];

  return lines.join('\n');
}

export function formatWatchedWhalesTable(whales: readonly WatchedWhaleAddress[]): string {
  const lines: string[] = [
    `${c.bold}${c.cyan}━━━ Monitored Whale Roster (${whales.length} Active Addresses) ━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
  ];

  whales.forEach((whale, index) => {
    const customThresholdStr = whale.customThresholdUsd
      ? `${c.yellow}$${whale.customThresholdUsd.toLocaleString()} USD${c.reset}`
      : `${c.dim}Global Default ($50k)${c.reset}`;

    lines.push(
      `  ${c.bold}${index + 1}.${c.reset} ${c.bold}${whale.moniker}${c.reset}`,
      `     Address:   ${c.dim}${whale.address}${c.reset}`,
      `     Tags:      ${whale.tags.map((t) => `${c.blue}[${t}]${c.reset}`).join(' ')}`,
      `     Threshold: ${customThresholdStr}`,
      `     Notes:     ${c.dim}${whale.notes ?? 'None'}${c.reset}`,
      '',
    );
  });

  return lines.join('\n');
}

export function formatActivitySummaryDigest(digest: WhaleActivityDigest): string {
  const lines: string[] = [
    `┌─────────────────────────────────────────────────────────────────────────────┐`,
    `│ ${c.bold}${c.cyan}📊 PHAROS CROSS-WHALE ACTIVITY SUMMARY DIGEST${c.reset}`.padEnd(85) + '│',
    `│ ${c.dim}Surveillance Period: Live Session Snapshot · ${digest.digestGeneratedAtIso}${c.reset}`.padEnd(85) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  • ${c.bold}Monitored Whales:${c.reset}       ${c.bold}${digest.monitoredWhaleCount}${c.reset} high-net-worth accounts`.padEnd(85) + '│',
    `│  • ${c.bold}Flow Events Captured:${c.reset}   ${c.bold}${digest.totalFlowEventsCaptured}${c.reset} high-impact movements`.padEnd(85) + '│',
    `│  • ${c.bold}Aggregate USD Volume:${c.reset}   ${c.bold}${c.green}$${digest.aggregateVolumeUsd.toLocaleString()} USD${c.reset}`.padEnd(95) + '│',
    `│  • ${c.bold}Peak Single Move:${c.reset}       ${c.bold}${c.yellow}$${digest.peakSingleMoveUsd.toLocaleString()} USD${c.reset}`.padEnd(95) + '│',
    `│  • ${c.bold}Most Active Mover:${c.reset}      ${digest.mostActiveWhaleMoniker}`.padEnd(85) + '│',
    `│  • ${c.bold}Top Target Sector:${c.reset}      ${getCategoryColor(digest.topDestinationCategory)}${c.bold}[${digest.topDestinationCategory}]${c.reset}`.padEnd(95) + '│',
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}Sector Capital Flow Distribution:${c.reset}`.padEnd(85) + '│',
  ];

  if (digest.protocolDistribution.length === 0) {
    lines.push(`│  ${c.dim}No sector volume recorded yet${c.reset}`.padEnd(85) + '│');
  } else {
    for (const dist of digest.protocolDistribution) {
      const color = getCategoryColor(dist.category);
      const barLength = Math.max(1, Math.round(dist.percentageOfTotal / 4));
      const bar = '█'.repeat(barLength).padEnd(25, '░');
      lines.push(
        `│   ${color}${dist.category.padEnd(12)}${c.reset} ${bar} ${dist.percentageOfTotal.toFixed(1)}% ($${dist.totalUsdVolume.toLocaleString()} USD across ${dist.transferCount} txs)`.padEnd(95) + '│',
      );
    }
  }

  lines.push(
    `├─────────────────────────────────────────────────────────────────────────────┤`,
    `│  ${c.bold}Recent Whale Flow Feed (Reverse Chronological):${c.reset}`.padEnd(85) + '│',
  );

  if (digest.recentFlows.length === 0) {
    lines.push(`│  ${c.dim}No qualifying flows captured during window${c.reset}`.padEnd(85) + '│');
  } else {
    for (const flow of digest.recentFlows.slice(0, 5)) {
      lines.push(
        `│   • ${c.bold}${flow.whaleMoniker.slice(0, 24).padEnd(24)}${c.reset} ➔ ${c.green}${flow.formattedAmount.padStart(9)} ${flow.token.symbol.padEnd(5)}${c.reset} ➔ ${flow.counterpartyLabel.slice(0, 26)}`.padEnd(95) + '│',
      );
    }
  }

  lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
  return lines.join('\n');
}
