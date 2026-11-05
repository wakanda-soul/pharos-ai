---
name: pharos-saga-executor
description: Distributed saga orchestrator for multi-step on-chain workflows on Pharos that verifies transaction receipts, handles transient faults with gas escalation, and executes compensating rollbacks on permanent failures.
---

# Pharos Skill: Saga Executor

## Purpose
The **Saga Executor** coordinates sequential, multi-step on-chain workflows (e.g. Approve $\to$ Swap $\to$ Deposit) on Pharos Mainnet. It prevents stranded capital by verifying confirmation receipts at each step, retrying transient network errors with gas price escalation, and executing compensating reverse transactions in LIFO order upon fatal failures.

### Core Capabilities:
1. **Receipt-Verified Dependent Steps**:
   - Executes $\ge 3$ sequential steps, explicitly validating confirmation receipts (`status === 1`) and confirmed block heights.
2. **Transient Fault Classification & Retries**:
   - Distinguishes network transient errors (gas spikes, mempool drops, timeouts) from fatal EVM reverts.
   - Applies exponential backoff and escalates replacement gas price by +20%.
3. **Compensating Rollback Engine**:
   - Executes reverse transactions in LIFO order (e.g. reverse swap, revoke allowances to zero) when a step fails permanently.
4. **Append-Only State Journal**:
   - Records real-time state transitions with timestamps and step indicators.

---

## Quick Start & Usage

```bash
# Run comparative demonstration (success vs forced failure rollback)
pharos-saga demo

# Inspect retry and fault policies
pharos-saga policy

# Run test suite
npx vitest run tasks/23-saga-executor
```
