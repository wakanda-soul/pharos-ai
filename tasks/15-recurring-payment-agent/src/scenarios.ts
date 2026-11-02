import { PaymentScheduleConfig } from './types.js';

export const SCENARIO_WEEKLY_PAYROLL_CONFIG: PaymentScheduleConfig = {
  scheduleId: 'sched-weekly-payroll-001',
  name: 'Core Contributor Weekly USDC Payroll',
  description: 'Automated weekly compensation stream for core developer operations.',
  frequency: 'WEEKLY',
  dayOfWeek: 5, // Friday
  amount: 250.0,
  tokenSymbol: 'USDC',
  tokenAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
  sender: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
  recipient: '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
  recipientAlias: 'alice.pharos',
  startDate: '2026-11-06T09:00:00Z',
};

export const SCENARIO_MONTHLY_RENT_CONFIG: PaymentScheduleConfig = {
  scheduleId: 'sched-monthly-rent-002',
  name: 'Decentralized Co-Working Office Lease',
  description: 'Monthly office rent lease agreement in USDC.',
  frequency: 'MONTHLY',
  dayOfMonth: 1,
  amount: 1500.0,
  tokenSymbol: 'USDC',
  tokenAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
  sender: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
  recipient: '0x5346452296d910a373b5ee0e6df27863cb6ad689',
  recipientAlias: 'bob.pharos',
  startDate: '2026-12-01T09:00:00Z',
};

export const SCENARIO_INTERVAL_SUBSCRIPTION_CONFIG: PaymentScheduleConfig = {
  scheduleId: 'sched-fast-sub-003',
  name: 'High-Frequency Node RPC Micro-Subscription',
  description: 'Demonstration schedule with 10-second intervals for rapid simulation.',
  frequency: 'INTERVAL_SECONDS',
  intervalSeconds: 10,
  amount: 0.01,
  tokenSymbol: 'PROS',
  tokenAddress: 'NATIVE',
  sender: '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
  recipient: '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
  recipientAlias: 'alice.pharos',
  startDate: '2026-11-02T19:00:00Z',
};
