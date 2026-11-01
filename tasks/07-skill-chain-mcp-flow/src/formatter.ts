import { FlowResult } from './types.js';

export class FlowFormatter {
  static formatReport(result: FlowResult): string {
    const lines: string[] = [];
    const { telemetry, decision, preparedExecution, trace } = result;

    lines.push('================================================================================');
    lines.push('            PHAROS AGENT FLOW: SKILLENGINE + CHAIN MCP COMPOSITION             ');
    lines.push('================================================================================');
    lines.push(`Execution ID:      ${result.executionId}`);
    lines.push(`Timestamp:         ${result.executedAt}`);
    lines.push(`Target Treasury:   ${result.treasuryAddress}`);
    lines.push(`Network:           ${telemetry.network} (Chain ID: ${telemetry.chainId})`);
    lines.push(`Live Block Number: #${telemetry.blockNumber}`);
    lines.push('');

    // Step 1: Chain MCP Output
    lines.push('--------------------------------------------------------------------------------');
    lines.push('1️⃣  STEP 1: LIVE ON-CHAIN TELEMETRY (via Chain MCP)');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`Native PROS Balance:  ${telemetry.nativeBalancePros} PROS ($${(telemetry.nativeBalancePros * 1.25).toFixed(2)} USD)`);
    lines.push(`USDC Balance:         $${telemetry.usdcBalanceUnits.toFixed(2)} USDC`);
    lines.push(`Total Valuation:      $${telemetry.totalValuationUsd.toFixed(2)} USD`);
    lines.push(`Live Gas Price:       ${telemetry.gasPriceGwei} Gwei`);
    lines.push('');

    // Step 2: SkillEngine Decision Output
    lines.push('--------------------------------------------------------------------------------');
    lines.push('2️⃣  STEP 2: SKILLENGINE POLICY DECISION (Ingested Chain MCP Data)');
    lines.push('--------------------------------------------------------------------------------');
    const verdictBadge = decision.verdict === 'IN_EQUILIBRIUM'
      ? '🟢 IN_EQUILIBRIUM (Safe)'
      : decision.verdict === 'REBALANCE_NEEDED'
      ? '🟠 REBALANCE_NEEDED (Drift Exceeded)'
      : '🔴 EMERGENCY_REPLENISH';

    lines.push(`Policy Verdict:       ${verdictBadge}`);
    lines.push(`Target Allocation:    ${decision.policySummary.targetRatio}`);
    lines.push(`Actual Allocation:    ${decision.policySummary.actualRatio}`);
    lines.push(`Portfolio Drift:      ${decision.policySummary.driftPercentage}% ${decision.policySummary.driftExceedsTolerance ? '(Exceeds tolerance)' : '(Within tolerance)'}`);
    lines.push(`Action Required:      ${decision.actionRequired ? 'YES' : 'NO'}`);
    lines.push(`Decision Rationale:   ${decision.explanation}`);
    lines.push('');

    // Step 3: Prepared Execution (if required)
    if (preparedExecution) {
      lines.push('--------------------------------------------------------------------------------');
      lines.push('3️⃣  STEP 3: ACTION PREPARATION (Automated Skill Output)');
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`Recommended Action:   ${decision.rebalanceAction?.type}`);
      lines.push(`Trade Amount:         ${decision.rebalanceAction?.formattedAmount}`);
      lines.push(`Target Protocol:      FaroSwap AMM Router (${preparedExecution.targetContract})`);
      lines.push(`Action Description:   ${preparedExecution.humanDescription}`);
      lines.push(`Method Signature:     ${preparedExecution.methodSignature}`);
      lines.push(`Value:                ${preparedExecution.valueHex}`);
      lines.push(`Calldata:             ${preparedExecution.calldata}`);
      lines.push('');
      lines.push('👉 Ready-to-Execute Foundry Cast Command:');
      lines.push(`   ${preparedExecution.castCommand}`);
      lines.push('');
    }

    // Step 4: Flow Composition Trace
    lines.push('--------------------------------------------------------------------------------');
    lines.push('🔄 COMPOSITION EXECUTION TRACE:');
    lines.push('--------------------------------------------------------------------------------');
    for (const step of trace) {
      lines.push(`[Step ${step.stepNumber}] [${step.component}] ${step.action}`);
      lines.push(`   In:  ${JSON.stringify(step.inputData)}`);
      lines.push(`   Out: ${JSON.stringify(step.outputData)}`);
    }

    lines.push('================================================================================');
    return lines.join('\n');
  }
}
