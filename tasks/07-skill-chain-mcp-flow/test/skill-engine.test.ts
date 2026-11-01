import { describe, it, expect } from 'vitest';
import { SkillEngineEvaluator } from '../src/skill-engine.js';
import { ChainTelemetry } from '../src/types.js';

describe('Task 07: SkillEngine Policy Evaluator', () => {
  const evaluator = new SkillEngineEvaluator();

  const baseTelemetry: ChainTelemetry = {
    network: 'Pharos Mainnet',
    chainId: 1672,
    blockNumber: 1042000,
    blockTimestamp: 1729000000,
    treasuryAddress: '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
    nativeBalanceWei: '0',
    nativeBalancePros: 0,
    usdcBalanceRaw: '0',
    usdcBalanceUnits: 0,
    gasPriceGwei: 1.0,
    totalValuationUsd: 0,
  };

  it('should trigger EMERGENCY_REPLENISH when treasury reserves are below minimum floor', () => {
    const telemetry: ChainTelemetry = {
      ...baseTelemetry,
      nativeBalancePros: 10, // $12.50
      usdcBalanceUnits: 10,  // $10.00
      totalValuationUsd: 22.50, // Below $100 floor
    };

    const decision = evaluator.evaluate(telemetry, { minimumReserveUsd: 100 });
    expect(decision.verdict).toBe('EMERGENCY_REPLENISH');
    expect(decision.actionRequired).toBe(true);
    expect(decision.explanation).toContain('below safety floor');
  });

  it('should evaluate IN_EQUILIBRIUM when actual ratio is within tolerance band', () => {
    // 6,000 USDC + 3,200 PROS ($4,000) = $10,000 total (60% USDC / 40% PROS)
    const telemetry: ChainTelemetry = {
      ...baseTelemetry,
      nativeBalancePros: 3200,
      usdcBalanceUnits: 6000,
      totalValuationUsd: 10000,
    };

    const decision = evaluator.evaluate(telemetry, {
      targetUsdcRatio: 0.60,
      targetProsRatio: 0.40,
      toleranceBandPct: 5.0,
    });

    expect(decision.verdict).toBe('IN_EQUILIBRIUM');
    expect(decision.actionRequired).toBe(false);
    expect(decision.policySummary.driftPercentage).toBe(0);
    expect(decision.policySummary.driftExceedsTolerance).toBe(false);
  });

  it('should trigger REBALANCE_NEEDED and SWAP_USDC_TO_PROS when overweight USDC', () => {
    // 8,500 USDC + 1,200 PROS ($1,500) = $10,000 total (85% USDC vs target 60%)
    const telemetry: ChainTelemetry = {
      ...baseTelemetry,
      nativeBalancePros: 1200,
      usdcBalanceUnits: 8500,
      totalValuationUsd: 10000,
    };

    const decision = evaluator.evaluate(telemetry, {
      targetUsdcRatio: 0.60,
      targetProsRatio: 0.40,
      toleranceBandPct: 5.0,
    });

    expect(decision.verdict).toBe('REBALANCE_NEEDED');
    expect(decision.actionRequired).toBe(true);
    expect(decision.rebalanceAction?.type).toBe('SWAP_USDC_TO_PROS');
    expect(decision.rebalanceAction?.tokenIn).toBe('USDC');
    expect(decision.rebalanceAction?.tokenOut).toBe('PROS');
    expect(decision.rebalanceAction?.amountUnits).toBe(2500); // 8500 - 6000 = 2500 excess
  });

  it('should trigger REBALANCE_NEEDED and SWAP_PROS_TO_USDC when overweight PROS', () => {
    // 2,000 USDC + 6,400 PROS ($8,000) = $10,000 total (20% USDC vs target 60%)
    const telemetry: ChainTelemetry = {
      ...baseTelemetry,
      nativeBalancePros: 6400,
      usdcBalanceUnits: 2000,
      totalValuationUsd: 10000,
    };

    const decision = evaluator.evaluate(telemetry, {
      targetUsdcRatio: 0.60,
      targetProsRatio: 0.40,
      toleranceBandPct: 5.0,
    });

    expect(decision.verdict).toBe('REBALANCE_NEEDED');
    expect(decision.actionRequired).toBe(true);
    expect(decision.rebalanceAction?.type).toBe('SWAP_PROS_TO_USDC');
    expect(decision.rebalanceAction?.tokenIn).toBe('PROS');
    expect(decision.rebalanceAction?.tokenOut).toBe('USDC');
    expect(decision.rebalanceAction?.amountUnits).toBe(3200); // $4000 excess PROS / $1.25 = 3200 PROS
  });
});
