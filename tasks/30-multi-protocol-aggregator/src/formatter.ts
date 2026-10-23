import {
  ProtocolVenue,
  UserPosition,
  UnsignedTransaction,
  RoutingResult,
  ProtocolHealthStatus,
} from './types.js';

export class AggregatorFormatter {
  static formatRatesTable(venues: ProtocolVenue[]): string {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push('                   PHAROS MULTI-PROTOCOL YIELD VENUES                           ');
    lines.push('================================================================================');
    lines.push(
      `${'PROTOCOL'.padEnd(16)} | ${'VAULT / PAIR'.padEnd(28)} | ${'APY'.padEnd(8)} | ${'LOCKUP'.padEnd(8)} | ${'TVL'.padEnd(10)} | ${'SAFETY'.padEnd(6)}`
    );
    lines.push('-----------------+------------------------------+----------+----------+------------+-------');

    for (const v of venues) {
      const apyStr = `${v.apyPercent.toFixed(2)}%`;
      const tvlStr = v.tvlUsd >= 1e6
        ? `$${(v.tvlUsd / 1e6).toFixed(2)}M`
        : `$${(v.tvlUsd / 1e3).toFixed(0)}k`;
      const safetyStr = `${v.safetyScore}/100`;

      lines.push(
        `${v.protocolName.slice(0, 16).padEnd(16)} | ${v.vaultName.slice(0, 28).padEnd(28)} | ${apyStr.padEnd(8)} | ${v.lockupTenor.padEnd(8)} | ${tvlStr.padEnd(10)} | ${safetyStr.padEnd(6)}`
      );
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }

  static formatPositionsTable(
    positions: UserPosition[],
    totalDepositedUsd: number,
    totalEarnedUsd: number,
    weightedApy: number,
    userAddress: string
  ): string {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push(`            PORTFOLIO OVERVIEW: ${userAddress.slice(0, 8)}...${userAddress.slice(-6)}`);
    lines.push('================================================================================');
    lines.push(
      `${'PROTOCOL'.padEnd(16)} | ${'VAULT'.padEnd(26)} | ${'DEPOSITED'.padEnd(12)} | ${'EARNED'.padEnd(10)} | ${'APY'.padEnd(8)} | ${'TENOR'.padEnd(8)}`
    );
    lines.push('-----------------+----------------------------+--------------+------------+----------+---------');

    for (const p of positions) {
      const depStr = `$${p.depositedValueUsd.toFixed(2)}`;
      const earnStr = `+$${p.earnedYieldUsd.toFixed(2)}`;
      const apyStr = `${p.currentApyPercent.toFixed(2)}%`;

      lines.push(
        `${p.protocolName.slice(0, 16).padEnd(16)} | ${p.vaultName.slice(0, 26).padEnd(26)} | ${depStr.padEnd(12)} | ${earnStr.padEnd(10)} | ${apyStr.padEnd(8)} | ${p.lockupTenor.padEnd(8)}`
      );
    }

    lines.push('-----------------+----------------------------+--------------+------------+----------+---------');
    lines.push(`TOTAL DEPOSITED:   $${totalDepositedUsd.toFixed(2)}`);
    lines.push(`TOTAL EARNED:      +$${totalEarnedUsd.toFixed(2)} USD`);
    lines.push(`WEIGHTED APY:      ${weightedApy.toFixed(2)}%`);
    lines.push('================================================================================');
    return lines.join('\n');
  }

  static formatRoutingResult(result: RoutingResult): string {
    const lines: string[] = [];
    const { bestVenue, inputToken, depositAmountUsd, projectedYieldUsd, explanation } = result;

    lines.push('================================================================================');
    lines.push('                      PHAROS SMART YIELD ROUTING RESULT                         ');
    lines.push('================================================================================');
    lines.push(`Requested Deposit:   $${depositAmountUsd.toLocaleString()} ${inputToken}`);
    lines.push(`Selected Venue:      🏆 ${bestVenue.vaultName} (${bestVenue.protocolName})`);
    lines.push(`Target APY:          ${bestVenue.apyPercent.toFixed(2)}%`);
    lines.push(`Lockup Tenor:        ${bestVenue.lockupTenor.toUpperCase()}`);
    lines.push(`Safety Score:        ${bestVenue.safetyScore} / 100`);
    lines.push(`Pool TVL:            $${(bestVenue.tvlUsd / 1e6).toFixed(2)}M USD`);
    lines.push(`Projected Return:    +$${projectedYieldUsd.toFixed(2)} USD / year`);
    lines.push('');
    lines.push('--------------------------------------------------------------------------------');
    lines.push('💡 WHY THIS VENUE WAS CHOSEN:');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`* ${explanation.primaryReason}`);
    lines.push('');
    lines.push('⚖️  KEY TRADEOFFS & CONSIDERATIONS:');
    for (const t of explanation.tradeoffs) {
      lines.push(`  - ${t}`);
    }
    lines.push('');
    lines.push(`📊 MARKET COMPARISON:`);
    lines.push(`  ${explanation.comparisonNotes}`);
    lines.push('');

    // Comparison breakdown
    lines.push('--------------------------------------------------------------------------------');
    lines.push('ALL EVALUATED VENUES:');
    lines.push(
      `${'VENUE'.padEnd(30)} | ${'APY'.padEnd(8)} | ${'TENOR'.padEnd(8)} | ${'STATUS'.padEnd(10)} | ${'REASON / NOTE'}`
    );
    lines.push('-------------------------------+----------+----------+------------+---------------------');

    for (const c of result.consideredVenues) {
      const isWinner = c.venueId === bestVenue.id;
      const status = isWinner ? 'SELECTED' : c.eligible ? 'ELIGIBLE' : 'SKIPPED';
      const apyStr = `${c.apyPercent.toFixed(2)}%`;
      const note = isWinner
        ? 'Best overall risk-adjusted return'
        : c.disqualificationReason || `+$${c.projectedAnnualYieldUsd.toFixed(2)}/yr`;

      lines.push(
        `${c.vaultName.slice(0, 30).padEnd(30)} | ${apyStr.padEnd(8)} | ${c.lockupTenor.padEnd(8)} | ${status.padEnd(10)} | ${note}`
      );
    }

    if (result.preparedDepositTx) {
      lines.push('');
      lines.push('--------------------------------------------------------------------------------');
      lines.push('PREPARED TRANSACTION FOR SIGNATURE:');
      lines.push('--------------------------------------------------------------------------------');
      lines.push(this.formatUnsignedTx(result.preparedDepositTx));
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }

  static formatUnsignedTx(tx: UnsignedTransaction): string {
    const lines: string[] = [];
    lines.push(`Action:          ${tx.humanReadable}`);
    lines.push(`Target Contract: ${tx.to}`);
    lines.push(`From Address:    ${tx.from || 'User Wallet'}`);
    lines.push(`Chain ID:        ${tx.chainId} (Pharos Network)`);
    lines.push(`Gas Limit:       ${tx.gasLimit || '200,000'}`);
    lines.push(`Method:          ${tx.methodName}`);
    lines.push(`Value:           ${tx.value}`);
    lines.push(`Calldata:        ${tx.data}`);
    lines.push('');
    lines.push(`👉 Foundry Cast Command (Execute directly via CLI):`);
    lines.push(`   ${tx.castCommand}`);
    return lines.join('\n');
  }

  static formatHealthTable(statuses: ProtocolHealthStatus[]): string {
    const lines: string[] = [];
    lines.push('================================================================================');
    lines.push('                   CIRCUIT BREAKER HEALTH STATUS                                ');
    lines.push('================================================================================');
    lines.push(
      `${'PROTOCOL'.padEnd(20)} | ${'CIRCUIT STATE'.padEnd(14)} | ${'FAILURES'.padEnd(10)} | ${'LATENCY'.padEnd(12)} | ${'STATUS'}`
    );
    lines.push('---------------------+----------------+------------+--------------+-------------');

    for (const s of statuses) {
      const stateBadge = s.state === 'CLOSED' ? '🟢 CLOSED (OK)' : s.state === 'HALF_OPEN' ? '🟡 HALF_OPEN' : '🔴 OPEN (ISOLATED)';
      const latencyStr = s.averageLatencyMs > 0 ? `${s.averageLatencyMs} ms` : '<10 ms';
      const statusDesc = s.isAvailable ? 'Operational' : 'Circuit tripped: Traffic isolated';

      lines.push(
        `${s.protocolName.slice(0, 20).padEnd(20)} | ${stateBadge.padEnd(14)} | ${String(s.failureCount).padEnd(10)} | ${latencyStr.padEnd(12)} | ${statusDesc}`
      );
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }
}
