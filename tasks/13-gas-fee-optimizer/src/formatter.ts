import { GasSnapshot, GasMarketStats, ExecutionPostMortem } from './types.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

export class GasFeeOptimizerFormatter {
  /**
   * Formats gas price history and market statistics (Requirement 01).
   */
  static formatGasHistory(history: GasSnapshot[], stats: GasMarketStats): string {
    const lines: string[] = [];

    lines.push(`${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
    lines.push(`${c.bold}${c.cyan}║             PHAROS GAS ORACLE: HISTORICAL TRENDS & DISTRIBUTION              ║${c.reset}`);
    lines.push(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
    lines.push('');

    // Summary Stats
    const trendColor =
      stats.trend === 'FALLING' ? c.green : stats.trend === 'RISING' ? c.red : c.yellow;
    lines.push(`${c.bold}Market Statistics (${stats.sampleCount} snapshots):${c.reset}`);
    lines.push(`  • Current Gas Price:  ${c.bold}${c.white}${stats.currentGwei.toFixed(2)} Gwei${c.reset}`);
    lines.push(`  • Range (Min - Max):  ${c.green}${stats.minGwei.toFixed(2)} Gwei${c.reset} → ${c.red}${stats.maxGwei.toFixed(2)} Gwei${c.reset}`);
    lines.push(`  • Rolling Average:    ${c.cyan}${stats.avgGwei.toFixed(2)} Gwei${c.reset} (Median: ${stats.medianGwei.toFixed(2)} Gwei)`);
    lines.push(`  • Target Percentiles: p10: ${c.green}${stats.p10Gwei.toFixed(2)}${c.reset} | p25: ${c.green}${stats.p25Gwei.toFixed(2)}${c.reset} | p75: ${c.yellow}${stats.p75Gwei.toFixed(2)}${c.reset} | p90: ${c.red}${stats.p90Gwei.toFixed(2)} Gwei${c.reset}`);
    lines.push(`  • Volatility Index:   ${stats.volatilityPercentage.toFixed(1)}% (StdDev: ±${stats.stdDevGwei.toFixed(2)} Gwei)`);
    lines.push(`  • Directional Trend:  ${trendColor}${c.bold}${stats.trend}${c.reset}`);
    lines.push('');

    // Recent History Table
    lines.push(`${c.bold}Recent On-Chain Snapshots (Latest ${Math.min(history.length, 8)}):${c.reset}`);
    lines.push(
      `${c.bold}Timestamp (UTC)          | Block Number | Gas Price (Gwei) | Base Fee | Status${c.reset}`
    );
    lines.push(`${c.gray}${'─'.repeat(74)}${c.reset}`);

    const recent = history.slice(-8);
    for (const snap of recent) {
      const timeStr = `${c.gray}${snap.timestamp.slice(11, 19)}${c.reset}`;
      const blockStr = `${c.cyan}#${snap.blockNumber.toString()}${c.reset}`;
      const priceStr = `${c.bold}${c.white}${snap.gasPriceGwei.toFixed(2).padStart(6)} Gwei${c.reset}`;
      const baseStr = `${c.gray}${(snap.baseFeeGwei ?? snap.gasPriceGwei).toFixed(2).padStart(5)} Gwei${c.reset}`;

      let tag = `${c.gray}NORMAL${c.reset}`;
      if (snap.gasPriceGwei <= stats.p25Gwei) tag = `${c.green}CHEAP ⭐${c.reset}`;
      else if (snap.gasPriceGwei >= stats.p75Gwei) tag = `${c.red}ELEVATED${c.reset}`;

      lines.push(`${timeStr}                 | ${blockStr}  | ${priceStr}   | ${baseStr} | ${tag}`);
    }
    lines.push(`${c.gray}${'─'.repeat(74)}${c.reset}`);

    return lines.join('\n');
  }

  /**
   * Formats execution post-mortem report (Requirements 02, 03, 04).
   */
  static formatPostMortem(res: ExecutionPostMortem): string {
    const lines: string[] = [];
    const isDip = res.trigger === 'OPPORTUNISTIC_DIP';
    const isDeadline = res.trigger === 'DEADLINE_FORCED';

    const banner = isDip
      ? `${c.bold}${c.bgGreen} ✓ [OPPORTUNISTIC DIP TRIGGERED] — OPTIMAL GAS HARVESTED ${c.reset}`
      : `${c.bold}${c.bgYellow} ⏱️ [DEADLINE REACHED — FORCED SUBMISSION] — SLA FULFILLED ${c.reset}`;

    lines.push('');
    lines.push(banner);
    lines.push('');
    lines.push(`${c.bold}Transaction ID:${c.reset}       ${c.white}${res.txId}${c.reset}`);
    lines.push(`${c.bold}Execution Trigger:${c.reset}    ${c.bold}${isDip ? c.green : c.yellow}${res.trigger}${c.reset}`);
    lines.push(`${c.bold}Request Timestamp:${c.reset}    ${c.gray}${res.requestTimestamp}${c.reset}`);
    lines.push(`${c.bold}Execution Timestamp:${c.reset}  ${c.gray}${res.executionTimestamp}${c.reset}`);
    lines.push(`${c.bold}Time Held in Queue:${c.reset}   ${c.cyan}${(res.durationWaitingMs / 1000).toFixed(1)}s${c.reset} (Remaining to Deadline: ${(res.timeRemainingAtExecutionMs / 1000).toFixed(1)}s)`);
    lines.push('');

    // Gas & Economic Comparison Matrix (Requirement 03)
    lines.push(`${c.bold}${c.cyan}─── GAS PRICE & COST COMPARISON (REQUIREMENT 03) ──────────────────────────────${c.reset}`);
    lines.push(`${c.bold}Gas Price at Request Time:${c.reset} ${c.white}${res.requestGasPriceGwei.toFixed(2)} Gwei${c.reset}`);
    lines.push(`${c.bold}Actual Gas Price Paid:${c.reset}     ${c.bold}${c.yellow}${res.executedGasPriceGwei.toFixed(2)} Gwei${c.reset}`);

    const deltaSign = res.gasSavedGwei >= 0 ? '+' : '';
    const saveColor = res.gasSavedGwei >= 0 ? c.green : c.red;
    lines.push(`${c.bold}Gas Differential:${c.reset}          ${saveColor}${deltaSign}${res.gasSavedGwei.toFixed(2)} Gwei (${deltaSign}${res.gasSavedPercentage.toFixed(1)}%)${c.reset}`);
    lines.push(`${c.bold}Gas Limit Units:${c.reset}           ${res.gasUnitsUsed.toLocaleString()} units`);
    lines.push(`${c.bold}Cost at Request Time:${c.reset}     ${c.gray}${parseFloat(res.costAtRequestPros).toFixed(6)} PROS${c.reset}`);
    lines.push(`${c.bold}Actual Cost Paid:${c.reset}         ${c.bold}${c.white}${parseFloat(res.actualCostPaidPros).toFixed(6)} PROS${c.reset}`);

    if (res.gasSavedGwei > 0) {
      lines.push(`${c.bold}Net Savings Achieved:${c.reset}     ${c.bold}${c.green}${parseFloat(res.prosSaved).toFixed(6)} PROS${c.reset}`);
      if (res.usdSaved !== undefined) {
        lines.push(`${c.bold}Estimated USD Saved:${c.reset}      ${c.bold}${c.green}~$${res.usdSaved.toFixed(4)} USD${c.reset} (via Chainlink Oracle @ $${res.oraclePriceUsd?.toFixed(2)}/ETH)`);
      }
    } else {
      lines.push(`${c.bold}Congestion Overhead:${c.reset}      ${c.bold}${c.yellow}${Math.abs(parseFloat(res.prosSaved)).toFixed(6)} PROS${c.reset} (accepted to prevent deadline breach)`);
    }

    lines.push('');

    // Trajectory Timeline Visualizer
    if (res.priceTrajectory.length > 0) {
      lines.push(`${c.bold}─── PRICE TRAJECTORY & RESERVATION CURVE ───────────────────────────────────────${c.reset}`);
      lines.push(`${c.gray}Step | Elapsed | Network Gas | Reservation Target | Decision${c.reset}`);
      let step = 1;
      for (const pt of res.priceTrajectory) {
        const timeOffset = `${((new Date(pt.timestamp).getTime() - new Date(res.requestTimestamp).getTime()) / 1000).toFixed(0)}s`.padStart(4);
        const gasStr = `${pt.gasPriceGwei.toFixed(2)} Gwei`.padStart(11);
        const targetStr = pt.reservationTargetGwei === Number.POSITIVE_INFINITY ? ' ∞ (FORCED)' : `${pt.reservationTargetGwei.toFixed(2)} Gwei`.padStart(11);
        const decStr = pt.isExecutionPoint
          ? `${c.bold}${isDip ? c.green + '✓ EXECUTE (DIP)' : c.yellow + '⚡ EXECUTE (DEADLINE)'}${c.reset}`
          : `${c.gray}HOLD (Waiting)${c.reset}`;

        lines.push(` ${step++}   |   ${timeOffset}  | ${gasStr} |        ${targetStr} | ${decStr}`);
      }
    }

    lines.push('');
    lines.push(`${c.bold}─── ON-CHAIN DISPATCH PAYLOAD ─────────────────────────────────────────────────${c.reset}`);
    lines.push(`${c.bold}Foundry Cast Command:${c.reset}  ${c.cyan}${res.castCommand}${c.reset}`);
    lines.push('───────────────────────────────────────────────────────────────────────────────');

    return lines.join('\n');
  }
}
