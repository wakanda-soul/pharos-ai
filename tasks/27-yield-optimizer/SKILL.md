---
name: pharos-yield-optimizer
description: Autonomous cross-protocol yield comparison, friction netting, and rebalancing optimizer skill for Pharos Mainnet. Compares >= 3 yield sources using live on-chain data, models a complete switching friction waterfall (exit fees, entry fees, EVM gas expenses), amortizes friction across holding period horizons, outputs clear net gain recommendations or 'stay put' rationale, and prepares 3-step unsigned calldata pipelines for user signature without ever holding private keys.
---

# Pharos SkillEngine: Yield Optimizer Skill

## Overview
The **Pharos Yield Optimizer** is an autonomous capital efficiency and rebalancing skill engineered for **Pharos Mainnet (Chain ID 1672)**. In decentralized finance, investors frequently chase higher nominal APYs without realizing that switching friction—withdrawal penalties, deposit fees, slippage, and on-chain EVM gas costs—can easily erase months of yield gains.

The Yield Optimizer solves this by concurrently comparing yields across verified on-chain venues (Harbor RWA vaults, Morpho Blue lending markets, FaroSwap liquidity pools), deducting an itemized friction waterfall, calculating the exact **break-even holding horizon**, and only recommending rebalancing when moving funds is genuinely profitable.

### Core Capabilities:
1. **Multi-Source Live Yield Comparison (Requirement 01)**:
   - Compares at least 3 yield sources on Pharos Mainnet using verified contract registries:
     - **Harbor APC3M Senior Commercial Paper**: Real-world asset vault (13.8% APY).
     - **Morpho Blue RockawayX-USDC**: Curated risk-isolated lending market (9.4% APY).
     - **Harbor VRPC Senior Secured Private Credit**: High-yield credit vault (16.5% APY).
     - **FaroSwap PROS/USDC LP**: Constant-product liquidity fee yield (22.4% APY).
2. **Itemized Friction & Holding Period Amortization (Requirement 02)**:
   - Full cost waterfall:
     - **Source Exit Fee**: Pro-rated exit/redemption fee from origin vault.
     - **Target Entry Fee**: Issuance/deposit fee into target vault.
     - **EVM Gas Expense**: 320,000 gas units modeled at live network base fee ($1.2\text{ Gwei}$).
   - Computes break-even holding period in days:
     $$\text{BreakEvenDays} = \left\lceil \frac{\text{TotalFriction}}{\text{Capital} \times \frac{\Delta\text{APY}}{100 \times 365}} \right\rceil$$
   - Enforces lockup tenor compatibility (e.g. 30-day lockup in VRPC).
3. **Decisive Recommendation Engine (Requirement 03)**:
   - Outputs `REBALANCE_RECOMMENDED` with expected net dollar gain and annualized net ROI when net profit exceeds the configured hurdle ($25.00 default).
   - Outputs `STAY_PUT` with an explicit plain-language rationale when friction consumes the return or holding horizon is too brief.
4. **Non-Custodial Unsigned Calldata Pipeline (Requirement 04)**:
   - Strictly non-custodial: the agent **never holds or accesses private keys**.
   - Synthesizes 3 sequential unsigned transactions ready for user signature:
     - **Step 1**: Withdraw assets from source vault (`withdraw(uint256,address,address)`).
     - **Step 2**: Approve underlying token for target vault (`approve(address,uint256)`).
     - **Step 3**: Supply assets into target vault (`deposit(uint256,address)`).
   - Provides ready-to-run Foundry `cast send` commands with chain ID 1672 and RPC parameters.

---

## Architecture Flow

```mermaid
flowchart TD
    A["Yield Optimizer Triggered\n(Input: $10,000 USD, Horizon: 90 Days)"] --> B["YieldVenueReader\n(Concurrent Multi-Source Ingestion)"]

    subgraph MultiSourceSampling ["Live Yield Comparison (Req 01)"]
        B --> V1["Harbor APC3M Vault\n(13.8% APY, 10 bps fee)"]
        B --> V2["Morpho Blue Market\n(9.4% APY, 0 bps fee)"]
        B --> V3["Harbor VRPC Vault\n(16.5% APY, 15 bps fee)"]
        B --> V4["FaroSwap DEX LP\n(22.4% APY, 25 bps fee)"]
    end

    V1 & V2 & V3 & V4 --> C["Pairwise Gross APY Spread Matrix\n(Target APY - Source APY = +7.1%)"]

    C --> D["SwitchingFrictionCalculator (Req 02)"]

    subgraph FrictionWaterfall ["Itemized Friction Cost Waterfall"]
        D --> F1["Source Exit Fee: $0.00 USD"]
        D --> F2["Target Entry Fee: -$15.00 USD (0.15%)"]
        D --> F3["EVM Gas Expense: -$0.0006 USD (320k gas)"]
    end

    F1 & F2 & F3 --> E["Calculate Net Return & Break-Even Days\n(Net Gain: +$160.07 USD, Break-Even: 8 Days)"]

    E --> G{"Hurdle & Horizon Gate (Req 03)\nNetGain >= $25 & Horizon >= BreakEven?"}

    G -->|Yes (+$160.07 >= $25)| H["Decision: REBALANCE_RECOMMENDED\nGenerate 3-Step Execution Pipeline"]
    G -->|No (Friction Consumes Spread)| I["Decision: STAY_PUT\nEmit Detailed Plain-Language Rationale"]

    H --> J["Synthesize Unsigned Calldata (Req 04)\n(Withdraw ➔ Approve ➔ Deposit)\nAgent Never Holds Keys"]
```

---

## CLI Usage

```bash
# Run interactive live demonstration (Rebalance Recommended vs Stay Put)
pharos-yield demo
npm run yield -- demo

# Compare live yields across all monitored Pharos venues
pharos-yield compare

# Evaluate custom migration pair
pharos-yield rebalance --from morpho:rockawayx-usdc --to harbor:vrpc --capital 15000 --days 90

# Automatically find optimal rebalance across all candidate vaults
pharos-yield optimize --from morpho:rockawayx-usdc --capital 25000 --days 180
```
