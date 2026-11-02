import {
  PaymentScheduleConfig,
  RecurringScheduleState,
  PaymentInstallment,
} from './types.js';
import { IdempotencyLockManager } from './idempotency-lock.js';

export class ScheduleManager {
  private schedules: Map<string, RecurringScheduleState> = new Map();

  /**
   * Registers a new recurring payment schedule (Requirement 01).
   */
  createSchedule(config: PaymentScheduleConfig): RecurringScheduleState {
    const nextDate = new Date(config.startDate);
    const state: RecurringScheduleState = {
      config,
      totalPaidAmount: 0,
      paidInstallmentsCount: 0,
      failedInstallmentsCount: 0,
      nextScheduledDate: nextDate.toISOString(),
      installments: [],
    };

    this.schedules.set(config.scheduleId, state);
    return state;
  }

  getSchedule(scheduleId: string): RecurringScheduleState | undefined {
    return this.schedules.get(scheduleId);
  }

  getAllSchedules(): RecurringScheduleState[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Calculates next calendar execution timestamp based on frequency (Requirement 01 & 04).
   */
  calculateNextExecutionDate(config: PaymentScheduleConfig, fromDate: Date): Date {
    const d = new Date(fromDate.getTime());

    if (config.frequency === 'WEEKLY') {
      const targetDay = config.dayOfWeek ?? 1; // Default Monday (1)
      d.setUTCDate(d.getUTCDate() + 1); // Start from next day
      while (d.getUTCDay() !== targetDay) {
        d.setUTCDate(d.getUTCDate() + 1);
      }
      d.setUTCHours(9, 0, 0, 0); // 09:00 UTC
      return d;
    }

    if (config.frequency === 'MONTHLY') {
      const targetDay = config.dayOfMonth ?? 1; // Default 1st of month
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCDate(targetDay);
      d.setUTCHours(9, 0, 0, 0);
      return d;
    }

    if (config.frequency === 'INTERVAL_SECONDS') {
      const seconds = config.intervalSeconds ?? 60;
      return new Date(fromDate.getTime() + seconds * 1000);
    }

    // Default fallback: 7 days
    return new Date(fromDate.getTime() + 7 * 86400000);
  }

  /**
   * Checks if an installment is due for execution.
   */
  isInstallmentDue(scheduleState: RecurringScheduleState, currentTimeIso: string): boolean {
    const currentMs = new Date(currentTimeIso).getTime();
    const nextMs = new Date(scheduleState.nextScheduledDate).getTime();
    return currentMs >= nextMs;
  }

  /**
   * Generates next pending installment for a due schedule.
   */
  prepareDueInstallment(
    scheduleState: RecurringScheduleState,
    currentTimeIso: string
  ): PaymentInstallment {
    const periodIndex = scheduleState.installments.length + 1;
    const config = scheduleState.config;
    const scheduledDate = scheduleState.nextScheduledDate;

    const idempotencyHash = IdempotencyLockManager.generateSlotHash(
      config.scheduleId,
      periodIndex,
      scheduledDate,
      config.recipient,
      config.amount
    );

    const installment: PaymentInstallment = {
      installmentId: `${config.scheduleId}#${periodIndex}`,
      scheduleId: config.scheduleId,
      periodIndex,
      scheduledDate,
      status: 'PENDING',
      amount: config.amount,
      tokenSymbol: config.tokenSymbol,
      tokenAddress: config.tokenAddress,
      recipient: config.recipient,
      recipientAlias: config.recipientAlias,
      idempotencyHash,
    };

    return installment;
  }

  clear(): void {
    this.schedules.clear();
  }
}
