import { Command } from 'commander';
import { DryRunExecutorEngine } from './simulator-engine.js';
import { DryRunFormatter } from './formatter.js';
import { BENCHMARK_SCENARIOS } from './scenarios.js';

const program = new Command();

program
  .name('pharos-dry-run')
  .description('Pharos SkillEngine Pre-Flight Dry-Run Simulation Engine')
  .version('1.0.0');

program
  .command('simulate')
  .description('Simulate a transaction on Pharos Mainnet without broadcasting')
  .requiredOption('--to <address>', 'Target contract or recipient address (0x...)')
  .option('--from <address>', 'Sender address (0x...)')
  .option('--data <calldata>', 'Transaction calldata hex', '0x')
  .option('--value <wei>', 'Native PROS value in wei', '0')
  .option('--gas-limit <units>', 'Optional maximum gas limit')
  .option('--json', 'Output raw JSON result')
  .action(async (options) => {
    try {
      const engine = new DryRunExecutorEngine();
      const result = await engine.simulate({
        from: options.from as `0x${string}` | undefined,
        to: options.to as `0x${string}`,
        data: options.data as `0x${string}`,
        value: options.value ? BigInt(options.value) : 0n,
        gasLimit: options.gasLimit ? BigInt(options.gasLimit) : undefined,
      });

      if (options.json) {
        console.log(JSON.stringify(result, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
      } else {
        console.log(DryRunFormatter.formatReport(result));
      }

      if (!result.canExecute) {
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(`Simulation fatal error: ${err.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('demo')
  .description('Run dual-outcome pre-flight demonstration (passing vs reverting)')
  .option('--json', 'Output raw JSON result')
  .action(async (options) => {
    const engine = new DryRunExecutorEngine();
    console.log('🚀 Running Pre-Flight Dry-Run Dual-Outcome Demonstration (Requirements 01-04)...\n');

    // Scenario A: Passing simulation
    console.log('================================================================================');
    console.log('▶ SCENARIO A: TRANSACTION SIMULATION SUCCEEDS (GATE UNLOCKED)');
    console.log('================================================================================');
    const validScenario = BENCHMARK_SCENARIOS.find((s) => s.expectedOutcome === 'SUCCESS')!;
    const resA = await engine.simulate(validScenario.request);

    if (options.json) {
      console.log(JSON.stringify(resA, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    } else {
      console.log(DryRunFormatter.formatReport(resA));
    }

    console.log('\n');

    // Scenario B: Reverting simulation
    console.log('================================================================================');
    console.log('▶ SCENARIO B: TRANSACTION REVERTS (GATE LOCKED & EXECUTION BLOCKED)');
    console.log('================================================================================');
    const revertScenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'SCENARIO_REVERT_TRANSFER_EXCEEDS_BALANCE')!;
    const resB = await engine.simulate(revertScenario.request);

    if (options.json) {
      console.log(JSON.stringify(resB, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    } else {
      console.log(DryRunFormatter.formatReport(resB));
    }
  });

program
  .command('scenarios')
  .description('List and run preset benchmark scenarios')
  .option('--run <scenarioId>', 'Scenario ID to execute')
  .action(async (options) => {
    if (options.run) {
      const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === options.run);
      if (!scenario) {
        console.error(`Unknown scenario: ${options.run}`);
        process.exitCode = 1;
        return;
      }
      const engine = new DryRunExecutorEngine();
      const res = await engine.simulate(scenario.request);
      console.log(DryRunFormatter.formatReport(res));
      return;
    }

    console.log('Available Pre-Flight Dry-Run Scenarios:');
    for (const s of BENCHMARK_SCENARIOS) {
      const badge = s.expectedOutcome === 'SUCCESS' ? '🟢 SUCCESS' : '🔴 REVERT ';
      console.log(`  [${badge}] ${s.id.padEnd(42)} - ${s.name}`);
    }
    console.log('\nRun with: pharos-dry-run scenarios --run <SCENARIO_ID>');
  });

program.parse(process.argv);
