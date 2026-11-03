/**
 * Task 29: Doc-Grounded Builder Agent
 * Core types, citation schemas, execution blueprints, and provenance models.
 * 
 * Answers "how do I do X on Pharos?" end to end:
 * 1. Finds answers in Developer Docs MCP and synthesizes an action plan with cited sources.
 * 2. Executes the plan via Chain MCP and prepares unsigned calldata for any fund movements.
 * 3. Verifies on-chain outcome and reports against the original plan.
 * 4. Halts and reports cleanly when requests are not grounded in Pharos docs.
 */

export interface DocCitationSource {
  readonly title: string;
  readonly url: string;
  readonly sectionHeading?: string;
  readonly excerptSnippet?: string;
}

export type ActionStepType =
  | 'CHAIN_READ' // Non-custodial state query via Chain MCP
  | 'PREPARED_CALLDATA' // State-modifying unsigned transaction for user signature
  | 'SIMULATION_CHECK'; // Pre-flight dry-run validation

export interface PlannedActionStep {
  readonly stepIndex: number;
  readonly stepType: ActionStepType;
  readonly description: string;
  readonly targetContractAddress: `0x${string}`;
  readonly targetContractName: string;
  readonly functionName: string;
  readonly functionSignature: string;
  readonly callArguments: readonly unknown[];
  readonly isFundMoving: boolean;
  readonly docCitation: DocCitationSource;
}

export interface DocGroundedExecutionPlan {
  readonly userQuery: string;
  readonly isDocsGrounded: boolean;
  readonly conceptualExplanation: string;
  readonly citedSources: readonly DocCitationSource[];
  readonly plannedSteps: readonly PlannedActionStep[];
  readonly docCoverageDiagnosis?: string;
}

export interface PreparedUnsignedTransaction {
  readonly targetAddress: `0x${string}`;
  readonly encodedCalldata: `0x${string}`;
  readonly valueWei: string;
  readonly castSendCommand: string;
  readonly estimatedGasLimit: string;
  readonly functionSignature: string;
  readonly requiredSignerDescription: string;
}

export interface ExecutedStepResult {
  readonly stepIndex: number;
  readonly status: 'SUCCESS' | 'PREPARED_FOR_SIGNATURE' | 'FAILED' | 'REJECTED_UNGROUNDED';
  readonly targetContract: `0x${string}`;
  readonly functionSignature: string;
  readonly rawResult?: unknown;
  readonly humanReadableOutcome: string;
  readonly unsignedTransactionPayload?: PreparedUnsignedTransaction;
  readonly verifiedOnChain: boolean;
  readonly blockNumberObserved?: number;
  readonly errorDetails?: string;
}

export type BuilderAgentOverallStatus =
  | 'COMPLETED_AND_VERIFIED'
  | 'PREPARED_FOR_USER_SIGNATURE'
  | 'UNSUPPORTED_DOCS_GAP'
  | 'EXECUTION_FAILED';

export interface DocGroundedBuilderOutcome {
  readonly userQuery: string;
  readonly isDocsCovered: boolean;
  readonly plan: DocGroundedExecutionPlan;
  readonly executedSteps: readonly ExecutedStepResult[];
  readonly overallStatus: BuilderAgentOverallStatus;
  readonly finalSummaryReport: string;
}
