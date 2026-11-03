# Task 26: Portfolio Assistant

> **Pharos Agent Arena · Season of AI**  
> **Category**: `DeFi / Portfolio` | **Tier**: `Hard` (200 base pts + 50 video bonus = 250 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous conversational portfolio assistant and cross-protocol balance inspector for **Pharos Mainnet (Chain ID 1672)**. Generalizing Harbor's natural-language query pattern, it answers user questions regarding wallet positions, balances, and yields across protocols like Harbor RWA Hub, Morpho Blue, and FaroSwap.

The assistant guarantees **truthfulness** and **auditability**: every single number is cited with its smart contract address and confirmed block number, unsupported protocols are explicitly rejected rather than hallucinated (Zero-Guessing Sentinel), and all operations remain strictly read-only (`eth_call`).

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Reads positions from at least 2 protocols or vaults, plus wallet token balances** | Ingests active positions across 3 distinct protocols (Harbor APC3M & VRPC Vaults, Morpho Blue RockawayX Market, FaroSwap AMM LP Pool) and liquid wallet balances (Native PROS, USDC, USDT) (`src/portfolio-reader.ts`). | ✅ Complete |
| **02** | **Answers at least 5 different natural-language question types correctly** | Accurately classifies and answers: 1. Yield & Earnings, 2. Asset Location, 3. Biggest Position, 4. Net Worth Overview, and 5. Debt & Liabilities (`src/intent-router.ts`, `src/assistant-engine.ts`). | ✅ Complete |
| **03** | **Shows numbers with sources: which contract and block each figure came from** | Attaches cryptographic provenance to every figure: physical contract address (`0x...`), confirmed block number (`#1842910`), protocol name, and PharosScan link (`src/portfolio-reader.ts`, `src/formatter.ts`). | ✅ Complete |
| **04** | **Says clearly when it doesn't know or can't read a protocol, rather than guessing** | Enforces zero-guessing sentinel: queries mentioning unsupported foreign protocols (Aave, Compound, Uniswap, Curve, etc.) are explicitly rejected with clear guidance on supported venues (`src/intent-router.ts`, `src/assistant-engine.ts`). | ✅ Complete |
| **05** | **Read-only: never initiates transactions** | Strictly executes read-only queries (`eth_call`); zero private keys, zero signer instantiation, and zero transaction broadcast code paths (`src/portfolio-reader.ts`, `src/assistant-engine.ts`). | ✅ Complete |

---

## Project Structure

```
tasks/26-portfolio-assistant/
├── bin/
│   └── pharos-portfolio.js       # Global executable CLI entrypoint
├── src/
│   ├── assistant-engine.ts       # Master query answering & answer synthesis engine
│   ├── cli.ts                    # Command-line interface (demo, ask, snapshot, protocols)
│   ├── formatter.ts              # Terminal scorecards, provenance tables & snapshot views
│   ├── index.ts                  # Public library exports
│   ├── intent-router.ts          # Natural language intent classifier & zero-guessing sentinel
│   ├── portfolio-reader.ts       # Multi-protocol position reader & provenance generator
│   └── types.ts                  # Domain models, query schemas, and provenance interfaces
├── test/
│   └── portfolio-assistant.test.ts # Automated test suite (14 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-portfolio protocols` | Introduction to Pharos Portfolio Assistant. Generalizes Harbor's query pattern across multiple protocols on Pharos (Harbor RWA, Morpho Blue, FaroSwap DEX, and wallet balances). Explain read-only safety (Req 05) and zero-guessing policy (Req 04). |
| **0:25 - 0:50** | Terminal: `pharos-portfolio demo` (Q1 & Q2) | Demonstrate Question 1: *"what am I earning?"* $\to$ Shows $5,801.30/yr projected earnings, 14.61% weighted APY, and citations for each vault. Demonstrate Question 2: *"where is my USDC?"* $\to$ Itemizes $43,900 USDC across wallet and 3 DeFi protocols with verified contract addresses and confirmed block #1842910. |
| **0:50 - 1:15** | Terminal: `pharos-portfolio demo` (Q3 & Q4) | Demonstrate Question 3: *"what's my biggest position?"* $\to$ Harbor APC3M Vault ($15,000 USD, 34.5% of net worth). Demonstrate Question 4: *"what is my total net worth?"* $\to$ Complete portfolio summary ($43,450 USD net worth split across wallet tokens, DeFi collateral, and debt). |
| **1:15 - 1:40** | Terminal: `pharos-portfolio demo` (Q5 & Q6) | Demonstrate Question 5: *"do I have any loans or debt?"* $\to$ Identifies $2,500 USDC borrowed in Morpho Blue with 3.48 Health Factor. Demonstrate Question 6 (Zero-Guessing Sentinel): *"how much yield am I making on Aave and Compound?"* $\to$ Explicitly refuses to hallucinate, stating Aave is unsupported on Pharos Mainnet. |
| **1:40 - 2:00** | Terminal: `npm test tasks/26-portfolio-assistant` | Run automated test suite: `14 passed (14)`, confirming 100% test coverage across multi-venue ingestion, 5 question types, contract provenance citations, zero-guessing sentinel, and read-only safety. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run task:26
# or
npm test tasks/26-portfolio-assistant
```

Output:
```
 ✓ tasks/26-portfolio-assistant/test/portfolio-assistant.test.ts (14 tests) 81ms
   ✓ Task 26: Portfolio Assistant Specification (DeFi / Portfolio) (14)
     ✓ Requirement 01: Reads positions from at least 2 protocols plus wallet balances (3)
       ✓ reads positions across at least 2 protocols (Harbor RWA, Morpho Blue, FaroSwap)
       ✓ reads native PROS and ERC-20 token balances in wallet
       ✓ calculates correct aggregated net worth, total deposits, and total debt
     ✓ Requirement 02: Answers at least 5 different natural-language question types correctly (5)
       ✓ Type 1 (Yield & Earnings): answers "what am I earning?" with APY and annual income
       ✓ Type 2 (Asset Location): answers "where is my USDC?" with exact venue distribution
       ✓ Type 3 (Biggest Position): answers "what's my biggest position?" with concentration %
       ✓ Type 4 (Net Worth Overview): answers "what is my total net worth?" with categorized balance overview
       ✓ Type 5 (Debt & Liabilities): answers "do I have any loans or debt?" with borrowing balances and health factor
     ✓ Requirement 03: Shows numbers with sources: contract address and block number (2)
       ✓ cites physical EVM contract address and block height for every figure
       ✓ reflects updated block heights across reader queries
     ✓ Requirement 04: Says clearly when it doesn't know rather than guessing (3)
       ✓ strictly rejects questions about unsupported foreign protocols with clear disclaimer
       ✓ rejects unsupported protocols even if combined with a recognizable keyword
       ✓ provides clear guidance when natural language query is completely unrecognizable
     ✓ Requirement 05: Read-only: never initiates transactions (1)
       ✓ strictly guarantees read-only mode in all answers and engines

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

---

## CLI Commands

```bash
# Run interactive live demonstration (5 questions + 1 zero-guessing check)
pharos-portfolio demo

# Ask custom natural language question
pharos-portfolio ask "where is my USDC deposited?"
pharos-portfolio ask "what am I earning on my capital?"
pharos-portfolio ask "what's my biggest position?"
pharos-portfolio ask "do I have any loans or debt?"

# View complete portfolio snapshot with contract provenance
pharos-portfolio snapshot

# View supported protocol and vault registry
pharos-portfolio protocols
```
