# Task 15: Recurring Payment Agent

> **Pharos Agent Arena — Payments Category (Medium Tier: 100 pts + 50 pts Video Walkthrough = 150 pts)**  
> **Challenge Slug**: `tasks/recurring-payment-agent`  
> **Target Network**: [Pharos Mainnet](https://scan.pharos.xyz) (Chain ID: `1672`, RPC: `https://rpc.pharos.xyz`)  
> **Pattern**: **Idempotent Recurring Payment Lifecycle & Slotted Lock Pattern**

---

## Executive Summary

The **Recurring Payment Agent** is a production-grade, non-custodial recurring payment scheduler and execution engine engineered for **Pharos Mainnet (Chain ID 1672)**. It automates periodic treasury operations—such as contributor payroll, vendor subscriptions, and facility leases—while eliminating the two greatest failure modes of automated blockchain billing: duplicate payment execution (double-billing) and stalled state upon balance deficits.

Key architectural highlights:
1. **Multi-Frequency Recurrence Scheduling (Requirement 01)**:
   - Supports weekly (e.g. ISO day-of-week payroll) and monthly (calendar day-of-month lease/subscription) recurring schedules.
   - Configurable per-schedule parameters: token asset (native PROS or ERC-20 like USDC), amount, recipient address/domain, and payment label.
2. **On-Time Preparation & Status Tracking (Requirement 02)**:
   - Dynamic evaluation against block or wall-clock timestamps to prepare installments right on time.
   - Comprehensive installment lifecycle: `PENDING`, `PREPARED`, `PAID`, `FAILED_INSUFFICIENT_FUNDS`, `FAILED_EXECUTION`, and `SKIPPED`.
3. **Solvency Deficit Recovery & Double-Payment Prevention (Requirement 03)**:
   - **Cryptographic Idempotency Lock**: Slots are deterministically hashed via SHA-256 (`sha256(scheduleId + slotTimestamp + recipient + amount)`).
   - Any duplicate execution attempt against a settled `PAID` slot is strictly blocked with a `CRITICAL_SECURITY_REJECTION`.
   - Pre-flight solvency checks intercept underfunded balances before broadcasting, marking the installment as `FAILED_INSUFFICIENT_FUNDS` with an audit reason, and advancing the schedule cleanly without re-triggering duplicate debits.
4. **Historical Audit Ledger & Next Due Payment (Requirement 04)**:
   - Complete historical ledger providing timestamped execution logs, on-chain transaction hashes, and distribution sums.
   - Live query of next scheduled execution date and projected distribution amount.

---

## Arena Requirements Compliance Matrix

| Requirement | Description | Implementation Details & Proof | Status |
| :--- | :--- | :--- | :---: |
| **01** | **Supports a schedule (weekly or monthly) with amount, token, recipient** | Implemented in `src/schedule-manager.ts` and `src/types.ts`. Fully supports weekly and monthly schedules with exact calendar date progression, amount parsing, token configurations (PROS/USDC), and PNS/ENS recipient resolution. Verified in `test/recurring-agent.test.ts`. | ✅ Compliant |
| **02** | **Prepares each payment on time and tracks paid, pending, failed status** | Implemented in `src/recurring-engine.ts`. Compares target execution timestamps against current reference time; tracks status through full lifecycle (`PENDING` -> `PREPARED` -> `PAID` / `FAILED`). Verified in `test/recurring-agent.test.ts`. | ✅ Compliant |
| **03** | **Handles insufficient balance or failed transaction without double-paying** | Implemented via `IdempotencyLockManager` in `src/idempotency-lock.ts` and pre-flight balance evaluation in `src/recurring-engine.ts`. Blocks duplicate slot execution and gracefully records `FAILED_INSUFFICIENT_FUNDS`. Verified in `test/recurring-agent.test.ts`. | ✅ Compliant |
| **04** | **Shows payment history and next scheduled payment** | Implemented in `src/formatter.ts` and exposed via CLI (`pharos-recurring history <id>`). Displays comprehensive history table with installment IDs, dates, amounts, statuses, tx hashes, and next scheduled payment date. Verified in `test/recurring-agent.test.ts`. | ✅ Compliant |

---

## Architectural Architecture

```
tasks/15-recurring-payment-agent/
├── bin/
│   └── pharos-recurring.js         # Executable wrapper binary
├── src/
│   ├── types.ts                    # TypeScript types (Schedule, Installment, Status)
│   ├── idempotency-lock.ts         # Deterministic SHA-256 slot locking & duplicate guards
│   ├── schedule-manager.ts         # Calendar date math for weekly/monthly recurrence
│   ├── recurring-engine.ts         # Core recurring execution & balance verification engine
│   ├── scenarios.ts                # Production scenarios (Weekly Payroll, Monthly Rent)
│   ├── formatter.ts                # ASCII table formatters for active schedules & ledgers
│   ├── cli.ts                      # Commander CLI commands (`demo`, `list`, `history`)
│   └── index.ts                    # Barrel exports
├── test/
│   └── recurring-agent.test.ts     # Vitest suite verifying all 4 requirements
├── README.md                       # Comprehensive task documentation & walkthrough
└── SKILL.md                        # Antigravity agent skill specification
```

---

## CLI Commands & Usage

The agent is exposed via the global `pharos-recurring` CLI command or `npm run task:15`:

### 1. Interactive Demonstration
Executes a multi-phase demonstration showcasing weekly payroll, monthly lease, failure handling, and idempotency locks:
```bash
pharos-recurring demo
# or
npm run task:15 -- demo
```

### 2. Listing Active Recurring Schedules
```bash
pharos-recurring list
```

Output:
```
Schedule ID             | Frequency | Amount     | Recipient            | Next Execution (UTC)
────────────────────────────────────────────────────────────────────────────────────────
sched-weekly-payroll-00 | WEEKLY    |  250.00 USDC | alice.pharos         | 2026-11-06 09:00:00
sched-monthly-rent-002  | MONTHLY   | 1500.00 USDC | bob.pharos           | 2026-12-01 09:00:00
```

### 3. Viewing Payment History & Next Execution
```bash
pharos-recurring history sched-weekly-payroll-001
```

Output:
```
─── PAYMENT HISTORY & AUDIT LEDGER (REQUIREMENT 04) ───────────────────────────
Schedule:  Core Contributor Weekly USDC Payroll [sched-weekly-payroll-001]
Totals:    Paid: 2 | Failed: 0 | Total Distributed: 500.00 USDC

Installment ID  | Scheduled Date       | Amount     | Status                  | Tx / Slot Hash
──────────────────────────────────────────────────────────────────────────────────────────
sched-weekly-payroll-001#1 | 2026-11-06 09:00:00 |  250.00 USDC | ✓ PAID                  | 0x88b21547be95...
sched-weekly-payroll-001#2 | 2026-11-13 09:00:00 |  250.00 USDC | ✓ PAID                  | 0x0abd90c24131...
──────────────────────────────────────────────────────────────────────────────────────────
Next Scheduled Payment: 2026-11-20T09:00:00.000Z (250 USDC)
```

---

## Automated Vitest Suite

Run the comprehensive unit and integration tests:
```bash
npx vitest run tasks/15-recurring-payment-agent
```

Test Results (11/11 passing):
```
 ✓ tasks/15-recurring-payment-agent/test/recurring-agent.test.ts (11 tests) 25ms
   ✓ Task 15: Recurring Payment Agent Engine (11)
     ✓ Requirement 01: Multi-Frequency Schedule Configuration (3)
       ✓ should support weekly recurring payment schedule with amount, token, recipient
       ✓ should support monthly recurring payment schedule with amount, token, recipient
       ✓ should accurately calculate next calendar execution dates for weekly and monthly cycles
     ✓ Requirement 02: On-Time Execution Lifecycle & Status Tracking (3)
       ✓ should prepare installment on time and update status to PAID upon execution
       ✓ should return undefined if installment is not yet due
       ✓ should track paid and pending status across consecutive execution cycles
     ✓ Requirement 03: Solvency Deficit Handling & Double-Payment Prevention (3)
       ✓ should handle insufficient balance cleanly by marking FAILED without double-paying
       ✓ should strictly reject duplicate execution of an already paid slot (Double-Pay Lock)
       ✓ should prevent concurrency collisions during active processing
     ✓ Requirement 04: Historical Ledger & Next Scheduled Payment (2)
       ✓ should display comprehensive payment history with statuses and tx hashes
       ✓ should accurately report the next scheduled payment date and amount

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

---

## Video Walkthrough Guide (50 pts Bonus)

| Timestamp | Visual Action | Accompanying Explanation / Subtitle |
| :--- | :--- | :--- |
| `00:00 - 00:15` | Terminal prompt: `pharos-recurring --help` | "Pharos Recurring Payment Agent: Autonomous non-custodial recurring payment manager for Pharos Mainnet." |
| `00:15 - 00:40` | Terminal prompt: `pharos-recurring demo` (Step 1) | "Requirement 01: Configure weekly payroll and monthly lease schedules with custom assets and recipients." |
| `00:40 - 01:10` | Step 2 (Weekly payroll execution) | "Requirement 02: Evaluates due dates on time, broadcasts payments, and records PAID status." |
| `01:10 - 01:40` | Step 3 (Solvency deficit & double-pay lock) | "Requirement 03: Handles insufficient balance without halting, and cryptographic SHA-256 slot locks prevent double-billing." |
| `01:40 - 02:10` | Audit ledger output | "Requirement 04: Shows comprehensive payment history, execution status, tx hashes, and next scheduled execution." |
| `02:10 - 02:30` | Terminal prompt: `npm test` | "All 11 unit tests passing with full coverage of all arena requirements." |
