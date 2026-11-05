import { describe, it, expect, beforeEach } from 'vitest';
import { RecurringPaymentAgentEngine } from '../src/recurring-engine.js';
import { IdempotencyLockManager } from '../src/idempotency-lock.js';
import {
  SCENARIO_WEEKLY_PAYROLL_CONFIG,
  SCENARIO_MONTHLY_RENT_CONFIG,
  SCENARIO_INTERVAL_SUBSCRIPTION_CONFIG,
} from '../src/scenarios.js';

describe('Task 15: Recurring Payment Agent Engine', () => {
  let engine: RecurringPaymentAgentEngine;

  beforeEach(() => {
    engine = new RecurringPaymentAgentEngine();
  });

  // =========================================================================
  // Requirement 01: Supports Schedule (Weekly or Monthly) with Amount, Token, Recipient
  // =========================================================================
  describe('Requirement 01: Multi-Frequency Schedule Configuration', () => {
    it('should support weekly recurring payment schedule with amount, token, recipient', () => {
      const schedule = engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);

      expect(schedule.config.scheduleId).toBe('sched-weekly-payroll-001');
      expect(schedule.config.frequency).toBe('WEEKLY');
      expect(schedule.config.amount).toBe(250.0);
      expect(schedule.config.tokenSymbol).toBe('USDC');
      expect(schedule.config.recipient).toBe('0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');
      expect(schedule.config.recipientAlias).toBe('alice.pharos');
      expect(schedule.nextScheduledDate).toBeDefined();
    });

    it('should support monthly recurring payment schedule with amount, token, recipient', () => {
      const schedule = engine.registerSchedule(SCENARIO_MONTHLY_RENT_CONFIG);

      expect(schedule.config.scheduleId).toBe('sched-monthly-rent-002');
      expect(schedule.config.frequency).toBe('MONTHLY');
      expect(schedule.config.amount).toBe(1500.0);
      expect(schedule.config.tokenSymbol).toBe('USDC');
      expect(schedule.config.recipient).toBe('0x5346452296d910a373b5ee0e6df27863cb6ad689');
      expect(schedule.config.dayOfMonth).toBe(1);
    });

    it('should support interval-based micro-subscription recurrence with native PROS', () => {
      const schedule = engine.registerSchedule(SCENARIO_INTERVAL_SUBSCRIPTION_CONFIG);

      expect(schedule.config.scheduleId).toBe('sched-fast-sub-003');
      expect(schedule.config.frequency).toBe('INTERVAL_SECONDS');
      expect(schedule.config.intervalSeconds).toBe(10);
      expect(schedule.config.tokenSymbol).toBe('PROS');
      expect(schedule.config.amount).toBe(0.01);
      expect(schedule.nextScheduledDate).toBeDefined();
    });

    it('should accurately calculate next calendar execution dates for weekly and monthly cycles', () => {
      const sm = engine.getScheduleManager();

      // Weekly (target Friday = day 5)
      const baseFri = new Date('2026-11-06T09:00:00Z');
      const nextFri = sm.calculateNextExecutionDate(SCENARIO_WEEKLY_PAYROLL_CONFIG, baseFri);
      expect(nextFri.getUTCDay()).toBe(5);
      expect(nextFri.getUTCDate()).toBe(13); // Friday 13th

      // Monthly (target 1st of month)
      const baseMonth = new Date('2026-12-01T09:00:00Z');
      const nextMonth = sm.calculateNextExecutionDate(SCENARIO_MONTHLY_RENT_CONFIG, baseMonth);
      expect(nextMonth.getUTCDate()).toBe(1);
      expect(nextMonth.getUTCMonth()).toBe(0); // January (month 0)
    });
  });

  // =========================================================================
  // Requirement 02: Prepares Payments on Time & Tracks Paid, Pending, Failed
  // =========================================================================
  describe('Requirement 02: On-Time Execution Lifecycle & Status Tracking', () => {
    it('should prepare installment on time and update status to PAID upon execution', async () => {
      engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);

      const dueTime = '2026-11-06T09:00:00Z';
      const mockFunded = { tokenBalance: 500.0, nativePros: 5.0 };

      const inst = await engine.processSchedule(
        SCENARIO_WEEKLY_PAYROLL_CONFIG.scheduleId,
        dueTime,
        mockFunded
      );

      expect(inst).toBeDefined();
      expect(inst?.periodIndex).toBe(1);
      expect(inst?.status).toBe('PAID');
      expect(inst?.amount).toBe(250.0);
      expect(inst?.executedAt).toBe(dueTime);
      expect(inst?.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(inst?.castCommand).toContain('cast send');
      expect(inst?.castCommand).toContain('0xc879c018db60520f4355c26ed1a6d572cdac1815');
    });

    it('should return undefined if installment is not yet due', async () => {
      engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);

      // Attempt execution 1 day before due date
      const prematureTime = '2026-11-05T09:00:00Z';
      const inst = await engine.processSchedule(
        SCENARIO_WEEKLY_PAYROLL_CONFIG.scheduleId,
        prematureTime
      );

      expect(inst).toBeUndefined();
    });

    it('should track paid and pending status across consecutive execution cycles', async () => {
      const schedule = engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);
      const mockFunded = { tokenBalance: 1000.0, nativePros: 5.0 };

      // Week 1
      await engine.processSchedule(schedule.config.scheduleId, '2026-11-06T09:00:00Z', mockFunded);
      expect(schedule.paidInstallmentsCount).toBe(1);
      expect(schedule.totalPaidAmount).toBe(250.0);

      // Week 2
      await engine.processSchedule(schedule.config.scheduleId, '2026-11-13T09:00:00Z', mockFunded);
      expect(schedule.paidInstallmentsCount).toBe(2);
      expect(schedule.totalPaidAmount).toBe(500.0);
      expect(schedule.installments).toHaveLength(2);
      expect(schedule.installments.every((i) => i.status === 'PAID')).toBe(true);
    });
  });

  // =========================================================================
  // Requirement 03: Insufficient Balance Handling & Zero Double-Paying
  // =========================================================================
  describe('Requirement 03: Solvency Deficit Handling & Double-Payment Prevention', () => {
    it('should handle insufficient balance cleanly by marking FAILED without double-paying', async () => {
      const schedule = engine.registerSchedule(SCENARIO_MONTHLY_RENT_CONFIG);

      // Underfunded: sender only holds 100 USDC, rent is 1,500 USDC
      const mockUnderfunded = { tokenBalance: 100.0, nativePros: 5.0 };
      const dueTime = '2026-12-01T09:00:00Z';

      const inst = await engine.processSchedule(
        schedule.config.scheduleId,
        dueTime,
        mockUnderfunded
      );

      expect(inst).toBeDefined();
      expect(inst?.status).toBe('FAILED_INSUFFICIENT_FUNDS');
      expect(inst?.failureReason).toContain('Insufficient balance: required 1500 USDC');
      expect(inst?.solvencyDeficit?.required).toBe(1500.0);
      expect(inst?.solvencyDeficit?.available).toBe(100.0);

      // Verify schedule was not debited
      expect(schedule.totalPaidAmount).toBe(0);
      expect(schedule.failedInstallmentsCount).toBe(1);
      expect(schedule.paidInstallmentsCount).toBe(0);

      // Verify next execution date was advanced to next month rather than stuck
      expect(schedule.nextScheduledDate).toContain('2027-01-01');
    });

    it('should strictly reject duplicate execution of an already paid slot (Double-Pay Lock)', async () => {
      const schedule = engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);
      const mockFunded = { tokenBalance: 1000.0, nativePros: 5.0 };
      const dueTime = '2026-11-06T09:00:00Z';

      // First run: Successfully executed and paid
      const inst = await engine.processSchedule(schedule.config.scheduleId, dueTime, mockFunded);
      expect(inst?.status).toBe('PAID');

      // Idempotency check: attempting to re-execute the identical slot hash must be blocked
      const lockCheck = engine.getLockManager().canProcessSlot(inst!.idempotencyHash);
      expect(lockCheck.allowed).toBe(false);
      expect(lockCheck.reason).toContain('CRITICAL_SECURITY_REJECTION');
      expect(lockCheck.reason).toContain('Slot has already been executed');
    });

    it('should prevent concurrency collisions during active processing', () => {
      const lockManager = engine.getLockManager();
      const hash = IdempotencyLockManager.generateSlotHash('test-sched', 1, '2026-11-06', '0x123', 50);

      expect(lockManager.acquireLock(hash)).toBe(true);
      // Attempt second lock acquisition on identical slot
      expect(lockManager.acquireLock(hash)).toBe(false);
      expect(lockManager.canProcessSlot(hash).allowed).toBe(false);

      // Release lock
      lockManager.releaseLock(hash);
      expect(lockManager.canProcessSlot(hash).allowed).toBe(true);
    });
  });

  // =========================================================================
  // Requirement 04: Payment History & Next Scheduled Payment Telemetry
  // =========================================================================
  describe('Requirement 04: Historical Ledger & Next Scheduled Payment', () => {
    it('should display comprehensive payment history with statuses and tx hashes', async () => {
      const schedule = engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);
      const mockFunded = { tokenBalance: 1000.0, nativePros: 5.0 };

      await engine.processSchedule(schedule.config.scheduleId, '2026-11-06T09:00:00Z', mockFunded);
      await engine.processSchedule(schedule.config.scheduleId, '2026-11-13T09:00:00Z', mockFunded);

      const history = engine.getPaymentHistory(schedule.config.scheduleId);
      expect(history).toHaveLength(2);
      expect(history[0].installmentId).toBe('sched-weekly-payroll-001#1');
      expect(history[0].status).toBe('PAID');
      expect(history[0].txHash).toBeDefined();

      expect(history[1].installmentId).toBe('sched-weekly-payroll-001#2');
      expect(history[1].status).toBe('PAID');
    });

    it('should accurately report the next scheduled payment date and amount', async () => {
      const schedule = engine.registerSchedule(SCENARIO_WEEKLY_PAYROLL_CONFIG);
      const mockFunded = { tokenBalance: 1000.0, nativePros: 5.0 };

      // Process first installment
      await engine.processSchedule(schedule.config.scheduleId, '2026-11-06T09:00:00Z', mockFunded);

      const nextPayment = engine.getNextScheduledPayment(schedule.config.scheduleId);
      expect(nextPayment).toBeDefined();
      expect(nextPayment?.amount).toBe(250.0);
      expect(nextPayment?.token).toBe('USDC');
      expect(nextPayment?.recipient).toBe('0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');
      expect(nextPayment?.nextDate).toContain('2026-11-13');
    });
  });
});
