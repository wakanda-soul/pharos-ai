/**
 * Task 29: Doc-Grounded Builder Agent
 * Master Agent: handles "how do I do X on Pharos?" end-to-end.
 * Grounds requests in Developer Docs MCP, executes non-custodial actions,
 * prepares unsigned calldata for fund movements, and verifies on-chain outcomes.
 */

import { DocCitationPlanner } from './doc-planner.js';
import { ActionExecutor } from './action-executor.js';
import { ChainOutcomeVerifier } from './chain-verifier.js';
import {
  DocGroundedBuilderOutcome,
  ExecutedStepResult,
} from './types.js';

export class DocGroundedBuilderAgent {
  private readonly planner: DocCitationPlanner;
  private readonly executor: ActionExecutor;
  private readonly verifier: ChainOutcomeVerifier;

  constructor(
    planner: DocCitationPlanner = new DocCitationPlanner(),
    executor: ActionExecutor = new ActionExecutor(),
    verifier: ChainOutcomeVerifier = new ChainOutcomeVerifier()
  ) {
    this.planner = planner;
    this.executor = executor;
    this.verifier = verifier;
  }

  public getPlanner(): DocCitationPlanner {
    return this.planner;
  }

  public getExecutor(): ActionExecutor {
    return this.executor;
  }

  public getVerifier(): ChainOutcomeVerifier {
    return this.verifier;
  }

  /**
   * Main entrypoint: processes a user's natural language inquiry end-to-end.
   */
  public async handleHowDoIRequest(userQuery: string): Promise<DocGroundedBuilderOutcome> {
    // Phase 1: Planning via Docs MCP with authoritative citations
    const plan = this.planner.planFromDocs(userQuery);

    // Negative guard: if the docs do not cover the topic, halt gracefully without improvising
    if (!plan.isDocsGrounded) {
      return {
        userQuery,
        isDocsCovered: false,
        plan,
        executedSteps: [],
        overallStatus: 'UNSUPPORTED_DOCS_GAP',
        finalSummaryReport:
          `❌ REQUEST NOT COVERED IN PHAROS DOCUMENTATION\n\n` +
          `Query: "${userQuery}"\n` +
          `Diagnosis: ${plan.docCoverageDiagnosis}\n` +
          `Policy: The agent strictly refrains from guessing unverified smart contract addresses or improvising non-existent protocol standards.`,
      };
    }

    // Phase 2: Action Execution
    const executedSteps: ExecutedStepResult[] = [];
    for (const step of plan.plannedSteps) {
      const stepResult = await this.executor.executeStep(step);
      executedSteps.push(stepResult);
    }

    // Phase 3: On-Chain Outcome Verification
    const verification = this.verifier.verifyOutcome(plan, executedSteps);

    // Phase 4: Structured Summary Synthesis
    const reportLines: string[] = [];
    reportLines.push(`📋 DOC-GROUNDED EXECUTION REPORT`);
    reportLines.push(`Question: "${userQuery}"`);
    reportLines.push(`Status: ${verification.overallStatus}`);
    reportLines.push(`\n📚 Official Documentation Provenance:`);
    for (const src of plan.citedSources) {
      reportLines.push(`  - Source: ${src.title} (${src.url})`);
      if (src.sectionHeading) reportLines.push(`    Section: ${src.sectionHeading}`);
      if (src.excerptSnippet) reportLines.push(`    Excerpt: "${src.excerptSnippet}"`);
    }

    reportLines.push(`\n⚙️ Executed Steps (${verification.stepsVerifiedCount}/${verification.totalStepsPlanned} Verified):`);
    for (const stepRes of executedSteps) {
      reportLines.push(`  [Step #${stepRes.stepIndex}] ${stepRes.functionSignature} on ${stepRes.targetContract}`);
      reportLines.push(`     Outcome: ${stepRes.humanReadableOutcome}`);
      if (stepRes.unsignedTransactionPayload) {
        reportLines.push(`     Cast Command: ${stepRes.unsignedTransactionPayload.castSendCommand}`);
      }
    }

    return {
      userQuery,
      isDocsCovered: true,
      plan,
      executedSteps,
      overallStatus: verification.overallStatus,
      finalSummaryReport: reportLines.join('\n'),
    };
  }
}
