import { describe, it, expect, beforeEach } from 'vitest';
import { SagaOrchestrator } from '../src/saga-orchestrator.js';
import { FaultClassifier } from '../src/fault-classifier.js';
import { SagaStateJournal } from '../src/state-journal.js';
import {
  DEFAULT_DEFI_SAGA_STEPS,
  ApproveRouterStep,
  SwapTokenStep,
  DepositCollateralStep,
} from '../src/steps/defi-workflow-steps.js';
import type {
  SagaExecutionContext,
  SagaStepDefinition,
} from '../src/types.js';

describe('Task 23: Saga Executor Specification (SkillEngine)', () => {
  const TREASURY_WALLET = '0x71C80000000000000000000000000000000071C8' as const;
  const FAROSWAP_ROUTER = '0x1000000000000000000000000000000000000001' as const;
  const HARBOR_POOL = '0x2000000000000000000000000000000000000002' as const;
  const USDC_ADDRESS = '0xC879C018dB60520F4355C26eD1a6D572cdAC1815' as const;

  function createFreshContext(options: { forceFailureStep?: number } = {}): SagaExecutionContext {
    return {
      sagaId: `saga-run-${Date.now().toString(36)}`,
      initiatorWalletAddress: TREASURY_WALLET,
      targetProtocolDirectory: {
        FaroSwapRouter: FAROSWAP_ROUTER,
        HarborLendingPool: HARBOR_POOL,
      },
      allocatedInputAsset: {
        tokenSymbol: 'USDC',
        tokenAddress: USDC_ADDRESS,
        nominalAmount: '10000',
        usdValuation: 10000,
      },
      accumulatedGasExpensePros: 0,
      stepOutputRegistry: {},
      forceFailureAtStepIndex: options.forceFailureStep,
      executionNotes: [],
    };
  }

  describe('Requirement 01: At least 3 dependent steps, each verified before next starts', () => {
    it('defines at least 3 sequential dependent steps in canonical workflow', () => {
      expect(DEFAULT_DEFI_SAGA_STEPS.length).toBeGreaterThanOrEqual(3);
      expect(DEFAULT_DEFI_SAGA_STEPS[0].orderIndex).toBe(1);
      expect(DEFAULT_DEFI_SAGA_STEPS[1].orderIndex).toBe(2);
      expect(DEFAULT_DEFI_SAGA_STEPS[2].orderIndex).toBe(3);

      expect(DEFAULT_DEFI_SAGA_STEPS[0].stepIdentifier).toBe('approve-faroswap-router');
      expect(DEFAULT_DEFI_SAGA_STEPS[1].stepIdentifier).toBe('swap-usdc-to-pros');
      expect(DEFAULT_DEFI_SAGA_STEPS[2].stepIdentifier).toBe('deposit-to-harbor-pool');
    });

    it('rejects sagas with fewer than 3 steps with an explicit error', () => {
      const incompleteSteps: SagaStepDefinition[] = [ApproveRouterStep, SwapTokenStep];
      expect(() => new SagaOrchestrator(incompleteSteps)).toThrow(/requires at least 3 dependent steps/i);
    });

    it('verifies transaction receipt status === 1 for each step before advancing', async () => {
      const orchestrator = new SagaOrchestrator();
      const context = createFreshContext();

      const report = await orchestrator.executeSagaWorkflow(context);
      expect(report.isFullySuccessful).toBe(true);
      expect(report.stepsCompletedSuccessfully).toBe(3);

      // Verify each step output contains verified block height
      expect(context.stepOutputRegistry['approve-faroswap-router']).toBeDefined();
      expect(context.stepOutputRegistry['swap-usdc-to-pros']).toBeDefined();
      expect(context.stepOutputRegistry['deposit-to-harbor-pool']).toBeDefined();

      const notes = context.executionNotes;
      expect(notes.some((n) => n.includes('Step 1 Verified'))).toBe(true);
      expect(notes.some((n) => n.includes('Step 2 Verified'))).toBe(true);
      expect(notes.some((n) => n.includes('Step 3 Verified'))).toBe(true);
    });
  });

  describe('Requirement 02: Defined retry policy for transient failures', () => {
    const faultClassifier = new FaultClassifier();

    it('accurately identifies transient network errors and gas spikes', () => {
      const gasSpike = faultClassifier.evaluateFailureSeverity(
        new Error('replacement transaction underpriced: max fee per gas too low'),
      );
      expect(gasSpike.isTransient).toBe(true);
      expect(gasSpike.failureCategory).toBe('GAS_SPIKE_UNDERPRICED');
      expect(gasSpike.remediationAdvice).toContain('Escalating gas price');

      const droppedTx = faultClassifier.evaluateFailureSeverity(
        new Error('transaction was not mined within 50 blocks, dropped from mempool'),
      );
      expect(droppedTx.isTransient).toBe(true);
      expect(droppedTx.failureCategory).toBe('DROPPED_TRANSACTION');

      const nonceError = faultClassifier.evaluateFailureSeverity(
        new Error('nonce too low: account nonce 42 already committed'),
      );
      expect(nonceError.isTransient).toBe(true);
      expect(nonceError.failureCategory).toBe('NONCE_DESYNCHRONIZATION');

      const timeoutError = faultClassifier.evaluateFailureSeverity(
        new Error('HTTP 504 Gateway Timeout while fetching receipt from RPC'),
      );
      expect(timeoutError.isTransient).toBe(true);
      expect(timeoutError.failureCategory).toBe('RPC_TIMEOUT');
    });

    it('classifies EVM contract execution reverts as fatal non-transient failures', () => {
      const evmRevert = faultClassifier.evaluateFailureSeverity(
        new Error('execution reverted: Harbor Lending Pool collateral deposit ceiling breached (PoolCapExceeded)'),
      );
      expect(evmRevert.isTransient).toBe(false);
      expect(evmRevert.remediationAdvice).toContain('compensating saga rollback');
    });

    it('computes exponential backoff delays with jitter and gas price escalation', () => {
      const delay1 = faultClassifier.computeBackoffDelayMilliseconds(1);
      const delay2 = faultClassifier.computeBackoffDelayMilliseconds(2);
      const delay3 = faultClassifier.computeBackoffDelayMilliseconds(3);

      expect(delay1).toBeGreaterThanOrEqual(400);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);

      // Gas price escalation: +20% bump
      const baseGasPrice = 1000000000n; // 1 Gwei
      const escalated = faultClassifier.computeEscalatedGasPrice(baseGasPrice);
      expect(escalated).toBe(1200000000n); // 1.2 Gwei (+20%)
    });
  });

  describe('Requirement 03: Defined compensation/rollback path when a step permanently fails', () => {
    it('executes reverse compensation flow when Step 3 fails permanently', async () => {
      const orchestrator = new SagaOrchestrator();
      const context = createFreshContext({ forceFailureStep: 3 });

      const report = await orchestrator.executeSagaWorkflow(context);

      expect(report.isFullySuccessful).toBe(false);
      expect(report.wasCompensated).toBe(true);
      expect(report.finalPhase).toBe('COMPENSATED_CLEANLY');
      expect(report.stepsCompletedSuccessfully).toBe(2); // Steps 1 & 2 completed forward
      expect(report.compensatingStepsExecuted).toBe(2); // Steps 2 & 1 rolled back in reverse

      // Check that intermediate swapped asset was reversed and cleared
      expect(context.swappedIntermediateAsset).toBeUndefined();

      // Check output registry reflects revocation and reversal
      const approveState = context.stepOutputRegistry['approve-faroswap-router'] as Record<string, unknown>;
      expect(approveState.allowanceRevoked).toBe(true);
      expect(approveState.currentAllowance).toBe('0');

      const swapState = context.stepOutputRegistry['swap-usdc-to-pros'] as Record<string, unknown>;
      expect(swapState.swapReversed).toBe(true);

      expect(report.executiveSummary).toContain('Automated compensating transactions triggered');
      expect(report.executiveSummary).toContain('zero assets stranded');
    });

    it('executes single-step rollback when Step 2 fails permanently', async () => {
      const orchestrator = new SagaOrchestrator();
      const context = createFreshContext({ forceFailureStep: 2 });

      const report = await orchestrator.executeSagaWorkflow(context);

      expect(report.isFullySuccessful).toBe(false);
      expect(report.wasCompensated).toBe(true);
      expect(report.finalPhase).toBe('COMPENSATED_CLEANLY');
      expect(report.stepsCompletedSuccessfully).toBe(1); // Only Step 1 completed
      expect(report.compensatingStepsExecuted).toBe(1); // Only Step 1 rolled back

      const approveState = context.stepOutputRegistry['approve-faroswap-router'] as Record<string, unknown>;
      expect(approveState.allowanceRevoked).toBe(true);
      expect(approveState.currentAllowance).toBe('0');
    });
  });

  describe('Requirement 04: State log showing exactly which step the saga is in at any time', () => {
    it('records real-time phase transitions in the state journal', async () => {
      const orchestrator = new SagaOrchestrator();
      const context = createFreshContext();

      const report = await orchestrator.executeSagaWorkflow(context);
      const events = report.stateJournalEvents;

      expect(events.length).toBeGreaterThanOrEqual(7);
      const phases = events.map((e) => e.sagaPhase);

      expect(phases).toContain('INITIALIZED');
      expect(phases).toContain('IN_PROGRESS');
      expect(phases).toContain('STEP_CONFIRMED');
      expect(phases).toContain('COMPLETED_SUCCESS');

      // Timeline visualization
      const journal = orchestrator.getStateJournal();
      const timeline = journal.renderAsciiExecutionTimeline();
      expect(timeline).toContain('SAGA STATE TRANSITION JOURNAL');
      expect(timeline).toContain('ERC-20 Token Approval');
      expect(timeline).toContain('AMM Token Swap');
      expect(timeline).toContain('Harbor Protocol Collateral Supply');
    });

    it('records retry and rollback transitions in state journal during failure run', async () => {
      const orchestrator = new SagaOrchestrator();
      const context = createFreshContext({ forceFailureStep: 3 });

      const report = await orchestrator.executeSagaWorkflow(context);
      const phases = report.stateJournalEvents.map((e) => e.sagaPhase);

      expect(phases).toContain('FAILED_FATAL');
      expect(phases).toContain('COMPENSATING');
      expect(phases).toContain('COMPENSATED_CLEANLY');

      const timeline = orchestrator.getStateJournal().renderAsciiExecutionTimeline();
      expect(timeline).toContain('FAILED_FATAL');
      expect(timeline).toContain('COMPENSATING');
      expect(timeline).toContain('COMPENSATED_CLEANLY');
    });
  });

  describe('Requirement 05: Shows one fully successful run and one forced-failure run with recovery', () => {
    it('executes a fully successful run from start to finish', async () => {
      const orchestrator = new SagaOrchestrator();
      const context = createFreshContext();

      const successReport = await orchestrator.executeSagaWorkflow(context);

      expect(successReport.finalPhase).toBe('COMPLETED_SUCCESS');
      expect(successReport.isFullySuccessful).toBe(true);
      expect(successReport.wasCompensated).toBe(false);
      expect(successReport.stepsCompletedSuccessfully).toBe(3);
      expect(successReport.compensatingStepsExecuted).toBe(0);
      expect(successReport.totalGasExpendedPros).toBeGreaterThan(0);
      expect(successReport.finalContext.depositedFinalAsset).toBeDefined();
      expect(successReport.finalContext.depositedFinalAsset?.nominalAmount).toBe('6666.67');
      expect(successReport.executiveSummary).toContain('succeeded in full');
    });

    it('executes a forced-failure run with automated recovery and compensation', async () => {
      const orchestrator = new SagaOrchestrator();
      const failureContext = createFreshContext({ forceFailureStep: 3 });

      const failureReport = await orchestrator.executeSagaWorkflow(failureContext);

      expect(failureReport.finalPhase).toBe('COMPENSATED_CLEANLY');
      expect(failureReport.isFullySuccessful).toBe(false);
      expect(failureReport.wasCompensated).toBe(true);
      expect(failureReport.stepsCompletedSuccessfully).toBe(2);
      expect(failureReport.compensatingStepsExecuted).toBe(2);
      expect(failureReport.finalContext.depositedFinalAsset).toBeUndefined();
      expect(failureReport.finalContext.swappedIntermediateAsset).toBeUndefined();
      expect(failureReport.executiveSummary).toContain('recovered cleanly');
    });
  });
});
