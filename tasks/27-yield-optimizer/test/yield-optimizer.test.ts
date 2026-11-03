import { describe, it, expect } from 'vitest';
import { YieldVenueReader } from '../src/yield-reader.js';
import { SwitchingFrictionCalculator } from '../src/friction-calculator.js';
import { YieldOptimizerEngine } from '../src/optimizer-engine.js';

const DEMO_USER_WALLET = '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E' as `0x${string}`;

describe('Task 27: Yield Optimizer Specification (DeFi / Portfolio)', () => {
  describe('Requirement 01: Compares at least 3 yield sources using live on-chain data', () => {
    it('returns at least 3 distinct live yield venues for USDC', async () => {
      const reader = new YieldVenueReader();
      const venues = await reader.getAvailableYieldVenues('USDC');

      expect(venues.length).toBeGreaterThanOrEqual(3);
      const venueIds = venues.map((v) => v.venueId);
      expect(venueIds).toContain('harbor:apc3m');
      expect(venueIds).toContain('morpho:rockawayx-usdc');
      expect(venueIds).toContain('harbor:vrpc');
    });

    it('verifies all venues contain verified EVM contract addresses and confirmed block numbers', async () => {
      const reader = new YieldVenueReader();
      const venues = await reader.getAvailableYieldVenues('USDC');

      for (const v of venues) {
        expect(v.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(v.blockNumber).toBeGreaterThan(0);
        expect(v.explorerUrl).toContain('https://pharosscan.xyz/address/0x');
        expect(v.apyPercent).toBeGreaterThan(0);
        expect(v.tvlUsd).toBeGreaterThan(0);
      }
    });

    it('rejects venue sets with fewer than 3 yield sources', async () => {
      const reader = new YieldVenueReader();
      await expect(reader.getAvailableYieldVenues('NON_EXISTENT_TOKEN')).rejects.toThrow(
        /Must compare at least 3 yield sources/
      );
    });
  });

  describe('Requirement 02: Accounts for gas, entry/exit fees, and holding period', () => {
    it('calculates itemized friction including exit fee, entry fee, and gas costs', async () => {
      const reader = new YieldVenueReader();
      const calculator = new SwitchingFrictionCalculator(1.5, 1.50); // 1.5 Gwei, $1.50 PROS
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc'); // 0% entry, 0% exit
      const vrpc = await reader.getVenueById('harbor:vrpc'); // 15 bps entry, 20 bps exit

      const friction = calculator.calculateFriction(10000, morpho, vrpc);

      expect(friction.exitFeeUsd).toBe(0.0); // Morpho has 0 exit fee
      expect(friction.entryFeeUsd).toBe(15.0); // 15 bps on 10k = $15.00
      expect(friction.estimatedGasUnits).toBe(320000);
      expect(friction.gasCostUsd).toBeGreaterThan(0);
      expect(friction.totalFrictionUsd).toBeCloseTo(15.0 + friction.gasCostUsd, 1);
    });

    it('demonstrates holding period amortization: longer holding horizon increases net yield', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader);
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc'); // 9.4%
      const vrpc = await reader.getVenueById('harbor:vrpc'); // 16.5% (+7.1% APY spread)

      // 30 days holding: gross gain ~$58.36, friction ~$15.70 -> Net ~$42.66
      const report30Days = engine.evaluateMigrationPair(10000, 30, morpho, vrpc);
      // 90 days holding: gross gain ~$175.07, friction ~$15.70 -> Net ~$159.37
      const report90Days = engine.evaluateMigrationPair(10000, 90, morpho, vrpc);

      expect(report90Days.projectedGrossGainUsd).toBeGreaterThan(report30Days.projectedGrossGainUsd);
      expect(report90Days.projectedNetGainUsd).toBeGreaterThan(report30Days.projectedNetGainUsd);
      expect(report90Days.switchingFriction.totalFrictionUsd).toBe(report30Days.switchingFriction.totalFrictionUsd);
    });

    it('enforces lockup tenor constraints: rejects rebalancing if lockup tenor exceeds holding period', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader);
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc');
      const vrpc = await reader.getVenueById('harbor:vrpc'); // 30-day lockup tenor

      // Planned holding period is only 14 days, but VRPC requires 30-day lockup
      const report = engine.evaluateMigrationPair(10000, 14, morpho, vrpc);

      expect(report.decision).toBe('STAY_PUT');
      expect(report.decisionRationale).toContain('imposes a mandatory lockup tenor of 30 days');
    });
  });

  describe('Requirement 03: Outputs clear recommendation with net gain, or stay put with reason', () => {
    it('outputs REBALANCE_RECOMMENDED with expected net gain when spread clears friction', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader);
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc'); // 9.4%
      const vrpc = await reader.getVenueById('harbor:vrpc'); // 16.5%

      const report = engine.evaluateMigrationPair(10000, 90, morpho, vrpc, DEMO_USER_WALLET);

      expect(report.decision).toBe('REBALANCE_RECOMMENDED');
      expect(report.projectedNetGainUsd).toBeGreaterThan(50);
      expect(report.breakEvenDays).toBeLessThan(90);
      expect(report.decisionRationale).toContain('Rebalance recommended');
      expect(report.decisionRationale).toContain('net gain');
    });

    it('outputs STAY_PUT with reason when holding period is too short to amortize friction', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader);
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc'); // 9.4%, liquid lockup 0
      const apc3m = await reader.getVenueById('harbor:apc3m'); // 13.8%, liquid lockup 0 (+4.4% spread, 10 bps entry)

      // Short 3-day holding horizon on $2,000 capital:
      // Gross gain = 2000 * 0.044 * (3/365) = $0.72 USD
      // Friction = 2000 * 0.0010 + gas = $2.00+ USD -> Net loss
      const report = engine.evaluateMigrationPair(2000, 3, morpho, apc3m);

      expect(report.decision).toBe('STAY_PUT');
      expect(report.decisionRationale).toContain('Stay put');
      expect(report.decisionRationale).toContain('too short to amortize');
      expect(report.projectedNetGainUsd).toBeLessThan(0);
    });

    it('outputs STAY_PUT when target venue offers lower or equal APY', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader);
      const vrpc = await reader.getVenueById('harbor:vrpc'); // 16.5%
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc'); // 9.4%

      const report = engine.evaluateMigrationPair(10000, 90, vrpc, morpho);

      expect(report.decision).toBe('STAY_PUT');
      expect(report.grossApySpread).toBeLessThan(0);
      expect(report.decisionRationale).toContain('does not offer a higher yield');
    });

    it('outputs STAY_PUT when net gain fails to clear configured hurdle ($25.00)', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader, undefined, { minimumNetGainHurdleUsd: 50.0 });
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc'); // 9.4%
      const apc3m = await reader.getVenueById('harbor:apc3m'); // 13.8% (+4.4% spread)

      // Small $1,000 capital over 30 days yields ~$3.60 net gain, which is < $50 hurdle
      const report = engine.evaluateMigrationPair(1000, 30, morpho, apc3m);

      expect(report.decision).toBe('STAY_PUT');
      expect(report.decisionRationale).toContain('fails to clear the configured minimum threshold hurdle');
    });
  });

  describe('Requirement 04: Prepares transactions for user signature only; never holds keys', () => {
    it('strictly asserts agentHoldsKeys === false on all evaluations', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader);
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc');
      const vrpc = await reader.getVenueById('harbor:vrpc');

      const report = engine.evaluateMigrationPair(10000, 90, morpho, vrpc);
      expect(report.agentHoldsKeys).toBe(false);
    });

    it('synthesizes 3-step unsigned transaction sequence with valid hex calldata and cast commands', async () => {
      const reader = new YieldVenueReader();
      const engine = new YieldOptimizerEngine(reader);
      const morpho = await reader.getVenueById('morpho:rockawayx-usdc');
      const vrpc = await reader.getVenueById('harbor:vrpc');

      const txs = engine.synthesizeUnsignedRebalanceTransactions(10000, morpho, vrpc, DEMO_USER_WALLET);

      expect(txs).toHaveLength(3);

      // Step 1: Withdraw
      expect(txs[0].stepIndex).toBe(1);
      expect(txs[0].actionDescription).toContain('Redeem and withdraw');
      expect(txs[0].targetContract).toBe(morpho.contractAddress);
      expect(txs[0].calldata).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(txs[0].castCommand).toContain('cast send');
      expect(txs[0].castCommand).toContain('withdraw');

      // Step 2: Approve
      expect(txs[1].stepIndex).toBe(2);
      expect(txs[1].actionDescription).toContain('Grant');
      expect(txs[1].functionName).toBe('approve(address,uint256)');
      expect(txs[1].calldata).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(txs[1].castCommand).toContain('approve');

      // Step 3: Deposit
      expect(txs[2].stepIndex).toBe(3);
      expect(txs[2].actionDescription).toContain('Supply and deposit');
      expect(txs[2].targetContract).toBe(vrpc.contractAddress);
      expect(txs[2].calldata).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(txs[2].castCommand).toContain('deposit');
    });

    it('guarantees zero private key custody across all engine instances', () => {
      const engine = new YieldOptimizerEngine();
      expect((engine as any).privateKey).toBeUndefined();
      expect((engine as any).signer).toBeUndefined();
      expect((engine as any).wallet).toBeUndefined();
    });
  });
});
