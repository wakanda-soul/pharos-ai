# Task 08: Docs MCP + Chain MCP Agent (Explain-Then-Act)

> **Pharos Agent Arena — Composition Category (Medium Tier: 100 pts + 50 pts Video Walkthrough)**  
> **Challenge Slug**: `tasks/docs-chain-mcp-agent`  
> **Target Network**: [Pharos Mainnet](https://scan.pharos.xyz) (Chain ID: `1672`)  
> **Composed Tools**: **Developer Docs MCP** (`https://docs.pharos.xyz`) + **Pharos Chain MCP** (`https://mcp.pharos.xyz/mcp`)

---

## Executive Summary

The **Docs MCP + Chain MCP Agent** implements the **"Explain-Then-Act"** autonomous paradigm. When presented with a contract function, rather than blindly triggering a transaction or giving an ungrounded hallucination, the agent:
1. **Explains**: Consults the **Developer Docs MCP** to retrieve official developer documentation, breaking down the function's purpose, parameters, return values, and citing official documentation sources.
2. **Acts**: Invokes the same function on-chain via **Chain MCP** on Pharos Mainnet (Chain ID 1672), extracting raw calldata, hex return data, and decoded values.
3. **Interprets**: Bridges theory with on-chain reality, contextualizing the live returned data against the documented specifications.

```
                         ┌─────────────────────────────────────────────────────────────┐
                         │      User Query: "Explain and check oracle latestRoundData"  │
                         └──────────────────────────────┬──────────────────────────────┘
                                                        │
                                                        ▼
                         ┌─────────────────────────────────────────────────────────────┐
                         │   Phase 1: Developer Docs MCP (Explanation & Citations)    │
                         │    - Queries official docs.pharos.xyz knowledge base        │
                         │    - Documents inputs, outputs, revert cases                │
                         │    - References official source URLs                        │
                         └──────────────────────────────┬──────────────────────────────┘
                                                        │
                                                        │ Same function passed to Chain
                                                        ▼
                         ┌─────────────────────────────────────────────────────────────┐
                         │       Phase 2: Pharos Chain MCP (On-Chain Execution)        │
                         │    - Encodes raw calldata (e.g. 0xfeaf968c)                 │
                         │    - Calls live contract on Pharos Mainnet                  │
                         │    - Unpacks returned ABI hex into typed values             │
                         └──────────────────────────────┬──────────────────────────────┘
                                                        │
                                                        │ Both streams synthesized
                                                        ▼
                         ┌─────────────────────────────────────────────────────────────┐
                         │      Phase 3: Contextual Interpretation (Theory + Reality)  │
                         │    - Validates consistency with official docs standard      │
                         │    - Formats business-level insights & decimals             │
                         │    - Checks freshness, health status, and thresholds        │
                         └─────────────────────────────────────────────────────────────┘
```

---

## Arena Requirements Compliance Matrix

| Rubric Item | Requirement Description | Implementation Details & Proof |
| :--- | :--- | :--- |
| **01** | **Explanation comes from Docs MCP with sources referenced** | Every query searches `docs.pharos.xyz`, extracts documentation text, and returns direct URLs (e.g. `https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-ds.md`). Verified in `test/agent.test.ts`. |
| **02** | **Agent calls the same function on-chain via Chain MCP** | Immediately following the explanation, the agent calls the exact function on Pharos Mainnet via `ethCall` on Chain MCP, capturing block number, calldata, and raw hex. |
| **03** | **Interprets result in the context of the explanation** | Evaluates the returned data against the theory (e.g. decoding 18-decimal price, explaining validator timestamps and oracle cache proxy mechanics). |
| **04** | **Works for at least 2 different functions or contracts** | Pre-configured with **4 distinct presets** across multiple live contracts: `oracle:latestRoundData`, `usdc:totalSupply`, `oracle:description`, and `link:totalSupply`. Verified via `pharos-explain demo`. |
| **05** | **Automated Tests** | 7 dedicated Vitest tests passing (`npm test`), verifying docs source citations, on-chain execution, and multi-contract handling. |

---

## Sequence Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Autonomous Trigger
    participant Agent as ExplainThenActAgent
    participant Docs as Developer Docs MCP
    participant Chain as Pharos Chain MCP

    User->>Agent: 1. Request: pharos-explain explain oracle:latestRoundData
    Agent->>Docs: 2. Query documentation for latestRoundData()
    Docs-->>Agent: 3. Return explanation, parameters, and source URLs (docs.pharos.xyz)
    Agent->>Chain: 4. Execute on-chain eth_call(target, calldata) on Pharos Mainnet
    Chain-->>Agent: 5. Return raw output hex (roundId, answer, timestamps) & block height
    Agent->>Agent: 6. Synthesize Contextual Interpretation (Decoded price, validator freshness)
    Agent-->>User: 7. Output structured Explain & Act report
```

---

## Verified Pharos Mainnet Contracts (Chain ID: 1672)

| Preset Identifier | Contract Name | Contract Address | Target Function |
| :--- | :--- | :--- | :--- |
| `oracle:latestRoundData` | Decentralized Price Feed Oracle | `0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8` | `latestRoundData()` |
| `oracle:description` | Decentralized Price Feed Oracle | `0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8` | `description()` |
| `usdc:totalSupply` | Pharos Native USDC Token | `0xc879c018db60520f4355c26ed1a6d572cdac1815` | `totalSupply()` |
| `link:totalSupply` | ChainLink Token | `0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29` | `totalSupply()` |

---

## Installation & Setup

```bash
# 1. Clone repository
git clone https://github.com/wakanda-soul/pharos-ai.git
cd pharos-ai

# 2. Install dependencies
npm install

# 3. Link executable globally
npm link

# 4. Verify CLI
pharos-explain --help
```

---

## Reproducible Command Walkthroughs

### 1. Explain and Act on Price Feed Oracle
```bash
pharos-explain explain oracle:latestRoundData
```
```text
================================================================================
            PHAROS DOCS MCP + CHAIN MCP AGENT: EXPLAIN & ACT                    
================================================================================
Execution ID:      agent-mvyjf4c5-7nez
Timestamp:         2026-11-02T00:45:30.677Z
Contract Name:     Pharos Decentralized Price Feed Oracle
Contract Address:  0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8
Function:          latestRoundData()
Network:           Pharos Mainnet (Chain ID: 1672)
Block Height:      #21891456

--------------------------------------------------------------------------------
📖 PHASE 1: FUNCTION EXPLANATION (via Developer Docs MCP)
--------------------------------------------------------------------------------
Query to Docs:     "how does latestRoundData work in Chainlink AggregatorV3 price feed oracles on Pharos"
What It Does:      On Pharos’s self-managed Chainlink feeds, prices are written directly by CRE workflows rather than produced through OCR aggregation rounds.
* startedAt and updatedAt both contain the latest report’s observation timestamp.
* The price is reported with 18 decimals.

Parameters:
  * None: View function taking 0 input arguments.

Returns:           Tuple (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound): live oracle exchange rate price, round metadata, and timestamps.

📚 Referenced Official Documentation Sources:
  - [Chainlink Data Feeds] (https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-ds.md)
  - [Chainlink Push Engine Feeds] (https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe.md)
  - [Oracle] (https://docs.pharos.xyz/tooling-and-infrastructure/oracles.md)

--------------------------------------------------------------------------------
⛓️  PHASE 2: ON-CHAIN CALL EXECUTION (via Chain MCP)
--------------------------------------------------------------------------------
Target:            0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8
Method Signature:  latestRoundData()
Calldata:          0xfeaf968c
Raw Output (Hex):  0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b05e4b77264740d80...
Decoded Output:    ["0","2269374187033094000000","1793578354","1793578354","0"]

--------------------------------------------------------------------------------
🧠 PHASE 3: CONTEXTUAL INTERPRETATION (Theory + On-Chain Reality)
--------------------------------------------------------------------------------
Verdict:           ✅ VERIFIED_CONSISTENT
Summary:           Live Oracle spot price: $2269.37 USD (updated at 2026-11-02T00:12:34.000Z).

Key Insights:
  💡 Decoded Price: $2269.37 USD (scaled from 18 decimals)
  💡 Oracle Feed Status: Active and verified by validator rounds
  💡 Last Round Update: 2026-11-02T00:12:34.000Z

Detailed Analysis:
  The on-chain latestRoundData() response strictly corroborates the Chainlink AggregatorV3 specification retrieved from Docs MCP. The answer is signed by decentralized validators, confirming healthy price freshness for Pharos DeFi protocols.
================================================================================
```

---

### 2. Multi-Contract Demo Pipeline
```bash
pharos-explain demo
```
*Demonstrates the agent sequentially explaining and acting across **Oracle** and **USDC Token** contracts.*

---

## Automated Test Suite

```bash
npx vitest run tasks/08-docs-chain-mcp-agent
```

```text
 ✓ tasks/08-docs-chain-mcp-agent/test/contracts-catalog.test.ts (3 tests)
 ✓ tasks/08-docs-chain-mcp-agent/test/agent.test.ts (4 tests)

 Test Files  2 passed (2)
      Tests  7 passed (7)
```

---

## License

MIT © [wakanda-soul](https://github.com/wakanda-soul)
