---
name: pharos-yield-optimizer
description: Autonomous cross-protocol yield surveillance and rebalancing skill for Pharos that compares live on-chain yields across >=3 vaults, calculates amortized switching friction (fees, gas, break-even days), and outputs non-custodial unsigned transactions.
---

# Pharos Skill: Yield Optimizer

## Purpose
The **Yield Optimizer** protects DeFi capital from unprofitable vault migrations on Pharos Mainnet. It compares live yields across at least 3 vaults, models an itemized switching friction waterfall (exit fees, entry fees, gas), amortizes costs against user holding horizons, outputs clear `REBALANCE_RECOMMENDED` or `STAY_PUT` advisories, and prepares non-custodial unsigned transactions.

### Core Capabilities:
1. **Multi-Venue Yield Surveillance**:
   - Concurrently monitors Harbor RWA vaults, Morpho Blue lending pools, and FaroSwap AMM liquidity.
2. **Itemized Friction Waterfall**:
   - Deducts exit fees, entry fees, and 3-step EVM gas execution costs.
3. **Holding Period Amortization & Break-Even Math**:
   - Calculates break-even days and enforces vault lockup tenors.
4. **Decisive Advisory Engine**:
   - Outputs `REBALANCE_RECOMMENDED` with dollar net gain and break-even timeline when profitable.
   - Outputs `STAY_PUT` with clear, plain-language reasoning when switching is not economically justified.
5. **Non-Custodial Unsigned Execution**:
   - Synthesizes 3-step unsigned transaction sequences (Withdraw $\to$ Approve $\to$ Deposit) with zero private key custody.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-yield demo

# Compare live yields
pharos-yield compare

# Run test suite
npx vitest run tasks/27-yield-optimizer
```
