import { Command } from 'commander';
import { NaturalLanguagePaymentAgent } from './payment-synthesizer.js';
import { PaymentAgentFormatter } from './formatter.js';
import { BENCHMARK_SCENARIOS } from './scenarios.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

export function createCli(): Command {
  const program = new Command();

  program
    .name('pharos-nl-pay')
    .description('Pharos Natural-Language Payment Agent (Harbor Action Pattern)')
    .version('1.0.0');

  program
    .command('demo')
    .description('Run comprehensive 6-scenario payment preparation demonstration')
    .action(async () => {
      console.log(`${c.bold}${c.cyan}\n🚀 Running Pharos Natural-Language Payment Agent Demonstration...\n${c.reset}`);
      const agent = new NaturalLanguagePaymentAgent();

      let index = 1;
      for (const scenario of BENCHMARK_SCENARIOS) {
        console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);
        console.log(`${c.bold}[Scenario ${index++} / ${BENCHMARK_SCENARIOS.length}]: ${scenario.name}${c.reset}`);
        console.log(`${c.gray}Instruction: "${scenario.instruction}"${c.reset}`);
        console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);

        const result = await agent.preparePayment(
          scenario.instruction,
          '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
          scenario.mockBalances
        );
        console.log(PaymentAgentFormatter.formatResult(result));
        console.log('\n');
      }

      console.log(`${c.green}✓ Natural-Language Payment Agent demonstration completed successfully.\n${c.reset}`);
    });

  program
    .command('prepare <instruction>')
    .description('Transform a plain-language payment instruction into an unsigned transaction')
    .option('--sender <address>', 'Sender address', '0x6119871b4eb66db137dcfad59655853ea6fe58ce')
    .action(async (instruction: string, options: { sender: `0x${string}` }) => {
      const agent = new NaturalLanguagePaymentAgent();
      const result = await agent.preparePayment(instruction, options.sender);
      console.log(PaymentAgentFormatter.formatResult(result));
    });

  program
    .command('resolve <target>')
    .description('Resolve a .pharos domain, .eth domain, or checksum a 0x address')
    .action((target: string) => {
      const agent = new NaturalLanguagePaymentAgent();
      const res = agent.getNameResolver().resolve(target);
      if (res.isValid && res.address) {
        console.log(`${c.green}✓ Resolved "${target}" → ${c.bold}${res.address}${c.reset}`);
      } else {
        console.log(`${c.yellow}✗ Could not resolve "${target}": ${res.error}${c.reset}`);
      }
    });

  program
    .command('tokens')
    .description('List registered tokens and aliases on Pharos Mainnet')
    .action(() => {
      const agent = new NaturalLanguagePaymentAgent();
      const tokens = agent.getTokenRegistry().getAllTokens();
      console.log(`${c.bold}Supported Pharos Ecosystem Tokens:${c.reset}\n`);
      for (const t of tokens) {
        console.log(`  • ${c.bold}${c.white}${t.symbol.padEnd(6)}${c.reset} - ${t.name} (${t.decimals} decimals)`);
        console.log(`    Address: ${c.gray}${t.address}${c.reset}`);
      }
    });

  return program;
}

const program = createCli();
program.parse(process.argv);
