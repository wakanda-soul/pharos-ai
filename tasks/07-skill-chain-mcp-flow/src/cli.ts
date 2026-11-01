import { Command } from 'commander';
import { FlowOrchestrator } from './flow-orchestrator.js';
import { FlowFormatter } from './formatter.js';
import { TreasuryPolicy } from './types.js';

const program = new Command();
const orchestrator = new FlowOrchestrator();

program
  .name('pharos-flow')
  .description('Skill + Chain MCP Composed Flow: Autonomous Dynamic Treasury Sentinel on Pharos')
  .version('1.0.0');

// Command: run
program
  .command('run')
  .description('Execute end-to-end flow: Chain MCP live query -> SkillEngine decision -> Action preparation')
  .option(
    '-t, --treasury <address>',
    'Treasury wallet address to inspect',
    '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932'
  )
  .option(
    '--target <ratio>',
    'Target USDC:PROS portfolio ratio (e.g. 60:40, 50:50, 70:30)',
    '60:40'
  )
  .option('--tolerance <percent>', 'Permitted drift tolerance percentage before triggering rebalance', '5.0')
  .option('--price <number>', 'Assumed PROS price in USD', '1.25')
  .option('--mock-pros <number>', 'Override native PROS balance for simulation')
  .option('--mock-usdc <number>', 'Override USDC balance for simulation')
  .option('--json', 'Output full flow trace and decision in JSON format')
  .action(async (options) => {
    try {
      // Parse ratio
      const parts = options.target.split(':').map((p: string) => parseFloat(p));
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1]) || parts[0] + parts[1] === 0) {
        throw new Error('Invalid target ratio format. Use format like 60:40 or 50:50');
      }

      const totalParts = parts[0] + parts[1];
      const targetUsdc = parts[0] / totalParts;
      const targetPros = parts[1] / totalParts;
      const tolerance = parseFloat(options.tolerance) || 5.0;
      const price = parseFloat(options.price) || 1.25;

      const mockBalances = (options.mockPros !== undefined || options.mockUsdc !== undefined)
        ? {
            pros: options.mockPros !== undefined ? parseFloat(options.mockPros) : undefined,
            usdc: options.mockUsdc !== undefined ? parseFloat(options.mockUsdc) : undefined,
          }
        : undefined;

      const policy: Partial<TreasuryPolicy> = {
        targetUsdcRatio: targetUsdc,
        targetProsRatio: targetPros,
        toleranceBandPct: tolerance,
        assumedProsPriceUsd: price,
      };

      const result = await orchestrator.runFlow(options.treasury as `0x${string}`, policy, mockBalances);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(FlowFormatter.formatReport(result));
      }
    } catch (err: any) {
      console.error(`Flow execution failed: ${err.message}`);
      process.exit(1);
    }
  });

// Command: demo
program
  .command('demo')
  .description('Run live end-to-end demonstration showing real on-chain data moving through both tools')
  .action(async () => {
    console.log('🚀 Running Pharos Skill + Chain MCP Live Composed Flow Demo...\n');
    const result = await orchestrator.runFlow(
      '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
      {
        targetUsdcRatio: 0.60,
        targetProsRatio: 0.40,
        toleranceBandPct: 5.0,
      }
    );
    console.log(FlowFormatter.formatReport(result));
  });

// Command: diagram
program
  .command('diagram')
  .description('Print the architectural workflow diagram of the Skill + Chain MCP composition')
  .action(() => {
    console.log(`
================================================================================
          SKILL + CHAIN MCP COMPOSED FLOW ARCHITECTURAL DIAGRAM
================================================================================

 [Single User Request]
        │
        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Flow Orchestrator (Pipeline Initiator)                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Calls
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Pharos Chain MCP (Data Supplier)                         │
 │    - get_block_number (#1042000)                            │
 │    - get_balance (native PROS)                              │
 │    - eth_call (USDC.balanceOf)                              │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Passes raw telemetry (output)
                                ▼ directly as input into
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. SkillEngine Policy Guardian (Decision Maker)             │
 │    - Computes portfolio drift vs Target (60:40)             │
 │    - Tests reserve floor thresholds                         │
 │    - Emits Verdict: IN_EQUILIBRIUM vs REBALANCE_NEEDED     │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Emits decision & delta amount
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 4. Action Synthesizer (Execution Preparer)                  │
 │    - Computes dynamic slippage tolerance                    │
 │    - Generates FaroSwap Router calldata (Uniswap V2)        │
 │    - Emits ready-to-sign Foundry "cast send" command        │
 └─────────────────────────────────────────────────────────────┘
================================================================================
`);
  });

program.parse();
