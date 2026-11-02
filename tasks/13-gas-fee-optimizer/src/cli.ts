import { Command } from 'commander';
import { GasTrackerOracle } from './gas-oracle.js';
import { GasFeeOptimizerEngine } from './optimizer-engine.js';
import { GasFeeOptimizerFormatter } from './formatter.js';
import { BENCHMARK_SCENARIOS, SCENARIO_OPPORTUNISTIC_DIP, SCENARIO_DEADLINE_FORCED_HIGH_GAS } from './scenarios.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

export function createCli(): Command {
  const program = new Command();

  program
    .name('pharos-gas-opt')
    .description('Pharos Temporal Volatility & Deadline Decay Gas Fee Optimizer')
    .version('1.0.0');

  program
    .command('demo')
    .description('Runs dual-outcome demonstration: Opportunistic Dip Savings (Part 1) + Deadline Enforcement (Part 2)')
    .action(async () => {
      console.log(`${c.bold}${c.cyan}\n🚀 Running Pharos Gas Fee Optimizer Demonstration (Requirements 01-04)...\n${c.reset}`);

      const oracle = new GasTrackerOracle();
      oracle.seedHistory(14.0, 25, 0.2); // Seed realistic baseline distribution
      const engine = new GasFeeOptimizerEngine(oracle);

      // Part 1: History & Statistics (Requirement 01)
      console.log(GasFeeOptimizerFormatter.formatGasHistory(oracle.getHistory(), oracle.getMarketStats()));
      console.log('\n');

      // Part 2: Scenario A - Opportunistic Dip (Requirements 02 & 03)
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);
      console.log(`${c.bold}▶ PART 1: OPPORTUNISTIC DIP HARVESTING (${SCENARIO_OPPORTUNISTIC_DIP.name})${c.reset}`);
      console.log(`${c.gray}${SCENARIO_OPPORTUNISTIC_DIP.description}${c.reset}`);
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);

      const resA = await engine.processTransaction(
        SCENARIO_OPPORTUNISTIC_DIP.transaction,
        SCENARIO_OPPORTUNISTIC_DIP.simulationTicks
      );
      console.log(GasFeeOptimizerFormatter.formatPostMortem(resA));
      console.log('\n');

      // Part 3: Scenario B - Deadline Enforcement Under Congestion (Requirements 02 & 04)
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);
      console.log(`${c.bold}▶ PART 2: GUARANTEED DEADLINE SUBMISSION (${SCENARIO_DEADLINE_FORCED_HIGH_GAS.name})${c.reset}`);
      console.log(`${c.gray}${SCENARIO_DEADLINE_FORCED_HIGH_GAS.description}${c.reset}`);
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);

      const resB = await engine.processTransaction(
        SCENARIO_DEADLINE_FORCED_HIGH_GAS.transaction,
        SCENARIO_DEADLINE_FORCED_HIGH_GAS.simulationTicks
      );
      console.log(GasFeeOptimizerFormatter.formatPostMortem(resB));
      console.log(`${c.green}\n✓ Gas Fee Optimizer demonstration completed successfully.\n${c.reset}`);
    });

  program
    .command('history')
    .description('Poll live Pharos Mainnet gas and display recent history & statistical percentiles')
    .action(async () => {
      console.log(`${c.cyan}Querying Pharos Mainnet RPC (Chain ID 1672)...${c.reset}`);
      const oracle = new GasTrackerOracle();
      oracle.seedHistory(10.0, 15, 0.15);
      await oracle.recordCurrentNetworkGas();
      console.log(GasFeeOptimizerFormatter.formatGasHistory(oracle.getHistory(), oracle.getMarketStats()));
    });

  program
    .command('scenarios')
    .description('List available benchmark scenarios')
    .action(() => {
      console.log(`${c.bold}Available Gas Optimization Benchmark Scenarios:${c.reset}\n`);
      for (const s of BENCHMARK_SCENARIOS) {
        console.log(`  • ${c.bold}${s.id.padEnd(38)}${c.reset} - ${s.name}`);
        console.log(`    ${c.gray}${s.description}${c.reset}\n`);
      }
    });

  return program;
}

const program = createCli();
program.parse(process.argv);
