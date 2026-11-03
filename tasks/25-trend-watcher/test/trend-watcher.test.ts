import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { PersistentObservationStore } from '../src/observation-store.js';
import { TrendWatcherEngine } from '../src/trend-evaluator.js';
import { TrendEvaluationConfig } from '../src/types.js';

const TEST_STORAGE_DIR = path.resolve(__dirname, '.test-storage');
const TEST_STORAGE_FILE = path.join(TEST_STORAGE_DIR, 'test-observations-ledger.json');

describe('Task 25: Trend Watcher Specification (SkillEngine)', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STORAGE_FILE)) {
      fs.unlinkSync(TEST_STORAGE_FILE);
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_STORAGE_FILE)) {
      fs.unlinkSync(TEST_STORAGE_FILE);
    }
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      try {
        fs.rmdirSync(TEST_STORAGE_DIR);
      } catch {
        // Ignored
      }
    }
  });

  describe('Requirement 01: Stores state between runs in persistent storage', () => {
    it('persists observations directly to disk as valid JSON file', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);

      const record1 = {
        observationId: 'obs-pros-1',
        metricKey: 'PROS/USDC',
        numericValue: 1.50,
        timestampIso: new Date(1762174000000).toISOString(),
        timestampMs: 1762174000000,
        sourceVenue: 'FaroSwap AMM',
      };

      store.ingestObservation(record1);

      expect(fs.existsSync(TEST_STORAGE_FILE)).toBe(true);
      const rawDiskContent = fs.readFileSync(TEST_STORAGE_FILE, 'utf-8');
      const parsedSnapshot = JSON.parse(rawDiskContent);

      expect(parsedSnapshot.version).toBe(1);
      expect(parsedSnapshot.metricKey).toBe('PROS/USDC');
      expect(parsedSnapshot.totalObservationsIngested).toBe(1);
      expect(parsedSnapshot.observations[0].numericValue).toBe(1.50);
    });

    it('loads persisted observations upon initializing a brand new store instance', () => {
      // First process session
      const initialStore = new PersistentObservationStore(TEST_STORAGE_FILE);
      initialStore.ingestObservation({
        observationId: 'obs-session1-1',
        metricKey: 'HARBOR_TVL',
        numericValue: 12500000,
        timestampIso: new Date(1762174100000).toISOString(),
        timestampMs: 1762174100000,
        sourceVenue: 'Harbor Protocol',
      });
      initialStore.ingestObservation({
        observationId: 'obs-session1-2',
        metricKey: 'HARBOR_TVL',
        numericValue: 12200000,
        timestampIso: new Date(1762174200000).toISOString(),
        timestampMs: 1762174200000,
        sourceVenue: 'Harbor Protocol',
      });

      expect(initialStore.getStoredObservationsCount()).toBe(2);

      // Simulated reboot: second process session loading from same disk file
      const rebootedStore = new PersistentObservationStore(TEST_STORAGE_FILE);
      const restoredRecords = rebootedStore.queryObservationsForMetric('HARBOR_TVL');

      expect(restoredRecords).toHaveLength(2);
      expect(restoredRecords[0].numericValue).toBe(12500000);
      expect(restoredRecords[1].numericValue).toBe(12200000);
    });
  });

  describe('Requirement 02: Trend rule needs at least 3 observations to trigger and is configurable', () => {
    it('strictly rejects configurations with minimumConsecutiveReadings < 3', () => {
      expect(() => {
        new TrendWatcherEngine({
          metricKey: 'PROS/USDC',
          minimumConsecutiveReadings: 2, // Violates rule: must be >= 3
          trendDirection: 'DOWNTREND',
          minimumCumulativeDeltaPercent: 1.0,
        });
      }).toThrow(/minimumConsecutiveReadings must be at least 3/);
    });

    it('confirms trend only when at least 3 consecutive observations meet criteria', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);
      const config: TrendEvaluationConfig = {
        metricKey: 'PROS/USDC',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 2.0,
      };
      const engine = new TrendWatcherEngine(config, store);

      // Observation 1: Baseline (100)
      engine.recordObservation(100.0, 'FaroSwap AMM', 1762174000000);
      let report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(false);
      expect(report.status).toBe('BUFFERING_OBSERVATIONS');

      // Observation 2: First drop (97.0 -> -3.0%)
      engine.recordObservation(97.0, 'FaroSwap AMM', 1762174060000);
      report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(false);
      expect(report.consecutiveConfirmedCount).toBe(2);
      expect(report.status).toBe('ACCUMULATING_TREND');

      // Observation 3: Second drop (94.0 -> cumulative -6.0%) -> 3 consecutive readings!
      engine.recordObservation(94.0, 'FaroSwap AMM', 1762174120000);
      report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(true);
      expect(report.consecutiveConfirmedCount).toBe(3);
      expect(report.status).toBe('TREND_CONFIRMED');
      expect(report.cumulativePercentageDelta).toBe(-6.0);
    });

    it('dynamically adapts to custom configurations (4 readings, UPTREND)', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);
      const config: TrendEvaluationConfig = {
        metricKey: 'GAS_BASE_FEE',
        minimumConsecutiveReadings: 4,
        trendDirection: 'UPTREND',
        minimumCumulativeDeltaPercent: 10.0,
      };
      const engine = new TrendWatcherEngine(config, store);

      engine.recordObservation(1.0, 'Pharos RPC', 1762174000000);
      engine.recordObservation(1.2, 'Pharos RPC', 1762174060000);
      engine.recordObservation(1.5, 'Pharos RPC', 1762174120000);

      // Only 3 readings, threshold is 4
      let report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(false);
      expect(report.status).toBe('ACCUMULATING_TREND');

      // 4th reading: 1.8 Gwei (+80% from baseline)
      engine.recordObservation(1.8, 'Pharos RPC', 1762174180000);
      report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(true);
      expect(report.status).toBe('TREND_CONFIRMED');
      expect(report.consecutiveConfirmedCount).toBe(4);
      expect(report.cumulativePercentageDelta).toBe(80.0);
    });
  });

  describe('Requirement 03: Handles restarts without losing or duplicating history', () => {
    it('simulates process restart and preserves full observation history', () => {
      // Session 1: record 2 observations
      const store1 = new PersistentObservationStore(TEST_STORAGE_FILE);
      const engine1 = new TrendWatcherEngine({
        metricKey: 'PROS/USDC',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 1.0,
      }, store1);

      engine1.recordObservation(1.50, 'FaroSwap', 1762174000000);
      engine1.recordObservation(1.47, 'FaroSwap', 1762174060000);

      // Session 2: Fresh instance (after reboot)
      const store2 = new PersistentObservationStore(TEST_STORAGE_FILE);
      const engine2 = new TrendWatcherEngine({
        metricKey: 'PROS/USDC',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 1.0,
      }, store2);

      const restoredHistory = store2.queryObservationsForMetric('PROS/USDC');
      expect(restoredHistory).toHaveLength(2);

      // Record 3rd observation in new session -> triggers trend confirmation!
      engine2.recordObservation(1.44, 'FaroSwap', 1762174120000);
      const report = engine2.evaluateCurrentTrend();

      expect(report.isTrendConfirmed).toBe(true);
      expect(report.consecutiveConfirmedCount).toBe(3);
      expect(report.evaluatedObservations).toHaveLength(3);
    });

    it('ignores duplicate ingestions of identical observations without duplicating history', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);

      const duplicateRecord = {
        observationId: 'obs-dedup-1',
        metricKey: 'PROS/USDC',
        numericValue: 1.50,
        timestampIso: new Date(1762174000000).toISOString(),
        timestampMs: 1762174000000,
        sourceVenue: 'FaroSwap AMM',
      };

      const firstAttempt = store.ingestObservation(duplicateRecord);
      const secondAttempt = store.ingestObservation(duplicateRecord);
      const thirdAttemptWithSameFingerprint = store.ingestObservation({
        ...duplicateRecord,
        observationId: 'obs-different-random-id', // Same timestamp, metric, and value
      });

      expect(firstAttempt).toBe(true);
      expect(secondAttempt).toBe(false);
      expect(thirdAttemptWithSameFingerprint).toBe(false);

      expect(store.queryObservationsForMetric('PROS/USDC')).toHaveLength(1);
    });
  });

  describe('Requirement 04: Shows stored history and the exact moment trend condition was met', () => {
    it('returns full chronological observation history in evaluation report', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);
      const engine = new TrendWatcherEngine({
        metricKey: 'PROS/USDC',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 1.0,
      }, store);

      engine.recordObservation(100, 'FaroSwap', 1762174000000);
      engine.recordObservation(98, 'FaroSwap', 1762174060000);
      engine.recordObservation(96, 'FaroSwap', 1762174120000);
      engine.recordObservation(94, 'FaroSwap', 1762174180000);

      const report = engine.evaluateCurrentTrend();
      expect(report.evaluatedObservations).toHaveLength(4);
      expect(report.evaluatedObservations.map(o => o.numericValue)).toEqual([100, 98, 96, 94]);
    });

    it('accurately identifies the exact observation and timestamp where trend was met', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);
      const engine = new TrendWatcherEngine({
        metricKey: 'PROS/USDC',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 1.0,
      }, store);

      engine.recordObservation(100, 'FaroSwap', 1762174000000);
      engine.recordObservation(98, 'FaroSwap', 1762174060000);
      
      // Exact moment the 3rd consecutive reading occurs:
      const triggeringTime = 1762174120000;
      const triggeringObs = engine.recordObservation(96, 'FaroSwap', triggeringTime);

      // Subsequent continuing drop
      engine.recordObservation(94, 'FaroSwap', 1762174180000);

      const report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(true);
      expect(report.triggeringObservation).toBeDefined();
      expect(report.triggeringObservation?.observationId).toBe(triggeringObs.observationId);
      expect(report.triggeringObservation?.timestampMs).toBe(triggeringTime);
    });
  });

  describe('Requirement 05: Demonstrates that a single spike does not trigger it', () => {
    it('rejects an isolated single tick spike as transient noise without confirming trend', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);
      const engine = new TrendWatcherEngine({
        metricKey: 'PROS/USDC',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 1.0,
      }, store);

      // Baseline price
      engine.recordObservation(1.50, 'FaroSwap AMM', 1762174000000);

      // Flash crash spike to 1.10 (-26.6% on single tick!)
      engine.recordObservation(1.10, 'FaroSwap AMM', 1762174060000);

      const report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(false);
      expect(report.status).toBe('NOISY_SPIKE_REJECTED');
      expect(report.justificationRationale).toMatch(/Transient price spike rejected as noise/);
    });

    it('rejects a single spike followed by immediate snapback without triggering action', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);
      const engine = new TrendWatcherEngine({
        metricKey: 'PROS/USDC',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 1.0,
      }, store);

      // Baseline price
      engine.recordObservation(1.50, 'FaroSwap AMM', 1762174000000);

      // Transient single spike down
      engine.recordObservation(1.20, 'FaroSwap AMM', 1762174060000);

      // Immediate snapback to mean
      engine.recordObservation(1.49, 'FaroSwap AMM', 1762174120000);

      const report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(false);
      expect(report.status).toBe('NOISY_SPIKE_REJECTED');
      expect(report.justificationRationale).toMatch(/Transient noise rejected/);
    });

    it('safely handles zero baseline and non-moving flat periods', () => {
      const store = new PersistentObservationStore(TEST_STORAGE_FILE);
      const engine = new TrendWatcherEngine({
        metricKey: 'TOKEN_ZERO',
        minimumConsecutiveReadings: 3,
        trendDirection: 'DOWNTREND',
        minimumCumulativeDeltaPercent: 1.0,
      }, store);

      engine.recordObservation(0.0, 'Venue', 1762174000000);
      engine.recordObservation(0.0, 'Venue', 1762174060000);
      engine.recordObservation(0.0, 'Venue', 1762174120000);

      const report = engine.evaluateCurrentTrend();
      expect(report.isTrendConfirmed).toBe(false);
      expect(report.status).toBe('TREND_INVALIDATED');
    });
  });
});
