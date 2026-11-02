import { GuardianDecision } from './types.js';

export class GuardianFormatter {
  static formatReport(decision: GuardianDecision): string {
    const lines: string[] = [];
    const { telemetry, conditions, verdict, preparedAction } = decision;

    lines.push('================================================================================');
    lines.push('               PHAROS SKILLENGINE: THRESHOLD GUARDIAN DECISION TRACE            ');
    lines.push('================================================================================');
    lines.push(`Execution ID:      ${decision.executionId}`);
    lines.push(`Timestamp:         ${decision.timestamp}`);
    lines.push(`Network:           ${telemetry.network} (Chain ID: ${telemetry.chainId})`);
    lines.push(`Live Block:        #${telemetry.blockNumber}`);
    lines.push('');

    // Table of Evaluated Conditions
    lines.push('--------------------------------------------------------------------------------');
    lines.push('📋 MULTI-CONDITION EVALUATION MATRIX (Read Live From Chain):');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(
      `${'CONDITION NAME'.padEnd(28)} | ${'OBSERVED'.padEnd(16)} | ${'THRESHOLD'.padEnd(18)} | ${'STATUS'}`
    );
    lines.push('-----------------------------+------------------+--------------------+----------');

    for (const c of conditions) {
      const statusBadge = c.passed ? '🟢 PASS' : '🔴 FAIL';
      lines.push(
        `${c.name.slice(0, 28).padEnd(28)} | ${c.formattedObserved.slice(0, 16).padEnd(16)} | ${c.formattedThreshold.slice(0, 18).padEnd(18)} | ${statusBadge}`
      );
    }
    lines.push('-----------------------------+------------------+--------------------+----------');
    lines.push(`Summary: ${decision.passedCount}/${decision.totalConditions} conditions satisfied.`);
    lines.push('');

    // Verdict Section
    lines.push('--------------------------------------------------------------------------------');
    lines.push('⚖️  FINAL DECISION VERDICT:');
    lines.push('--------------------------------------------------------------------------------');
    if (verdict === 'FIRE_ACTION') {
      lines.push('🎯 VERDICT: 🚀 [FIRE_ACTION] — ALL ON-CHAIN CONDITIONS MET');
      lines.push('Execution gate unlocked: Action execution is economically and operationally safe.');
      if (preparedAction) {
        lines.push('');
        lines.push('Prepared Transaction:');
        lines.push(`  Action:          ${preparedAction.actionType}`);
        lines.push(`  Description:     ${preparedAction.description}`);
        lines.push(`  Target Contract: ${preparedAction.targetContract}`);
        lines.push(`  Calldata:        ${preparedAction.calldata}`);
        lines.push(`  👉 Foundry Cast Command:`);
        lines.push(`     ${preparedAction.castCommand}`);
      }
    } else {
      lines.push('🛡️  VERDICT: 🛑 [HOLD_ACTION] — EXECUTION BLOCKED BY GUARDIAN');
      lines.push('Execution gate locked: One or more critical on-chain thresholds were violated.');
      lines.push('');
      lines.push('Blocking Violations:');
      for (const reason of decision.blockingReasons) {
        lines.push(`  ⚠️  ${reason}`);
      }
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }
}
