import { Command } from 'commander';
import { GuardianChainReader } from './chain-reader.js';
import { ThresholdGuardianEngine } from './guardian-engine.js';
import { GuardianFormatter } from './formatter.js';

const program = new Command();
const reader = new GuardianChainReader();

program
  .name('pharos-guardian')
  .description('SkillEngine Threshold Guardian: Multi-condition on-chain evaluator before action execution.')
  .version('1.0.0');

// Command: evaluate
program
  .command('evaluate')
  .description('Evaluate live on-chain conditions and decide whether to fire action or hold')
  .option('--max-gas <gwei>', 'Override maximum acceptable gas price ceiling (Gwei)')
  .option('--min-price <usd>', 'Override minimum acceptable asset price floor (USD)')
  .option('--min-liquidity <usd>', 'Override minimum pool liquidity depth (USD)')
  .option('--max-lag <seconds>', 'Override maximum oracle staleness lag buffer (seconds)')
  .option('--mock-gas <gwei>', 'Simulate specific gas price for testing')
  .option('--mock-price <usd>', 'Simulate specific oracle price for testing')
  .option('--json', 'Output raw JSON decision trace')
  .action(async (options) => {
    try {
      const engine = new ThresholdGuardianEngine();

      if (options.maxGas) {
        engine.configureRule('RULE_GAS_THRESHOLD', { threshold: parseFloat(options.maxGas) });
      }
      if (options.minPrice) {
        engine.configureRule('RULE_PRICE_FLOOR', { threshold: parseFloat(options.minPrice) });
      }
      if (options.minLiquidity) {
        engine.configureRule('RULE_LIQUIDITY_DEPTH', { threshold: parseFloat(options.minLiquidity) });
      }
      if (options.maxLag) {
        engine.configureRule('RULE_ORACLE_FRESHNESS', { threshold: parseFloat(options.maxLag) });
      }

      const mockOverrides: any = {};
      if (options.mockGas !== undefined) mockOverrides.gasPriceGwei = parseFloat(options.mockGas);
      if (options.mockPrice !== undefined) mockOverrides.oraclePriceUsd = parseFloat(options.mockPrice);

      const telemetry = await reader.fetchLiveTelemetry(mockOverrides);
      const decision = engine.evaluate(telemetry);

      if (options.json) {
        console.log(JSON.stringify(decision, null, 2));
      } else {
        console.log(GuardianFormatter.formatReport(decision));
      }
    } catch (err: any) {
      console.error(`Guardian evaluation failed: ${err.message}`);
      process.exit(1);
    }
  });

// Command: demo
program
  .command('demo')
  .description('Demonstrate both outcomes (Requirement 04): Run 1 FIRES action, Run 2 HOLDS action')
  .action(async () => {
    console.log('🚀 Running Threshold Guardian Dual-Outcome Demonstration (Requirement 04)...\n');

    const liveTelemetry = await reader.fetchLiveTelemetry();

    // -------------------------------------------------------------------------
    // Scenario A: All conditions met -> FIRE_ACTION
    // -------------------------------------------------------------------------
    console.log('================================================================================');
    console.log('▶ SCENARIO A: ALL ON-CHAIN CONDITIONS MET (EXECUTION UNLOCKED)');
    console.log('================================================================================');
    const engineA = new ThresholdGuardianEngine();
    // Configure thresholds that comfortably encompass current healthy mainnet state
    engineA.configureRule('RULE_GAS_THRESHOLD', { threshold: 3.0 });
    engineA.configureRule('RULE_PRICE_FLOOR', { threshold: 1800.0 });
    engineA.configureRule('RULE_LIQUIDITY_DEPTH', { threshold: 1000000.0 });
    const decisionA = engineA.evaluate(liveTelemetry);
    console.log(GuardianFormatter.formatReport(decisionA));

    // -------------------------------------------------------------------------
    // Scenario B: Stricter condition violated -> HOLD_ACTION
    // -------------------------------------------------------------------------
    console.log('\n\n================================================================================');
    console.log('▶ SCENARIO B: CONDITION VIOLATED (EXECUTION SAFELY HELD BY GUARDIAN)');
    console.log('================================================================================');
    const engineB = new ThresholdGuardianEngine();
    // Simulate condition violation (e.g. price floor set above current price, or ultra-low gas threshold 0.1 Gwei)
    engineB.configureRule('RULE_GAS_THRESHOLD', { threshold: 0.2 }); // 0.2 Gwei will fail when live is 1.0 Gwei
    engineB.configureRule('RULE_PRICE_FLOOR', { threshold: 3500.0 }); // $3500 USD floor will fail when live is ~$2269
    const decisionB = engineB.evaluate(liveTelemetry);
    console.log(GuardianFormatter.formatReport(decisionB));
  });

// Command: config
program
  .command('config')
  .description('Print active configurable rules and evaluation thresholds')
  .action(() => {
    const engine = new ThresholdGuardianEngine();
    console.log('================================================================================');
    console.log('                  THRESHOLD GUARDIAN CONFIGURATION MANIFEST                     ');
    console.log('================================================================================');
    console.log(JSON.stringify(engine.getConfig(), null, 2));
    console.log('================================================================================');
  });

program.parse();
