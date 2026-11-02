---
name: pharos-threshold-guardian
description: Autonomous multi-condition on-chain decision engine that evaluates live oracle prices, gas ceilings, liquidity depth, and feed staleness before gating sensitive smart contract execution.
---

# Pharos SkillEngine: Threshold Guardian Skill

## Overview
The **Pharos Threshold Guardian** is an enterprise-grade execution gate built on **Pharos SkillEngine**. It prevents automated agents, rebalancers, and arbitrage bots from executing transactions under dangerous or unviable market conditions.

Before triggering any on-chain action (e.g., liquidity rebalancing, collateral top-ups, arbitrage routing), the Threshold Guardian queries 4 independent live on-chain parameters from Pharos Mainnet (Chain ID 1672):
1. **Chainlink Oracle Spot Price** (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`): Verifies the asset price exceeds safety floors to prevent execution during flash crashes or depeg events.
2. **Oracle Observation Staleness**: Verifies the oracle round timestamp is recent, preventing execution against stale reports.
3. **Live Base Gas Price**: Queries `eth_gasPrice` to enforce economic gas ceilings (<= 2.0 Gwei).
4. **On-Chain Liquidity Depth**: Queries native USDC `totalSupply()` (`0xc879c018db60520f4355c26ed1a6d572cdac1815`) to ensure sufficient circulating pool depth before triggering high-value operations.

Every execution run produces an immutable, human-readable **Decision Trace Matrix** detailing observed values vs configurable thresholds, pass/fail status per condition, and the final decision (`FIRE_ACTION` or `HOLD_ACTION`).

---

## When to Activate
Activate this skill when:
- The user or workflow requires a pre-flight execution gate before submitting on-chain transactions.
- Automated DeFi bots need multi-condition safety checks (gas limits, price corridors, liquidity floors, oracle staleness).
- An audit trace is required proving why an autonomous action was executed or blocked.
- Configurable rulesets are needed to dynamically adapt to varying market regimes (`ALL_MATCH` vs `ANY_MATCH`).

---

## Architecture Flow
```mermaid
flowchart TD
    subgraph PharosNetwork["Pharos Mainnet (Chain ID 1672)"]
        RPC["Pharos JSON-RPC (https://rpc.pharos.xyz)"]
        Oracle["Chainlink Oracle: 0x1Ed3...1DB8"]
        USDC["Native USDC Token: 0xc879...1815"]
    end

    subgraph GuardianEngine["SkillEngine Threshold Guardian"]
        Reader["Chain Telemetry Reader"]
        Rules["Configurable Threshold Matrix"]
        Evaluator["Multi-Condition Logic Evaluator"]
        Tracer["Decision Trace & Formatter"]
    end

    subgraph DecisionOutcomes["Execution Gate Verdict"]
        Fire["🚀 FIRE_ACTION<br/>(Gate Unlocked + Calldata Prepared)"]
        Hold["🛑 HOLD_ACTION<br/>(Gate Locked + Violation Trace Logged)"]
    end

    RPC -->|eth_gasPrice, eth_blockNumber| Reader
    Oracle -->|latestRoundData()| Reader
    USDC -->|totalSupply()| Reader

    Reader -->|Observed Telemetry| Evaluator
    Rules -->|Configured Thresholds| Evaluator
    Evaluator --> Tracer

    Tracer -->|All Conditions Satisfied| Fire
    Tracer -->|One or More Conditions Violated| Hold
```

---

## CLI Usage

```bash
# Evaluate live on-chain metrics against guardian rules
pharos-guardian evaluate

# Run dual-outcome demonstration (shows both FIRE_ACTION and HOLD_ACTION)
pharos-guardian demo

# Inspect active configuration and ruleset
pharos-guardian config

# Evaluate with custom gas threshold override
pharos-guardian evaluate --gas-max 1.5

# Emit structured JSON output for downstream agent pipelines
pharos-guardian evaluate --json
```
