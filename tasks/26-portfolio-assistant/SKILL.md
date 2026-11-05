---
name: pharos-portfolio-assistant
description: Conversational portfolio assistant for Pharos that reads multi-protocol positions and wallet balances via read-only queries, answers 5 natural-language question types with contract provenance, and enforces zero-guessing sentinels.
---

# Pharos Skill: Portfolio Assistant

## Purpose
The **Portfolio Assistant** answers natural-language questions regarding a wallet's cross-protocol positions, balances, and yields on Pharos Mainnet (Harbor RWA Hub, Morpho Blue, and FaroSwap). It guarantees truthfulness by citing contract addresses and block numbers for every figure, rejecting unsupported protocols, and maintaining strict read-only execution.

### Core Capabilities:
1. **Multi-Protocol Position Aggregation**:
   - Queries Harbor RWA vaults, Morpho Blue lending pools, FaroSwap AMM liquidity, and native/ERC-20 wallet tokens.
2. **5 Natural-Language Question Types**:
   - Yield & Earnings (*"what am I earning?"*).
   - Asset Location (*"where is my USDC?"*).
   - Biggest Position (*"what's my biggest position?"*).
   - Net Worth Overview (*"what is my total net worth?"*).
   - Debt & Liabilities (*"do I have any loans or debt?"*).
3. **Cryptographic Provenance**:
   - Every numerical value cites its exact smart contract address and confirmed block number.
4. **Zero-Guessing Sentinel**:
   - Rejects queries regarding unsupported foreign protocols (e.g. Aave, Compound) without hallucinating.
5. **Read-Only Safety**:
   - Exclusively executes read-only `eth_call` queries; never initiates transactions.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-portfolio demo

# Ask a portfolio question
pharos-portfolio ask "what am I earning?" --wallet 0x6119871b4eb66db137dcfad59655853ea6fe58ce

# Run test suite
npx vitest run tasks/26-portfolio-assistant
```
