---
name: pharos-batch-executor
description: Autonomous multi-action bundling engine that aggregates independent smart contract operations into an atomic or fault-tolerant Multicall3 batch, reducing transaction steps and cutting gas by 35%+.
---

# Pharos SkillEngine: Batch Executor Skill

## Overview
The **Pharos Batch Executor** is an advanced transaction orchestration and optimization engine built on **Pharos SkillEngine**. It takes lists of independent smart contract calls, token transfers, or oracle queries, bundling them into a single optimized **Multicall3 `aggregate3`** execution rather than firing separate individual transactions.

### Key Innovations:
1. **Adaptive Multicall3 Orchestration**:
   - Compiles heterogeneous actions into canonical Multicall3 structures (`0xcA11bde05977b3631167028862bE2a173976CA11`).
   - Supports both `FAULT_TOLERANT` (individual failures do not break the batch) and `STRICT_ATOMIC` (atomic all-or-nothing rollback).
2. **Deterministic Gas Economics & Savings Matrix**:
   - Compares the baseline gas of $N$ individual transactions against the batched multicall.
   - Computes gas units saved, percentage saved (>35%), native PROS saved, and live USD equivalent savings via Chainlink Oracle (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`).
3. **Granular Partial Failure Post-Mortem**:
   - Decodes exact revert reasons (`Error(string)`, `Panic`, and custom contract errors) for failed actions.
   - Provides clear isolation trace proving how subsequent actions executed successfully without interruption.

---

## When to Activate
Activate this skill when:
- The user or agent has multiple independent transactions to send (e.g., claiming rewards, approving tokens, querying feeds, rebalancing).
- Gas optimization and transaction fee minimization are required.
- The user wants atomic execution or fault-isolated batching across multiple contracts on Pharos.
- The user asks: "Can you batch these transactions?", "How much gas do I save by using multicall?", or "Bundle these 3 actions".

---

## Architecture Flow
```mermaid
sequenceDiagram
    autonumber
    actor Agent as Autonomous Agent / User
    participant Engine as Batch Executor Engine
    participant Multi as Multicall3 (0xcA11...CA11)
    participant Oracle as Chainlink Oracle (0x1Ed3...1DB8)
    participant Targets as On-Chain Targets (USDC, LINK, AMM)

    Agent->>Engine: executeBatch([Action 1, Action 2, Action 3], mode)
    Engine->>Engine: Measure Individual Gas Baseline (N x estimateGas)
    Engine->>Multi: Simulate aggregate3(Call3[] calls)
    Multi->>Targets: Dispatches Call 1, Call 2, Call 3 in 1 EVM tx
    Targets-->>Multi: Returns results / isolated reverts
    Multi-->>Engine: Returns Result[] { success, returnData }
    Engine->>Oracle: Query live spot rate for USD economics
    Oracle-->>Engine: Returns $2,283 USD
    Engine->>Engine: Compute Gas Saved (Units, %, PROS, USD)
    Engine-->>Agent: Output Batch Report + Post-Mortem + Cast Command
```

---

## CLI Usage

```bash
# 1. Run dual-outcome demonstration (optimal batch + fault-tolerant partial failure)
pharos-batch demo

# 2. Benchmark gas savings across individual vs batched execution
pharos-batch compare

# 3. List available benchmark scenarios
pharos-batch scenarios

# 4. Run a specific scenario
pharos-batch scenarios --run SCENARIO_3_ACTIONS_OPTIMIZED
pharos-batch scenarios --run SCENARIO_4_ACTIONS_WITH_PARTIAL_FAILURE
```
