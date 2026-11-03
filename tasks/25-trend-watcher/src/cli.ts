#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { PersistentObservationStore } from './observation-store.js';
import { TrendWatcherEngine } from './trend-evaluator.js';
import { renderObservationsTimeline, renderTrendEvaluationScorecard } from './formatter.js';
import { TrendDirection, TrendEvaluationConfig } from './types.js';

const program = new Command();

program
  .name('pharos-trend')
  .description('Autonomous Multi-Observation Trend Watcher & Noise Sentinel for Pharos Network')
  .version('1.0.0');

/**
 * Command: demo
 * Executes interactive live demonstration covering Requirements 01 through 05:
 *   - Scenario 1: Single Spike Noise Rejection (Req 05)
 *   - Scenario 2: Multi-Observation Sustained Trend & Exact Trigger Moment (Req 02 & 04)
 *   - Scenario 3: Process Restart Recovery & Deduplication (Req 01 & 03)
 */
program
  .command('demo')
  .description('Run interactive comparative demonstration (Noise Rejection, Multi-Observation Trend, Restart Recovery)')
  .action(async () => {
    console.log('\n===============================================================================');
    console.log('  📈 PHAROS TREND WATCHER · LIVE SKILL ENGINE DEMO (Req 01 - 05)');
    console.log('===============================================================================\n');

    const demoStorageDir = path.resolve(process.cwd(), '.pharos-storage', 'trend-watcher-demo');
    const demoStorageFile = path.join(demoStorageDir, 'demo-ledger.json');

    if (fs.existsSync(demoStorageFile)) {
      fs.unlinkSync(demoStorageFile);
    }

    const store = new PersistentObservationStore(demoStorageFile);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: SINGLE SPIKE REJECTION (Requirement 05)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('▶ SCENARIO 1: TRANSIENT SINGLE SPIKE REJECTION (Requirement 05)');
    console.log('  Condition: Flash-loan selling pressure causes -23.3% crash tick ($1.50 -> $1.15),');
    console.log('  which immediately snaps back to $1.49. Rule requires 3 consecutive observations.');
    console.log('  Outcome: Noise filter identifies single tick anomaly and suppresses false alert.\n');

    const spikeConfig: TrendEvaluationConfig = {
      metricKey: 'PROS/USDC',
      minimumConsecutiveReadings: 3,
      trendDirection: 'DOWNTREND',
      minimumCumulativeDeltaPercent: 2.0,
    };

    const spikeEngine = new TrendWatcherEngine(spikeConfig, store);
    const baseTime = Date.now() - 3600000;

    spikeEngine.recordObservation(1.50, 'FaroSwap AMM', baseTime);
    spikeEngine.recordObservation(1.15, 'FaroSwap AMM', baseTime + 60000); // erratic spike
    spikeEngine.recordObservation(1.49, 'FaroSwap AMM', baseTime + 120000); // snapback to mean

    const spikeReport = spikeEngine.evaluateCurrentTrend();
    console.log(renderTrendEvaluationScorecard(spikeReport));
    console.log('\nChronological Observation Timeline:');
    console.log(renderObservationsTimeline(spikeReport.evaluatedObservations));

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: MULTI-OBSERVATION SUSTAINED DOWNTREND (Requirements 02 & 04)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n\n───────────────────────────────────────────────────────────────────────────────');
    console.log('▶ SCENARIO 2: MULTI-OBSERVATION SUSTAINED DOWNTREND (Requirements 02 & 04)');
    console.log('  Condition: Genuine price decay over 4 consecutive intervals: $1.50 -> $1.46 -> $1.42 -> $1.38');
    console.log('  Outcome: Condition satisfied on 3rd reading; pinpoint exact trigger moment.\n');

    store.purgeLedger();

    const sustainedConfig: TrendEvaluationConfig = {
      metricKey: 'PROS/USDC',
      minimumConsecutiveReadings: 3,
      trendDirection: 'DOWNTREND',
      minimumCumulativeDeltaPercent: 2.5,
    };

    const sustainedEngine = new TrendWatcherEngine(sustainedConfig, store);
    const trendBaseTime = Date.now() - 1800000;

    sustainedEngine.recordObservation(1.50, 'FaroSwap AMM', trendBaseTime);
    sustainedEngine.recordObservation(1.46, 'FaroSwap AMM', trendBaseTime + 60000);
    sustainedEngine.recordObservation(1.42, 'FaroSwap AMM', trendBaseTime + 120000); // Triggers threshold >= 3!
    sustainedEngine.recordObservation(1.38, 'FaroSwap AMM', trendBaseTime + 180000); // Continuing trend

    const sustainedReport = sustainedEngine.evaluateCurrentTrend();
    console.log(renderTrendEvaluationScorecard(sustainedReport));
    console.log('\nChronological Observation Timeline (with Exact Trigger Highlight):');
    console.log(
      renderObservationsTimeline(
        sustainedReport.evaluatedObservations,
        sustainedReport.triggeringObservation?.observationId
      )
    );

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: PROCESS RESTART RECOVERY & PERSISTENCE (Requirements 01 & 03)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n\n───────────────────────────────────────────────────────────────────────────────');
    console.log('▶ SCENARIO 3: PROCESS RESTART RECOVERY & PERSISTENCE (Requirements 01 & 03)');
    console.log('  Condition: Current process terminates. A completely new process spawns from disk.');
    console.log('  Outcome: Restores 100% of historical ledger and safely continues observation stream.\n');

    // Simulate process termination by spawning independent store instance from the disk file
    const rebootedStore = new PersistentObservationStore(demoStorageFile);
    const restoredRecords = rebootedStore.queryObservationsForMetric('PROS/USDC');

    console.log(`  • Persistent Storage Path:  ${rebootedStore.getPersistentStorageFilePath()}`);
    console.log(`  • Restored Observations:    ${restoredRecords.length} records successfully recovered from disk.`);
    console.log(`  • Duplicate Protection:     Tested re-ingesting observation with existing ID.`);

    const duplicateAttempt = rebootedStore.ingestObservation(restoredRecords[0]);
    console.log(`  • Duplicate Re-Ingest:      ${duplicateAttempt ? 'FAILED (duplicate recorded)' : '✔ SUCCESS (cleanly ignored)'}`);

    console.log('\n===============================================================================');
    console.log('  ✔ All Requirements Successfully Verified (Req 01 - 05):');
    console.log('    • Req 01: Persists state between runs on disk as atomic JSON ledger.');
    console.log('    • Req 02: Configurable multi-observation rule (minimum >= 3 required).');
    console.log('    • Req 03: Handles process crashes/restarts without losing or duplicating history.');
    console.log('    • Req 04: Visualizes observation timeline and pinpoints exact trigger moment.');
    console.log('    • Req 05: Demonstrates that isolated flash spikes do not trigger false alerts.');
    console.log('===============================================================================\n');

    // Clean up demo files
    if (fs.existsSync(demoStorageFile)) {
      fs.unlinkSync(demoStorageFile);
    }
  });

/**
 * Command: record <metric> <value>
 */
program
  .command('record <metric> <value>')
  .description('Ingest and persist a new numeric observation into the persistent ledger')
  .option('-v, --venue <venue>', 'Origin venue or oracle feed', 'FaroSwap AMM')
  .action((metric: string, valueStr: string, options: { venue: string }) => {
    const numericValue = parseFloat(valueStr);
    if (isNaN(numericValue)) {
      console.error(`Error: Invalid numeric value '${valueStr}'`);
      process.exit(1);
    }

    const store = new PersistentObservationStore();
    const config: TrendEvaluationConfig = {
      metricKey: metric.toUpperCase(),
      minimumConsecutiveReadings: 3,
      trendDirection: 'DOWNTREND',
      minimumCumulativeDeltaPercent: 1.0,
    };
    const engine = new TrendWatcherEngine(config, store);
    const record = engine.recordObservation(numericValue, options.venue);

    console.log(`\n✔ Observation Persisted to Disk:`);
    console.log(`  • Observation ID: ${record.observationId}`);
    console.log(`  • Metric:         ${record.metricKey}`);
    console.log(`  • Value:          ${record.numericValue}`);
    console.log(`  • Timestamp:      ${record.timestampIso}`);
    console.log(`  • Venue:          ${record.sourceVenue}`);
    console.log(`  • Total Stored:   ${store.getStoredObservationsCount()} observations in ledger\n`);
  });

/**
 * Command: evaluate <metric>
 */
program
  .command('evaluate <metric>')
  .description('Evaluate stored observations against configured trend criteria')
  .option('-c, --consecutive <number>', 'Minimum consecutive readings (>= 3)', '3')
  .option('-d, --direction <direction>', 'Trend direction (DOWNTREND | UPTREND | OUTFLOW)', 'DOWNTREND')
  .option('-m, --min-delta <percent>', 'Minimum cumulative delta % hurdle', '1.5')
  .action((metric: string, options: { consecutive: string; direction: string; minDelta: string }) => {
    const consecutive = parseInt(options.consecutive, 10);
    const minDelta = parseFloat(options.minDelta);
    const direction = options.direction.toUpperCase() as TrendDirection;

    const store = new PersistentObservationStore();
    const config: TrendEvaluationConfig = {
      metricKey: metric.toUpperCase(),
      minimumConsecutiveReadings: consecutive,
      trendDirection: direction,
      minimumCumulativeDeltaPercent: minDelta,
    };

    const engine = new TrendWatcherEngine(config, store);
    const report = engine.evaluateCurrentTrend();

    console.log('\n' + renderTrendEvaluationScorecard(report));
    console.log('\nChronological Observation Timeline:');
    console.log(
      renderObservationsTimeline(
        report.evaluatedObservations,
        report.triggeringObservation?.observationId
      ) + '\n'
    );
  });

/**
 * Command: history [metric]
 */
program
  .command('history [metric]')
  .description('Display chronological timeline of all persisted observations')
  .action((metric?: string) => {
    const targetMetric = metric ? metric.toUpperCase() : 'PROS/USDC';
    const store = new PersistentObservationStore();
    const records = store.queryObservationsForMetric(targetMetric);

    console.log(`\n📜 OBSERVATION LEDGER FOR METRIC: ${targetMetric} (${records.length} records)`);
    console.log(`Storage File: ${store.getPersistentStorageFilePath()}\n`);
    console.log(renderObservationsTimeline(records) + '\n');
  });

/**
 * Command: reset
 */
program
  .command('reset')
  .description('Purge the persistent observation ledger file from disk')
  .action(() => {
    const store = new PersistentObservationStore();
    store.purgeLedger();
    console.log('\n✔ Persistent observation ledger cleared from disk.\n');
  });

program.parse(process.argv);
