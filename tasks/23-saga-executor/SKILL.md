---
name: pharos-saga-executor
description: Autonomous multi-step dependent workflow execution skill for Pharos Mainnet. Coordinates complex DeFi flows (Approve → Swap → Deposit) with explicit transaction receipt verification, exponential backoff retries with gas price escalation for transient failures, clean reverse compensating rollbacks upon fatal reverts, and an append-only state transition journal.
---

# Pharos SkillEngine: Saga Executor Skill

## Overview
The **Pharos Saga Executor** is an autonomous multi-step distributed transaction orchestrator built for **Pharos Mainnet (Chain ID 1672)**. In blockchain architectures, multi-hop transactions (such as approving a token allowance, executing an AMM swap on FaroSwap, and supplying the resulting collateral into Harbor Lending) risk stranding user funds halfway if an intermediate or final step fails. The Saga Executor prevents stranded capital by enforcing strict on-chain receipt verification between steps, retrying transient network spikes, and executing **Compensating Reverse Transactions** in LIFO order upon permanent failure.

### Core Capabilities:
1. **Sequential Dependent Step Verification (Requirement 01)**:
   - Coordinates a minimum of 3 dependent steps:
     - **Step 1 (`Approve`)**: Grants FaroSwap Router allowance for input tokens (USDC).
     - **Step 2 (`Swap`)**: Swaps USDC for PROS on FaroSwap AMM Router.
     - **Step 3 (`Deposit`)**: Supplies swapped PROS collateral into Harbor Lending Pool.
   - Strictly verifies on-chain transaction receipt `status === 1` and confirmed block numbers before allowing the subsequent step to begin.
2. **Transient Fault Classification & Gas Escalation (Requirement 02)**:
   - Inspects error signatures to isolate transient network anomalies (`GAS_SPIKE_UNDERPRICED`, `DROPPED_TRANSACTION`, `NONCE_DESYNCHRONIZATION`, `RPC_TIMEOUT`).
   - Applies exponential backoff ($1.8\times$) with randomized jitter.
   - Automatically escalates gas price by **+20%** on replacement transactions during network base fee surges.
3. **Automated Compensating Rollback Path (Requirement 03)**:
   - When a step suffers a fatal contract revert or exhausts retry attempts, forward progression halts immediately.
   - Triggers reverse compensating actions in LIFO order:
     - **Rollback Step 2**: Reverses the swap on FaroSwap Router (selling PROS back into USDC).
     - **Rollback Step 1**: Revokes the router's ERC-20 spending allowance back to zero.
   - Restores the initiator's principal capital; zero assets remain trapped.
4. **Append-Only Real-Time State Journal (Requirement 04)**:
   - Maintains a timestamped audit log of all phase transitions (`INITIALIZED`, `IN_PROGRESS`, `RETRYING`, `STEP_CONFIRMED`, `COMPENSATING`, `COMPENSATED_CLEANLY`, `COMPLETED_SUCCESS`).
   - Renders visual ASCII execution timelines showing step statuses and transaction hashes.
5. **Comparative Benchmark Verification (Requirement 05)**:
   - Built-in dual demonstration:
     - **Run 1 (Full Success)**: 3/3 steps verified forward with yield position minted.
     - **Run 2 (Forced Failure & Recovery)**: Step 3 forced revert triggering clean 2-step reverse compensation with 100% capital restoration.

---

## Architecture Flow

```mermaid
flowchart TD
    A["Saga Orchestrator Initialized\n(Input: 10,000 USDC)"] --> B["Step 1: Approve FaroSwap Router"]
    B --> C{"Verify Step 1 Receipt\n(status === 1)"}
    C -->|Confirmed| D["Step 2: Swap USDC ➔ PROS\n(FaroSwap AMM Router)"]
    C -->|Transient Failure| B_Retry["Retry Policy (+20% Gas Bump)"]
    B_Retry --> B

    D --> E{"Verify Step 2 Receipt\n(status === 1)"}
    E -->|Confirmed| F["Step 3: Deposit PROS Collateral\n(Harbor Lending Pool)"]
    E -->|Transient Failure| D_Retry["Retry Policy (Backoff Jitter)"]
    D_Retry --> D

    F --> G{"Verify Step 3 Receipt\n(status === 1)"}
    G -->|Success| H["COMPLETED_SUCCESS\n(Lending Position Minted)"]

    G -->|Permanent Revert\n(e.g., PoolCapExceeded)| I["Trigger Compensating Rollback\n(Phase: COMPENSATING)"]
    I --> J["Compensate Step 2:\nReverse Swap PROS ➔ USDC on FaroSwap"]
    J --> K["Compensate Step 1:\nRevoke Allowance to 0 on FaroSwap"]
    K --> L["COMPENSATED_CLEANLY\n(100% Principal Restored, 0 Stranded Funds)"]

    M["SagaStateJournal\n(Real-time State Transitions)"] -.-> B
    M -.-> D
    M -.-> F
    M -.-> J
    M -.-> K
```

---

## CLI Usage

```bash
# Run comparative demonstration: One successful run + One forced-failure run with recovery (Requirement 05)
pharos-saga demo
npm run saga -- demo

# Execute forward workflow with custom USDC amount
pharos-saga execute 15000

# Inject forced failure at specific step to test automated compensation
pharos-saga test-failure 3
pharos-saga test-failure 2

# Inspect transient fault classifier and retry policy
pharos-saga policy
```
