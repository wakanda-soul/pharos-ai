/**
 * Friction Cost & Net Profit Calculator for Pharos Arbitrage Scanner (Requirement 02).
 * Quantifies gross price spreads, AMM protocol swap fees, dynamic liquidity slippage,
 * and EVM network gas expenses to compute exact net profit and yield margins.
 */

import type { FrictionCostBreakdown, PriceFeedQuote } from './types.js';

export interface CalculatedOpportunityEconomics {
  buyVenue: PriceFeedQuote;
  sellVenue: PriceFeedQuote;
  grossSpreadUsd: number;
  grossSpreadPercentage: number;
  tradeCapitalUsd: number;
  frictionCosts: FrictionCostBreakdown;
  netProfitUsd: number;
  netYieldReturnPercentage: number;
  netYieldBasisPoints: number;
}

export class ProfitCalculator {
  /**
   * Calculates net arbitrage profit after deducting swap fees, estimated slippage, and gas (Requirement 02).
   */
  public calculateNetArbitrageEconomics(
    buyVenue: PriceFeedQuote,
    sellVenue: PriceFeedQuote,
    tradeCapitalUsd: number,
    gasPriceGwei: number = 1.2,
    prosUsdPrice: number = 1.50,
  ): CalculatedOpportunityEconomics {
    if (buyVenue.quotedPriceUsd <= 0 || sellVenue.quotedPriceUsd <= 0) {
      throw new Error('Invalid quote: prices must be positive numbers');
    }

    // 1. Gross price spread
    const priceDifferential = sellVenue.quotedPriceUsd - buyVenue.quotedPriceUsd;
    const grossSpreadPercentage = (priceDifferential / buyVenue.quotedPriceUsd) * 100;
    const grossSpreadUsd = (tradeCapitalUsd * priceDifferential) / buyVenue.quotedPriceUsd;

    // 2. Protocol Swap Fees (0.30% for AMM pool, 0.05% for oracle-settled venue)
    const sourceFeeRate = buyVenue.sourceKind === 'AMM_POOL' ? 0.003 : 0.0005;
    const destinationFeeRate = sellVenue.sourceKind === 'AMM_POOL' ? 0.003 : 0.0005;

    const sourceSwapFeeUsd = tradeCapitalUsd * sourceFeeRate;
    const destinationSwapFeeUsd = (tradeCapitalUsd + grossSpreadUsd) * destinationFeeRate;
    const totalSwapFeesUsd = sourceSwapFeeUsd + destinationSwapFeeUsd;

    // 3. Dynamic Slippage Estimation
    // Slippage grows proportionally with trade size relative to pool liquidity depth
    const poolDepth = Math.min(
      buyVenue.liquidityDepthUsd || 500000,
      sellVenue.liquidityDepthUsd || 500000,
    );

    // Slippage formula: (TradeSize / (2 * PoolDepth)) * 10000 bps
    const rawSlippageBps = Math.min(250, (tradeCapitalUsd / (2 * poolDepth)) * 10000);
    const slippageBps = Number(rawSlippageBps.toFixed(1));
    const estimatedSlippageUsd = (tradeCapitalUsd * slippageBps) / 10000;

    // 4. EVM Network Gas Expense on Pharos
    // Multi-leg atomic arbitrage: ~285,000 gas units
    const gasUsedUnits = 285000n;
    const gasPriceWei = BigInt(Math.round(gasPriceGwei * 1e9));
    const gasExpensePros = Number(gasUsedUnits * gasPriceWei) / 1e18;
    const networkGasCostUsd = gasExpensePros * prosUsdPrice;

    // 5. Aggregate Friction Costs & Net Outcome
    const aggregateFrictionCostUsd = totalSwapFeesUsd + estimatedSlippageUsd + networkGasCostUsd;
    const netProfitUsd = grossSpreadUsd - aggregateFrictionCostUsd;
    const netYieldReturnPercentage = (netProfitUsd / tradeCapitalUsd) * 100;
    const netYieldBasisPoints = Math.round(netYieldReturnPercentage * 100);

    const frictionCosts: FrictionCostBreakdown = {
      tradeNotionalUsd: tradeCapitalUsd,
      sourceSwapFeeUsd: Number(sourceSwapFeeUsd.toFixed(2)),
      destinationSwapFeeUsd: Number(destinationSwapFeeUsd.toFixed(2)),
      totalSwapFeesUsd: Number(totalSwapFeesUsd.toFixed(2)),
      estimatedSlippageUsd: Number(estimatedSlippageUsd.toFixed(2)),
      slippageBps,
      networkGasCostUsd: Number(networkGasCostUsd.toFixed(4)),
      gasUsedUnits,
      effectiveGasPriceGwei: gasPriceGwei,
      aggregateFrictionCostUsd: Number(aggregateFrictionCostUsd.toFixed(2)),
    };

    return {
      buyVenue,
      sellVenue,
      grossSpreadUsd: Number(grossSpreadUsd.toFixed(2)),
      grossSpreadPercentage: Number(grossSpreadPercentage.toFixed(2)),
      tradeCapitalUsd,
      frictionCosts,
      netProfitUsd: Number(netProfitUsd.toFixed(2)),
      netYieldReturnPercentage: Number(netYieldReturnPercentage.toFixed(2)),
      netYieldBasisPoints,
    };
  }
}
