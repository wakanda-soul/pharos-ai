import { Command } from 'commander';
import { MultiProtocolAggregator } from './aggregator.js';
import { AggregatorFormatter } from './formatter.js';
import { ProtocolId, LockupTenor } from './types.js';

const program = new Command();
const aggregator = new MultiProtocolAggregator();

program
  .name('pharos-aggregator')
  .description('Multi-Protocol Yield & Liquidity Aggregator across Harbor, Morpho Blue, and FaroSwap on Pharos Network')
  .version('1.0.0');

// Command: rates
program
  .command('rates')
  .description('Query current APYs, TVL, and lockup terms across all integrated Pharos protocols')
  .option('-t, --token <symbol>', 'Filter by token symbol (e.g. USDC, WPROS)')
  .option('-p, --protocol <id>', 'Filter by protocol (harbor, morpho, faroswap)')
  .option('--simulate-failure <protocolId>', 'Simulate outage of a specific protocol to demonstrate circuit breaker fault isolation')
  .option('--json', 'Output raw JSON result')
  .action(async (options) => {
    try {
      if (options.simulateFailure) {
        aggregator.simulateFailure(options.simulateFailure as ProtocolId, true);
        console.warn(`[CIRCUIT BREAKER TEST] Simulated outage enabled for protocol: ${options.simulateFailure}`);
      }

      const { venues, degradedProtocols } = await aggregator.getAllRates();

      let filtered = venues;
      if (options.token) {
        filtered = filtered.filter(
          (v) => v.underlyingToken.toUpperCase() === options.token.toUpperCase()
        );
      }
      if (options.protocol) {
        filtered = filtered.filter(
          (v) => v.protocolId.toLowerCase() === options.protocol.toLowerCase()
        );
      }

      if (options.json) {
        console.log(JSON.stringify({ venues: filtered, degradedProtocols }, null, 2));
      } else {
        if (degradedProtocols.length > 0) {
          console.warn('\n⚠️  DEGRADED PROTOCOLS DETECTED (Gracefully Isolated):');
          for (const d of degradedProtocols) {
            console.warn(`   - Protocol: ${d.protocolId} -> ${d.error}`);
          }
          console.warn('   The aggregator continues operating with healthy venues.\n');
        }

        console.log(AggregatorFormatter.formatRatesTable(filtered));
      }
    } catch (err: any) {
      console.error(`Error fetching rates: ${err.message}`);
      process.exit(1);
    }
  });

// Command: route
program
  .command('route')
  .description('Find best venue for deposit, explain why it was chosen, and prepare unsigned transaction')
  .requiredOption('-t, --token <symbol>', 'Asset token symbol (e.g. USDC)')
  .requiredOption('-a, --amount <number>', 'Deposit amount in USD')
  .option('--term <tenor>', 'Maximum lockup tenor permitted (liquid, 1d, 3m, 6m)', '6m')
  .option('--min-safety <score>', 'Minimum safety score (0-100)', '0')
  .option('-u, --user <address>', 'User wallet address for transaction preparation', '0x1000000000000000000000000000000000000001')
  .option('--simulate-failure <protocolId>', 'Simulate protocol failure to test fallback routing')
  .option('--json', 'Output raw JSON result')
  .action(async (options) => {
    try {
      if (options.simulateFailure) {
        aggregator.simulateFailure(options.simulateFailure as ProtocolId, true);
        console.warn(`[CIRCUIT BREAKER TEST] Simulated outage for ${options.simulateFailure}. Rerouting to surviving venues.`);
      }

      const amountUsd = parseFloat(options.amount);
      if (isNaN(amountUsd) || amountUsd <= 0) {
        throw new Error('Amount must be a positive number');
      }

      const result = await aggregator.routeAndPrepareDeposit(
        {
          token: options.token,
          amountUsd,
          maxLockupTenor: options.term as LockupTenor,
          minSafetyScore: parseInt(options.minSafety, 10),
        },
        options.user as `0x${string}`
      );

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(AggregatorFormatter.formatRoutingResult(result));
      }
    } catch (err: any) {
      console.error(`Routing error: ${err.message}`);
      process.exit(1);
    }
  });

// Command: positions
program
  .command('positions')
  .description('Query and aggregate active positions and accrued yield across all integrated protocols')
  .option('-u, --user <address>', 'User wallet address to inspect', '0x1000000000000000000000000000000000000001')
  .option('--json', 'Output raw JSON portfolio data')
  .action(async (options) => {
    try {
      const data = await aggregator.getUserPositions(options.user as `0x${string}`);
      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(
          AggregatorFormatter.formatPositionsTable(
            data.positions,
            data.totalDepositedUsd,
            data.totalEarnedUsd,
            data.weightedAverageApy,
            options.user
          )
        );
      }
    } catch (err: any) {
      console.error(`Error querying positions: ${err.message}`);
      process.exit(1);
    }
  });

// Command: deposit
program
  .command('deposit')
  .description('Prepare an unsigned deposit transaction for a specific vault venue')
  .requiredOption('-v, --venue <id>', 'Target venue ID (e.g. harbor:apc3m, morpho:rockawayx-usdc, faroswap:wpros-usdc)')
  .requiredOption('-a, --amount <units>', 'Amount of token units to deposit')
  .option('-u, --user <address>', 'User sender address', '0x1000000000000000000000000000000000000001')
  .option('--json', 'Output JSON unsigned transaction payload')
  .action(async (options) => {
    try {
      const tx = await aggregator.prepareDeposit(
        options.venue,
        options.amount,
        options.user as `0x${string}`
      );

      if (options.json) {
        console.log(JSON.stringify(tx, null, 2));
      } else {
        console.log('================================================================================');
        console.log('                 PREPARED DEPOSIT TRANSACTION (READY TO SIGN)                   ');
        console.log('================================================================================');
        console.log(AggregatorFormatter.formatUnsignedTx(tx));
        console.log('================================================================================');
      }
    } catch (err: any) {
      console.error(`Deposit preparation error: ${err.message}`);
      process.exit(1);
    }
  });

// Command: withdraw
program
  .command('withdraw')
  .description('Prepare an unsigned withdrawal transaction for a specific vault venue')
  .requiredOption('-v, --venue <id>', 'Target venue ID (e.g. harbor:apc3m, morpho:rockawayx-usdc, faroswap:wpros-usdc)')
  .requiredOption('-a, --amount <units>', 'Amount of token units or shares to withdraw')
  .option('-u, --user <address>', 'User sender address', '0x1000000000000000000000000000000000000001')
  .option('--json', 'Output JSON unsigned transaction payload')
  .action(async (options) => {
    try {
      const tx = await aggregator.prepareWithdraw(
        options.venue,
        options.amount,
        options.user as `0x${string}`
      );

      if (options.json) {
        console.log(JSON.stringify(tx, null, 2));
      } else {
        console.log('================================================================================');
        console.log('                PREPARED WITHDRAWAL TRANSACTION (READY TO SIGN)                 ');
        console.log('================================================================================');
        console.log(AggregatorFormatter.formatUnsignedTx(tx));
        console.log('================================================================================');
      }
    } catch (err: any) {
      console.error(`Withdrawal preparation error: ${err.message}`);
      process.exit(1);
    }
  });

// Command: health
program
  .command('health')
  .description('Check health and circuit breaker status for all integrated protocols')
  .option('--json', 'Output health in JSON format')
  .action((options) => {
    const statuses = aggregator.getHealthStatus();
    if (options.json) {
      console.log(JSON.stringify(statuses, null, 2));
    } else {
      console.log(AggregatorFormatter.formatHealthTable(statuses));
    }
  });

program.parse();
