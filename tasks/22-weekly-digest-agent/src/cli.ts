#!/usr/bin/env node

/**
 * Command-Line Interface for the Pharos Weekly Digest Agent.
 * Generates periodic summaries of wallet or protocol activity, comparing key metrics
 * to previous periods, highlighting the top 3 notable events, and delivering to real channels
 * or published HTML pages.
 */

import { Command } from 'commander';
import path from 'node:path';
import { DigestScheduleManager } from './scheduler.js';
import { DigestGenerator } from './digest-generator.js';
import { DigestDeliveryDispatcher } from './dispatcher.js';
import { formatWeeklyDigestTerminal } from './formatter.js';
import {
  BENCHMARK_TREASURY_TRANSACTIONS,
  DEMO_BASELINE_PERIOD,
  DEMO_CURRENT_PERIOD,
  DEMO_PROTOCOL_PROFILE,
  DEMO_TREASURY_PROFILE,
} from './scenarios.js';
import type { DeliveryChannelKind, DigestTargetProfile } from './types.js';

const program = new Command();

program
  .name('pharos-digest')
  .description('Autonomous Weekly Digest Agent for Pharos Network (Chain ID 1672)')
  .version('1.0.0');

program
  .command('demo')
  .description('Run interactive weekly digest simulation comparing current vs baseline periods on sample treasury and protocol')
  .option('-o, --out-dir <dir>', 'Directory to save published HTML executive reports', './published-digests')
  .action(async (options: { outDir: string }) => {
    console.log('\n\x1b[1m\x1b[36m===============================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  📰 PHAROS WEEKLY DIGEST AGENT · AUTONOMOUS REPORTING DEMO\x1b[0m');
    console.log('\x1b[1m\x1b[36m===============================================================================\x1b[0m\n');

    const generator = new DigestGenerator();
    const dispatcher = new DigestDeliveryDispatcher();

    console.log('\x1b[1m\x1b[33m[1/2] Generating Weekly Digest for Corporate Treasury Wallet...\x1b[0m\n');

    const treasuryReport = generator.generateWeeklyDigest(
      DEMO_TREASURY_PROFILE,
      DEMO_CURRENT_PERIOD,
      DEMO_BASELINE_PERIOD,
      BENCHMARK_TREASURY_TRANSACTIONS,
    );

    const dispatchedTreasuryReport = await dispatcher.dispatchReport(
      treasuryReport,
      ['PUBLISHED_PAGE', 'DISCORD', 'TELEGRAM', 'EMAIL'],
      { outputDirectory: options.outDir },
    );

    console.log(formatWeeklyDigestTerminal(dispatchedTreasuryReport));

    console.log('\n\x1b[1m\x1b[33m[2/2] Generating Weekly Digest for FaroSwap AMM Protocol...\x1b[0m\n');

    const protocolReport = generator.generateWeeklyDigest(
      DEMO_PROTOCOL_PROFILE,
      DEMO_CURRENT_PERIOD,
      DEMO_BASELINE_PERIOD,
      BENCHMARK_TREASURY_TRANSACTIONS,
    );

    const dispatchedProtocolReport = await dispatcher.dispatchReport(
      protocolReport,
      ['PUBLISHED_PAGE'],
      { outputDirectory: options.outDir },
    );

    console.log(formatWeeklyDigestTerminal(dispatchedProtocolReport));

    console.log('\n\x1b[1m\x1b[32m✔ Weekly Digests Successfully Synthesized & Published (Requirement 04):\x1b[0m');
    console.log(`  • Published HTML Directory: \x1b[36m${path.resolve(process.cwd(), options.outDir)}\x1b[0m`);
    console.log(`  • Treasury Digest File:     \x1b[36m${dispatchedTreasuryReport.deliveryDispatches[0]?.destinationTarget}\x1b[0m\n`);
  });

program
  .command('schedule')
  .description('Inspect or reconfigure the recurrence schedule for weekly digests (Requirement 01)')
  .option('-c, --cadence <cadence>', 'Cadence: WEEKLY, DAILY, BIWEEKLY', 'WEEKLY')
  .option('-u, --hour <hour>', 'Execution hour in UTC (0-23)', '9')
  .action((options: { cadence: string; hour: string }) => {
    const manager = new DigestScheduleManager();
    const cadence = options.cadence.toUpperCase() as 'WEEKLY' | 'DAILY' | 'BIWEEKLY';
    const hour = parseInt(options.hour, 10);

    manager.reconfigureCadence(cadence, hour);
    const config = manager.getScheduleConfiguration();
    const nextRun = manager.calculateNextScheduledOccurrence();

    console.log('\n\x1b[1m\x1b[36m===============================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  ⏰ PHAROS WEEKLY DIGEST · SCHEDULE CONFIGURATION (Requirement 01)\x1b[0m');
    console.log('\x1b[1m\x1b[36m===============================================================================\x1b[0m\n');
    console.log(`  • Schedule Identifier: \x1b[33m${config.scheduleIdentifier}\x1b[0m`);
    console.log(`  • Recurrence Cadence:  \x1b[32m${config.cadence}\x1b[0m`);
    console.log(`  • Cron Expression:     \x1b[36m"${config.cronExpression}"\x1b[0m`);
    console.log(`  • Execution Time:      ${String(config.executionHourUtc).padStart(2, '0')}:00 UTC`);
    console.log(`  • Next Trigger Date:   \x1b[35m${nextRun.toUTCString()}\x1b[0m`);
    console.log(`  • Human Description:   ${manager.describeScheduleCadence()}\n`);
  });

program
  .command('generate <target>')
  .description('Generate weekly digest for a target wallet address or protocol')
  .option('-k, --kind <kind>', 'Target kind: WALLET or PROTOCOL', 'WALLET')
  .option('-l, --label <label>', 'Human readable label for the target', 'Custom Target Account')
  .option('-c, --channel <channel>', 'Delivery channel: page, discord, telegram, email, or all', 'all')
  .option('-o, --out-dir <dir>', 'Output directory for published HTML page', './published-digests')
  .action(async (target: string, options: { kind: string; label: string; channel: string; outDir: string }) => {
    const generator = new DigestGenerator();
    const dispatcher = new DigestDeliveryDispatcher();
    const scheduleManager = new DigestScheduleManager();

    const targetProfile: DigestTargetProfile = {
      targetIdentifier: target,
      targetLabel: options.label,
      targetKind: options.kind.toUpperCase() === 'PROTOCOL' ? 'PROTOCOL' : 'WALLET',
      operationalContext: `Custom monitored ${options.kind.toLowerCase()} on Pharos Mainnet`,
    };

    const { currentPeriod, baselinePeriod } = scheduleManager.deriveAccountingPeriods();

    const report = generator.generateWeeklyDigest(
      targetProfile,
      currentPeriod,
      baselinePeriod,
      BENCHMARK_TREASURY_TRANSACTIONS,
    );

    let channelList: DeliveryChannelKind[] = ['PUBLISHED_PAGE', 'DISCORD', 'TELEGRAM', 'EMAIL'];
    if (options.channel === 'page') channelList = ['PUBLISHED_PAGE'];
    else if (options.channel === 'discord') channelList = ['DISCORD'];
    else if (options.channel === 'telegram') channelList = ['TELEGRAM'];
    else if (options.channel === 'email') channelList = ['EMAIL'];

    const dispatched = await dispatcher.dispatchReport(report, channelList, {
      outputDirectory: options.outDir,
    });

    console.log(formatWeeklyDigestTerminal(dispatched));
  });

program.parse(process.argv);
