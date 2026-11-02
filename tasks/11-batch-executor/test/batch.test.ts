import { describe, it, expect } from 'vitest';
import { BatchExecutorEngine, MULTICALL3_ADDRESS } from '../src/batch-engine.js';
import { BatchFormatter } from '../src/formatter.js';
import { BENCHMARK_BATCH_SCENARIOS } from '../src/scenarios.js';

describe('Task 11: Batch Executor Engine & Optimization Matrix', () => {
  const engine = new BatchExecutorEngine();

  it('Requirement 01: Accepts a list of at least 3 independent actions', async () => {
    const optScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_3_ACTIONS_OPTIMIZED')!;
    expect(optScenario.actions.length).toBeGreaterThanOrEqual(3);

    // Verify rejection if fewer than 3 actions are provided
    const twoActions = optScenario.actions.slice(0, 2);
    await expect(engine.executeBatch(twoActions)).rejects.toThrow(
      'Batch Executor requires a list of at least 3 actions'
    );

    // Verify execution succeeds with 3 actions
    const res = await engine.executeBatch(optScenario.actions);
    expect(res.totalActions).toBe(3);
    expect(res.actionResults.length).toBe(3);
  }, 25000);

  it('Requirement 02: Executes actions as a batch via Multicall3 in a single prepared transaction', async () => {
    const optScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_3_ACTIONS_OPTIMIZED')!;
    const res = await engine.executeBatch(optScenario.actions);

    expect(res.strategy).toBe('MULTICALL3_AGGREGATE3');
    expect(res.preparedBatchTransaction.to.toLowerCase()).toBe(MULTICALL3_ADDRESS.toLowerCase());
    expect(res.preparedBatchTransaction.calldata.startsWith('0x82ad56cb')).toBe(true); // aggregate3 selector
    expect(res.preparedBatchTransaction.totalCallsCount).toBe(3);
    expect(res.preparedBatchTransaction.castCommand).toContain('cast send');
    expect(res.preparedBatchTransaction.castCommand).toContain(MULTICALL3_ADDRESS);

    // Verify all 3 independent results returned
    for (let i = 0; i < 3; i++) {
      expect(res.actionResults[i].index).toBe(i);
      expect(res.actionResults[i].success).toBe(true);
      expect(res.actionResults[i].status).toBe('COMPLETED');
      expect(res.actionResults[i].returnData.length).toBeGreaterThan(2);
    }
  }, 25000);

  it('Requirement 03: Reports gas savings and step reduction compared with running individually', async () => {
    const optScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_3_ACTIONS_OPTIMIZED')!;
    const res = await engine.executeBatch(optScenario.actions);
    const { gasEconomics } = res;

    // Step reduction assertion (3 transactions reduced to 1 transaction = 66.7% reduction)
    expect(gasEconomics.individualStepCount).toBe(3);
    expect(gasEconomics.batchStepCount).toBe(1);
    expect(gasEconomics.stepReductionPercentage).toBeGreaterThanOrEqual(60);

    // Gas savings assertions
    expect(gasEconomics.individualEstimatedGasTotal).toBeGreaterThan(gasEconomics.batchEstimatedGas);
    expect(gasEconomics.gasSavedUnits).toBeGreaterThan(20000n);
    expect(gasEconomics.gasSavedPercentage).toBeGreaterThan(20); // typically 30-40%
    expect(gasEconomics.nativeProsSaved).toContain('PROS');
    expect(gasEconomics.usdSaved).toBeGreaterThan(0);
    expect(gasEconomics.oraclePriceUsd).toBeGreaterThan(1000);

    // Formatted report assertions
    const report = BatchFormatter.formatReport(res);
    expect(report).toContain('GAS ECONOMICS & BATCH OPTIMIZATION SAVINGS');
    expect(report).toContain('Net Gas Saved');
    expect(report).toContain('Step Count Reduction');
  }, 25000);

  it('Requirement 04: Handles partial failure clearly: documents which action failed and what happened to the rest', async () => {
    const failScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_4_ACTIONS_WITH_PARTIAL_FAILURE')!;
    const res = await engine.executeBatch(failScenario.actions, 'FAULT_TOLERANT');

    expect(res.overallStatus).toBe('PARTIAL_FAILURE_HANDLED');
    expect(res.successfulCount).toBe(3);
    expect(res.failedCount).toBe(1);

    // Action 0 & 1: Succeeded
    expect(res.actionResults[0].success).toBe(true);
    expect(res.actionResults[0].status).toBe('COMPLETED');
    expect(res.actionResults[1].success).toBe(true);
    expect(res.actionResults[1].status).toBe('COMPLETED');

    // Action 2: Failed with custom revert string
    const failedAct = res.actionResults[2];
    expect(failedAct.success).toBe(false);
    expect(failedAct.status).toBe('FAILED_ALLOWED');
    expect(failedAct.revertReason).toContain('The year just became eeeveen woooorse');

    // Action 3: Succeeded (Executed after the failing action due to fault isolation)
    const postFailAct = res.actionResults[3];
    expect(postFailAct.success).toBe(true);
    expect(postFailAct.status).toBe('COMPLETED');

    // Partial failure post-mortem report
    expect(res.partialFailurePostMortem).toBeDefined();
    expect(res.partialFailurePostMortem?.failedIndex).toBe(2);
    expect(res.partialFailurePostMortem?.revertReason).toContain('The year just became eeeveen woooorse');
    expect(res.partialFailurePostMortem?.impactOnSubsequentActions).toContain('Fault-tolerant isolation engaged');

    // Formatted report verification
    const report = BatchFormatter.formatReport(res);
    expect(report).toContain('⚠️  PARTIAL FAILURE POST-MORTEM & FAULT ISOLATION');
    expect(report).toContain('Action #2');
    expect(report).toContain('🔴 FAIL');
  }, 25000);

  it('Supports strict atomic failure mode when fault tolerance is disabled', async () => {
    const failScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_4_ACTIONS_WITH_PARTIAL_FAILURE')!;
    const res = await engine.executeBatch(failScenario.actions, 'STRICT_ATOMIC');

    // When allowFailure is false for a reverting call, the batch halts atomically
    expect(res.overallStatus).toBe('BATCH_REVERTED');
    expect(res.successfulCount).toBe(0);
    expect(res.failedCount).toBe(4);
    for (const act of res.actionResults) {
      expect(act.status).toBe('FAILED_FATAL');
    }
  }, 25000);
});
