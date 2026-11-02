import { Command } from 'commander';
import { BatchExecutorEngine } from './batch-engine.js';
import { BatchFormatter } from './formatter.js';
import { BENCHMARK_BATCH_SCENARIOS } from './scenarios.js';

const program = new Command();

program
  .name('pharos-batch')
  .description('Pharos SkillEngine Batch & Multicall Orchestration Engine')
  .version('1.0.0');

program
  .command('demo')
  .description('Run dual-outcome demonstration (optimal batch + fault-tolerant partial failure)')
  .option('--json', 'Output raw JSON result')
  .action(async (options) => {
    const engine = new BatchExecutorEngine();
    console.log('🚀 Running Batch Executor Dual-Outcome Demonstration (Requirements 01-04)...\n');

    // Part 1: Scenario A (Optimal 3-Action Bundle)
    console.log('================================================================================');
    console.log('▶ PART 1: OPTIMAL 3-ACTION BUNDLE (100% SUCCESS + GAS SAVINGS)');
    console.log('================================================================================');
    const optScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_3_ACTIONS_OPTIMIZED')!;
    const resA = await engine.executeBatch(optScenario.actions, 'FAULT_TOLERANT');

    if (options.json) {
      console.log(JSON.stringify(resA, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    } else {
      console.log(BatchFormatter.formatReport(resA));
    }

    console.log('\n');

    // Part 2: Scenario B (Partial Failure Isolation)
    console.log('================================================================================');
    console.log('▶ PART 2: 4-ACTION BUNDLE WITH FAULT ISOLATION (PARTIAL FAILURE HANDLED)');
    console.log('================================================================================');
    const failScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_4_ACTIONS_WITH_PARTIAL_FAILURE')!;
    const resB = await engine.executeBatch(failScenario.actions, 'FAULT_TOLERANT');

    if (options.json) {
      console.log(JSON.stringify(resB, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    } else {
      console.log(BatchFormatter.formatReport(resB));
    }
  });

program
  .command('compare')
  .description('Benchmark gas savings of individual transactions vs batched execution')
  .action(async () => {
    const engine = new BatchExecutorEngine();
    const optScenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === 'SCENARIO_3_ACTIONS_OPTIMIZED')!;
    const res = await engine.executeBatch(optScenario.actions);
    const { gasEconomics } = res;

    console.log('================================================================================');
    console.log('            PHAROS SKILLENGINE: BATCH GAS SAVINGS BENCHMARK                    ');
    console.log('================================================================================');
    console.log(`Action Count:           ${res.totalActions} actions bundled into 1 transaction`);
    console.log(`Individual Gas Total:   ${gasEconomics.individualEstimatedGasTotal.toLocaleString()} units`);
    console.log(`Batch Multicall3 Gas:   ${gasEconomics.batchEstimatedGas.toLocaleString()} units`);
    console.log(`Gas Units Saved:        ${gasEconomics.gasSavedUnits.toLocaleString()} units`);
    console.log(`Gas Reduction %:        ${gasEconomics.gasSavedPercentage.toFixed(2)}% SAVED`);
    console.log(`Step Reduction %:       ${gasEconomics.stepReductionPercentage.toFixed(1)}% REDUCTION (3 txs -> 1 tx)`);
    console.log(`Native PROS Saved:      ${gasEconomics.nativeProsSaved}`);
    if (gasEconomics.usdSaved !== undefined) {
      console.log(`Estimated USD Savings:  ~$${gasEconomics.usdSaved.toFixed(4)} USD`);
    }
    console.log('================================================================================');
  });

program
  .command('scenarios')
  .description('List and run preset benchmark scenarios')
  .option('--run <scenarioId>', 'Scenario ID to execute')
  .action(async (options) => {
    if (options.run) {
      const scenario = BENCHMARK_BATCH_SCENARIOS.find((s) => s.id === options.run);
      if (!scenario) {
        console.error(`Unknown scenario: ${options.run}`);
        process.exitCode = 1;
        return;
      }
      const engine = new BatchExecutorEngine();
      const res = await engine.executeBatch(scenario.actions);
      console.log(BatchFormatter.formatReport(res));
      return;
    }

    console.log('Available Pre-Set Batch Scenarios:');
    for (const s of BENCHMARK_BATCH_SCENARIOS) {
      console.log(`  • ${s.id.padEnd(42)} [${s.actions.length} actions] - ${s.name}`);
    }
    console.log('\nRun with: pharos-batch scenarios --run <SCENARIO_ID>');
  });

program.parse(process.argv);
