---
name: pharos-skill-chain-mcp-flow
description: Autonomous composed agent flow combining Pharos Chain MCP and SkillEngine policy rules into a unified end-to-end treasury sentinel and rebalancer.
---

# Pharos Skill + Chain MCP Flow Skill

## Overview
This skill implements a tightly composed agent workflow where **Pharos Chain MCP** and a **SkillEngine Policy Guardian** work in tandem:
1. **Chain MCP** queries real-time on-chain state (block height, native PROS balances, ERC-20 USDC balances, and gas conditions).
2. The raw telemetry is fed directly into **SkillEngine**, which computes allocation drift against risk-weighted target ratios.
3. The flow synthesizes executable calldata and Foundry `cast` commands for automated AMM rebalancing on FaroSwap.

## When to Activate
Activate this skill when:
- The user asks to audit, monitor, or rebalance a treasury, portfolio, or liquidity position on Pharos.
- Real-time on-chain balances must drive dynamic hedging or reserve protection decisions.
- Demonstrating tool composition (output of tool A feeding input of tool B).

## Architecture
```mermaid
sequenceDiagram
    autonumber
    actor User as User / Autonomous Trigger
    participant Flow as Flow Orchestrator
    participant MCP as Pharos Chain MCP
    participant Skill as SkillEngine Guardian Policy
    participant Engine as Action Synthesizer

    User->>Flow: 1. Request: Check treasury risk & rebalance policy
    Flow->>MCP: 2. Query live on-chain state (USDC balance, PROS balance, Gas, Block)
    MCP-->>Flow: 3. Returns live blockchain telemetry
    Flow->>Skill: 4. Ingests live data into SkillEngine Policy Rule
    Note over Skill: Evaluates drift %, minimum reserve threshold, and volatility penalty
    Skill-->>Flow: 5. Emits Decision Matrix (ActionNeeded, Amount, RiskVerdict, Reason)
    Flow->>Engine: 6. Formats Foundry cast send calldata based on Skill's decision
    Engine-->>User: 7. End-to-end report + ready-to-sign transaction
```

## CLI Usage
```bash
# Run flow on treasury address
pharos-flow run --treasury 0xa0c048d1afb32de4e4b8756a55e22fde5c74e932 --target 60:40

# Run live demo
pharos-flow demo

# Print architectural diagram
pharos-flow diagram
```
