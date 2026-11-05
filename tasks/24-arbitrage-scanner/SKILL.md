---
name: pharos-arbitrage-scanner
description: Multi-venue cross-DEX arbitrage scanner for Pharos that concurrently reads spot quotes, deducts itemized friction (fees, slippage, gas), gates execution via profit hurdles, and logs scan audit journals.
---

# Pharos Skill: Arbitrage Scanner

## Purpose
The **Arbitrage Scanner** identifies and validates cross-venue price discrepancies on Pharos Mainnet. It concurrently samples spot prices across AMMs and oracles, applies a full friction deduction waterfall (swap fees, price impact slippage, EVM gas), gates execution against a configurable profit hurdle, and maintains an append-only scan audit journal.

### Core Capabilities:
1. **Concurrent Multi-Venue Sampling**:
   - Concurrently queries FaroSwap AMM reserves, Harbor Lending Oracles, and Chainlink reference feeds.
2. **Itemized Friction Waterfall**:
   - Deducts protocol swap fees across buy and sell legs.
   - Calculates dynamic constant-product price impact slippage.
   - Accounts for EVM execution gas costs at prevailing market rates.
3. **Configurable Hurdle Decision Gate**:
   - Enforces minimum net profit threshold (default: $30.00 USD).
   - Generates atomic execution calldata when profitable; provides detailed plain-language skip rationales when unprofitable.
4. **Append-Only Scan Audit Journal**:
   - Records gross spreads, itemized deductions, net profits, and decisions for every scan cycle.
5. **Zero-Risk Simulation Safety**:
   - Operates in simulation mode by default without committing private keys or risking capital.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-arbitrage demo

# Inspect registered venues
pharos-arbitrage venues

# Run test suite
npx vitest run tasks/24-arbitrage-scanner
```
