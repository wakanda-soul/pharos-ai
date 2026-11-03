#!/usr/bin/env node

/**
 * Command-Line Interface for Pharos Whale-Watching Agent.
 * Executes live multi-whale surveillance, runs realistic simulation demos,
 * and prints structured cross-whale activity digests.
 */

import { Command } from 'commander';
import { DEFAULT_WATCHED_WHALES, WhaleWatchingEngine } from './whale-engine.js';
import {
  formatActivitySummaryDigest,
  formatWatchedWhalesTable,
  formatWhaleFlowBanner,
} from './formatter.js';
import { WHALE_DEMO_SCENARIOS } from './scenarios.js';
import { synthesizeActivityDigest } from './activity-summary.js';

const program = new Command();

program
  .name('pharos-whale')
  .description('Autonomous Whale-Watching & High-Impact Capital Flow Surveillance Agent for Pharos Network')
  .version('1.0.0');

program
  .command('demo')
  .description('Run interactive simulation showing multi-whale tracking, threshold filtering, labeled moves and activity summary')
  .action(async () => {
    console.log('\n\x1b[1m\x1b[36m===============================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  🐋 PHAROS WHALE-WATCHING AGENT · INTERACTIVE SURVEILLANCE DEMO\x1b[0m');
    console.log('\x1b[1m\x1b[36m===============================================================================\x1b[0m\n');

    const engine = new WhaleWatchingEngine();

    console.log(formatWatchedWhalesTable(engine.getWatchedWhales()));

    const cfg = engine.detector.currentConfig;
    console.log('\x1b[1m\x1b[33mActive Significance Thresholds:\x1b[0m');
    console.log(`  • Global USD Minimum:     \x1b[1m\x1b[32m$${cfg.minimumUsdValuation.toLocaleString()} USD\x1b[0m`);
    console.log(`  • Per-Token Base Quotas:  PROS: 25,000 | USDC: 50,000 | USDT: 50,000 | WETH: 20`);
    console.log(`  • Self-Transfer Filtering: \x1b[34m${cfg.suppressSelfTransfers ? 'ENABLED' : 'DISABLED'}\x1b[0m\n`);

    console.log('\x1b[1m\x1b[34m━━━ Streaming Simulated Block Stream & Transfer Feed ━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

    let processedCount = 0;
    for (const scenario of WHALE_DEMO_SCENARIOS) {
      processedCount++;
      console.log(`\x1b[1m[Event ${processedCount}/${WHALE_DEMO_SCENARIOS.length}]\x1b[0m \x1b[36m${scenario.title}\x1b[0m: ${scenario.description}`);

      const event = engine.ingestTransfer(scenario.payload);

      if (event) {
        console.log(formatWhaleFlowBanner(event));
      } else {
        console.log(
          `  \x1b[2m↳ Transfer filtered out: Payload below significance threshold ($${cfg.minimumUsdValuation.toLocaleString()}). No alert dispatched.\x1b[0m`,
        );
      }
      console.log('');
      // Brief pause to simulate human streaming experience
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    console.log('\x1b[1m\x1b[34m━━━ Generating Cross-Whale Activity Summary Digest ━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
    const digest = synthesizeActivityDigest(engine);
    console.log(formatActivitySummaryDigest(digest));
    console.log('\n\x1b[1m\x1b[32m✔ Whale surveillance demonstration completed successfully.\x1b[0m\n');
  });

program
  .command('list')
  .description('List all active monitored whale addresses and custom thresholds')
  .action(() => {
    const engine = new WhaleWatchingEngine();
    console.log('\n' + formatWatchedWhalesTable(engine.getWatchedWhales()));
  });

program
  .command('summary')
  .description('Print recent activity summary digest')
  .action(() => {
    const engine = new WhaleWatchingEngine();
    // Ingest default scenarios to populate sample state
    for (const s of WHALE_DEMO_SCENARIOS) {
      engine.ingestTransfer(s.payload);
    }
    const digest = synthesizeActivityDigest(engine);
    console.log('\n' + formatActivitySummaryDigest(digest));
  });

program.parse(process.argv);
