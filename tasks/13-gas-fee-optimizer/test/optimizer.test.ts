import { describe, it, expect, beforeEach } from 'vitest';
import { GasTrackerOracle } from '../src/gas-oracle.js';
import { GasFeeOptimizerEngine } from '../src/optimizer-engine.js';
import { ReservationCurveCalculator } from '../src/reservation-curve.js';
import {
  SCENARIO_OPPORTUNISTIC_DIP,
  SCENARIO_DEADLINE_FORCED_HIGH_GAS,
} from '../src/scenarios.js';
import { QueuedTransaction } from '../src/types.js';

describe('Task 13: Gas Fee Optimizer Engine', () => {
  let oracle: GasTrackerOracle;
  let engine: GasFeeOptimizerEngine;

  beforeEach(() => {
    oracle = new GasTrackerOracle();
    engine = new GasFeeOptimizerEngine(oracle);
  });

  // =========================================================================
  // Requirement 01: Tracks gas price over time and shows recent history
  // =========================================================================
  describe('Requirement 01: Gas Price Tracking & Historical Distribution', () => {
    it('should track gas price snapshots over time and retain chronological history', () => {
      expect(oracle.getHistory()).toHaveLength(0);

      oracle.addSnapshot({
        blockNumber: 100n,
        timestamp: '2026-11-02T12:00:00Z',
        gasPriceGwei: 12.0,
      });
      oracle.addSnapshot({
        blockNumber: 101n,
        timestamp: '2026-11-02T12:00:03Z',
        gasPriceGwei: 10.5,
      });
      oracle.addSnapshot({
        blockNumber: 102n,
        timestamp: '2026-11-02T12:00:06Z',
        gasPriceGwei: 14.0,
      });

      const history = oracle.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].gasPriceGwei).toBe(12.0);
      expect(history[1].gasPriceGwei).toBe(10.5);
      expect(history[2].gasPriceGwei).toBe(14.0);
      expect(oracle.getLatest()?.gasPriceGwei).toBe(14.0);
    });

    it('should accurately compute market statistics and distribution percentiles (p10, p25, median, p75, p90)', () => {
      // Seed predictable values: 10, 11, 12, ..., 20
      for (let p = 10; p <= 20; p++) {
        oracle.addSnapshot({
          blockNumber: BigInt(100 + p),
          timestamp: new Date().toISOString(),
          gasPriceGwei: p,
        });
      }

      const stats = oracle.getMarketStats();
      expect(stats.sampleCount).toBe(11);
      expect(stats.minGwei).toBe(10.0);
      expect(stats.maxGwei).toBe(20.0);
      expect(stats.avgGwei).toBe(15.0);
      expect(stats.medianGwei).toBe(15.0);
      expect(stats.p10Gwei).toBeLessThanOrEqual(12.0);
      expect(stats.p90Gwei).toBeGreaterThanOrEqual(18.0);
      expect(stats.stdDevGwei).toBeGreaterThan(0);
    });

    it('should record live network gas from Pharos Mainnet RPC', async () => {
      const liveSnapshot = await oracle.recordCurrentNetworkGas();
      expect(liveSnapshot.gasPriceGwei).toBeGreaterThan(0);
      expect(liveSnapshot.blockNumber).toBeGreaterThan(20000000n);
      expect(oracle.getHistory().length).toBeGreaterThan(0);
    });

    it('should handle empty market stats gracefully without NaN or uncaught exceptions', () => {
      oracle.clear();
      const stats = oracle.getMarketStats();
      expect(stats.sampleCount).toBe(0);
      expect(stats.currentGwei).toBe(0);
      expect(stats.avgGwei).toBe(0);
      expect(stats.volatilityPercentage).toBe(0);
      expect(stats.trend).toBe('STABLE');
    });

    it('should enforce history length cap (sliding window) to prevent memory unbounded growth', () => {
      const boundedOracle = new GasTrackerOracle(5);
      for (let i = 1; i <= 10; i++) {
        boundedOracle.addSnapshot({
          blockNumber: BigInt(i),
          timestamp: new Date().toISOString(),
          gasPriceGwei: 10 + i,
        });
      }
      expect(boundedOracle.getHistory()).toHaveLength(5);
      expect(boundedOracle.getLatest()?.gasPriceGwei).toBe(20);
    });
  });

  // =========================================================================
  // Requirement 02: Accepts a transaction with a deadline and holds it until gas is favorable
  // =========================================================================
  describe('Requirement 02: Holding Mechanism & Opportunistic Gas Dip Trigger', () => {
    it('should hold non-urgent transaction until gas price dips to favorable levels', async () => {
      oracle.seedHistory(15.0, 20);

      const res = await engine.processTransaction(
        SCENARIO_OPPORTUNISTIC_DIP.transaction,
        SCENARIO_OPPORTUNISTIC_DIP.simulationTicks
      );

      // Verify that transaction was HELD for multiple steps before executing
      expect(res.priceTrajectory.length).toBeGreaterThan(1);
      const waitingSteps = res.priceTrajectory.filter((pt) => !pt.isExecutionPoint);
      expect(waitingSteps.length).toBeGreaterThanOrEqual(2);

      // Verify triggered via opportunistic dip
      expect(res.trigger).toBe('OPPORTUNISTIC_DIP');
      expect(res.status).toBe('SUBMITTED');
      expect(res.durationWaitingMs).toBeGreaterThan(0);
      expect(res.timeRemainingAtExecutionMs).toBeGreaterThan(0);
      expect(res.executedGasPriceGwei).toBeLessThan(res.requestGasPriceGwei);
    });

    it('should dynamically decay reservation price as deadline nears', () => {
      const stats = {
        sampleCount: 10,
        currentGwei: 15.0,
        minGwei: 10.0,
        maxGwei: 20.0,
        avgGwei: 15.0,
        medianGwei: 15.0,
        p10Gwei: 10.5,
        p25Gwei: 11.5,
        p75Gwei: 17.0,
        p90Gwei: 19.0,
        stdDevGwei: 3.0,
        trend: 'STABLE' as const,
        volatilityPercentage: 20.0,
      };

      const start = 1000000;
      const deadline = 1060000; // 60s window
      const strategy = {
        type: 'DYNAMIC_DECAY' as const,
        safetyMarginMs: 2000,
        decayExponent: 2.0,
      };

      const pEarly = ReservationCurveCalculator.calculateReservationPrice(
        start,
        deadline,
        start + 5000,
        stats,
        strategy
      );
      const pMid = ReservationCurveCalculator.calculateReservationPrice(
        start,
        deadline,
        start + 30000,
        stats,
        strategy
      );
      const pLate = ReservationCurveCalculator.calculateReservationPrice(
        start,
        deadline,
        start + 55000,
        stats,
        strategy
      );
      const pDeadline = ReservationCurveCalculator.calculateReservationPrice(
        start,
        deadline,
        deadline - 1000, // Inside safety margin
        stats,
        strategy
      );

      // Reservation price should increase monotonically towards deadline
      expect(pMid).toBeGreaterThan(pEarly);
      expect(pLate).toBeGreaterThan(pMid);
      expect(pDeadline).toBe(Number.POSITIVE_INFINITY);
    });

    it('should respect FIXED_THRESHOLD strategy and execute when gas dips below static target', async () => {
      const now = Date.now();
      const fixedTx: QueuedTransaction = {
        txId: 'tx-fixed-threshold',
        from: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
        to: '0xcA11bde05977b3631167028862bE2a173976CA11',
        data: '0x',
        value: 0n,
        gasLimit: 50000n,
        createdAt: now,
        deadline: now + 60000,
        requestGasPriceGwei: 15.0,
        strategy: {
          type: 'FIXED_THRESHOLD',
          fixedThresholdGwei: 9.0,
          safetyMarginMs: 2000,
        },
      };

      const ticks = [
        { timestampMs: now + 5000, gasPriceGwei: 14.0 }, // Hold (> 9.0)
        { timestampMs: now + 15000, gasPriceGwei: 12.0 }, // Hold (> 9.0)
        { timestampMs: now + 25000, gasPriceGwei: 8.5 }, // Dip below fixed target (<= 9.0) -> Trigger!
      ];

      const res = await engine.processTransaction(fixedTx, ticks);
      expect(res.trigger).toBe('OPPORTUNISTIC_DIP');
      expect(res.executedGasPriceGwei).toBe(8.5);
      expect(res.gasSavedGwei).toBe(6.5);
    });
  });

  // =========================================================================
  // Requirement 03: Reports actual gas paid compared with price at request time
  // =========================================================================
  describe('Requirement 03: Gas & Economic Cost Comparison Reporting', () => {
    it('should report exact gas prices at request vs execution time and quantify savings', async () => {
      oracle.seedHistory(15.0, 20);

      const res = await engine.processTransaction(
        SCENARIO_OPPORTUNISTIC_DIP.transaction,
        SCENARIO_OPPORTUNISTIC_DIP.simulationTicks
      );

      // Verify request vs actual gas paid
      expect(res.requestGasPriceGwei).toBe(18.0);
      expect(res.executedGasPriceGwei).toBe(10.5);

      // Verify gas savings
      expect(res.gasSavedGwei).toBe(7.5);
      expect(res.gasSavedPercentage).toBeCloseTo(41.67, 1);
      expect(parseFloat(res.prosSaved)).toBeGreaterThan(0);

      // Verify financial cost in PROS & USD
      expect(parseFloat(res.actualCostPaidPros)).toBeLessThan(parseFloat(res.costAtRequestPros));
      expect(res.usdSaved).toBeDefined();
      expect(res.usdSaved!).toBeGreaterThan(0);
      expect(res.oraclePriceUsd).toBeGreaterThan(1000); // Live Chainlink price (~$2,280+)
    });

    it('should scale PROS and USD cost savings accurately for heavy gas operations', async () => {
      const now = Date.now();
      const heavyTx: QueuedTransaction = {
        txId: 'tx-heavy-batch',
        from: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
        to: '0xcA11bde05977b3631167028862bE2a173976CA11',
        data: '0x',
        value: 0n,
        gasLimit: 500000n, // 500k gas units
        createdAt: now,
        deadline: now + 30000,
        requestGasPriceGwei: 20.0,
        strategy: {
          type: 'DYNAMIC_DECAY',
          safetyMarginMs: 2000,
        },
      };

      const ticks = [
        { timestampMs: now + 10000, gasPriceGwei: 10.0 }, // 10 Gwei drop = 50% discount
      ];

      const res = await engine.processTransaction(heavyTx, ticks);
      expect(res.gasSavedGwei).toBe(10.0);
      expect(res.gasSavedPercentage).toBe(50.0);
      // 500,000 gas * 10 Gwei = 0.005 PROS saved
      expect(parseFloat(res.prosSaved)).toBeCloseTo(0.005, 4);
      expect(res.usdSaved!).toBeGreaterThan(10.0); // 0.005 * ~$2300 = ~$11.50 USD
    });
  });

  // =========================================================================
  // Requirement 04: Never misses the deadline. Submits at deadline even if gas is high
  // =========================================================================
  describe('Requirement 04: Zero-Miss Deadline SLA Under High Gas Congestion', () => {
    it('should strictly submit transaction at deadline even when network gas spikes and remains elevated', async () => {
      oracle.seedHistory(14.0, 20);

      const res = await engine.processTransaction(
        SCENARIO_DEADLINE_FORCED_HIGH_GAS.transaction,
        SCENARIO_DEADLINE_FORCED_HIGH_GAS.simulationTicks
      );

      // Strict requirement verification:
      expect(res.trigger).toBe('DEADLINE_FORCED');
      expect(res.status).toBe('SUBMITTED');

      // Submitted at the elevated spike price (25 Gwei) to preserve deadline SLA
      expect(res.executedGasPriceGwei).toBe(25.0);
      expect(res.executedGasPriceGwei).toBeGreaterThan(res.requestGasPriceGwei);

      // Verified execution happened within deadline window (not late)
      const execTime = new Date(res.executionTimestamp).getTime();
      expect(execTime).toBeLessThanOrEqual(SCENARIO_DEADLINE_FORCED_HIGH_GAS.transaction.deadline);

      // Command is generated and ready for dispatch
      expect(res.castCommand).toContain('cast send');
      expect(res.castCommand).toContain('--gas-price 25000000000');
    });

    it('should force immediate execution if transaction is enqueued with an expired or immediate deadline', async () => {
      const now = Date.now();
      const urgentTx: QueuedTransaction = {
        txId: 'tx-urgent-now',
        from: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
        to: '0xcA11bde05977b3631167028862bE2a173976CA11',
        data: '0x',
        value: 0n,
        gasLimit: 21000n,
        createdAt: now,
        deadline: now + 500, // 500ms (already within safety margin)
        requestGasPriceGwei: 10.0,
        strategy: {
          type: 'DYNAMIC_DECAY',
          safetyMarginMs: 1000,
        },
      };

      const res = await engine.processTransaction(urgentTx);
      expect(res.trigger).toBe('DEADLINE_FORCED');
      expect(res.status).toBe('SUBMITTED');
    });
  });
});
