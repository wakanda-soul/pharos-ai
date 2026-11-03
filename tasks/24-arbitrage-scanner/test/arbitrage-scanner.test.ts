import { describe, it, expect, beforeEach } from 'vitest';
import { ArbitrageScannerEngine, DEFAULT_SCANNER_CONFIG } from '../src/arbitrage-engine.js';
import { MultiSourcePriceReader } from '../src/price-reader.js';
import { ProfitCalculator } from '../src/profit-calculator.js';
import { ScanJournal } from '../src/scan-journal.js';
import type { PriceFeedQuote } from '../src/types.js';

describe('Task 24: Arbitrage Scanner Specification (SkillEngine)', () => {
  const priceReader = new MultiSourcePriceReader();
  const profitCalculator = new ProfitCalculator();

  const mockAmmQuote: PriceFeedQuote = {
    sourceIdentifier: 'FaroSwap AMM (PROS/USDC)',
    sourceKind: 'AMM_POOL',
    contractAddress: '0x1000000000000000000000000000000000000002',
    assetPairSymbol: 'PROS/USDC',
    quotedPriceUsd: 1.432, // Lower price
    quotedPriceRaw: 1432000n,
    decimals: 6,
    liquidityDepthUsd: 850000,
    observedBlockHeight: 1545000,
    observedTimestampIso: new Date().toISOString(),
  };

  const mockOracleQuote: PriceFeedQuote = {
    sourceIdentifier: 'Chainlink Price Feed (PROS/USD)',
    sourceKind: 'CHAINLINK_ORACLE',
    contractAddress: '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8',
    assetPairSymbol: 'PROS/USDC',
    quotedPriceUsd: 1.500, // Higher price
    quotedPriceRaw: 150000000n,
    decimals: 8,
    liquidityDepthUsd: 5000000,
    observedBlockHeight: 1545000,
    observedTimestampIso: new Date().toISOString(),
  };

  describe('Requirement 01: Reads prices from at least 2 sources in the same scan', () => {
    it('concurrently fetches spot prices from at least 2 distinct venues', async () => {
      const quotes = await priceReader.scanPriceSources('PROS/USDC', 'WIDE_ARBITRAGE');

      expect(quotes.length).toBeGreaterThanOrEqual(2);
      const identifiers = quotes.map((q) => q.sourceIdentifier);
      const uniqueIdentifiers = new Set(identifiers);
      expect(uniqueIdentifiers.size).toBe(quotes.length);

      for (const quote of quotes) {
        expect(quote.quotedPriceUsd).toBeGreaterThan(0);
        expect(quote.observedBlockHeight).toBeGreaterThan(1000000);
        expect(quote.observedTimestampIso).toBeDefined();
        expect(quote.contractAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    });

    it('samples both constant-product AMM reserves and oracle reference feeds', async () => {
      const quotes = await priceReader.scanPriceSources('PROS/USDC');
      const kinds = quotes.map((q) => q.sourceKind);

      expect(kinds).toContain('AMM_POOL');
      expect(kinds).toContain('CHAINLINK_ORACLE');
    });
  });

  describe('Requirement 02: Calculates net profit after swap fees, slippage estimate, and gas', () => {
    it('deducts swap fees, dynamic slippage, and EVM network gas to compute net profit', () => {
      const tradeCapital = 10000; // $10,000 USD
      const economics = profitCalculator.calculateNetArbitrageEconomics(
        mockAmmQuote,
        mockOracleQuote,
        tradeCapital,
        1.2, // 1.2 Gwei
        1.50, // PROS = $1.50
      );

      // Price diff: 1.500 - 1.432 = 0.068 (+4.75%)
      expect(economics.grossSpreadPercentage).toBeCloseTo(4.75, 1);
      expect(economics.grossSpreadUsd).toBeCloseTo(474.86, 0);

      // Friction cost breakdown
      const costs = economics.frictionCosts;
      expect(costs.tradeNotionalUsd).toBe(tradeCapital);
      expect(costs.totalSwapFeesUsd).toBeGreaterThan(30); // 0.30% + 0.05%
      expect(costs.estimatedSlippageUsd).toBeGreaterThan(0);
      expect(costs.networkGasCostUsd).toBeGreaterThan(0);
      expect(costs.aggregateFrictionCostUsd).toBeCloseTo(
        costs.totalSwapFeesUsd + costs.estimatedSlippageUsd + costs.networkGasCostUsd,
        1,
      );

      // Net profit = Gross spread - Total friction
      expect(economics.netProfitUsd).toBeCloseTo(economics.grossSpreadUsd - costs.aggregateFrictionCostUsd, 1);
      expect(economics.netProfitUsd).toBeGreaterThan(300);
      expect(economics.netYieldBasisPoints).toBeGreaterThan(300);
    });

    it('demonstrates that higher trade size incurs greater slippage penalty', () => {
      const smallTrade = profitCalculator.calculateNetArbitrageEconomics(mockAmmQuote, mockOracleQuote, 2000);
      const largeTrade = profitCalculator.calculateNetArbitrageEconomics(mockAmmQuote, mockOracleQuote, 50000);

      expect(largeTrade.frictionCosts.slippageBps).toBeGreaterThan(smallTrade.frictionCosts.slippageBps);
      expect(largeTrade.frictionCosts.estimatedSlippageUsd).toBeGreaterThan(smallTrade.frictionCosts.estimatedSlippageUsd);
    });
  });

  describe('Requirement 03: Acts or prepares transaction only above profit threshold; otherwise logs why skipped', () => {
    it('approves execution and prepares transaction when net profit exceeds hurdle threshold', async () => {
      const engine = new ArbitrageScannerEngine({
        minimumNetProfitThresholdUsd: 30.0,
      });

      const opportunity = await engine.performArbitrageScan('WIDE_ARBITRAGE');

      expect(opportunity.decision).toBe('EXECUTE_ARBITRAGE');
      expect(opportunity.netProfitUsd).toBeGreaterThan(opportunity.hurdleProfitThresholdUsd);
      expect(opportunity.plainLanguageJustification).toContain('Arbitrage opportunity approved');
      expect(opportunity.preparedExecutionPayload).toBeDefined();

      const payload = opportunity.preparedExecutionPayload!;
      expect(payload.targetContract).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(payload.calldataPayload.startsWith('0x')).toBe(true);
      expect(payload.expectedNetProceedsUsd).toBeGreaterThan(payload.allocatedTradeCapitalUsd);
      expect(payload.pharosscanExplorerSimUrl).toContain('https://pharosscan.xyz/tx/');
    });

    it('skips execution and provides detailed plain-language reason when net profit is below hurdle', async () => {
      const engine = new ArbitrageScannerEngine({
        minimumNetProfitThresholdUsd: 50.0, // High hurdle threshold
      });

      // Tight spread scenario: gross spread is +0.53%, but after fees net profit is negative or negligible
      const opportunity = await engine.performArbitrageScan('TIGHT_SPREAD_UNPROFITABLE');

      expect(opportunity.decision).toBe('SKIP_INSUFFICIENT_PROFIT');
      expect(opportunity.netProfitUsd).toBeLessThan(50.0);
      expect(opportunity.preparedExecutionPayload).toBeUndefined();
      expect(opportunity.plainLanguageJustification).toContain('Skipped: Projected net profit');
      expect(opportunity.plainLanguageJustification).toContain('fails to meet required hurdle threshold');
    });

    it('skips execution when venues are in equilibrium with zero spread', async () => {
      const engine = new ArbitrageScannerEngine();
      const opportunity = await engine.performArbitrageScan('EQUILIBRIUM');

      expect(['SKIP_NEGATIVE_SPREAD', 'SKIP_INSUFFICIENT_PROFIT']).toContain(opportunity.decision);
      expect(opportunity.preparedExecutionPayload).toBeUndefined();
    });

    it('dynamically adapts decision when profit threshold is reconfigured', async () => {
      const engine = new ArbitrageScannerEngine();

      // With $1000 hurdle, wide opportunity should be skipped
      engine.updateConfiguration({ minimumNetProfitThresholdUsd: 1000.0 });
      let opp = await engine.performArbitrageScan('WIDE_ARBITRAGE');
      expect(opp.decision).toBe('SKIP_INSUFFICIENT_PROFIT');

      // Lower hurdle to $10, opportunity should be executed
      engine.updateConfiguration({ minimumNetProfitThresholdUsd: 10.0 });
      opp = await engine.performArbitrageScan('WIDE_ARBITRAGE');
      expect(opp.decision).toBe('EXECUTE_ARBITRAGE');
    });
  });

  describe('Requirement 04: Logs every scan with gross spread, costs, net result and decision', () => {
    it('appends every scan cycle to the scan audit journal', async () => {
      const engine = new ArbitrageScannerEngine();

      await engine.performArbitrageScan('WIDE_ARBITRAGE');
      await engine.performArbitrageScan('TIGHT_SPREAD_UNPROFITABLE');

      const journal = engine.getScanJournal();
      const logs = journal.getAllScanRecords();

      expect(logs.length).toBe(2);
      expect(logs[0].decision).toBe('EXECUTE_ARBITRAGE');
      expect(logs[1].decision).toBe('SKIP_INSUFFICIENT_PROFIT');

      // Test formatting of single scan log and summary table
      const formattedEntry = journal.formatSingleScanLogEntry(logs[0]);
      expect(formattedEntry).toContain('ARBITRAGE SCAN AUDIT LOG');
      expect(formattedEntry).toContain('Buy Venue:');
      expect(formattedEntry).toContain('Sell Venue:');
      expect(formattedEntry).toContain('Itemized Friction Costs');
      expect(formattedEntry).toContain('Net Profit:');

      const summaryTable = journal.renderScanHistorySummary();
      expect(summaryTable).toContain('Scan ID');
      expect(summaryTable).toContain('Gross Spread');
      expect(summaryTable).toContain('Net Profit');
    });
  });

  describe('Requirement 05: Works safely on testnet or with simulated execution; no real funds risked', () => {
    it('operates in zero-broadcast simulation mode by default', () => {
      const engine = new ArbitrageScannerEngine();
      const config = engine.getConfiguration();
      expect(config.isSimulationOnly).toBe(true);
    });

    it('rejects non-positive capital allocation to prevent invalid state operations', async () => {
      const engine = new ArbitrageScannerEngine({ capitalAllocationUsd: -500 });
      await expect(engine.performArbitrageScan()).rejects.toThrow(/capitalAllocationUsd must be greater than zero/i);
    });

    it('safely handles zero liquidity depth without division by zero errors', () => {
      const zeroDepthQuote: PriceFeedQuote = {
        ...mockAmmQuote,
        liquidityDepthUsd: 0,
      };
      const economics = profitCalculator.calculateNetArbitrageEconomics(zeroDepthQuote, mockOracleQuote, 10000);
      expect(Number.isFinite(economics.frictionCosts.slippageBps)).toBe(true);
      expect(Number.isFinite(economics.netProfitUsd)).toBe(true);
    });

    it('correctly accounts for extreme gas price spikes in network gas cost', () => {
      const normalGas = profitCalculator.calculateNetArbitrageEconomics(mockAmmQuote, mockOracleQuote, 10000, 1.2);
      const spikeGas = profitCalculator.calculateNetArbitrageEconomics(mockAmmQuote, mockOracleQuote, 10000, 50.0); // 50 Gwei spike

      expect(spikeGas.frictionCosts.networkGasCostUsd).toBeGreaterThan(normalGas.frictionCosts.networkGasCostUsd * 20);
      expect(spikeGas.netProfitUsd).toBeLessThan(normalGas.netProfitUsd);
    });
  });
});
