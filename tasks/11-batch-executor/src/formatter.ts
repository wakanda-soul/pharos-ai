import { BatchExecutionResult } from './types.js';

export class BatchFormatter {
  static formatReport(res: BatchExecutionResult): string {
    const lines: string[] = [];

    lines.push('================================================================================');
    lines.push('              PHAROS SKILLENGINE: BATCH EXECUTOR OPTIMIZATION REPORT            ');
    lines.push('================================================================================');
    lines.push(`Batch ID:          ${res.batchId}`);
    lines.push(`Timestamp:         ${res.timestamp}`);
    lines.push(`Network:           ${res.network} (Chain ID: ${res.chainId})`);
    lines.push(`Live Block:        #${res.blockNumber}`);
    lines.push(`Strategy:          ${res.strategy}`);
    lines.push(`Execution Mode:    ${res.mode}`);
    lines.push('');

    // Overall Status
    lines.push('--------------------------------------------------------------------------------');
    lines.push('🎯 BATCH EXECUTION STATUS:');
    lines.push('--------------------------------------------------------------------------------');
    if (res.overallStatus === 'ALL_SUCCEEDED') {
      lines.push(`🟢 [ALL_SUCCEEDED] — All ${res.successfulCount}/${res.totalActions} independent actions executed successfully in a single batch!`);
    } else if (res.overallStatus === 'PARTIAL_FAILURE_HANDLED') {
      lines.push(`🟠 [PARTIAL_FAILURE_HANDLED] — ${res.successfulCount}/${res.totalActions} actions succeeded. Failing actions isolated via Multicall3.`);
    } else {
      lines.push(`🔴 [BATCH_REVERTED] — Batch execution aborted atomically in STRICT_ATOMIC mode.`);
    }
    lines.push('');

    // Action Execution Pipeline
    lines.push('--------------------------------------------------------------------------------');
    lines.push('📋 ACTION EXECUTION PIPELINE (Bundled Into 1 Transaction):');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(
      `${'#'.padEnd(3)} | ${'ACTION NAME'.padEnd(30)} | ${'STATUS'.padEnd(10)} | ${'DETAILS / REVERT REASON'}`
    );
    lines.push('----+--------------------------------+------------+---------------------------------');

    for (const act of res.actionResults) {
      const statusBadge = act.success ? '🟢 OK' : '🔴 FAIL';
      const details = act.success
        ? (act.decodedReturn ?? 'Success')
        : (act.revertReason ?? 'Failed');
      lines.push(
        `${act.index.toString().padEnd(3)} | ${act.actionName.slice(0, 30).padEnd(30)} | ${statusBadge.padEnd(10)} | ${details}`
      );
    }
    lines.push('----+--------------------------------+------------+---------------------------------');
    lines.push('');

    // Partial Failure Post-Mortem (Requirement 04)
    if (res.partialFailurePostMortem) {
      const pm = res.partialFailurePostMortem;
      lines.push('--------------------------------------------------------------------------------');
      lines.push('⚠️  PARTIAL FAILURE POST-MORTEM & FAULT ISOLATION:');
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`  Failing Step:    Action #${pm.failedIndex} ("${pm.failedActionName}")`);
      lines.push(`  Target Contract: ${pm.target}`);
      lines.push(`  Revert Reason:   ${pm.revertReason}`);
      lines.push(`  Isolation Trace: ${pm.impactOnSubsequentActions}`);
      lines.push('');
    }

    // Gas Economics & Savings Matrix (Requirement 03)
    const { gasEconomics } = res;
    lines.push('--------------------------------------------------------------------------------');
    lines.push('⚡ GAS ECONOMICS & BATCH OPTIMIZATION SAVINGS:');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`${'EXECUTION MODE'.padEnd(28)} | ${'TRANSACTION STEPS'.padEnd(20)} | ${'ESTIMATED GAS'}`);
    lines.push('-----------------------------+----------------------+--------------------------');
    lines.push(
      `${'Individual Transactions'.padEnd(28)} | ${(`${gasEconomics.individualStepCount} separate txs`).padEnd(20)} | ${gasEconomics.individualEstimatedGasTotal.toLocaleString()} gas`
    );
    lines.push(
      `${'Batch Multicall3 Execution'.padEnd(28)} | ${(`${gasEconomics.batchStepCount} atomic tx`).padEnd(20)} | ${gasEconomics.batchEstimatedGas.toLocaleString()} gas`
    );
    lines.push('-----------------------------+----------------------+--------------------------');
    lines.push(`  👉 Net Gas Saved:        ${gasEconomics.gasSavedUnits.toLocaleString()} units (${gasEconomics.gasSavedPercentage.toFixed(2)}% saved)`);
    lines.push(`  👉 Step Count Reduction:  ${gasEconomics.stepReductionPercentage.toFixed(1)}% reduction (${gasEconomics.individualStepCount} txs -> ${gasEconomics.batchStepCount} tx)`);
    lines.push(`  👉 Native PROS Saved:    ${gasEconomics.nativeProsSaved}`);
    if (gasEconomics.usdSaved !== undefined) {
      lines.push(`  👉 USD Equivalent Saved:  ~$${gasEconomics.usdSaved.toFixed(4)} USD (at $${gasEconomics.oraclePriceUsd?.toLocaleString()}/ETH)`);
    }
    lines.push('');

    // Prepared Transaction Command
    lines.push('--------------------------------------------------------------------------------');
    lines.push('🚀 PREPARED BATCH TRANSACTION (Foundry Cast):');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`  Target Contract: ${res.preparedBatchTransaction.to} (Multicall3)`);
    lines.push(`  Gas Limit Cap:   ${res.preparedBatchTransaction.recommendedGasLimit.toLocaleString()}`);
    lines.push('  👉 Foundry Cast Command:');
    lines.push(`     ${res.preparedBatchTransaction.castCommand}`);
    lines.push('================================================================================');

    return lines.join('\n');
  }
}
