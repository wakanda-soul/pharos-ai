/**
 * Task 29: Doc-Grounded Builder Agent
 * Terminal Formatter: visually expressive cards, documentation citation tables,
 * calldata snippets, and audit reports.
 */

import {
  DocGroundedBuilderOutcome,
  DocCitationSource,
  ExecutedStepResult,
} from './types.js';

export function formatBanner(title: string, subtitle: string): string {
  const bar = '═'.repeat(76);
  return [
    `\n${bar}`,
    `  🛠️  PHAROS DOC-GROUNDED BUILDER AGENT — ${title.toUpperCase()}`,
    `  ${subtitle}`,
    `${bar}\n`,
  ].join('\n');
}

export function formatOutcomeCard(outcome: DocGroundedBuilderOutcome): string {
  const lines: string[] = [];

  let statusBadge = '🟢 COMPLETED & VERIFIED';
  if (outcome.overallStatus === 'PREPARED_FOR_USER_SIGNATURE') {
    statusBadge = '🔐 PREPARED FOR USER SIGNATURE (ZERO KEY CUSTODY)';
  } else if (outcome.overallStatus === 'UNSUPPORTED_DOCS_GAP') {
    statusBadge = '🛑 UNSUPPORTED (OFFICIAL DOCS GAP DETECTED)';
  } else if (outcome.overallStatus === 'EXECUTION_FAILED') {
    statusBadge = '❌ EXECUTION FAILED';
  }

  lines.push(`  ┌────────────────────────────────────────────────────────────────────────┐`);
  lines.push(`  │ ❓ USER INQUIRY: "${outcome.userQuery.padEnd(52, ' ').slice(0, 52)}" │`);
  lines.push(`  │ 📊 STATUS:       ${statusBadge.padEnd(53, ' ').slice(0, 53)} │`);
  lines.push(`  └────────────────────────────────────────────────────────────────────────┘`);

  if (!outcome.isDocsCovered) {
    lines.push(`\n  ⚠️  Documentation Gap Explanation:`);
    lines.push(`     ${outcome.plan.docCoverageDiagnosis}\n`);
    lines.push(`  🛡️  Zero-Guessing Sentinel Verdict: REFUSED UNGROUNDED IMPROVISATION.`);
    return lines.join('\n');
  }

  // Citations
  lines.push(`\n  📚 Official Documentation Provenance:`);
  for (const src of outcome.plan.citedSources) {
    lines.push(`     • Title:   ${src.title}`);
    lines.push(`       URL:     ${src.url}`);
    if (src.sectionHeading) lines.push(`       Section: ${src.sectionHeading}`);
    if (src.excerptSnippet) lines.push(`       Excerpt: "${src.excerptSnippet}"`);
  }

  // Plan Explanation
  lines.push(`\n  💡 Grounded Operational Rationale:`);
  lines.push(`     ${outcome.plan.conceptualExplanation}`);

  // Executed Steps Table
  lines.push(`\n  ⚙️  Executed Action Sequence:`);
  for (const step of outcome.executedSteps) {
    const isFund = !!step.unsignedTransactionPayload;
    const typeLabel = isFund ? '🔐 FUND-MOVING (PREPARED CALLDATA)' : '🔍 NON-CUSTODIAL READ';
    lines.push(`     [Step #${step.stepIndex}] ${typeLabel}`);
    lines.push(`       Target:    ${step.targetContract}`);
    lines.push(`       Signature: ${step.functionSignature}`);
    lines.push(`       Outcome:   ${step.humanReadableOutcome}`);

    if (step.unsignedTransactionPayload) {
      lines.push(`       Calldata:  ${step.unsignedTransactionPayload.encodedCalldata}`);
      lines.push(`       Gas Limit: ${step.unsignedTransactionPayload.estimatedGasLimit}`);
      lines.push(`       CLI Cast:  ${step.unsignedTransactionPayload.castSendCommand}`);
    }
    if (step.verifiedOnChain) {
      lines.push(`       Verified:  ✅ Confirmed against Pharos on-chain state (Block #${step.blockNumberObserved || 'Latest'})`);
    }
  }

  return lines.join('\n');
}
