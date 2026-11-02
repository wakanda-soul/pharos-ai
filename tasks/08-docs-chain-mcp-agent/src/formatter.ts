import { ExplainAndActResult } from './types.js';

export class AgentFormatter {
  static formatReport(result: ExplainAndActResult): string {
    const lines: string[] = [];
    const { target, docsExplanation, chainCall, interpretation } = result;

    lines.push('================================================================================');
    lines.push('            PHAROS DOCS MCP + CHAIN MCP AGENT: EXPLAIN & ACT                    ');
    lines.push('================================================================================');
    lines.push(`Execution ID:      ${result.executionId}`);
    lines.push(`Timestamp:         ${result.timestamp}`);
    lines.push(`Contract Name:     ${target.contractName}`);
    lines.push(`Contract Address:  ${target.contractAddress}`);
    lines.push(`Function:          ${target.functionSignature}`);
    lines.push(`Network:           ${chainCall.network} (Chain ID: ${chainCall.chainId})`);
    lines.push(`Block Height:      #${chainCall.blockNumber}`);
    lines.push('');

    // Phase 1: Docs MCP Explanation
    lines.push('--------------------------------------------------------------------------------');
    lines.push('📖 PHASE 1: FUNCTION EXPLANATION (via Developer Docs MCP)');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`Query to Docs:     "${docsExplanation.query}"`);
    lines.push(`What It Does:      ${docsExplanation.explanation}`);
    lines.push('');
    lines.push('Parameters:');
    for (const [param, desc] of Object.entries(docsExplanation.parametersDescription)) {
      lines.push(`  * ${param}: ${desc}`);
    }
    lines.push('');
    lines.push(`Returns:           ${docsExplanation.returnDescription}`);
    lines.push('');
    lines.push('📚 Referenced Official Documentation Sources:');
    for (const src of docsExplanation.sources) {
      lines.push(`  - [${src.title}] (${src.url})`);
    }
    lines.push('');

    // Phase 2: Chain MCP Call
    lines.push('--------------------------------------------------------------------------------');
    lines.push('⛓️  PHASE 2: ON-CHAIN CALL EXECUTION (via Chain MCP)');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`Target:            ${chainCall.contractAddress}`);
    lines.push(`Method Signature:  ${chainCall.functionSignature}`);
    lines.push(`Calldata:          ${chainCall.rawCalldata}`);
    lines.push(`Raw Output (Hex):  ${chainCall.rawOutputHex}`);
    lines.push(`Decoded Output:    ${JSON.stringify(chainCall.decodedResult, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
    lines.push('');

    // Phase 3: Contextual Interpretation
    lines.push('--------------------------------------------------------------------------------');
    lines.push('🧠 PHASE 3: CONTEXTUAL INTERPRETATION (Theory + On-Chain Reality)');
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`Verdict:           ✅ ${interpretation.consistencyWithDocs}`);
    lines.push(`Summary:           ${interpretation.summary}`);
    lines.push('');
    lines.push('Key Insights:');
    for (const insight of interpretation.insights) {
      lines.push(`  💡 ${insight}`);
    }
    lines.push('');
    lines.push(`Detailed Analysis:`);
    lines.push(`  ${interpretation.detailedAnalysis}`);
    lines.push('================================================================================');

    return lines.join('\n');
  }
}
