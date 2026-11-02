import {
  LendingAssetMetadata,
  LendingPositionSnapshot,
  RemediationActionPlan,
  WatchdogThresholdConfig,
} from './types.js';

export class LendingMathCalculator {
  /**
   * Computes position metrics including Health Factor, LTV, and Liquidation Collateral Price.
   */
  static evaluatePositionMetrics(params: {
    protocol: string;
    borrowerAddress: `0x${string}`;
    collateralAsset: LendingAssetMetadata;
    debtAsset: LendingAssetMetadata;
    collateralAmountFormatted: number;
    debtAmountFormatted: number;
    collateralPriceUsd: number;
    debtPriceUsd: number;
    liquidationThreshold: number; // e.g. 0.85
    blockNumber: number;
  }): LendingPositionSnapshot {
    const {
      protocol,
      borrowerAddress,
      collateralAsset,
      debtAsset,
      collateralAmountFormatted,
      debtAmountFormatted,
      collateralPriceUsd,
      debtPriceUsd,
      liquidationThreshold,
      blockNumber,
    } = params;

    // Clamp negative inputs to 0
    const cleanCollateralAmount = Math.max(0, collateralAmountFormatted);
    const cleanDebtAmount = Math.max(0, debtAmountFormatted);

    const collateralValueUsd = cleanCollateralAmount * Math.max(0, collateralPriceUsd);
    const debtValueUsd = cleanDebtAmount * Math.max(0, debtPriceUsd);

    // Health Factor = (Collateral Value * Liquidation Threshold) / Debt Value
    let healthFactor = 999.0;
    if (debtValueUsd > 0) {
      if (collateralValueUsd === 0) {
        // Zero collateral with outstanding debt is immediately insolvent
        healthFactor = 0.0;
      } else {
        healthFactor = (collateralValueUsd * liquidationThreshold) / debtValueUsd;
      }
    }

    // Current LTV = Debt Value / Collateral Value
    let currentLtv = 0;
    if (collateralValueUsd > 0) {
      currentLtv = debtValueUsd / collateralValueUsd;
    } else if (debtValueUsd > 0) {
      currentLtv = 999.0; // Insolvent
    }

    // Liquidation Price: The collateral price at which Health Factor drops to 1.0
    // HF = 1.0 => (collateralAmount * liqPrice * LT) = debtValueUsd
    // liqPrice = debtValueUsd / (collateralAmount * LT)
    let liquidationPriceUsd = 0;
    if (cleanCollateralAmount > 0 && liquidationThreshold > 0) {
      liquidationPriceUsd = debtValueUsd / (cleanCollateralAmount * liquidationThreshold);
    }

    const collateralRaw = BigInt(Math.floor(collateralAmountFormatted * 10 ** collateralAsset.decimals));
    const debtRaw = BigInt(Math.floor(debtAmountFormatted * 10 ** debtAsset.decimals));

    return {
      protocol,
      borrowerAddress,
      collateralAsset,
      debtAsset,
      collateralAmountRaw: collateralRaw,
      debtAmountRaw: debtRaw,
      collateralAmountFormatted,
      debtAmountFormatted,
      collateralPriceUsd,
      debtPriceUsd,
      collateralValueUsd,
      debtValueUsd,
      liquidationThreshold,
      healthFactor: Math.round(healthFactor * 1000) / 1000,
      currentLtv: Math.round(currentLtv * 1000) / 1000,
      liquidationPriceUsd: Math.round(liquidationPriceUsd * 100) / 100,
      queriedAtBlockNumber: blockNumber,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculates concrete remediation actions to bring position back to target safe Health Factor.
   * Enforces Arena Requirement 04: "Suggests a concrete action in each alert, e.g. repay X or add Y collateral".
   */
  static calculateRemediationPlan(
    position: LendingPositionSnapshot,
    config: WatchdogThresholdConfig
  ): RemediationActionPlan {
    const targetHf = config.targetSafeHealthFactor;
    const {
      collateralValueUsd,
      debtValueUsd,
      liquidationThreshold,
      debtPriceUsd,
      collateralPriceUsd,
      debtAsset,
      collateralAsset,
    } = position;

    // If position is already above target HF, no action needed
    if (position.healthFactor >= targetHf || debtValueUsd === 0) {
      return {
        targetSafeHealthFactor: targetHf,
        debtRepaymentNeededUsd: 0,
        debtRepaymentUnits: 0,
        debtAssetSymbol: debtAsset.symbol,
        additionalCollateralNeededUsd: 0,
        additionalCollateralUnits: 0,
        collateralAssetSymbol: collateralAsset.symbol,
        actionSummary: `Position is safe (Health Factor ${position.healthFactor.toFixed(2)} >= target ${targetHf.toFixed(2)}). No rebalancing required.`,
      };
    }

    // Option 1: Repay Debt
    // Target HF = (Collateral Value * LT) / (New Debt)
    // New Debt = (Collateral Value * LT) / Target HF
    // Repayment Needed = Current Debt - New Debt
    const maxAllowableDebtUsd = (collateralValueUsd * liquidationThreshold) / targetHf;
    const debtRepaymentNeededUsd = Math.max(0, debtValueUsd - maxAllowableDebtUsd);
    const debtRepaymentUnits = debtPriceUsd > 0 ? debtRepaymentNeededUsd / debtPriceUsd : 0;

    // Option 2: Add Additional Collateral
    // Target HF = ((Collateral Value + Added Collateral) * LT) / Current Debt
    // Target HF * Current Debt = (Collateral Value + Added Collateral) * LT
    // Required Collateral Value = (Target HF * Current Debt) / LT
    // Added Collateral USD = Required Collateral Value - Collateral Value
    const requiredCollateralUsd = (targetHf * debtValueUsd) / liquidationThreshold;
    const additionalCollateralNeededUsd = Math.max(0, requiredCollateralUsd - collateralValueUsd);
    const additionalCollateralUnits = collateralPriceUsd > 0 ? additionalCollateralNeededUsd / collateralPriceUsd : 0;

    const actionSummary =
      `Repay $${debtRepaymentNeededUsd.toFixed(2)} ${debtAsset.symbol} ` +
      `(${debtRepaymentUnits.toFixed(2)} ${debtAsset.symbol}) or ` +
      `add $${additionalCollateralNeededUsd.toFixed(2)} of ${collateralAsset.symbol} ` +
      `(${additionalCollateralUnits.toFixed(4)} ${collateralAsset.symbol}) ` +
      `to restore Health Factor to safe target ${targetHf.toFixed(2)}.`;

    return {
      targetSafeHealthFactor: targetHf,
      debtRepaymentNeededUsd: Math.round(debtRepaymentNeededUsd * 100) / 100,
      debtRepaymentUnits: Math.round(debtRepaymentUnits * 100) / 100,
      debtAssetSymbol: debtAsset.symbol,
      additionalCollateralNeededUsd: Math.round(additionalCollateralNeededUsd * 100) / 100,
      additionalCollateralUnits: Math.round(additionalCollateralUnits * 10000) / 10000,
      collateralAssetSymbol: collateralAsset.symbol,
      actionSummary,
    };
  }
}
