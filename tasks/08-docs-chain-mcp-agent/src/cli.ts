import { Command } from 'commander';
import { ExplainThenActAgent } from './agent.js';
import { AgentFormatter } from './formatter.js';
import { CONTRACT_PRESETS } from './contracts-catalog.js';

const program = new Command();
const agent = new ExplainThenActAgent();

program
  .name('pharos-explain')
  .description('Docs MCP + Chain MCP Agent: Explains contract function via Docs MCP, calls via Chain MCP, and interprets on-chain results.')
  .version('1.0.0');

// Command: run / explain
program
  .command('explain [preset]')
  .description('Explain a contract function using Docs MCP, execute it via Chain MCP, and interpret the result')
  .option('-t, --target <preset>', 'Target function preset (e.g. faroswap:getReserves, harbor:totalAssets)', 'faroswap:getReserves')
  .option('--json', 'Output full result in JSON format')
  .action(async (presetArg, options) => {
    const targetKey = presetArg || options.target;

    try {
      const result = await agent.explainAndAct(targetKey);

      if (options.json) {
        console.log(
          JSON.stringify(
            result,
            (_, v) => (typeof v === 'bigint' ? v.toString() : v),
            2
          )
        );
      } else {
        console.log(AgentFormatter.formatReport(result));
      }
    } catch (err: any) {
      console.error(`Agent execution failed: ${err.message}`);
      process.exit(1);
    }
  });

// Command: list
program
  .command('list')
  .description('List available verified contract function presets')
  .action(() => {
    console.log('================================================================================');
    console.log('           AVAILABLE CONTRACT FUNCTION PRESETS (PHAROS MAINNET)                 ');
    console.log('================================================================================');
    console.log(`${'PRESET ID'.padEnd(25)} | ${'CONTRACT'.padEnd(30)} | ${'FUNCTION'}`);
    console.log('--------------------------+--------------------------------+--------------------');
    for (const [id, preset] of Object.entries(CONTRACT_PRESETS)) {
      console.log(
        `${id.padEnd(25)} | ${preset.contractName.slice(0, 30).padEnd(30)} | ${preset.functionSignature}`
      );
    }
    console.log('================================================================================');
  });

// Command: demo
program
  .command('demo')
  .description('Demonstrate multi-contract explain-and-act pipeline across Oracle and USDC')
  .action(async () => {
    console.log('🚀 Running Multi-Contract Explain-Then-Act Agent Demonstration...\n');

    console.log('▶ Target 1: Pharos Decentralized Price Feed Oracle (latestRoundData)');
    const res1 = await agent.explainAndAct('oracle:latestRoundData');
    console.log(AgentFormatter.formatReport(res1));

    console.log('\n\n▶ Target 2: Pharos Native USDC Token (totalSupply)');
    const res2 = await agent.explainAndAct('usdc:totalSupply');
    console.log(AgentFormatter.formatReport(res2));
  });

program.parse();
