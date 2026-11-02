---
name: pharos-gas-fee-optimizer
description: Temporal volatility and deadline decay transaction dispatcher for Pharos Mainnet that tracks gas prices over time, holds non-urgent transactions until gas dips or deadline is reached, reports economic savings vs request time, and guarantees zero-miss deadline execution.
---

# Pharos Trading / Monitoring: Gas Fee Optimizer Skill

## Overview
The **Pharos Gas Fee Optimizer** is an autonomous temporal volatility and deadline-decay transaction scheduling sentinel for **Pharos Mainnet (Chain ID 1672)**. It solves network fee inefficiencies by intercepting non-urgent blockchain transactions, modeling gas distributions, and timing their on-chain submission using an **Optimal Stopping Reservation Price Decay Curve**.

### Core Capabilities:
1. **Gas Price History & Percentile Statistics (Requirement 01)**:
   - Queries live network gas from Pharos Mainnet RPC (`eth_gasPrice`, block base fee).
   - Maintains a sliding chronological history buffer.
   - Computes parametric distributions: rolling average, min, max, standard deviation, directional trend, and statistical percentiles ($p_{10}, p_{25}, p_{50}, p_{75}, p_{90}$).
2. **Holding Mechanism with Reservation Price Decay (Requirement 02)**:
   - Holds pending transactions in an optimized queue rather than executing immediately at peak congestion.
   - Dynamically adjusts the acceptable gas ceiling as time approaches the deadline:
     $$G_{\text{target}}(t) = G_{\text{initial}} + (G_{\text{max}} - G_{\text{initial}}) \times \left(\frac{t - t_{\text{start}}}{\text{deadline} - t_{\text{start}}}\right)^\gamma$$
   - Dispatches transaction immediately when an opportunistic dip satisfies the curve.
3. **Comprehensive Economic Post-Mortem (Requirement 03)**:
   - Quantifies the delta between gas price at request time and actual executed gas price.
   - Computes net gas units, native PROS saved, percentage saved (>40%), and USD value saved using live on-chain Chainlink Price Oracles (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`).
4. **Guaranteed Zero-Miss Deadline SLA (Requirement 04)**:
   - Strict safety margin threshold enforces dispatch before deadline expiration.
   - If congestion persists, the transaction is forcefully submitted at the deadline regardless of elevated gas.

---

## Architecture Flow
```mermaid
sequenceDiagram
    autonumber
    actor User as Agent / Protocol Treasury
    participant Opt as Gas Fee Optimizer
    participant Oracle as Gas Tracker & Statistics
    participant Curve as Reservation Decay Curve
    participant Chainlink as Chainlink Oracle (0x1Ed3...1DB8)
    participant Chain as Pharos Mainnet RPC

    User->>Opt: submit(tx, deadline, strategy)
    Opt->>Oracle: Record initial gas price at request time (G_request)
    
    loop Monitoring & Holding Phase
        Opt->>Chain: Query block gasPrice & baseFee
        Chain-->>Opt: Current Gas Price (G_current)
        Opt->>Curve: Compute Reservation Price G_target(t)
        
        alt G_current <= G_target(t) [Opportunistic Dip]
            Opt->>Opt: Trigger OPPORTUNISTIC_DIP
        else t >= deadline - safetyMargin [Deadline SLA]
            Opt->>Opt: Trigger DEADLINE_FORCED (Force dispatch)
        else G_current > G_target(t)
            Opt->>Opt: HOLD (Wait in queue)
        end
    end

    Opt->>Chainlink: Query latestRoundData() for USD valuation
    Opt->>Opt: Generate Foundry cast command & Post-Mortem
    Opt-->>User: Execution Report (Gas Saved, Delta vs Request, Cast Command)
```

---

## When to Activate
Activate this skill when:
- An autonomous agent or protocol needs to execute non-urgent operations (token distributions, vault rebalancing, batch settlements, or contract maintenance).
- Network gas is currently elevated or volatile, and immediate execution is not mandatory.
- The user sets a deadline (e.g., within 5 minutes, 1 hour, or end of day) and wants to minimize fee spend without risking missing the deadline.
- Real-time gas market statistics and percentile distributions on Pharos Mainnet are requested.

---

## CLI Usage
```bash
# Run dual-outcome benchmark demonstration (Opportunistic Dip + Deadline Enforcement)
pharos-gas-opt demo

# Inspect live Pharos Mainnet gas history and percentile distributions
pharos-gas-opt history

# List available benchmark scenarios
pharos-gas-opt scenarios
```
