/**
 * Core Arbitrage Engine for Pharos SkillEngine (Requirements 01, 02, 03, 04, 05).
 * Compares multi-source prices, computes net profit after friction fees, evaluates
 * profitability against configurable thresholds, and prepares non-custodial execution payloads.
 */

import { type Address, getAddress } from 'viem';
import { MultiSourcePriceReader } from './price-reader.js';
import { ProfitCalculator } from './profit-calculator.js';
import { ScanJournal } from './scan-journal.js';
import type {
  ArbitrageOpportunityRecord,
  PreparedExecutionPayload,
  ScannerConfiguration,
} from './types.js';

export const DEFAULT_SCANNER_CONFIG: ScannerConfiguration = {
  targetAssetPair: 'PROS/USDC',
  capitalAllocationUsd: 10000, // $10,000 USD trade size
  minimumNetProfitThresholdUsd: 30.0, // Minimum $30 USD hurdle
  minimumNetBasisPoints: 25, // Minimum 25 bps (0.25%)
  maximumAllowedSlippageBps: 100, // Max 100 bps (1.00%) price impact ceiling
  isSimulationOnly: true,
};

export class ArbitrageScannerEngine {
  private priceReader: MultiSourcePriceReader;
  private profitCalculator: ProfitCalculator;
  private scanJournal: ScanJournal;
  private activeConfig: ScannerConfiguration;

  constructor(
    customConfig?: Partial<ScannerConfiguration>,
    customPriceReader?: MultiSourcePriceReader,
    customProfitCalculator?: ProfitCalculator,
  ) {
    this.activeConfig = {
      ...DEFAULT_SCANNER_CONFIG,
      ...customConfig,
    };
    this.priceReader = customPriceReader || new MultiSourcePriceReader();
    this.profitCalculator = customProfitCalculator || new ProfitCalculator();
    this.scanJournal = new ScanJournal();
  }

  public getScanJournal(): ScanJournal {
    return this.scanJournal;
  }

  public getConfiguration(): ScannerConfiguration {
    return { ...this.activeConfig };
  }

  public updateConfiguration(updates: Partial<ScannerConfiguration>): void {
    this.activeConfig = {
      ...this.activeConfig,
      ...updates,
    };
  }

  /**
   * Performs an end-to-end arbitrage scan across sources, evaluates net profitability,
   * decides whether to act or skip, and logs the result (Requirements 01 - 05).
   */
  public async performArbitrageScan(
    scenario: 'WIDE_ARBITRAGE' | 'TIGHT_SPREAD_UNPROFITABLE' | 'EQUILIBRIUM' = 'WIDE_ARBITRAGE',
  ): Promise<ArbitrageOpportunityRecord> {
    const scanId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const timestampIso = new Date().toISOString();

    if (this.activeConfig.capitalAllocationUsd <= 0) {
      throw new Error(
        `Invalid configuration: capitalAllocationUsd must be greater than zero, received ${this.activeConfig.capitalAllocationUsd}`,
      );
    }

    // 1. Requirement 01: Reads prices from at least 2 sources in the same scan
    const quotes = await this.priceReader.scanPriceSources(this.activeConfig.targetAssetPair, scenario);
    if (quotes.length < 2) {
      throw new Error(`Insufficient price sources: scanner requires at least 2 sources, found ${quotes.length}`);
    }

    // 2. Pairwise analysis across distinct venues: find the pair (buy, sell) that maximizes price spread
    let bestBuyVenue = quotes[0];
    let bestSellVenue = quotes[1];
    let maxSpreadDiff = -Infinity;

    for (let i = 0; i < quotes.length; i++) {
      for (let j = 0; j < quotes.length; j++) {
        if (i === j) continue;
        const buyCandidate = quotes[i];
        const sellCandidate = quotes[j];
        if (buyCandidate.sourceIdentifier === sellCandidate.sourceIdentifier) continue;

        const diff = sellCandidate.quotedPriceUsd - buyCandidate.quotedPriceUsd;
        if (diff > maxSpreadDiff) {
          maxSpreadDiff = diff;
          bestBuyVenue = buyCandidate;
          bestSellVenue = sellCandidate;
        }
      }
    }

    // 3. Requirement 02: Calculates net profit after swap fees, slippage estimate, and gas
    const economics = this.profitCalculator.calculateNetArbitrageEconomics(
      bestBuyVenue,
      bestSellVenue,
      this.activeConfig.capitalAllocationUsd,
    );

    // 4. Requirement 03: Acts or prepares transaction only above profit threshold; otherwise logs why skipped
    let decision: ArbitrageOpportunityRecord['decision'];
    let plainLanguageJustification: string;
    let preparedPayload: PreparedExecutionPayload | undefined = undefined;

    if (economics.grossSpreadUsd <= 0) {
      decision = 'SKIP_NEGATIVE_SPREAD';
      plainLanguageJustification =
        `Skipped: Observed gross spread is non-positive ($${economics.grossSpreadUsd.toFixed(2)} USD). Prices are in equilibrium across all monitored venues.`;
    } else if (economics.frictionCosts.slippageBps > this.activeConfig.maximumAllowedSlippageBps) {
      decision = 'SKIP_INSUFFICIENT_LIQUIDITY';
      plainLanguageJustification =
        `Skipped: Estimated slippage price impact (${economics.frictionCosts.slippageBps.toFixed(1)} bps) exceeds safety threshold (${this.activeConfig.maximumAllowedSlippageBps} bps). Risk of adverse price impact too high.`;
    } else if (economics.netProfitUsd < this.activeConfig.minimumNetProfitThresholdUsd) {
      decision = 'SKIP_INSUFFICIENT_PROFIT';
      const frictionSharePct = ((economics.frictionCosts.aggregateFrictionCostUsd / economics.grossSpreadUsd) * 100).toFixed(1);
      plainLanguageJustification =
        `Skipped: Projected net profit ($${economics.netProfitUsd.toFixed(2)} USD) fails to meet required hurdle threshold ($${this.activeConfig.minimumNetProfitThresholdUsd.toFixed(2)} USD). ` +
        `Friction costs ($${economics.frictionCosts.aggregateFrictionCostUsd.toFixed(2)} USD from swap fees, slippage and gas) consume ${frictionSharePct}% of gross spread ($${economics.grossSpreadUsd.toFixed(2)} USD).`;
    } else {
      // Net profit clears hurdle: Prepare transaction (Requirement 03 & 05)
      decision = 'EXECUTE_ARBITRAGE';
      plainLanguageJustification =
        `Arbitrage opportunity approved for execution. Gross spread of +${economics.grossSpreadPercentage.toFixed(2)}% yields ` +
        `+$${economics.netProfitUsd.toFixed(2)} USD net profit (+${economics.netYieldBasisPoints} bps) after deducting $${economics.frictionCosts.aggregateFrictionCostUsd.toFixed(2)} in fees and gas. ` +
        `Comfortably exceeds the $${this.activeConfig.minimumNetProfitThresholdUsd.toFixed(2)} USD hurdle.`;

      preparedPayload = this.synthesizeSimulatedExecutionPayload(
        bestBuyVenue.contractAddress,
        economics.tradeCapitalUsd,
        economics.grossSpreadUsd,
        economics.netProfitUsd,
        economics.frictionCosts.gasUsedUnits,
      );
    }

    const opportunityRecord: ArbitrageOpportunityRecord = {
      scanId,
      timestampIso,
      assetPair: this.activeConfig.targetAssetPair,
      buyVenueQuote: bestBuyVenue,
      sellVenueQuote: bestSellVenue,
      grossSpreadUsd: economics.grossSpreadUsd,
      grossSpreadPercentage: economics.grossSpreadPercentage,
      tradeSizeCapitalUsd: economics.tradeCapitalUsd,
      frictionCosts: economics.frictionCosts,
      netProfitUsd: economics.netProfitUsd,
      netYieldReturnPercentage: economics.netYieldReturnPercentage,
      hurdleProfitThresholdUsd: this.activeConfig.minimumNetProfitThresholdUsd,
      decision,
      plainLanguageJustification,
      preparedExecutionPayload: preparedPayload,
    };

    // 5. Requirement 04: Logs every scan with gross spread, costs, net result and decision
    this.scanJournal.logScanRecord(opportunityRecord);

    return opportunityRecord;
  }

  private synthesizeSimulatedExecutionPayload(
    routerContract: Address,
    capitalUsd: number,
    grossUsd: number,
    netUsd: number,
    gasUnits: bigint,
  ): PreparedExecutionPayload {
    // Generate deterministic simulation calldata and Pharosscan simulation link
    const calldataPayload = `0x38ed17390000000000000000000000000000000000000000000000000000000000002710` as `0x${string}`;
    const simTxHash = `0xfa400001${Date.now().toString(16).padStart(8, '0')}${'0'.repeat(48)}1`;

    return {
      targetContract: routerContract,
      routerFunctionMethod: 'atomicTwoLegSwap(address buyPool, address sellPool, uint256 capital)',
      calldataPayload,
      allocatedTradeCapitalUsd: capitalUsd,
      estimatedGasUnits: gasUnits,
      expectedGrossProceedsUsd: capitalUsd + grossUsd,
      expectedNetProceedsUsd: capitalUsd + netUsd,
      pharosscanExplorerSimUrl: `https://pharosscan.xyz/tx/${simTxHash}`,
    };
  }
}
