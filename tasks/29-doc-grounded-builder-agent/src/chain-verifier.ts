/**
 * Task 29: Doc-Grounded Builder Agent
 * Chain Verifier: inspects execution results against the initial documentation plan,
 * verifying contract provenance, calldata selectors, and block state.
 */

import {
  DocGroundedExecutionPlan,
  ExecutedStepResult,
  BuilderAgentOverallStatus,
} from './types.js';

export interface VerificationReport {
  readonly isPlanSatisfied: boolean;
  readonly overallStatus: BuilderAgentOverallStatus;
  readonly stepsVerifiedCount: number;
  readonly totalStepsPlanned: number;
  readonly detailedAuditNotes: readonly string[];
}

export class ChainOutcomeVerifier {
  /**
   * Verifies execution outcomes against the doc-grounded plan.
   */
  public verifyOutcome(
    plan: DocGroundedExecutionPlan,
    executedSteps: readonly ExecutedStepResult[]
  ): VerificationReport {
    if (!plan.isDocsGrounded) {
      return {
        isPlanSatisfied: false,
        overallStatus: 'UNSUPPORTED_DOCS_GAP',
        stepsVerifiedCount: 0,
        totalStepsPlanned: 0,
        detailedAuditNotes: [
          plan.docCoverageDiagnosis || 'Request not grounded in official Pharos documentation.',
        ],
      };
    }

    const notes: string[] = [];
    let verifiedCount = 0;
    let hasFundMovements = false;

    if (executedSteps.length !== plan.plannedSteps.length) {
      notes.push(
        `Discrepancy: Plan specified ${plan.plannedSteps.length} steps, but ${executedSteps.length} steps were executed.`
      );
    }

    for (let i = 0; i < plan.plannedSteps.length; i++) {
      const planned = plan.plannedSteps[i];
      const executed = executedSteps.find((e) => e.stepIndex === planned.stepIndex);

      if (!executed) {
        notes.push(`Step #${planned.stepIndex} (${planned.functionSignature}) was NOT executed.`);
        continue;
      }

      // Check contract matching
      if (planned.targetContractAddress.toLowerCase() !== executed.targetContract.toLowerCase()) {
        notes.push(
          `Contract address mismatch on step #${planned.stepIndex}: planned ${planned.targetContractAddress}, observed ${executed.targetContract}.`
        );
        continue;
      }

      if (planned.isFundMoving) {
        hasFundMovements = true;
        if (executed.status !== 'PREPARED_FOR_SIGNATURE' || !executed.unsignedTransactionPayload) {
          notes.push(
            `Safety violation on step #${planned.stepIndex}: Fund-moving step was not prepared as an unsigned payload.`
          );
          continue;
        }

        // Validate 4-byte EVM function selector
        const calldata = executed.unsignedTransactionPayload.encodedCalldata;
        if (planned.functionName === 'approve' && !calldata.startsWith('0x095ea7b3')) {
          notes.push(`Selector validation failed: Expected approve 0x095ea7b3, got ${calldata.slice(0, 10)}.`);
          continue;
        }
        if (planned.functionName === 'deposit' && !calldata.startsWith('0x6e553f65')) {
          notes.push(`Selector validation failed: Expected deposit 0x6e553f65, got ${calldata.slice(0, 10)}.`);
          continue;
        }

        notes.push(
          `Step #${planned.stepIndex} Verified: Unsigned calldata encoded for ${planned.functionSignature} on ${planned.targetContractName} (Selector: ${calldata.slice(0, 10)}, Gas: ${executed.unsignedTransactionPayload.estimatedGasLimit}). Zero key custody maintained.`
        );
      } else {
        if (executed.status !== 'SUCCESS') {
          notes.push(`Execution failed on step #${planned.stepIndex}: ${executed.errorDetails || 'Unknown error'}`);
          continue;
        }
        notes.push(
          `Step #${planned.stepIndex} Verified: On-chain state query verified at block #${executed.blockNumberObserved}. Result: ${executed.humanReadableOutcome}`
        );
      }

      verifiedCount++;
    }

    const isSatisfied = verifiedCount === plan.plannedSteps.length;
    let overallStatus: BuilderAgentOverallStatus = 'COMPLETED_AND_VERIFIED';
    if (!isSatisfied) {
      overallStatus = 'EXECUTION_FAILED';
    } else if (hasFundMovements) {
      overallStatus = 'PREPARED_FOR_USER_SIGNATURE';
    }

    return {
      isPlanSatisfied: isSatisfied,
      overallStatus,
      stepsVerifiedCount: verifiedCount,
      totalStepsPlanned: plan.plannedSteps.length,
      detailedAuditNotes: notes,
    };
  }
}
