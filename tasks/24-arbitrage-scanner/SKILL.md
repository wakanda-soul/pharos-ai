---
name: pharos-arbitrage-scanner
description: Autonomous multi-venue cross-DEX arbitrage scanner and net profit evaluation engine for Pharos Mainnet. Concurrently samples spot prices across FaroSwap AMMs, Chainlink oracles, and Harbor Lending protocol feeds, deducts itemized friction costs (protocol swap fees, dynamic price impact slippage, EVM network gas), gates execution via configurable hurdle thresholds, maintains an append-only scan audit journal, and generates simulation-safe calldata payloads.
---

# Pharos SkillEngine: Arbitrage Scanner Skill

## Overview
The **Pharos Arbitrage Scanner** is an autonomous market efficiency and yield discovery engine engineered for **Pharos Mainnet (Chain ID 1672)**. In fragmented decentralized finance ecosystems, price discrepancies naturally emerge between constant-product automated market makers (AMMs), lending oracle reference feeds, and liquidity hubs. However, naïve arbitrageurs often experience negative returns because they fail to account for the true friction cost waterfall—protocol swap fees, pool price impact slippage, and on-chain EVM gas expenses.

The Arbitrage Scanner solves this by concurrently sampling multiple liquidity venues, computing true net yields after deducting all friction layers, gating execution through a strict configurable hurdle threshold, maintaining an append-only scan audit journal, and preparing simulation-safe calldata payloads without risking real capital.

### Core Capabilities:
1. **Multi-Source Price Ingestion (Requirement 01)**:
   - Concurrently samples spot prices and pool reserves across at least 2 distinct venues in the same cycle:
     - **FaroSwap AMM (PROS/USDC)**: Constant-product reserve ratio ($x \cdot y = k$).
     - **Harbor Protocol Lending Oracle (PROS/USD)**: Overcollateralized lending valuation feed.
     - **Chainlink Reference Oracle**: Decentralized consensus benchmark feed.
   - Computes real-time gross price spread in basis points (bps) and percentage discrepancy.
2. **Itemized Friction Cost Waterfall (Requirement 02)**:
   - Deducts protocol swap fees across legs (0.30% buy venue + 0.05% sell venue).
   - Dynamically models price impact slippage based on pool liquidity depth ($\text{impact} = \frac{\text{tradeSize}}{2 \times \text{poolDepth}}$).
   - Accurately converts EVM transaction gas units ($\sim 285{,}000$ gas @ $1.2$ Gwei) to native token and USD expenses.
   - Calculates true **Net Arbitrage Profit**:
     $$\text{NetProfit} = \text{GrossDiscrepancy} - \text{ProtocolFees} - \text{PriceImpactSlippage} - \text{GasCost}$$
3. **Configurable Hurdle Gate & Transaction Synthesis (Requirement 03)**:
   - Configurable minimum net profit hurdle threshold (default: **$30.00 USD**).
   - Only triggers execution when $\text{NetProfit} \ge \text{Threshold}$; otherwise skips with an explicit human-readable rationale (e.g. friction consuming spread).
   - Synthesizes atomic multi-call routing calldata (`swapExactTokensForTokens` on FaroSwap Router) ready for dry-run simulation or execution.
4. **Append-Only Scan Audit Journal (Requirement 04)**:
   - Logs every scan cycle with timestamp, pair, venue quotes, gross spread, itemized friction, net yield, and final decision.
   - Supports tabular CLI formatting and structured JSON/Markdown exports.
5. **Simulation-Safe Execution (Requirement 05)**:
   - 100% simulated dry-run execution by default on Pharos Mainnet / Testnet (`zero-broadcast`).
   - Verifies route validity and balance deltas without risking real capital.

---

## Architecture Flow

```mermaid
flowchart TD
    A["Arbitrage Scanner Cycle Triggered\n(Capital: $10,000 USD, Target: PROS/USDC)"] --> B["Price Feed Reader\n(Concurrent Multi-Source Sampling)"]
    
    subgraph MultiSourceSampling ["Multi-Venue Price Sampling (Req 01)"]
        B --> V1["FaroSwap AMM Pool\n(Reserves: $1.4320 USD)"]
        B --> V2["Harbor Lending Oracle\n(Reference: $1.5020 USD)"]
        B --> V3["Chainlink Consensus Feed\n(Benchmark: $1.5000 USD)"]
    end

    V1 & V2 & V3 --> C["Pairwise Discrepancy Matrix\n(Gross Spread: +4.89% / +$488.83 USD)"]
    
    C --> D["Profit Calculator Waterfall (Req 02)"]
    
    subgraph FrictionWaterfall ["Itemized Friction Cost Waterfall"]
        D --> F1["Protocol Swap Fees: -$35.24 USD\n(0.30% buy + 0.05% sell)"]
        D --> F2["Dynamic Slippage Impact: -$33.30 USD\n(33.3 bps @ $1.5M pool depth)"]
        D --> F3["EVM Gas Expense: -$0.0005 USD\n(285,000 gas @ 1.2 Gwei)"]
    end

    F1 & F2 & F3 --> E["Net Profit Calculation\n(Net Yield: +$420.28 USD / +4.20%)"]

    E --> G{"Hurdle Evaluation Gate (Req 03)\nNetProfit >= $30.00 Threshold?"}
    
    G -->|Yes (+$420.28 >= $30.00)| H["Decision: EXECUTE_ARBITRAGE\nSynthesize FaroSwap Router Calldata"]
    G -->|No (Friction Consumes Spread)| I["Decision: SKIP_INSUFFICIENT_PROFIT\nRecord Detailed Justification"]
    G -->|Slippage Exceeds Max Ceiling| J["Decision: SKIP_INSUFFICIENT_LIQUIDITY\nPool depth too shallow for trade size"]

    H --> K["Append to Scan Audit Journal (Req 04)"]
    I --> K
    J --> K

    K --> L["Safe Simulation Dry-Run (Req 05)\n(Zero Broadcast, No Real Funds Risked)"]
```

---

## CLI Usage

```bash
# Run interactive live demonstration showing profitable + unprofitable scenarios
pharos-arbitrage demo
npm run arbitrage -- demo

# Perform a one-shot scan across active venues
pharos-arbitrage scan --pair PROS/USDC --capital 10000 --threshold 30

# Scan with custom liquidity depth and gas price
pharos-arbitrage scan --capital 25000 --threshold 50 --gas-price 2.5

# Inspect registered price feeds and liquidity venues
pharos-arbitrage venues
```
