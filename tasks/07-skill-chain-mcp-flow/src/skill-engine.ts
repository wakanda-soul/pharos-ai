import {
  ChainTelemetry,
  TreasuryPolicy,
  SkillDecision,
  SkillDecisionVerdict,
  SkillRebalanceAction,
} from './types.js';

export class SkillEngineEvaluator {
  private defaultPolicy: TreasuryPolicy = {
    targetUsdcRatio: 0.60,
    targetProsRatio: 0.40,
    toleranceBandPct: 5.0, // +/- 5% tolerance
    minimumReserveUsd: 100.0,
    assumedProsPriceUsd: 1.25,
  };

  /**
   * Core composition step: Ingests on-chain data emitted by Chain MCP,
   * runs SkillEngine rule engine, and emits a policy decision.
   */
  evaluate(telemetry: ChainTelemetry, customPolicy?: Partial<TreasuryPolicy>): SkillDecision {
    const policy: TreasuryPolicy = { ...this.defaultPolicy, ...customPolicy };

    const { usdcBalanceUnits, nativeBalancePros, totalValuationUsd } = telemetry;
    const prosValuationUsd = nativeBalancePros * policy.assumedProsPriceUsd;

    // 1. Edge Case: Empty or Below Minimum Floor
    if (totalValuationUsd < policy.minimumReserveUsd) {
      return {
        verdict: 'EMERGENCY_REPLENISH',
        policySummary: {
          targetRatio: `${Math.round(policy.targetUsdcRatio * 100)}% USDC / ${Math.round(policy.targetProsRatio * 100)}% PROS`,
          actualRatio: 'N/A (Critical Low Balance)',
          driftPercentage: 100,
          driftExceedsTolerance: true,
        },
        explanation: `Treasury reserve valuation ($${totalValuationUsd.toFixed(2)}) is below safety floor ($${policy.minimumReserveUsd.toFixed(2)}). Immediate capital replenishment required.`,
        actionRequired: true,
        rebalanceAction: {
          type: 'NONE',
          tokenIn: 'EXTERNAL',
          tokenOut: 'USDC',
          amountUnits: policy.minimumReserveUsd - totalValuationUsd,
          formattedAmount: `$${(policy.minimumReserveUsd - totalValuationUsd).toFixed(2)} USD`,
          rationale: 'Deposit funds to meet minimum operational safety reserve.',
          estimatedTargetRatioAfter: 'Target reserve restoration',
        },
        riskEvaluation: {
          reserveHealth: 'CRITICAL_LOW',
          volatilityBuffer: 'Exhausted (0%)',
          gasCondition: telemetry.gasPriceGwei <= 2.0 ? 'FAVORABLE' : 'ELEVATED',
        },
      };
    }

    // 2. Ratio Calculation
    const actualUsdcRatio = totalValuationUsd > 0 ? usdcBalanceUnits / totalValuationUsd : 0;
    const actualProsRatio = totalValuationUsd > 0 ? prosValuationUsd / totalValuationUsd : 0;

    const driftPercentage = Math.abs(actualUsdcRatio - policy.targetUsdcRatio) * 100;
    const driftExceedsTolerance = driftPercentage > policy.toleranceBandPct;

    const targetRatioStr = `${Math.round(policy.targetUsdcRatio * 100)}% USDC / ${Math.round(policy.targetProsRatio * 100)}% PROS`;
    const actualRatioStr = `${Math.round(actualUsdcRatio * 100)}% USDC / ${Math.round(actualProsRatio * 100)}% PROS`;

    // 3. Equilibrium Check
    if (!driftExceedsTolerance) {
      return {
        verdict: 'IN_EQUILIBRIUM',
        policySummary: {
          targetRatio: targetRatioStr,
          actualRatio: actualRatioStr,
          driftPercentage: parseFloat(driftPercentage.toFixed(2)),
          driftExceedsTolerance: false,
        },
        explanation: `Portfolio is well balanced at ${actualRatioStr}. Drift is only ${driftPercentage.toFixed(2)}% (within +/-${policy.toleranceBandPct}% tolerance). No trade needed.`,
        actionRequired: false,
        rebalanceAction: {
          type: 'NONE',
          tokenIn: 'NONE',
          tokenOut: 'NONE',
          amountUnits: 0,
          formattedAmount: '0',
          rationale: 'Portfolio matches target risk profile.',
          estimatedTargetRatioAfter: actualRatioStr,
        },
        riskEvaluation: {
          reserveHealth: 'HEALTHY',
          volatilityBuffer: 'Optimal (+/-5%)',
          gasCondition: telemetry.gasPriceGwei <= 2.0 ? 'FAVORABLE' : 'ELEVATED',
        },
      };
    }

    // 4. Rebalance Triggered
    let action: SkillRebalanceAction;
    let explanation = '';

    if (actualUsdcRatio > policy.targetUsdcRatio) {
      // Overweight USDC, need to swap USDC -> PROS
      const excessUsdcUsd = (actualUsdcRatio - policy.targetUsdcRatio) * totalValuationUsd;
      const expectedProsOut = excessUsdcUsd / policy.assumedProsPriceUsd;

      action = {
        type: 'SWAP_USDC_TO_PROS',
        tokenIn: 'USDC',
        tokenOut: 'PROS',
        amountUnits: parseFloat(excessUsdcUsd.toFixed(2)),
        formattedAmount: `${excessUsdcUsd.toFixed(2)} USDC`,
        rationale: `USDC allocation (${(actualUsdcRatio * 100).toFixed(1)}%) exceeds target (${(policy.targetUsdcRatio * 100).toFixed(1)}%). Swap excess to PROS.`,
        estimatedTargetRatioAfter: targetRatioStr,
      };

      explanation = `Rebalance triggered: Treasury is overweight USDC by +${driftPercentage.toFixed(1)}%. Recommending swap of ${excessUsdcUsd.toFixed(2)} USDC to PROS to restore ${targetRatioStr}.`;
    } else {
      // Overweight PROS, need to swap PROS -> USDC
      const excessProsUsd = (actualProsRatio - policy.targetProsRatio) * totalValuationUsd;
      const prosToSellUnits = excessProsUsd / policy.assumedProsPriceUsd;

      action = {
        type: 'SWAP_PROS_TO_USDC',
        tokenIn: 'PROS',
        tokenOut: 'USDC',
        amountUnits: parseFloat(prosToSellUnits.toFixed(4)),
        formattedAmount: `${prosToSellUnits.toFixed(4)} PROS`,
        rationale: `PROS allocation (${(actualProsRatio * 100).toFixed(1)}%) exceeds target (${(policy.targetProsRatio * 100).toFixed(1)}%). Realize profits to USDC.`,
        estimatedTargetRatioAfter: targetRatioStr,
      };

      explanation = `Rebalance triggered: Treasury is overweight PROS by +${driftPercentage.toFixed(1)}%. Recommending swap of ${prosToSellUnits.toFixed(4)} PROS to USDC to restore ${targetRatioStr}.`;
    }

    return {
      verdict: 'REBALANCE_NEEDED',
      policySummary: {
        targetRatio: targetRatioStr,
        actualRatio: actualRatioStr,
        driftPercentage: parseFloat(driftPercentage.toFixed(2)),
        driftExceedsTolerance: true,
      },
      explanation,
      actionRequired: true,
      rebalanceAction: action,
      riskEvaluation: {
        reserveHealth: 'HEALTHY',
        volatilityBuffer: `Drift: ${driftPercentage.toFixed(1)}%`,
        gasCondition: telemetry.gasPriceGwei <= 2.0 ? 'FAVORABLE' : 'ELEVATED',
      },
    };
  }
}
