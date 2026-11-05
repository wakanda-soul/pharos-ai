---
name: pharos-liquidation-watchdog
description: Autonomous DeFi liquidation risk watchdog for Pharos that monitors on-chain lending positions, calculates Health Factors, and broadcasts timestamped alerts with concrete remediation advice.
---

# Pharos Skill: Liquidation Watchdog

## Purpose
The **Liquidation Watchdog** protects DeFi borrowers on Pharos (Morpho Blue, Harbor Lending) from sudden liquidation. It monitors positions against live Chainlink price feeds, evaluates multi-tier risk thresholds, and issues actionable alerts with exact debt repayment and collateral top-up advice.

### Core Capabilities:
1. **On-Chain Position Reading**:
   - Queries collateral balances, debt obligations, and liquidation thresholds on Pharos Mainnet.
   - Evaluates real-time USD asset values using Chainlink Price Feeds (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`).
2. **Configurable Risk Thresholds**:
   - Classifies risk across `SAFE`, `WARNING` (default: 1.30), `CRITICAL` (default: 1.10), and `LIQUIDATION_IMMINENT` (< 1.0).
   - Supports custom institutional or high-volatility thresholds.
3. **Multi-Channel Alerting**:
   - Dispatches structured alerts with ISO-8601 timestamps to Console and Discord webhooks.
   - Preserves an in-memory audit ledger for governance and alerting history.
4. **Concrete Remediation Advice**:
   - Calculates exact dollar and token amounts required to restore position to target safe Health Factor (e.g., 1.50).
   - Advises exact USDC debt to repay or exact WPROS collateral to deposit.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-watchdog demo

# Inspect a live position
pharos-watchdog inspect 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Run test suite
npx vitest run tasks/18-liquidation-watchdog
```
