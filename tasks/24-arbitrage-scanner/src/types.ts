/**
 * Domain types and schema models for the Pharos Arbitrage Scanner (SkillEngine).
 * Evaluates real-time price discrepancies across multiple on-chain sources (AMM pools, Oracles),
 * calculates friction costs (swap fees, slippage, gas), and prepares profitable arbitrage transactions.
 */

import type { Address } from 'viem';

export type ArbitrageSourceKind = 'AMM_POOL' | 'CHAINLINK_ORACLE' | 'LENDING_ORACLE';

export interface PriceFeedQuote {
  sourceIdentifier: string;
  sourceKind: ArbitrageSourceKind;
  contractAddress: Address;
  assetPairSymbol: string;
  quotedPriceUsd: number;
  quotedPriceRaw: bigint;
  decimals: number;
  liquidityDepthUsd?: number;
  observedBlockHeight: number;
  observedTimestampIso: string;
}

export interface FrictionCostBreakdown {
  tradeNotionalUsd: number;
  sourceSwapFeeUsd: number;
  destinationSwapFeeUsd: number;
  totalSwapFeesUsd: number;
  estimatedSlippageUsd: number;
  slippageBps: number;
  networkGasCostUsd: number;
  gasUsedUnits: bigint;
  effectiveGasPriceGwei: number;
  aggregateFrictionCostUsd: number;
}

export type ArbitrageEvaluationDecision =
  | 'EXECUTE_ARBITRAGE'
  | 'SKIP_INSUFFICIENT_PROFIT'
  | 'SKIP_NEGATIVE_SPREAD'
  | 'SKIP_INSUFFICIENT_LIQUIDITY';

export interface PreparedExecutionPayload {
  targetContract: Address;
  routerFunctionMethod: string;
  calldataPayload: `0x${string}`;
  allocatedTradeCapitalUsd: number;
  estimatedGasUnits: bigint;
  expectedGrossProceedsUsd: number;
  expectedNetProceedsUsd: number;
  pharosscanExplorerSimUrl: string;
}

export interface ArbitrageOpportunityRecord {
  scanId: string;
  timestampIso: string;
  assetPair: string;
  buyVenueQuote: PriceFeedQuote;
  sellVenueQuote: PriceFeedQuote;
  grossSpreadUsd: number;
  grossSpreadPercentage: number; // e.g. +2.45%
  tradeSizeCapitalUsd: number;
  frictionCosts: FrictionCostBreakdown;
  netProfitUsd: number;
  netYieldReturnPercentage: number;
  hurdleProfitThresholdUsd: number;
  decision: ArbitrageEvaluationDecision;
  plainLanguageJustification: string;
  preparedExecutionPayload?: PreparedExecutionPayload;
}

export interface ScannerConfiguration {
  targetAssetPair: string;
  capitalAllocationUsd: number; // e.g. $10,000 USD
  minimumNetProfitThresholdUsd: number; // e.g. $30.00 USD hurdle
  minimumNetBasisPoints: number; // e.g. 25 bps (0.25%)
  maximumAllowedSlippageBps: number; // e.g. 50 bps (0.50%)
  isSimulationOnly: boolean;
}
