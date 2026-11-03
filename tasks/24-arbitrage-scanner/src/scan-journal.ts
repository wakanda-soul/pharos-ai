/**
 * Scan Audit Journal & Execution Logger for Pharos Arbitrage Scanner (Requirement 04).
 * Logs every scan cycle with gross spread, itemized friction costs, net result, and final decision.
 */

import type { ArbitrageOpportunityRecord } from './types.js';

export class ScanJournal {
  private scanRecords: ArbitrageOpportunityRecord[] = [];

  /**
   * Appends an evaluated scan opportunity to the journal (Requirement 04).
   */
  public logScanRecord(record: ArbitrageOpportunityRecord): void {
    this.scanRecords.push(record);
  }

  /**
   * Retrieves all logged scan records.
   */
  public getAllScanRecords(): ArbitrageOpportunityRecord[] {
    return [...this.scanRecords];
  }

  /**
   * Formats a single scan record into a rich terminal log entry.
   */
  public formatSingleScanLogEntry(record: ArbitrageOpportunityRecord): string {
    const lines: string[] = [];
    const costs = record.frictionCosts;
    const isExecute = record.decision === 'EXECUTE_ARBITRAGE';
    const decisionColor = isExecute ? '\x1b[32m[EXECUTE_ARBITRAGE]\x1b[0m' : '\x1b[33m[' + record.decision + ']\x1b[0m';

    lines.push(`┌─────────────────────────────────────────────────────────────────────────────┐`);
    lines.push(`│ 📡 ARBITRAGE SCAN AUDIT LOG: ${record.scanId.padEnd(46)} │`);
    lines.push(`│ Timestamp:   ${record.timestampIso.padEnd(62)} │`);
    lines.push(`│ Asset Pair:  ${record.assetPair.padEnd(62)} │`);
    lines.push(`│ Decision:    ${decisionColor.padEnd(71)} │`);
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ 📍 Venues & Observed Prices:                                                │`);
    lines.push(`│   • Buy Venue:  ${record.buyVenueQuote.sourceIdentifier.padEnd(35)} @ $${record.buyVenueQuote.quotedPriceUsd.toFixed(4)} USD │`);
    lines.push(`│   • Sell Venue: ${record.sellVenueQuote.sourceIdentifier.padEnd(35)} @ $${record.sellVenueQuote.quotedPriceUsd.toFixed(4)} USD │`);
    lines.push(`│   • Gross Spread: +${record.grossSpreadPercentage.toFixed(2)}% (Gross Discrepancy: +$${record.grossSpreadUsd.toFixed(2)} USD) │`);
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ 💸 Itemized Friction Costs (Requirement 02):                                │`);
    lines.push(`│   • Trade Capital:        $${record.tradeSizeCapitalUsd.toLocaleString()} USD                                      │`);
    lines.push(`│   • Protocol Swap Fees:   -$${costs.totalSwapFeesUsd.toFixed(2)} USD (Source + Destination legs)             │`);
    lines.push(`│   • Estimated Slippage:   -$${costs.estimatedSlippageUsd.toFixed(2)} USD (${costs.slippageBps.toFixed(1)} bps price impact)              │`);
    lines.push(`│   • Network Gas Expense:  -$${costs.networkGasCostUsd.toFixed(4)} USD (${costs.effectiveGasPriceGwei} Gwei @ 285k gas)               │`);
    lines.push(`│   • Total Friction Cost:  -$${costs.aggregateFrictionCostUsd.toFixed(2)} USD                                      │`);
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ 💰 Net Yield & Economic Outcome:                                            │`);
    const sign = record.netProfitUsd >= 0 ? '+' : '';
    lines.push(`│   • Net Profit:           ${sign}$${record.netProfitUsd.toFixed(2)} USD (Hurdle Threshold: $${record.hurdleProfitThresholdUsd.toFixed(2)} USD) │`);
    lines.push(`│   • Net Return Yield:     ${sign}${record.netYieldReturnPercentage.toFixed(2)}% (${sign}${Math.round(record.netYieldReturnPercentage * 100)} bps)                              │`);
    lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
    lines.push(`│ 💡 Decision Justification:                                                  │`);
    const wrappedJustification = wrapText(record.plainLanguageJustification, 73);
    for (const chunk of wrappedJustification) {
      lines.push(`│   ${chunk.padEnd(73)} │`);
    }

    if (record.preparedExecutionPayload) {
      lines.push(`├─────────────────────────────────────────────────────────────────────────────┤`);
      lines.push(`│ 🚀 Prepared Execution Payload (Requirement 03 & 05):                         │`);
      lines.push(`│   • Router Contract:      ${record.preparedExecutionPayload.targetContract} │`);
      lines.push(`│   • Function Method:      ${record.preparedExecutionPayload.routerFunctionMethod.padEnd(49)} │`);
      lines.push(`│   • Calldata:             ${record.preparedExecutionPayload.calldataPayload.slice(0, 48)}... │`);
      lines.push(`│   • Simulation URL:       ${record.preparedExecutionPayload.pharosscanExplorerSimUrl.slice(0, 48)}... │`);
    }

    lines.push(`└─────────────────────────────────────────────────────────────────────────────┘`);
    return lines.join('\n');
  }

  /**
   * Renders summary table of all recorded scans.
   */
  public renderScanHistorySummary(): string {
    const lines: string[] = [];
    lines.push('Scan ID           Timestamp   Pair        Gross Spread  Friction     Net Profit   Decision');
    lines.push('───────────────── ─────────── ─────────── ───────────── ──────────── ──────────── ──────────────────────');
    for (const r of this.scanRecords) {
      const time = r.timestampIso.slice(11, 19);
      const gross = `+$${r.grossSpreadUsd.toFixed(0)} (${r.grossSpreadPercentage.toFixed(1)}%)`.padEnd(13);
      const friction = `-$${r.frictionCosts.aggregateFrictionCostUsd.toFixed(0)}`.padEnd(12);
      const net = `${r.netProfitUsd >= 0 ? '+' : ''}$${r.netProfitUsd.toFixed(0)}`.padEnd(12);
      lines.push(
        `${r.scanId.slice(0, 17).padEnd(17)} ${time}    ${r.assetPair.padEnd(11)} ${gross} ${friction} ${net} ${r.decision}`,
      );
    }
    return lines.join('\n');
  }
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
