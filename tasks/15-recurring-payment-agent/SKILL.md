---
name: pharos-recurring-payment-agent
description: Idempotent recurring payment engine for Pharos that schedules repeating on-chain disbursements (weekly, monthly, interval) with SHA-256 deduplication locks, solvency deficit handling, and historical ledgers.
---

# Pharos Skill: Recurring Payment Agent

## Purpose
The **Recurring Payment Agent** automates repeating on-chain disbursements (payroll, leases, subscriptions) on Pharos. It prevents accidental double-billing via cryptographic idempotency locks and gracefully advances schedules when experiencing temporary balance deficits.

### Core Capabilities:
1. **Multi-Frequency Schedule Support**:
   - Manages weekly (day-of-week), monthly (day-of-month), and interval-based recurrence.
   - Supports native PROS and ERC-20 tokens (e.g. USDC `0xc879c018db60520f4355c26ed1a6d572cdac1815`).
2. **On-Time Preparation & Lifecycle Tracking**:
   - Compares timestamps to ensure installments are dispatched only when due.
   - Tracks full installment lifecycle: `PENDING`, `PREPARED`, `PAID`, `FAILED_INSUFFICIENT_FUNDS`, and `FAILED_EXECUTION`.
3. **Idempotency & Zero Double-Paying**:
   - Deterministic slot hashing via SHA-256 prevents duplicate executions of already-settled installments.
   - Pre-flight solvency checks intercept underfunded wallets without causing stalled loops or duplicate charges.
4. **Historical Ledger & Next Payment Telemetry**:
   - Maintains an auditable ledger of all past disbursements with transaction hashes.
   - Accurately computes and exposes the next scheduled payment date and amount.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-recurring demo

# List registered schedules
pharos-recurring list

# View payment history for a schedule
pharos-recurring history sched-weekly-payroll-001
```
