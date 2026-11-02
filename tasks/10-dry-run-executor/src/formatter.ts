import { SimulationResult } from './types.js';

export class DryRunFormatter {
  static formatReport(result: SimulationResult): string {
    const lines: string[] = [];
    const isSuccess = result.canExecute;

    lines.push('================================================================================');
    lines.push('              PHAROS SKILLENGINE: PRE-FLIGHT DRY-RUN SIMULATION REPORT          ');
    lines.push('================================================================================');
    lines.push(`Simulation ID:     ${result.simulationId}`);
    lines.push(`Timestamp:         ${result.timestamp}`);
    lines.push(`Network:           ${result.network} (Chain ID: ${result.chainId})`);
    lines.push(`Simulated Block:   #${result.blockNumber}`);
    lines.push('');

    // Pre-Flight Gate Status
    lines.push('--------------------------------------------------------------------------------');
    lines.push('🛡️  EXECUTION SAFETY GATE VERDICT:');
    lines.push('--------------------------------------------------------------------------------');
    if (isSuccess) {
      lines.push('🎯 VERDICT: 🟢 [PROCEED_CLEARED] — TRANSACTION SIMULATION SUCCEEDED');
      lines.push('Status: Execution gate unlocked. No EVM reverts detected; gas cost within limits.');
    } else {
      lines.push('🎯 VERDICT: 🛑 [EXECUTION_BLOCKED] — SIMULATION REVERTED');
      lines.push('Status: Execution gate locked automatically to protect funds and avoid gas loss.');
    }
    lines.push('');

    // Transaction Details
    lines.push('--------------------------------------------------------------------------------');
    lines.push('📝 TRANSACTION DETAILS:');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`  Sender (from):   ${result.request.from}`);
    lines.push(`  Target (to):     ${result.request.to}`);
    lines.push(`  Value:           ${result.request.value} wei`);
    lines.push(`  Calldata:        ${result.request.data.length > 50 ? result.request.data.slice(0, 50) + '...' : result.request.data}`);
    if (result.request.description) {
      lines.push(`  Description:     ${result.request.description}`);
    }
    lines.push('');

    // Gas & Cost Estimation
    if (result.gasBreakdown) {
      const { gasBreakdown } = result;
      lines.push('--------------------------------------------------------------------------------');
      lines.push('⛽ ESTIMATED GAS & EXECUTION COST:');
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`  Estimated Gas:   ${gasBreakdown.gasLimitEstimated.toLocaleString()} units`);
      lines.push(`  Base Gas Price:  ${gasBreakdown.gasPriceGwei.toFixed(2)} Gwei`);
      lines.push(`  Total Fee:       ${gasBreakdown.totalGasFeePros}`);
      if (gasBreakdown.totalGasFeeUsd !== undefined) {
        lines.push(`  USD Cost:        $${gasBreakdown.totalGasFeeUsd.toFixed(4)} (Oracle: $${gasBreakdown.oraclePriceUsd?.toLocaleString()})`);
      }
      lines.push('');
    }

    // Expected State Diff (Requirement 03)
    if (result.stateDiff) {
      const { stateDiff } = result;
      lines.push('--------------------------------------------------------------------------------');
      lines.push('📊 PREDICTED STATE DIFF (BEFORE VS AFTER EXECUTION):');
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`${'ENTITY / ACCOUNT'.padEnd(24)} | ${'BEFORE EXECUTION'.padEnd(24)} | ${'AFTER EXECUTION'.padEnd(24)}`);
      lines.push('-------------------------+--------------------------+--------------------------');

      // Sender Native
      lines.push(
        `${'Sender PROS'.padEnd(24)} | ${stateDiff.senderPre.nativeBalanceFormatted.padEnd(24)} | ${stateDiff.senderPost.nativeBalanceFormatted.padEnd(24)}`
      );

      // Sender Token (if applicable)
      if (stateDiff.senderPre.tokenBalanceFormatted && stateDiff.senderPost.tokenBalanceFormatted) {
        lines.push(
          `${(`Sender ${stateDiff.tokenSymbol ?? 'Token'}`).padEnd(24)} | ${stateDiff.senderPre.tokenBalanceFormatted.padEnd(24)} | ${stateDiff.senderPost.tokenBalanceFormatted.padEnd(24)}`
        );
      }

      // Sender Nonce
      lines.push(
        `${'Sender Nonce'.padEnd(24)} | ${(`Nonce #${stateDiff.senderPre.nonce}`).padEnd(24)} | ${(`Nonce #${stateDiff.senderPost.nonce}`).padEnd(24)}`
      );

      // Recipient State (if applicable)
      if (stateDiff.recipientPre && stateDiff.recipientPost) {
        lines.push(
          `${'Recipient PROS'.padEnd(24)} | ${stateDiff.recipientPre.nativeBalanceFormatted.padEnd(24)} | ${stateDiff.recipientPost.nativeBalanceFormatted.padEnd(24)}`
        );
        if (stateDiff.recipientPre.tokenBalanceFormatted && stateDiff.recipientPost.tokenBalanceFormatted) {
          lines.push(
            `${(`Recipient ${stateDiff.tokenSymbol ?? 'Token'}`).padEnd(24)} | ${stateDiff.recipientPre.tokenBalanceFormatted.padEnd(24)} | ${stateDiff.recipientPost.tokenBalanceFormatted.padEnd(24)}`
          );
        }
      }

      lines.push('-------------------------+--------------------------+--------------------------');
      lines.push(`Net Native Impact: ${stateDiff.netNativeDeltaFormatted}`);
      if (stateDiff.netTokenDeltaFormatted) {
        lines.push(`Net Token Impact:  ${stateDiff.netTokenDeltaFormatted}`);
      }
      lines.push('');
    }

    // Revert Diagnostics & Root Cause Analysis
    if (!isSuccess) {
      lines.push('--------------------------------------------------------------------------------');
      lines.push('⚠️  REVERT ROOT-CAUSE ANALYSIS & DIAGNOSTICS:');
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`  Category:        ${result.revertCategory ?? 'UNKNOWN'}`);
      lines.push(`  Revert Reason:   ${result.revertReason ?? 'Execution reverted without string'}`);
      if (result.revertData) {
        lines.push(`  Revert Hex Data: ${result.revertData}`);
      }
      lines.push('');
      lines.push('  Diagnostics & Remediation Hints:');
      for (const diag of result.diagnostics) {
        lines.push(`    • ${diag}`);
      }
      lines.push('');
    }

    // Prepared Execution Command (if cleared)
    if (isSuccess && result.preparedExecution) {
      lines.push('--------------------------------------------------------------------------------');
      lines.push('🚀 AUTHORIZED EXECUTION TICKET:');
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`  Ticket Hash:     ${result.preparedExecution.executionTicketHash}`);
      lines.push(`  Rec. Gas Limit:  ${result.preparedExecution.recommendedGasLimit.toLocaleString()}`);
      lines.push('  👉 Ready-to-Run Foundry Cast Command:');
      lines.push(`     ${result.preparedExecution.castCommand}`);
      lines.push('');
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }
}
