# Task 09: Threshold Guardian

> **Pharos Agent Arena — SkillEngine Category (Medium Tier: 100 pts + 50 pts Video Walkthrough = 150 pts)**  
> **Challenge Slug**: `tasks/threshold-guardian`  
> **Target Network**: [Pharos Mainnet](https://scan.pharos.xyz) (Chain ID: `1672`, RPC: `https://rpc.pharos.xyz`)  
> **Engine**: **Pharos SkillEngine** Multi-Condition Decision Matrix

---

## Executive Summary

The **Threshold Guardian** is an autonomous safety gate and decision engine developed for **Pharos SkillEngine**. It evaluates multiple live on-chain conditions before permitting smart contract interaction or automated transaction execution.

In decentralized automated agents, single-condition triggers often lead to disastrous execution failure during market distress (e.g. trading during extreme gas spikes, rebalancing into depegged or manipulated oracle prices, or swapping against depleted AMM liquidity). The Threshold Guardian solves this by enforcing a **configurable multi-condition gate matrix**:
1. **Chainlink Oracle Asset Spot Price**: Asserts asset price meets minimum safety floors (preventing flash crash execution).
2. **Oracle Observation Staleness**: Asserts round update timestamp lag is within acceptable thresholds (preventing stale price attacks).
3. **Network Base Gas Price**: Queries `eth_gasPrice` to guarantee economic transaction feasibility.
4. **Circulating Liquidity Depth**: Asserts token circulating supply or pool depth meets minimum depth to safeguard against severe slippage.

Every evaluation produces a deterministic, transparent **Decision Trace**:
- Condition-by-condition comparison of observed on-chain values vs configured threshold targets.
- Clear pass/fail indicators per condition.
- Final gated verdict: `FIRE_ACTION` (gate unlocked, transaction payload generated) vs `HOLD_ACTION` (gate locked, specific blocking violations logged).

---

## Arena Requirements Compliance Matrix

| Requirement | Description | Implementation Details & Proof | Status |
| :--- | :--- | :--- | :---: |
| **01** | **Evaluates at least 3 independent conditions read from chain** | Reads 4 independent live metrics from Pharos Mainnet: (1) Chainlink Oracle Spot Price, (2) Oracle Observation Staleness, (3) Live Gas Price (Gwei), and (4) Native USDC Liquidity Depth. Tested in `test/guardian.test.ts`. | ✅ Compliant |
| **02** | **Conditions and thresholds are configurable, not hard-coded** | Supports dynamic rule reconfiguration via `configureRule()` and `setRules()`, custom rule arrays, operator customization (`>=`, `<=`, `>`, `<`, `==`, `BETWEEN`), and selectable gating logic (`ALL_MATCH` vs `ANY_MATCH`). Tested in `test/guardian.test.ts`. | ✅ Compliant |
| **03** | **Logs a clear decision trace each run** | Formats an ASCII matrix displaying Condition Name, Observed Value, Threshold Target, and Pass/Fail Status, followed by the final decision and blocking violations or prepared calldata. | ✅ Compliant |
| **04** | **Demonstrates both outcomes (FIRE and HOLD)** | Built-in CLI command `pharos-guardian demo` executes both scenarios in a single run: Scenario A where all conditions pass (`FIRE_ACTION`), and Scenario B where market stress triggers execution lock (`HOLD_ACTION`). Tested in `test/guardian.test.ts`. | ✅ Compliant |

---

## Architecture Flow

```mermaid
flowchart TD
    subgraph PharosNetwork["Pharos Mainnet (Chain ID: 1672)"]
        RPC["Pharos JSON-RPC (https://rpc.pharos.xyz)"]
        Oracle["Chainlink Aggregator Proxy (0x1Ed3...1DB8)"]
        USDC["Native USDC Token (0xc879...1815)"]
    end

    subgraph GuardianEngine["Threshold Guardian Engine (SkillEngine)"]
        Reader["GuardianChainReader<br/>Fetches 4 live on-chain metrics"]
        Config["GuardianConfig<br/>Configurable Rule Matrix (>=, <=, BETWEEN)"]
        Evaluator["Multi-Condition Evaluator<br/>Evaluates rules against telemetry"]
        TraceFormatter["GuardianFormatter<br/>Generates Decision Trace Matrix"]
    end

    subgraph Outcomes["Decision Gate Outcomes"]
        Fire["🚀 FIRE_ACTION<br/>• Gate Unlocked<br/>• Target Contract: 0xba3b...b68a<br/>• Ready-to-run Foundry cast command"]
        Hold["🛡️ HOLD_ACTION<br/>• Gate Locked<br/>• Detailed Blocking Violations Logged<br/>• Zero Calldata Prepared"]
    end

    RPC -->|eth_blockNumber, eth_gasPrice| Reader
    Oracle -->|latestRoundData()| Reader
    USDC -->|totalSupply()| Reader

    Reader -->|Live Telemetry| Evaluator
    Config -->|Configured Rules| Evaluator
    Evaluator --> TraceFormatter

    TraceFormatter -->|All Rules Satisfied| Fire
    TraceFormatter -->|One or More Rules Violated| Hold
```

---

## Live Contracts on Pharos Mainnet

The Threshold Guardian reads live on-chain parameters from official, verified Pharos Mainnet smart contracts:

| Protocol / Contract | Address | Read Method | Metric Extracted |
| :--- | :--- | :--- | :--- |
| **Pharos JSON-RPC** | `https://rpc.pharos.xyz` | `eth_gasPrice`, `eth_blockNumber` | Gas Price (Gwei) & Block Height |
| **Chainlink Price Oracle** | `0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8` | `latestRoundData()` | ETH/USD Spot Price & Observation Staleness Lag |
| **Native USDC Token** | `0xc879c018db60520f4355c26ed1a6d572cdac1815` | `totalSupply()` | Total Circulating Market Liquidity Depth |

---

## CLI Commands & Usage

The package exposes the `pharos-guardian` CLI (also available via `npm run guardian` or `npm run task:09`).

### 1. Live Evaluation
Evaluates live on-chain metrics against the active guardian ruleset:
```bash
pharos-guardian evaluate
```

**Live Output Example**:
```text
================================================================================
               PHAROS SKILLENGINE: THRESHOLD GUARDIAN DECISION TRACE            
================================================================================
Execution ID:      guard-mvyq5yzu-qhpz
Timestamp:         2026-11-02T03:54:21.162Z
Network:           Pharos Mainnet (Chain ID: 1672)
Live Block:        #21903022

--------------------------------------------------------------------------------
📋 MULTI-CONDITION EVALUATION MATRIX (Read Live From Chain):
--------------------------------------------------------------------------------
CONDITION NAME               | OBSERVED         | THRESHOLD          | STATUS
-----------------------------+------------------+--------------------+----------
Gas Price Ceiling            | 1 Gwei           | <= 2 Gwei          | 🟢 PASS
Oracle Asset Price Minimum   | 2,306.77 USD     | >= 2,000 USD       | 🟢 PASS
Minimum Market Liquidity     | 11,200,000 USDC  | >= 5,000,000 USDC  | 🟢 PASS
Oracle Data Freshness        | 100 seconds      | <= 86,400 seconds  | 🟢 PASS
-----------------------------+------------------+--------------------+----------
Summary: 4/4 conditions satisfied.

--------------------------------------------------------------------------------
⚖️  FINAL DECISION VERDICT:
--------------------------------------------------------------------------------
🎯 VERDICT: 🚀 [FIRE_ACTION] — ALL ON-CHAIN CONDITIONS MET
Execution gate unlocked: Action execution is economically and operationally safe.

Prepared Transaction:
  Action:          TRIGGER_REBALANCE_DEPOSIT
  Description:     Execute automated liquidity rebalance and supply transaction on Pharos DEX router
  Target Contract: 0xba3b00c3b0632b6fa622f990924976725227b68a
  Calldata:        0x6e553f6500000000000000000000000000000000000000000000000000000000000003e8
  👉 Foundry Cast Command:
     cast send 0xba3b00c3b0632b6fa622f990924976725227b68a "executeRebalance(uint256,address)" 1000 0x1000000000000000000000000000000000000001 --rpc-url https://rpc.pharos.xyz
================================================================================
```

---

### 2. Dual-Outcome Demonstration (`FIRE_ACTION` and `HOLD_ACTION`)
Runs both execution gate outcomes in sequence to prove safety enforcement:
```bash
pharos-guardian demo
```

**Scenario B Violation Output**:
```text
--------------------------------------------------------------------------------
📋 MULTI-CONDITION EVALUATION MATRIX (Read Live From Chain):
--------------------------------------------------------------------------------
CONDITION NAME               | OBSERVED         | THRESHOLD          | STATUS
-----------------------------+------------------+--------------------+----------
Gas Price Ceiling            | 12.5 Gwei        | <= 2 Gwei          | 🔴 FAIL
Oracle Asset Price Minimum   | 1,850 USD        | >= 2,000 USD       | 🔴 FAIL
Minimum Market Liquidity     | 8,500,000 USDC   | >= 5,000,000 USDC  | 🟢 PASS
Oracle Data Freshness        | 100 seconds      | <= 86,400 seconds  | 🟢 PASS
-----------------------------+------------------+--------------------+----------
Summary: 2/4 conditions satisfied.

--------------------------------------------------------------------------------
⚖️  FINAL DECISION VERDICT:
--------------------------------------------------------------------------------
🛡️  VERDICT: 🛑 [HOLD_ACTION] — EXECUTION BLOCKED BY GUARDIAN
Execution gate locked: One or more critical on-chain thresholds were violated.

Blocking Violations:
  ⚠️  Violation: Observed 12.5 Gwei failed requirement (<= 2 Gwei). Action blocked.
  ⚠️  Violation: Observed 1,850 USD failed requirement (>= 2,000 USD). Action blocked.
================================================================================
```

---

### 3. Inspecting Active Configuration
Displays the active rules, metrics, operators, thresholds, and target execution payload:
```bash
pharos-guardian config
```

---

## Unit Testing & Verification

The suite includes tests for each requirement:
```bash
npm run test tasks/09-threshold-guardian
```

```text
 ✓ tasks/09-threshold-guardian/test/guardian.test.ts (5 tests)
   ✓ Task 09: Threshold Guardian Engine & Decision Trace (5)
     ✓ Requirement 01: Evaluates at least 3 independent conditions read from chain
     ✓ Requirement 02: Conditions and thresholds are configurable, not hard-coded
     ✓ Requirement 03: Logs a clear decision trace each run: each condition value, pass/fail, and final decision
     ✓ Requirement 04: Demonstrates both outcomes: FIRE_ACTION and HOLD_ACTION
     ✓ Supports BETWEEN operator and custom range assertions

 Test Files  1 passed (1)
      Tests  5 passed (5)
```
