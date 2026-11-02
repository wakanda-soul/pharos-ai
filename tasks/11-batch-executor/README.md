# Task 11: Batch Executor

> **Pharos Agent Arena — SkillEngine Category (Medium Tier: 100 pts + 50 pts Video Walkthrough = 150 pts)**  
> **Challenge Slug**: `tasks/batch-executor`  
> **Target Network**: [Pharos Mainnet](https://scan.pharos.xyz) (Chain ID: `1672`, RPC: `https://rpc.pharos.xyz`)  
> **Engine**: **Pharos SkillEngine** Multi-Action Batch & Optimization Synthesizer

---

## Executive Summary

The **Batch Executor** is an enterprise-grade transaction bundling and optimization engine built for **Pharos SkillEngine**. It intercepts independent operations (such as multi-protocol oracle queries, token allowances, transfers, and contract interactions) and aggregates them into a single, gas-optimized **Multicall3 `aggregate3`** execution on Pharos Mainnet.

Rather than implementing a naive batch loop that sends consecutive transactions, this architecture solves EVM fee inefficiencies and partial failure handling through **Adaptive Fault-Isolated Batching**:
1. **Canonical Multicall3 Aggregation**: Employs the canonical on-chain Multicall3 contract (`0xcA11bde05977b3631167028862bE2a173976CA11`) to execute multiple calls within a single transaction envelope.
2. **Deterministic Gas Economics & Savings Matrix**: Quantifies gas savings by benchmarking the sum of $N$ individual transactions (with base 21,000 gas overheads and distinct signatures) against the batched multicall. Calculates exact units saved, percentage saved (>35%), native PROS saved, and live USD savings using Chainlink Price Oracles (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`).
3. **Transaction Step Reduction**: Collapses multiple independent transactions into 1 single atomic dispatch (reducing steps by 66.7% to 75%+).
4. **Fault-Tolerant Partial Failure Isolation**: Decodes EVM revert reasons (`Error(string)`, `Panic(uint256)`, custom revert errors) per action. When an action reverts in `FAULT_TOLERANT` mode, the error is isolated without breaking or aborting the remaining actions in the batch.

---

## Arena Requirements Compliance Matrix

| Requirement | Description | Implementation Details & Proof | Status |
| :--- | :--- | :--- | :---: |
| **01** | **Accepts a list of at least 3 independent actions** | Validates batch payload has >= 3 actions. Rejects payloads with < 3 actions. Tested with 3-action, 4-action, and custom bundles in `test/batch.test.ts`. | ✅ Compliant |
| **02** | **Executes them as a batch: multicall or single prepared transaction** | Compiles actions into Multicall3 `aggregate3(Call3[])` calldata and executes via single call to `0xcA11bde05977b3631167028862bE2a173976CA11` on Pharos Mainnet. Verified in `test/batch.test.ts`. | ✅ Compliant |
| **03** | **Reports gas saving or step reduction compared with individual runs** | Measures individual gas sum vs batch gas. Emits detailed report showing 46,700+ gas units saved (36.5% reduction), 66.7% transaction step reduction, and USD savings. Verified in `test/batch.test.ts`. | ✅ Compliant |
| **04** | **Handles partial failure clearly: which action failed and what happened to the rest** | Decodes exact revert string from failed return data (`"The year just became eeeveen woooorse :O but only for you : )"`). Documents that downstream actions completed successfully under fault-tolerant mode. Verified in `test/batch.test.ts`. | ✅ Compliant |

---

## Architecture Flow

```mermaid
flowchart TD
    subgraph ActionsList["Independent Action Request (N >= 3)"]
        A1["Action #0: Oracle Price Check"]
        A2["Action #1: USDC Liquidity Depth"]
        A3["Action #2: Contract Interaction / Revert Check"]
        A4["Action #3: Token Decimals Verification"]
    end

    subgraph BatchEngine["SkillEngine Batch Executor"]
        Validator["Input Validator (>= 3 actions)"]
        Encoder["Multicall3 aggregate3 Encoder"]
        Benchmarker["Gas Economics Benchmarker<br/>(Individual vs Batched Gas)"]
        Dispatcher["Single Batch Dispatcher"]
        RevertDecoder["Error & Revert Reason Parser"]
    end

    subgraph PharosChain["Pharos Mainnet (Chain ID 1672)"]
        Multi["Multicall3 (0xcA11...CA11)"]
        Oracle["Chainlink Oracle (0x1Ed3...1DB8)"]
        USDC["USDC Token (0xc879...1815)"]
        Troll["Reverting Target (0x9365...b470)"]
    end

    ActionsList --> Validator
    Validator --> Encoder
    Encoder --> Benchmarker
    Benchmarker --> Dispatcher
    Dispatcher -->|Single aggregate3() tx| Multi

    Multi -->|Call 0| Oracle
    Multi -->|Call 1| USDC
    Multi -->|Call 2: Reverts| Troll
    Multi -->|Call 3: Succeeds| USDC

    Multi -->|Results Array| RevertDecoder
    RevertDecoder --> Report["Formatted Optimization Report<br/>• Step Reduction (75%)<br/>• Gas Saved (47.4%)<br/>• Partial Failure Post-Mortem"]
```

---

## Live Smart Contracts Evaluated

| Protocol / Contract | Address | Purpose in Batch |
| :--- | :--- | :--- |
| **Multicall3 Canonical Contract** | `0xcA11bde05977b3631167028862bE2a173976CA11` | Primary batch router and atomic execution gateway |
| **Chainlink Price Oracle** | `0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8` | Spot asset price snapshot and USD gas savings calculation |
| **Native USDC Token** | `0xc879c018db60520f4355c26ed1a6d572cdac1815` | Total supply, symbol, and decimals verification |
| **Pharos Troll Revert Contract** | `0x936564245b69f5a293b42cbd752e0ee3bb68b470` | Reverting contract to verify fault-tolerant partial failure isolation |

---

## CLI Commands & Usage

The package exposes the global `pharos-batch` CLI (also accessible via `npm run batch` or `npm run task:11`).

### 1. Dual-Outcome Demonstration (Requirements 01-04)
Runs both an optimal 3-action bundle (100% success with gas savings) and a 4-action bundle with partial failure isolation:
```bash
pharos-batch demo
```

**Scenario A: Optimal 3-Action Bundle**:
```text
================================================================================
              PHAROS SKILLENGINE: BATCH EXECUTOR OPTIMIZATION REPORT            
================================================================================
Batch ID:          batch-mvz3ldfs-cfh2
Timestamp:         2026-11-02T10:10:14.728Z
Network:           Pharos Mainnet (Chain ID: 1672)
Live Block:        #21923358
Strategy:          MULTICALL3_AGGREGATE3
Execution Mode:    FAULT_TOLERANT

--------------------------------------------------------------------------------
🎯 BATCH EXECUTION STATUS:
--------------------------------------------------------------------------------
🟢 [ALL_SUCCEEDED] — All 3/3 independent actions executed successfully in a single batch!

--------------------------------------------------------------------------------
📋 ACTION EXECUTION PIPELINE (Bundled Into 1 Transaction):
--------------------------------------------------------------------------------
#   | ACTION NAME                    | STATUS     | DETAILS / REVERT REASON
----+--------------------------------+------------+---------------------------------
0   | Chainlink Price Oracle Snapsho | 🟢 OK      | Success (0x00000000000000000000... [322 chars])
1   | USDC Circulating Liquidity     | 🟢 OK      | Success (0x00000000000000000000... [66 chars])
2   | USDC Token Metadata Verificati | 🟢 OK      | Success (0x00000000000000000000... [194 chars])
----+--------------------------------+------------+---------------------------------

--------------------------------------------------------------------------------
⚡ GAS ECONOMICS & BATCH OPTIMIZATION SAVINGS:
--------------------------------------------------------------------------------
EXECUTION MODE               | TRANSACTION STEPS    | ESTIMATED GAS
-----------------------------+----------------------+--------------------------
Individual Transactions      | 3 separate txs       | 128,118 gas
Batch Multicall3 Execution   | 1 atomic tx          | 81,326 gas
-----------------------------+----------------------+--------------------------
  👉 Net Gas Saved:        46,792 units (36.52% saved)
  👉 Step Count Reduction:  66.7% reduction (3 txs -> 1 tx)
  👉 Native PROS Saved:    0.00046792 PROS
  👉 USD Equivalent Saved:  ~$1.0684 USD (at $2,283.303/ETH)

--------------------------------------------------------------------------------
🚀 PREPARED BATCH TRANSACTION (Foundry Cast):
--------------------------------------------------------------------------------
  Target Contract: 0xcA11bde05977b3631167028862bE2a173976CA11 (Multicall3)
  Gas Limit Cap:   97,591
  👉 Foundry Cast Command:
     cast send 0xcA11bde05977b3631167028862bE2a173976CA11 --data "0x82ad56cb..." --rpc-url https://rpc.pharos.xyz
================================================================================
```

**Scenario B: 4-Action Bundle with Partial Failure Isolation**:
```text
================================================================================
              PHAROS SKILLENGINE: BATCH EXECUTOR OPTIMIZATION REPORT            
================================================================================
Batch ID:          batch-mvz3lgk7-dga6
Timestamp:         2026-11-02T10:10:18.775Z
Network:           Pharos Mainnet (Chain ID: 1672)
Live Block:        #21923358
Strategy:          MULTICALL3_AGGREGATE3
Execution Mode:    FAULT_TOLERANT

--------------------------------------------------------------------------------
🎯 BATCH EXECUTION STATUS:
--------------------------------------------------------------------------------
🟠 [PARTIAL_FAILURE_HANDLED] — 3/4 actions succeeded. Failing actions isolated via Multicall3.

--------------------------------------------------------------------------------
📋 ACTION EXECUTION PIPELINE (Bundled Into 1 Transaction):
--------------------------------------------------------------------------------
#   | ACTION NAME                    | STATUS     | DETAILS / REVERT REASON
----+--------------------------------+------------+---------------------------------
0   | Oracle Price Snapshot          | 🟢 OK      | Success (0x00000000000000000000... [322 chars])
1   | USDC Circulating Supply        | 🟢 OK      | Success (0x00000000000000000000... [66 chars])
2   | Reverting Contract Call (Injec | 🔴 FAIL    | Reverted with reason: "The year just became eeeveen woooorse :O but only for you :  )"
3   | USDC Decimals (Post-Failure Ex | 🟢 OK      | Success (0x00000000000000000000... [66 chars])
----+--------------------------------+------------+---------------------------------

--------------------------------------------------------------------------------
⚠️  PARTIAL FAILURE POST-MORTEM & FAULT ISOLATION:
--------------------------------------------------------------------------------
  Failing Step:    Action #2 ("Reverting Contract Call (Injected Failure)")
  Target Contract: 0x936564245b69f5a293b42cbd752e0ee3bb68b470
  Revert Reason:   Reverted with reason: "The year just became eeeveen woooorse :O but only for you :  )"
  Isolation Trace: Fault-tolerant isolation engaged: The remaining 1 action(s) continued and executed successfully without interruption.

--------------------------------------------------------------------------------
⚡ GAS ECONOMICS & BATCH OPTIMIZATION SAVINGS:
--------------------------------------------------------------------------------
EXECUTION MODE               | TRANSACTION STEPS    | ESTIMATED GAS
-----------------------------+----------------------+--------------------------
Individual Transactions      | 4 separate txs       | 172,205 gas
Batch Multicall3 Execution   | 1 atomic tx          | 90,543 gas
-----------------------------+----------------------+--------------------------
  👉 Net Gas Saved:        81,662 units (47.42% saved)
  👉 Step Count Reduction:  75.0% reduction (4 txs -> 1 tx)
  👉 Native PROS Saved:    0.00081662 PROS
  👉 USD Equivalent Saved:  ~$1.8646 USD (at $2,283.303/ETH)
================================================================================
```

---

### 2. Gas Optimization Benchmarks
```bash
pharos-batch compare
```

---

## Unit Testing & Verification

Run the dedicated test suite:
```bash
npx vitest run tasks/11-batch-executor
```

```text
 ✓ tasks/11-batch-executor/test/batch.test.ts (5 tests)
   ✓ Task 11: Batch Executor Engine & Optimization Matrix (5)
     ✓ Requirement 01: Accepts a list of at least 3 independent actions
     ✓ Requirement 02: Executes actions as a batch via Multicall3 in a single prepared transaction
     ✓ Requirement 03: Reports gas savings and step reduction compared with running individually
     ✓ Requirement 04: Handles partial failure clearly: documents which action failed and what happened to the rest
     ✓ Supports strict atomic failure mode when fault tolerance is disabled

 Test Files  1 passed (1)
      Tests  5 passed (5)
```
