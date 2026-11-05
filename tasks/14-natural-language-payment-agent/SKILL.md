---
name: pharos-natural-language-payment-agent
description: Natural-language payment preparation agent for Pharos that translates informal user prompts into validated, unsigned on-chain transaction payloads with ambiguity clarification and pre-flight summaries.
---

# Pharos Skill: Natural-Language Payment Agent

## Purpose
The **Natural-Language Payment Agent** safely parses and validates informal payment instructions (e.g. *"send 100 USDC to alice.pharos"*), performing on-chain validation and generating unsigned transactions for human wallet authorization.

### Core Capabilities:
1. **Free-Text Intent Parsing & Ambiguity Handling**:
   - Extracts amount, token symbol, and recipient addresses or domain names.
   - If any parameter is missing or ambiguous, halts and presents a structured follow-up clarification question with suggested options.
2. **On-Chain Pre-Flight Validation**:
   - Validates 20-byte address formats and resolves PNS/ENS domain handles.
   - Verifies smart contract bytecode on Pharos Mainnet for ERC-20 tokens.
   - Checks sender solvency and verifies native PROS headroom for network gas fees.
3. **Pre-Flight Human-Readable Summary**:
   - Presents full breakdown of sender, recipient, asset amounts, live USD valuations via Chainlink (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`), estimated gas fees, and projected post-transfer balances.
4. **Non-Custodial Unsigned Output**:
   - Strictly outputs an unsigned EIP-1193 transaction payload and a Foundry `cast send` reproduction command.
   - Holds zero private keys and never attempts autonomous transaction signing.

---

## Quick Start & Usage

```bash
# Run demonstration scenarios
pharos-payment-agent demo

# Test an informal payment instruction
pharos-payment-agent parse "send 50 USDC to bob.pharos"

# Run Vitest test suite
npx vitest run tasks/14-natural-language-payment-agent
```
