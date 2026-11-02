import {
  RecurringScheduleState,
  PaymentInstallment,
  ExecutionCycleResult,
} from './types.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

export class RecurringPaymentFormatter {
  static formatSchedulesTable(schedules: RecurringScheduleState[]): string {
    const lines: string[] = [];

    lines.push(`${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
    lines.push(`${c.bold}${c.cyan}║             PHAROS RECURRING PAYMENT AGENT: ACTIVE SCHEDULES                 ║${c.reset}`);
    lines.push(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
    lines.push('');
    lines.push(
      `${c.bold}Schedule ID             | Frequency | Amount     | Recipient            | Next Execution (UTC)${c.reset}`
    );
    lines.push(`${c.gray}${'─'.repeat(88)}${c.reset}`);

    for (const s of schedules) {
      const idStr = `${c.white}${s.config.scheduleId.padEnd(23).slice(0, 23)}${c.reset}`;
      const freqStr = `${c.cyan}${s.config.frequency.padEnd(9)}${c.reset}`;
      const amtStr = `${c.yellow}${s.config.amount.toFixed(2).padStart(7)} ${s.config.tokenSymbol.padEnd(4)}${c.reset}`;
      const recStr = `${c.green}${(s.config.recipientAlias ?? s.config.recipient).padEnd(20).slice(0, 20)}${c.reset}`;
      const nextStr = `${c.gray}${s.nextScheduledDate.slice(0, 19).replace('T', ' ')}${c.reset}`;

      lines.push(`${idStr} | ${freqStr} | ${amtStr} | ${recStr} | ${nextStr}`);
    }
    lines.push(`${c.gray}${'─'.repeat(88)}${c.reset}`);

    return lines.join('\n');
  }

  static formatPaymentHistory(schedule: RecurringScheduleState): string {
    const lines: string[] = [];

    lines.push(`${c.bold}${c.magenta}─── PAYMENT HISTORY & AUDIT LEDGER (REQUIREMENT 04) ───────────────────────────${c.reset}`);
    lines.push(`${c.bold}Schedule:${c.reset}  ${c.white}${schedule.config.name}${c.reset} [${c.yellow}${schedule.config.scheduleId}${c.reset}]`);
    lines.push(`${c.bold}Totals:${c.reset}    Paid: ${c.green}${schedule.paidInstallmentsCount}${c.reset} | Failed: ${c.red}${schedule.failedInstallmentsCount}${c.reset} | Total Distributed: ${c.bold}${c.white}${schedule.totalPaidAmount.toFixed(2)} ${schedule.config.tokenSymbol}${c.reset}`);
    lines.push('');

    if (schedule.installments.length === 0) {
      lines.push(`${c.gray}No historical installments recorded yet.${c.reset}`);
      return lines.join('\n');
    }

    lines.push(
      `${c.bold}Installment ID  | Scheduled Date       | Amount     | Status                  | Tx / Slot Hash${c.reset}`
    );
    lines.push(`${c.gray}${'─'.repeat(90)}${c.reset}`);

    for (const inst of schedule.installments) {
      const instStr = `${c.cyan}${inst.installmentId.padEnd(15)}${c.reset}`;
      const dateStr = `${c.gray}${inst.scheduledDate.slice(0, 19).replace('T', ' ')}${c.reset}`;
      const amtStr = `${c.white}${inst.amount.toFixed(2).padStart(7)} ${inst.tokenSymbol.padEnd(4)}${c.reset}`;

      let statusBadge: string;
      if (inst.status === 'PAID') {
        statusBadge = `${c.bold}${c.green}✓ PAID                 ${c.reset}`;
      } else if (inst.status === 'FAILED_INSUFFICIENT_FUNDS') {
        statusBadge = `${c.bold}${c.red}✗ INSUFFICIENT FUNDS   ${c.reset}`;
      } else if (inst.status === 'SKIPPED') {
        statusBadge = `${c.bold}${c.yellow}⚠️ DOUBLE-PAY BLOCKED  ${c.reset}`;
      } else {
        statusBadge = `${c.gray}${inst.status.padEnd(23)}${c.reset}`;
      }

      const hashStr = inst.txHash ? `${c.gray}${inst.txHash.slice(0, 14)}...${c.reset}` : `${c.gray}None${c.reset}`;
      lines.push(`${instStr} | ${dateStr} | ${amtStr} | ${statusBadge} | ${hashStr}`);
      if (inst.failureReason) {
        lines.push(`  ${c.red}└─ Reason: ${inst.failureReason}${c.reset}`);
      }
    }
    lines.push(`${c.gray}${'─'.repeat(90)}${c.reset}`);
    lines.push(`${c.bold}Next Scheduled Payment:${c.reset} ${c.yellow}${schedule.nextScheduledDate}${c.reset} (${schedule.config.amount} ${schedule.config.tokenSymbol})`);

    return lines.join('\n');
  }

  static formatCycleSummary(cycle: ExecutionCycleResult): string {
    const lines: string[] = [];
    lines.push(`${c.bold}Execution Cycle at ${c.gray}${cycle.cycleTimestamp}${c.reset}:`);
    lines.push(`  • Due Installments Evaluated: ${c.bold}${cycle.dueInstallmentsEvaluated}${c.reset}`);
    lines.push(`  • Successfully Paid:          ${c.green}${cycle.paidCount}${c.reset}`);
    lines.push(`  • Failed (Solvency/Revert):   ${c.red}${cycle.failedCount}${c.reset}`);
    lines.push(`  • Double-Payments Neutralized: ${c.yellow}${cycle.doublePaymentAttemptsBlocked}${c.reset}`);
    return lines.join('\n');
  }
}
