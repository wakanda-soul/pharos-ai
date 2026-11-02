/**
 * Task 15: Recurring Payment Agent Types & Interfaces
 * Idempotent Recurring Payment Sentinel for Pharos Mainnet.
 */

export type ScheduleFrequency = 'WEEKLY' | 'MONTHLY' | 'INTERVAL_SECONDS';

export type InstallmentStatus =
  | 'SCHEDULED'
  | 'PENDING'
  | 'PAID'
  | 'FAILED_INSUFFICIENT_FUNDS'
  | 'FAILED_REVERT'
  | 'SKIPPED';

export interface PaymentScheduleConfig {
  scheduleId: string;
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  dayOfWeek?: number; // 0 = Sun, 1 = Mon ... 5 = Fri, 6 = Sat
  dayOfMonth?: number; // 1 - 31
  intervalSeconds?: number; // Used for automated simulation / testing
  amount: number;
  tokenSymbol: 'PROS' | 'USDC' | 'LINK';
  tokenAddress: `0x${string}` | 'NATIVE';
  recipient: `0x${string}`;
  recipientAlias?: string;
  sender: `0x${string}`;
  startDate: string; // ISO 8601
  endDate?: string;
  maxInstallments?: number;
}

export interface PaymentInstallment {
  installmentId: string;
  scheduleId: string;
  periodIndex: number; // 1, 2, 3...
  scheduledDate: string; // ISO 8601
  status: InstallmentStatus;
  amount: number;
  tokenSymbol: string;
  tokenAddress: `0x${string}` | 'NATIVE';
  recipient: `0x${string}`;
  recipientAlias?: string;
  executedAt?: string;
  idempotencyHash: string;
  txHash?: string;
  castCommand?: string;
  failureReason?: string;
  solvencyDeficit?: {
    required: number;
    available: number;
  };
}

export interface RecurringScheduleState {
  config: PaymentScheduleConfig;
  totalPaidAmount: number;
  paidInstallmentsCount: number;
  failedInstallmentsCount: number;
  lastProcessedDate?: string;
  nextScheduledDate: string;
  installments: PaymentInstallment[];
}

export interface ExecutionCycleResult {
  cycleTimestamp: string;
  dueInstallmentsEvaluated: number;
  paidCount: number;
  failedCount: number;
  installments: PaymentInstallment[];
  doublePaymentAttemptsBlocked: number;
}
