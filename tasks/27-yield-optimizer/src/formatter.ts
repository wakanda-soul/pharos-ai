import { RebalanceEvaluationReport, YieldVenueRecord } from './types.js';

/**
 * Renders an ASCII scorecard for a Yield Optimizer evaluation report.
 */
export function renderRebalanceScorecard(report: RebalanceEvaluationReport): string {
  const horizontalBar = '─'.repeat(77);
  const decisionBadge =
    report.decision === 'REBALANCE_RECOMMENDED'
      ? '🟢 REBALANCE_RECOMMENDED (WORTH IT)'
      : '🟡 STAY_PUT (FRICTION EXCEEDS GAIN)';

  const lines: string[] = [];
  lines.push(`┌${horizontalBar}┐`);
  lines.push(`│ 🌾 PHAROS YIELD OPTIMIZER · REBALANCE EVALUATION REPORT                     │`);
  lines.push(`│ Evaluation ID: ${report.evaluationId.padEnd(60)}│`);
  lines.push(`│ Capital Amount: $${report.capitalAmountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }).padEnd(58)}│`);
  lines.push(`│ Planned Horizon: ${report.holdingPeriodDays} days${''.padEnd(59)}│`);
  lines.push(`│ Recommendation:  ${decisionBadge.padEnd(59)}│`);
  lines.push(`├${horizontalBar}┤`);
  lines.push(`│ 📍 Source vs Target Comparison (Requirement 01):                            │`);
  lines.push(
    `│   • Current Source: ${report.sourceVenue.protocolName} (${report.sourceVenue.vaultName})`.substring(0, 77).padEnd(77) + '│'
  );
  lines.push(
    `│     Yield: ${report.sourceVenue.apyPercent}% APY | Contract: ${report.sourceVenue.contractAddress.substring(0, 10)}...${report.sourceVenue.contractAddress.substring(38)}`.padEnd(77) + '│'
  );
  lines.push(
    `│   • Target Venue:   ${report.targetVenue.protocolName} (${report.targetVenue.vaultName})`.substring(0, 77).padEnd(77) + '│'
  );
  lines.push(
    `│     Yield: ${report.targetVenue.apyPercent}% APY | Contract: ${report.targetVenue.contractAddress.substring(0, 10)}...${report.targetVenue.contractAddress.substring(38)}`.padEnd(77) + '│'
  );
  lines.push(
    `│   • Gross Spread:   ${report.grossApySpread >= 0 ? '+' : ''}${report.grossApySpread}% APY spread ($${report.projectedGrossGainUsd.toFixed(2)} USD over ${report.holdingPeriodDays}d)`.padEnd(77) + '│'
  );
  lines.push(`├${horizontalBar}┤`);
  lines.push(`│ 💸 Itemized Switching Friction Waterfall (Requirement 02):                  │`);
  lines.push(
    `│   1. Source Exit Fee (${(report.switchingFriction.exitFeeBps / 100).toFixed(2)}%):       -$${report.switchingFriction.exitFeeUsd.toFixed(2)} USD`.padEnd(77) + '│'
  );
  lines.push(
    `│   2. Target Entry Fee (${(report.switchingFriction.entryFeeBps / 100).toFixed(2)}%):      -$${report.switchingFriction.entryFeeUsd.toFixed(2)} USD`.padEnd(77) + '│'
  );
  lines.push(
    `│   3. EVM Network Gas (320k gas):  -$${report.switchingFriction.gasCostUsd.toFixed(4)} USD (@ ${report.switchingFriction.gasPriceGwei} Gwei)`.padEnd(77) + '│'
  );
  lines.push(`│   ───────────────────────────────────────────────────────────────────────── │`);
  lines.push(
    `│   Total Switching Friction:       -$${report.switchingFriction.totalFrictionUsd.toFixed(2)} USD`.padEnd(77) + '│'
  );
  lines.push(`├${horizontalBar}┤`);
  lines.push(`│ 💰 Net Return & Amortization Horizon (Requirement 02 & 03):                 │`);
  lines.push(
    `│   • Projected Net Gain:         ${report.projectedNetGainUsd >= 0 ? '+' : ''}$${report.projectedNetGainUsd.toFixed(2)} USD (after all fees)`.padEnd(77) + '│'
  );
  lines.push(
    `│   • Net Annualized ROI:         ${report.netAnnualizedRoiPercent >= 0 ? '+' : ''}${report.netAnnualizedRoiPercent.toFixed(2)}% net APY`.padEnd(77) + '│'
  );
  lines.push(
    `│   • Break-Even Horizon:         ${report.breakEvenDays} days needed to break even`.padEnd(77) + '│'
  );
  lines.push(`├${horizontalBar}┤`);
  lines.push(`│ 📋 Decision Rationale (Requirement 03):                                      │`);
  const wrappedRationale = wrapText(report.decisionRationale, 73);
  for (const rLine of wrappedRationale) {
    lines.push(`│   ${rLine.padEnd(74)}│`);
  }

  // Prepared Unsigned Transactions (Requirement 04)
  if (report.preparedTransactions.length > 0) {
    lines.push(`├${horizontalBar}┤`);
    lines.push(`│ 🚀 Prepared Unsigned Transactions for User Signature (Req 04 - Non-Custodial): │`);
    lines.push(`│ Note: Agent never holds keys. Execute manually via cast or wallet interface. │`);
    for (const tx of report.preparedTransactions) {
      lines.push(`│   [Step ${tx.stepIndex}/3] ${tx.actionDescription}`.substring(0, 77).padEnd(77) + '│');
      lines.push(`│     Target:  ${tx.targetContract}`.padEnd(77) + '│');
      lines.push(`│     Command: ${tx.castCommand}`.substring(0, 77).padEnd(77) + '│');
    }
  }

  lines.push(`└${horizontalBar}┘`);
  return lines.join('\n');
}

/**
 * Renders a comparative matrix table across multiple live yield venues.
 */
export function renderVenueComparisonMatrix(venues: YieldVenueRecord[]): string {
  const lines: string[] = [];
  lines.push('\n🏛️ LIVE PHAROS YIELD VENUES MATRIX (Requirement 01):\n');
  lines.push('Venue ID                Protocol        Vault Name                       APY%    TVL (USD)     Exit/Entry Fee  Lockup   Contract');
  lines.push('─────────────────────── ─────────────── ──────────────────────────────── ─────── ───────────── ─────────────── ──────── ──────────');

  for (const v of venues) {
    const id = v.venueId.padEnd(23).substring(0, 23);
    const proto = v.protocolName.padEnd(15).substring(0, 15);
    const vault = v.vaultName.padEnd(32).substring(0, 32);
    const apy = `${v.apyPercent}%`.padEnd(7);
    const tvl = `$${(v.tvlUsd / 1e6).toFixed(1)}M`.padEnd(13);
    const fees = `${(v.exitFeeBps / 100).toFixed(2)}% / ${(v.entryFeeBps / 100).toFixed(2)}%`.padEnd(15);
    const lockup = (v.lockupTenorDays === 0 ? 'Liquid' : `${v.lockupTenorDays}d`).padEnd(8);
    const contract = `${v.contractAddress.substring(0, 6)}...${v.contractAddress.substring(38)}`;
    lines.push(`${id} ${proto} ${vault} ${apy} ${tvl} ${fees} ${lockup} ${contract}`);
  }

  return lines.join('\n');
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > maxWidth) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}
