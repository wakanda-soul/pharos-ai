import { describe, it, expect } from 'vitest';
import { FlowOrchestrator } from '../src/flow-orchestrator.js';

describe('Task 07: Skill + Chain MCP Flow Composition', () => {
  const orchestrator = new FlowOrchestrator();

  it('Requirement 01: Skill output strictly depends on data fetched via Chain MCP in the same flow', async () => {
    // Run flow with scenario A (Overweight PROS)
    const resultA = await orchestrator.runFlow(
      '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
      { targetUsdcRatio: 0.60, targetProsRatio: 0.40 },
      { usdc: 2000, pros: 6400 } // PROS is 80%
    );

    // Run flow with scenario B (Overweight USDC)
    const resultB = await orchestrator.runFlow(
      '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
      { targetUsdcRatio: 0.60, targetProsRatio: 0.40 },
      { usdc: 9000, pros: 800 } // USDC is 90%
    );

    // Run flow with scenario C (In Equilibrium)
    const resultC = await orchestrator.runFlow(
      '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
      { targetUsdcRatio: 0.60, targetProsRatio: 0.40 },
      { usdc: 6000, pros: 3200 } // 60:40 balanced
    );

    // Verify Skill output changed directly based on chain telemetry
    expect(resultA.decision.rebalanceAction?.type).toBe('SWAP_PROS_TO_USDC');
    expect(resultB.decision.rebalanceAction?.type).toBe('SWAP_USDC_TO_PROS');
    expect(resultC.decision.verdict).toBe('IN_EQUILIBRIUM');
    expect(resultC.decision.actionRequired).toBe(false);
  });

  it('Requirement 02: Flow runs end-to-end from a single user request', async () => {
    const result = await orchestrator.runFlow('0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');

    expect(result).toBeDefined();
    expect(result.executionId).toBeTruthy();
    expect(result.telemetry).toBeDefined();
    expect(result.decision).toBeDefined();
    expect(result.trace.length).toBeGreaterThanOrEqual(2);
  });

  it('Requirement 03: Flow records sequential trace showing components and order of invocation', async () => {
    const result = await orchestrator.runFlow(
      '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
      { targetUsdcRatio: 0.60, targetProsRatio: 0.40 },
      { usdc: 1000, pros: 7200 } // Triggers rebalance
    );

    expect(result.trace.length).toBe(3);

    // Step 1: Chain MCP
    expect(result.trace[0].stepNumber).toBe(1);
    expect(result.trace[0].component).toBe('Chain MCP');

    // Step 2: SkillEngine
    expect(result.trace[1].stepNumber).toBe(2);
    expect(result.trace[1].component).toBe('SkillEngine');

    // Step 3: Action Synthesis
    expect(result.trace[2].stepNumber).toBe(3);
    expect(result.trace[2].component).toBe('Flow Orchestrator');

    // Verify prepared transaction was synthesized
    expect(result.preparedExecution).toBeDefined();
    expect(result.preparedExecution?.targetContract).toBe('0xba3b00c3b0632b6fa622f990924976725227b68a');
    expect(result.preparedExecution?.castCommand).toContain('cast send');
  });

  it('Requirement 04: Successfully fetches real on-chain block and network info from Pharos', async () => {
    const result = await orchestrator.runFlow('0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');

    expect(result.telemetry.chainId).toBe(1672);
    expect(result.telemetry.network).toBe('Pharos Mainnet');
    expect(result.telemetry.blockNumber).toBeGreaterThan(1000000);
  });
});
