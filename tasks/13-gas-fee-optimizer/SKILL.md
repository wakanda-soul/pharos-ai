---
name: pharos-gas-fee-optimizer
description: Dynamic gas fee optimization engine for Pharos that schedules non-urgent transactions into low-cost fee windows using rolling market statistics and reservation price decay while strictly guaranteeing deadlines.
---

# Pharos Skill: Gas Fee Optimizer

## Purpose
The **Gas Fee Optimizer** times transaction broadcast to minimize gas expenditure for autonomous agents and treasury operations on Pharos. It holds non-urgent transactions in a prioritized queue, waiting for opportunistic fee dips while enforcing hard deadline commitments.

### Core Capabilities:
1. **Gas Price History & Statistical Profiling**:
   - Gathers block-by-block gas price and base fee snapshots from Pharos Mainnet.
   - Computes rolling percentiles ($p_{10}, p_{25}, p_{50}, p_{75}, p_{90}$), variance, and short-term trend momentum (`RISING`, `FALLING`, `STABLE`).
2. **Holding Mechanism with Reservation Decay**:
   - Holds transactions in a pending queue during congestion spikes.
   - Dynamically escalates acceptable gas prices as the deadline approaches to balance fee reduction with execution certainty.
3. **Financial Cost Delta & Savings Quantification**:
   - Reports exact gas prices at request time vs actual execution time.
   - Calculates Gwei saved, percentage reduction, native PROS saved, and USD savings via Chainlink (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`).
4. **Hard Deadline Enforcement (Zero-Miss SLA)**:
   - Evaluates a safety margin window before the deadline expires.
   - Automatically forces immediate dispatch under elevated gas if necessary to prevent deadline breaches.

---

## Quick Start & Usage

```bash
# Run scenario demo (favorable dip vs deadline forced)
pharos-gas-optimizer demo

# Check live network gas statistics
pharos-gas-optimizer live

# Run test suite
npx vitest run tasks/13-gas-fee-optimizer
```
