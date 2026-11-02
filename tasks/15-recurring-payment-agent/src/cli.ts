import { Command } from 'commander';
import { RecurringPaymentAgentEngine } from './recurring-engine.js';
import { RecurringPaymentFormatter } from './formatter.js';
import {
  SCENARIO_WEEKLY_PAYROLL_CONFIG,
  SCENARIO_MONTHLY_RENT_CONFIG,
} from './scenarios.js';

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
    .name('pharos-recurring')
    .description('Pharos Autonomous Idempotent Recurring Payment Agent')
    .version('1.0.0');

  program
    .command('demo')
    .description('Run comprehensive demonstration of weekly & monthly schedules, failure handling & double-pay locks')
    .action(async () => {
      console.log(`${c.bold}${c.cyan}\n🚀 Running Pharos Recurring Payment Agent Demonstration (Requirements 01-04)...\n${c.reset}`);
      const engine = new RecurringPaymentAgentEngine();

      // Step 1: Register Weekly and Monthly schedules (Requirement 01)
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);
      console.log(`${c.bold}▶ STEP 1: REGISTERING WEEKLY & MONTHLY RECURRING SCHEDULES (REQUIREMENT 01)${c.reset}`);
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);

      const sPayroll = engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);
      const sRent = engine.registerSchedule(SCENARIO_MONTHLY_RENT_CONFIG);

      console.log(RecurringPaymentFormatter.formatSchedulesTable([sPayroll, sRent]));
      console.log('\n');

      // Step 2: Process Multiple Scheduled Cycles (Requirement 02: On-time payments)
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);
      console.log(`${c.bold}▶ STEP 2: PROCESSING CONSECUTIVE PAYROLL PERIODS (REQUIREMENT 02)${c.reset}`);
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);

      // Week 1: 2026-11-06 (Funded with 1,000 USDC)
      const mockFunded = { tokenBalance: 1000.0, nativePros: 5.0 };
      const inst1 = await engine.processSchedule(
        SCENARIO_WEEKLY_PAYROLL_CONFIG.scheduleId,
        '2026-11-06T09:00:00Z',
        mockFunded
      );
      console.log(`[Week 1 Execution]: Status = ${inst1?.status}, Amount = ${inst1?.amount} USDC, Tx = ${inst1?.txHash}`);

      // Week 2: 2026-11-13 (Funded with 750 USDC)
      const inst2 = await engine.processSchedule(
        SCENARIO_WEEKLY_PAYROLL_CONFIG.scheduleId,
        '2026-11-13T09:00:00Z',
        mockFunded
      );
      console.log(`[Week 2 Execution]: Status = ${inst2?.status}, Amount = ${inst2?.amount} USDC, Tx = ${inst2?.txHash}`);

      console.log('\n' + RecurringPaymentFormatter.formatPaymentHistory(sPayroll));
      console.log('\n');

      // Step 3: Handle Insufficient Funds & Double-Payment Resistance (Requirement 03)
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);
      console.log(`${c.bold}▶ STEP 3: SOLVENCY DEFICIT & IDEMPOTENT DOUBLE-PAY RESISTANCE (REQUIREMENT 03)${c.reset}`);
      console.log(`${c.bold}${c.magenta}================================================================================${c.reset}`);

      // Month 1: 2026-12-01 (Underfunded: only holds 200 USDC, rent is 1,500 USDC)
      const mockUnderfunded = { tokenBalance: 200.0, nativePros: 5.0 };
      const rentInst1 = await engine.processSchedule(
        SCENARIO_MONTHLY_RENT_CONFIG.scheduleId,
        '2026-12-01T09:00:00Z',
        mockUnderfunded
      );
      console.log(`[Month 1 Underfunded]: Status = ${rentInst1?.status}`);
      console.log(`  Reason: ${rentInst1?.failureReason}`);

      // Attempt to re-process Week 1 payroll (Double payment attack/glitch simulation)
      console.log(`\nSimulating duplicate execution attempt for already paid Week 1 slot:`);
      const dupCheck = engine.getLockManager().canProcessSlot(inst1!.idempotencyHash);
      console.log(`  Allowed to execute? ${dupCheck.allowed ? 'YES (UNSAFE)' : 'NO (PROTECTED BY IDEMPOTENCY LOCK)'}`);
      console.log(`  Guard Response: ${dupCheck.reason}`);

      console.log('\n' + RecurringPaymentFormatter.formatPaymentHistory(sRent));
      console.log(`${c.green}\n✓ Recurring Payment Agent demonstration completed successfully.\n${c.reset}`);
    });

  program
    .command('list')
    .description('List all active recurring payment schedules')
    .action(() => {
      const engine = new RecurringPaymentAgentEngine();
      engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);
      engine.registerSchedule(SCENARIO_MONTHLY_RENT_CONFIG);
      console.log(RecurringPaymentFormatter.formatSchedulesTable(engine.getScheduleManager().getAllSchedules()));
    });

  program
    .command('history <scheduleId>')
    .description('Display complete payment ledger and next scheduled payment')
    .action((scheduleId: string) => {
      const engine = new RecurringPaymentAgentEngine();
      engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);
      const sched = engine.getScheduleManager().getSchedule(scheduleId);
      if (sched) {
        console.log(RecurringPaymentFormatter.formatPaymentHistory(sched));
      } else {
        console.error(`Schedule not found: ${scheduleId}`);
      }
    });

  return program;
}

const program = createCli();
program.parse(process.argv);
