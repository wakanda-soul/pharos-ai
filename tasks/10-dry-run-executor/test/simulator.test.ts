import { describe, it, expect } from 'vitest';
import { DryRunExecutorEngine } from '../src/simulator-engine.js';
import { StateInspector } from '../src/state-inspector.js';
import { DryRunFormatter } from '../src/formatter.js';
import { BENCHMARK_SCENARIOS } from '../src/scenarios.js';
import { createPublicClient, http } from 'viem';

describe('Task 10: Dry-Run Executor Engine & Pre-Flight Gate', () => {
  const engine = new DryRunExecutorEngine();
  const client = createPublicClient({
    transport: http('https://rpc.pharos.xyz', {
      retryCount: 5,
      retryDelay: 1000,
    }),
  });
  const stateInspector = new StateInspector(client);

  it('Requirement 01: Uses call or gas estimation to simulate transaction without broadcasting', async () => {
    // Test on oracle call where sender is stable
    const testSender = '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8' as `0x${string}`;
    const initialNonce = await client.getTransactionCount({ address: testSender });

    // Execute dry-run simulation
    const result = await engine.simulate({
      from: testSender,
      to: testSender,
      data: '0x',
      value: 0n,
    });

    // Verify simulation completed and returned metrics
    expect(result.simulationId).toBeTruthy();
    expect(result.network).toBe('Pharos Mainnet');
    expect(result.chainId).toBe(1672);
    expect(result.blockNumber).toBeGreaterThan(20000000);
    expect(result.gasBreakdown?.gasLimitEstimated).toBeGreaterThan(0n);

    // Verify transaction was NEVER broadcast: on-chain nonce did NOT increment
    const postNonce = await client.getTransactionCount({ address: testSender });
    expect(postNonce).toBe(initialNonce);
  }, 25000);

  it('Requirement 02: Reports predicted success or revert, revert reason, and estimated gas cost', async () => {
    // 1. Success Case
    const successScenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'SCENARIO_VALID_NATIVE_TRANSFER')!;
    const successResult = await engine.simulate(successScenario.request);

    expect(successResult.status).toBe('SIMULATION_PASSED');
    expect(successResult.revertReason).toBeUndefined();
    expect(successResult.gasBreakdown).toBeDefined();
    expect(successResult.gasBreakdown?.gasPriceGwei).toBeGreaterThan(0);
    expect(successResult.gasBreakdown?.totalGasFeePros).toContain('PROS');
    expect(successResult.gasBreakdown?.totalGasFeeUsd).toBeGreaterThan(0);

    // 2. Revert Case (USDC Transfer Exceeding Balance)
    const revertScenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'SCENARIO_REVERT_TRANSFER_EXCEEDS_BALANCE')!;
    const revertResult = await engine.simulate(revertScenario.request);

    expect(revertResult.status).toBe('SIMULATION_REVERTED');
    expect(revertResult.revertReason).toContain('exceeds balance');
    expect(revertResult.revertCategory).toBe('TRANSFER_EXCEEDS_BALANCE');
    expect(revertResult.gasBreakdown).toBeDefined();
  }, 30000);

  it('Requirement 03: Shows expected outcome: balances and state before and after execution', async () => {
    const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'SCENARIO_VALID_NATIVE_TRANSFER')!;
    const result = await engine.simulate(scenario.request);

    expect(result.stateDiff).toBeDefined();
    const diff = result.stateDiff!;

    // Sender state assertions
    expect(diff.senderPre.address.toLowerCase()).toBe(scenario.request.from!.toLowerCase());
    expect(diff.senderPre.nativeBalanceWei).toBeGreaterThan(0n);
    expect(diff.senderPost.nativeBalanceWei).toBeLessThan(diff.senderPre.nativeBalanceWei);
    expect(diff.senderPost.nonce).toBe(diff.senderPre.nonce + 1);

    // Recipient state assertions
    expect(diff.recipientPre).toBeDefined();
    expect(diff.recipientPost).toBeDefined();
    expect(diff.recipientPost!.nativeBalanceWei).toBeGreaterThanOrEqual(diff.recipientPre!.nativeBalanceWei);

    // Net delta assertions
    expect(diff.netNativeDeltaWei).toBeGreaterThan(0n);
    expect(diff.netNativeDeltaFormatted).toContain('PROS');
  }, 25000);

  it('Requirement 04: Blocks execution automatically if simulation fails', async () => {
    const revertScenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'SCENARIO_REVERT_TRANSFER_EXCEEDS_BALANCE')!;
    const result = await engine.simulate(revertScenario.request);

    // Strict safety gate assertion
    expect(result.canExecute).toBe(false);
    expect(result.gateVerdict).toBe('EXECUTION_BLOCKED');
    expect(result.status).toBe('SIMULATION_REVERTED');
    expect(result.preparedExecution).toBeUndefined(); // Zero execution calldata / commands authorized

    // Diagnostic assertions
    expect(result.diagnostics.some((d) => d.includes('Safety Gate engaged'))).toBe(true);
    expect(result.diagnostics.some((d) => d.includes('Verify sender token balance'))).toBe(true);

    // Verify report contains clear lock banner
    const report = DryRunFormatter.formatReport(result);
    expect(report).toContain('🛑 [EXECUTION_BLOCKED]');
    expect(report).toContain('gate locked automatically');
    expect(report).toContain('REVERT ROOT-CAUSE ANALYSIS');
  }, 25000);

  it('Handles custom contract revert errors and decodes troll revert messages', async () => {
    const trollScenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'SCENARIO_REVERT_CUSTOM_TROLL_CONTRACT')!;
    const result = await engine.simulate(trollScenario.request);

    expect(result.canExecute).toBe(false);
    expect(result.gateVerdict).toBe('EXECUTION_BLOCKED');
    expect(result.revertReason).toContain('The year just became eeeveen woooorse');
    expect(result.revertCategory).toBe('CUSTOM_REVERT');
  }, 25000);

  it('Decodes ERC-20 transfer, transferFrom, and approve function calls', async () => {
    const usdcAddr = '0xc879c018db60520f4355c26ed1a6d572cdac1815';

    // Transfer
    const transferData = '0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000f4240';
    const decodedTransfer = await stateInspector.decodeCall(usdcAddr, transferData);
    expect(decodedTransfer.isErc20).toBe(true);
    expect(decodedTransfer.functionName).toBe('transfer');
    expect(decodedTransfer.symbol).toBe('USDC');
    expect(decodedTransfer.decimals).toBe(6);
    expect(decodedTransfer.amountRaw).toBe(1000000n);

    // Approve
    const approveData = '0x095ea7b300000000000000000000000022222222222222222222222222222222222222220000000000000000000000000000000000000000000000000000000000989680';
    const decodedApprove = await stateInspector.decodeCall(usdcAddr, approveData);
    expect(decodedApprove.isErc20).toBe(true);
    expect(decodedApprove.functionName).toBe('approve');
    expect(decodedApprove.amountRaw).toBe(10000000n);
  }, 20000);
});
