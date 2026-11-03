#!/usr/bin/env node

import { Command } from 'commander';
import { LiquidationWatchdogEngine } from './watchdog-engine.js';
import { OnChainPositionReader } from './position-reader.js';
import { ConsoleNotificationChannel } from './alert-channels.js';
import { WatchdogFormatter } from './formatter.js';
import { WATCHDOG_SCENARIOS } from './scenarios.ts';
import { LendingPositionSnapshot } from './types.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('pharos-watchdog')
    .description('Pharos Autonomous Lending Position Liquidation Watchdog Sentinel')
    .version('1.0.0');

  program
    .command('demo')
    .description('Run comprehensive demonstration of lending health factor tracking, alerts & mitigation actions')
    .option('-w, --warn <hf>', 'Custom warning Health Factor threshold', '1.30')
    .option('-c, --crit <hf>', 'Custom critical Health Factor threshold', '1.10')
    .action(async (options) => {
      console.log(WatchdogFormatter.formatHeader());

      const warningHf = parseFloat(options.warn);
      const criticalHf = parseFloat(options.crit);

      const consoleChannel = new ConsoleNotificationChannel();
      const watchdog = new LiquidationWatchdogEngine(
        {
          warningHealthFactor: warningHf,
          criticalHealthFactor: criticalHf,
          targetSafeHealthFactor: 1.50,
        },
        [consoleChannel]
      );
      const reader = new OnChainPositionReader();

      console.log(WatchdogFormatter.formatConfig(watchdog.getConfig()));
      console.log('\n🚀 Starting Pharos Liquidation Watchdog Walkthrough (Requirements 01-04)...\n');

      const evaluatedSnapshots: LendingPositionSnapshot[] = [];

      for (let i = 0; i < WATCHDOG_SCENARIOS.length; i++) {
        const scenario = WATCHDOG_SCENARIOS[i];
        console.log(`▶ STEP ${i + 1}: ${scenario.title.toUpperCase()}`);
        console.log(`  Context: ${scenario.description}`);

        const position = await reader.readPosition({
          borrowerAddress: scenario.borrowerAddress,
          collateralAmountFormatted: scenario.collateralAmount,
          debtAmountFormatted: scenario.debtAmount,
          liquidationThreshold: scenario.liquidationThreshold,
          overrideCollateralPriceUsd: scenario.collateralPriceUsd,
        });

        evaluatedSnapshots.push(position);
        await watchdog.evaluatePosition(position);
      }

      console.log('================================================================================');
      console.log('📊 POSITION HEALTH FACTOR AUDIT SUMMARY');
      console.log('================================================================================');
      console.log(WatchdogFormatter.formatPositionTable(evaluatedSnapshots));

      console.log('\n✓ Liquidation Watchdog demonstration completed successfully.');
    });

  program
    .command('inspect')
    .description('Inspect a borrower position using live Chainlink oracle prices on Pharos Mainnet')
    .option('-a, --address <address>', 'Borrower address', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
    .option('--collateral <amount>', 'Collateral amount in WPROS', '5.0')
    .option('--debt <amount>', 'Debt amount in USDC', '5000.0')
    .action(async (options) => {
      console.log(WatchdogFormatter.formatHeader());
      const reader = new OnChainPositionReader();
      const consoleChannel = new ConsoleNotificationChannel();
      const watchdog = new LiquidationWatchdogEngine({}, [consoleChannel]);

      const position = await reader.readPosition({
        borrowerAddress: options.address as `0x${string}`,
        collateralAmountFormatted: parseFloat(options.collateral),
        debtAmountFormatted: parseFloat(options.debt),
      });

      console.log(WatchdogFormatter.formatPositionTable([position]));
      await watchdog.evaluatePosition(position);
    });

  return program;
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('pharos-watchdog.js')) {
  createCli().parse(process.argv);
}
