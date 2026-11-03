/**
 * Terminal Scorecard & Waterfall Breakdown Formatter for Pharos Arbitrage Scanner.
 * Renders rich ASCII arbitrage scorecards with friction cost waterfalls and simulation links.
 */

import type { ArbitrageOpportunityRecord } from './types.js';

export function formatArbitrageOpportunityTerminal(
  opp: ArbitrageOpportunityRecord,
  titleBadge: string,
): string {
  const lines: string[] = [];
  const hr = '─'.repeat(75);
  const boxTop = '┌' + '─'.repeat(77) + '┐';
  const boxBottom = '└' + '─'.repeat(77) + '┘';

  const isExecute = opp.decision === 'EXECUTE_ARBITRAGE';
  const decisionBadge = isExecute
    ? '\x1b[32m✔ EXECUTE ARBITRAGE (PROFITABLE)\x1b[0m'
    : `\x1b[33m✖ ${opp.decision}\x1b[0m`;

  lines.push(boxTop);
  lines.push(`│ ⚡ PHAROS ARBITRAGE SCANNER · ${titleBadge.padEnd(46)} │`);
  lines.push(`│ Scan ID:     ${opp.scanId.padEnd(61)} │`);
  lines.push(`│ Target Pair: ${opp.assetPair.padEnd(61)} │`);
  lines.push(`│ Decision:    ${decisionBadge.padEnd(70)} │`);
  lines.push('├' + '─'.repeat(77) + '┤');

  // Multi-venue price comparison (Requirement 01)
  lines.push(`│ 📍 Multi-Venue Price Discrepancy (Requirement 01):                          │`);
  lines.push(`│   • Buy Venue:    ${opp.buyVenueQuote.sourceIdentifier.padEnd(35)} @ $${opp.buyVenueQuote.quotedPriceUsd.toFixed(4)} USD │`);
  lines.push(`│   • Sell Venue:   ${opp.sellVenueQuote.sourceIdentifier.padEnd(35)} @ $${opp.sellVenueQuote.quotedPriceUsd.toFixed(4)} USD │`);
  lines.push(`│   • Gross Spread: +${opp.grossSpreadPercentage.toFixed(2)}% (Gross Value: +$${opp.grossSpreadUsd.toFixed(2)} USD on $${opp.tradeSizeCapitalUsd.toLocaleString()} capital)`.padEnd(78) + '│');
  lines.push('├' + '─'.repeat(77) + '┤');

  // Friction cost waterfall (Requirement 02)
  const costs = opp.frictionCosts;
  lines.push(`│ 💸 Friction Cost Deduction Waterfall (Requirement 02):                      │`);
  lines.push(`│   1. Gross Opportunity:         +$${opp.grossSpreadUsd.toFixed(2)} USD`.padEnd(78) + '│');
  lines.push(`│   2. Protocol Swap Fees:        -$${costs.totalSwapFeesUsd.toFixed(2)} USD (0.30% buy + 0.05% sell legs)`.padEnd(78) + '│');
  lines.push(`│   3. Dynamic Slippage Cost:     -$${costs.estimatedSlippageUsd.toFixed(2)} USD (${costs.slippageBps.toFixed(1)} bps price impact)`.padEnd(78) + '│');
  lines.push(`│   4. EVM Network Gas Expense:   -$${costs.networkGasCostUsd.toFixed(4)} USD (285k gas @ ${costs.effectiveGasPriceGwei} Gwei)`.padEnd(78) + '│');
  lines.push(`│   ───────────────────────────────────────────────────────────────────────── │`);
  lines.push(`│   Total Friction Overhead:      -$${costs.aggregateFrictionCostUsd.toFixed(2)} USD`.padEnd(78) + '│');
  lines.push('├' + '─'.repeat(77) + '┤');

  // Net Profit & Threshold Evaluation (Requirement 03)
  const sign = opp.netProfitUsd >= 0 ? '+' : '';
  lines.push(`│ 💰 Net Yield & Hurdle Gate (Requirement 03):                                │`);
  lines.push(`│   • Net Arbitrage Profit:       ${sign}$${opp.netProfitUsd.toFixed(2)} USD`.padEnd(78) + '│');
  lines.push(`│   • Net Return Yield:           ${sign}${opp.netYieldReturnPercentage.toFixed(2)}% (${sign}${Math.round(opp.netYieldReturnPercentage * 100)} bps)`.padEnd(78) + '│');
  lines.push(`│   • Hurdle Profit Threshold:    $${opp.hurdleProfitThresholdUsd.toFixed(2)} USD (Configured minimum)`.padEnd(78) + '│');
  lines.push('├' + '─'.repeat(77) + '┤');

  // Plain-Language Justification (Requirement 03 & 04)
  lines.push(`│ 📋 Plain-Language Justification & Rationale (Requirement 04):               │`);
  const wrapped = wrapText(opp.plainLanguageJustification, 73);
  for (const chunk of wrapped) {
    lines.push(`│   ${chunk.padEnd(73)} │`);
  }

  // Prepared transaction payload (Requirement 03 & 05)
  if (opp.preparedExecutionPayload) {
    const payload = opp.preparedExecutionPayload;
    lines.push('├' + '─'.repeat(77) + '┤');
    lines.push(`│ 🚀 Prepared Execution Payload (Requirement 03 & 05 - Simulation Safe):       │`);
    lines.push(`│   • Target Router:     ${payload.targetContract} │`);
    lines.push(`│   • Action Calldata:   ${payload.calldataPayload.slice(0, 48)}... │`);
    lines.push(`│   • Expected Output:   $${payload.expectedNetProceedsUsd.toFixed(2)} USD (Net Return: +$${opp.netProfitUsd.toFixed(2)})`.padEnd(78) + '│');
    lines.push(`│   • Simulation URL:    ${payload.pharosscanExplorerSimUrl.slice(0, 52)}... │`);
  }

  lines.push(boxBottom);
  return lines.join('\n');
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxWidth) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
