---
name: pharos-portfolio-assistant
description: Autonomous natural-language portfolio assistant and cross-protocol balance query skill for Pharos Mainnet. Ingests positions and yields across Harbor RWA vaults, Morpho Blue lending markets, FaroSwap AMM liquidity pools, and personal wallet tokens. Accurately classifies and answers 5 distinct financial query types, attaches verified contract addresses and confirmed block numbers to every figure, strictly enforces a zero-guessing policy for unknown or foreign protocols, and guarantees 100% read-only safety.
---

# Pharos SkillEngine: Portfolio Assistant Skill

## Overview
The **Pharos Portfolio Assistant** is an autonomous conversational DeFi inspection and portfolio surveillance skill engineered for **Pharos Mainnet (Chain ID 1672)**. It generalizes Harbor's query pattern across multiple decentralized protocols, enabling users and autonomous agents to ask free-text questions about positions, balances, and yields without needing to navigate complex disjoint contract interfaces.

The assistant prioritizes **cryptographic provenance** and **truthfulness**: every single number is cited with its underlying smart contract address and confirmed block number, unsupported protocols are explicitly rejected rather than hallucinated (Zero-Guessing Sentinel), and execution is guaranteed to remain strictly read-only (`eth_call`).

### Core Capabilities:
1. **Multi-Protocol & Multi-Asset Aggregation (Requirement 01)**:
   - Concurrently monitors positions across at least 3 major Pharos protocols:
     - **Harbor Protocol**: Senior RWA Commercial Paper (APC3M @ 13.8% APY) & Private Credit (VRPC @ 16.5% APY).
     - **Morpho Blue**: Curated RockawayX-USDC Lending & Collateralized Borrowing (9.4% Supply APY).
     - **FaroSwap AMM**: PROS/USDC Concentrated Liquidity Pools (22.4% LP Fee APY).
   - Ingests liquid personal wallet balances (Native PROS, USDC, USDT).
2. **Natural-Language Intent Routing (Requirement 02)**:
   - Answers at least 5 distinct financial inquiry categories:
     1. **Yield & Earnings**: *"what am I earning?"*, *"what is my annual return?"* $\to$ Itemizes annual earnings ($/yr) and portfolio-weighted APY.
     2. **Asset Location & Distribution**: *"where is my USDC?"* $\to$ Maps token distribution between wallet and DeFi vaults.
     3. **Exposure & Concentration**: *"what's my biggest position?"* $\to$ Pinpoints highest allocation and portfolio concentration percentage.
     4. **Net Worth & Balance Overview**: *"what's my total net worth?"* $\to$ Produces a categorized equity balance breakdown.
     5. **Debt & Liabilities**: *"do I have any loans or debt?"* $\to$ Summarizes active borrowing balances, collateralization, and Health Factor.
3. **Cryptographic Contract Provenance (Requirement 03)**:
   - Every single reported figure cites its verified smart contract address (`0x...`), confirmed block number (`#1842910`), and direct explorer link on PharosScan.
4. **Zero-Guessing Sentinel (Requirement 04)**:
   - Strictly refuses to guess or fabricate on-chain balances.
   - If queried about an unsupported protocol (e.g. Aave, Compound, Uniswap), explicitly replies that the protocol is unverified or unsupported on Pharos, naming verified venues.
5. **Read-Only Safety Guarantee (Requirement 05)**:
   - Exclusively performs read-only view queries (`eth_call`).
   - Zero private keys, zero transaction signing, and zero broadcast capabilities.

---

## Architecture Flow

```mermaid
flowchart TD
    A["User Prompt\n(e.g., 'where is my USDC deposited?')"] --> B["PortfolioIntentRouter\n(Natural Language Intent Classifier)"]

    B -->|Check Unsupported Protocols| C{"Contains Foreign Protocol?\n(Aave, Compound, Uniswap)"}
    C -->|Yes| D["UNKNOWN_OR_UNSUPPORTED\n(Zero-Guessing Sentinel Rejection)"]
    C -->|No| E["Classified Intent:\n(YIELD | LOCATION | CONCENTRATION | NET_WORTH | DEBT)"]

    E --> F["PortfolioReader\n(Concurrent Read-Only View Queries)"]
    
    subgraph MultiProtocolSampling ["On-Chain State Ingestion (Req 01 & 05)"]
        F --> V1["Harbor RWA Vaults\n(APC3M & VRPC Contracts)"]
        F --> V2["Morpho Blue Market\n(RockawayX-USDC Lending & Debt)"]
        F --> V3["FaroSwap DEX\n(PROS/USDC Pool Contract)"]
        F --> V4["Wallet State\n(Native PROS + ERC-20 Balances)"]
    end

    V1 & V2 & V3 & V4 --> G["Pin Confirmed Block Height #1842910\n(Attach Cryptographic Provenance)"]
    
    G --> H["PortfolioAssistantEngine\n(Answer Synthesis & Math Aggregation)"]
    
    H --> I["Formatted Answer Card with Provenance Citations (Req 03)"]
```

---

## CLI Usage

```bash
# Run interactive live demonstration (5 Question Types + Zero-Guessing Sentinel)
pharos-portfolio demo
npm run portfolio -- demo

# Ask any natural language question about your wallet
pharos-portfolio ask "where is my USDC?"
pharos-portfolio ask "what am I earning on my capital?"
pharos-portfolio ask "what is my biggest position?"
pharos-portfolio ask "do I have any loans or debt?"

# View full categorized balance breakdown with contract addresses and block numbers
pharos-portfolio snapshot

# List monitored contracts and verified vault addresses on Pharos
pharos-portfolio protocols
```
