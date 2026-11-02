import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { PolicyGatekeeperEngine } from './gatekeeper-engine.js';
import { AuditLogger } from './audit-logger.js';
import { DEMO_SCENARIOS } from './scenarios.js';
import { formatDecisionReport, formatPolicySummary, formatAuditLogTable } from './formatter.js';
import { ActionProposal } from './types.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

export function createCli(): Command {
  const program = new Command();

  program
    .name('pharos-gatekeeper')
    .description('Zero-Trust Execution Policy Gatekeeper Sentinel for Autonomous AI Agents')
    .version('1.0.0');

  program
    .command('demo')
    .description('Runs the comprehensive 4-case gatekeeper validation suite (ALLOW + 3 DENY rule types)')
    .action(async () => {
      console.log(`${c.bold}${c.cyan}\n🚀 Launching Pharos Zero-Trust Policy Gatekeeper Demonstration...\n${c.reset}`);
      const engine = new PolicyGatekeeperEngine();

      console.log(formatPolicySummary(engine.getConfig()));
      console.log(`\n${c.bold}${c.yellow}=== RUNNING SCENARIO EVALUATIONS ===${c.reset}\n`);

      let index = 1;
      for (const scenario of DEMO_SCENARIOS) {
        console.log(`${c.bold}${c.magenta}\n[Scenario ${index++} / ${DEMO_SCENARIOS.length}]: ${scenario.actionType}${c.reset}`);
        console.log(`${c.gray}Description: ${scenario.description}${c.reset}`);
        const decision = await engine.evaluate(scenario);
        console.log(formatDecisionReport(decision));
      }

      console.log(`\n${c.bold}${c.cyan}=== VERIFYING PERSISTENT AUDIT LOG ===${c.reset}\n`);
      const entries = engine.getAuditLogger().readAll();
      console.log(formatAuditLogTable(entries));
      console.log(`${c.green}\n✓ Policy Gatekeeper demonstration completed successfully.\n${c.reset}`);
    });

  program
    .command('policy')
    .description('Inspect current active Zero-Trust policy configurations and rule bounds')
    .action(() => {
      const engine = new PolicyGatekeeperEngine();
      console.log(formatPolicySummary(engine.getConfig()));
    });

  program
    .command('evaluate <filepath>')
    .description('Evaluate an agent action proposal JSON file against active policies')
    .action(async (filepath: string) => {
      const resolved = path.resolve(process.cwd(), filepath);
      if (!fs.existsSync(resolved)) {
        console.error(`${c.red}Error: File not found at ${resolved}${c.reset}`);
        process.exit(1);
      }

      try {
        const raw = fs.readFileSync(resolved, 'utf-8');
        const proposal = JSON.parse(raw) as ActionProposal;
        const engine = new PolicyGatekeeperEngine();
        const decision = await engine.evaluate(proposal);
        console.log(formatDecisionReport(decision));

        if (decision.verdict === 'DENY') {
          process.exitCode = 2; // Non-zero exit code indicating blocked proposal
        }
      } catch (err: unknown) {
        console.error(`${c.red}Evaluation failed: ${(err as Error).message}${c.reset}`);
        process.exit(1);
      }
    });

  program
    .command('audit')
    .description('Display persistent append-only audit trail entries')
    .option('--verdict <verdict>', 'Filter by verdict: ALLOW or DENY')
    .action((options: { verdict?: 'ALLOW' | 'DENY' }) => {
      const logger = new AuditLogger();
      let entries = logger.readAll();
      if (options.verdict) {
        entries = logger.getByVerdict(options.verdict);
      }
      console.log(formatAuditLogTable(entries));
    });

  program
    .command('clear-audit')
    .description('Clear audit log entries (for testing and administrative reset)')
    .action(() => {
      const logger = new AuditLogger();
      logger.clear();
      console.log(`${c.yellow}Audit log cleared.${c.reset}`);
    });

  return program;
}

const program = createCli();
program.parse(process.argv);
