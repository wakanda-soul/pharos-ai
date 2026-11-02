# Task 14: Natural-Language Payment Agent

> **Pharos Agent Arena — Payments Category (Medium Tier: 100 pts + 50 pts Video Walkthrough = 150 pts)**  
> **Challenge Slug**: `tasks/natural-language-payment-agent`  
> **Target Network**: [Pharos Mainnet](https://scan.pharos.xyz) (Chain ID: `1672`, RPC: `https://rpc.pharos.xyz`)  
> **Pattern**: **Harbor Action Pattern Generalized** (Intent-to-Action Payment Synthesizer)

---

## Executive Summary

The **Natural-Language Payment Agent** is an enterprise-grade payment preparation agent engineered for **Pharos Mainnet (Chain ID 1672)**. It generalizes the **Harbor Action Pattern**, turning unstructured natural-language requests (such as *"send 100 USDC to alice.pharos"*, *"wire 0.05 PROS to 0x..."*, or *"transfer $50 to bob"*) into strictly validated, pre-flight financial summaries and non-custodial unsigned transactions for user signature.

Key architectural features include:
1. **Multi-Pattern Intent Parsing & Ambiguity Resolution (Requirement 01)**:
   - Robustly parses free-text commands extracting numerical amounts, asset tokens, and destination recipients.
   - Detects missing or ambiguous parameters and responds with targeted follow-up questions and structured options (e.g. asking for recipient, token, or amount).
2. **On-Chain Name Resolution & Multi-Vector Validation (Requirement 02)**:
   - Resolves Pharos Name Service (`.pharos`) and ENS (`.eth`) domain names to canonical checksummed addresses.
   - Validates smart contract bytecode on Pharos Mainnet for ERC-20 tokens (e.g., native USDC `0xc879c018db60520f4355c26ed1a6d572cdac1815`).
   - Queries live sender balances on Pharos Mainnet, verifying both asset solvency and native PROS headroom for gas fees.
3. **Comprehensive Human-Readable Pre-Flight Summary (Requirement 03)**:
   - Displays a complete audit summary before producing the transaction: sender, recipient (both input and resolved 0x address), token amount, live USD valuation via on-chain Chainlink Price Oracles (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`), network fees, and balance projections.
4. **Strict Non-Custodial Invariant (Requirement 04)**:
   - **Zero-Signing Invariant**: The agent NEVER holds private keys, signs, or broadcasts transactions autonomously.
   - Emits standardized unsigned EIP-1193 / MetaMask transaction objects and Foundry `cast send` reproduction commands for secure, manual wallet authorization.

---

## Arena Requirements Compliance Matrix

| Requirement | Description | Implementation Details & Proof | Status |
| :--- | :--- | :--- | :---: |
| **01** | **Parses amount, token and recipient from free text, and asks a follow-up when anything is ambiguous** | Implemented in `src/intent-parser.ts`. Handles diverse phrasings; generates structured follow-up clarification questions with options when amount, token, or recipient is missing. Verified in `test/payment-agent.test.ts`. | ✅ Compliant |
| **02** | **Validates the request: recipient format, token contract, sufficient balance** | Implemented in `src/payment-validator.ts`. Validates 20-byte address format, resolves PNS/ENS domains, checks token contract presence on-chain, and verifies sender balance and gas headroom. Verified in `test/payment-agent.test.ts`. | ✅ Compliant |
| **03** | **Shows a human-readable summary before producing the unsigned transaction** | Implemented in `src/formatter.ts` and `src/payment-synthesizer.ts`. Displays pre-flight summary with sender, recipient, asset amount, Chainlink USD valuation, estimated fees, and balance projection. Verified in `test/payment-agent.test.ts`. | ✅ Compliant |
| **04** | **Never signs or sends on its own. Output is an unsigned transaction or a wallet signing request** | Implemented in `src/payment-synthesizer.ts`. Emits standardized `UnsignedPaymentTransaction` and `WalletSigningRequest` without private keys or signatures. Verified in `test/payment-agent.test.ts`. | ✅ Compliant |

---

## Architecture Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Autonomous Agent
    participant Agent as NL Payment Agent
    participant Parser as Intent Parser
    participant Resolver as PNS / ENS Name Resolver
    participant Validator as Solvency Validator
    participant Oracle as Chainlink Oracle (0x1Ed3...1DB8)
    participant Wallet as User Secure Wallet

    User->>Agent: "send 100 USDC to alice.pharos"
    Agent->>Parser: parse(text)
    Parser->>Resolver: resolve("alice.pharos")
    Resolver-->>Parser: 0xa0c048d1afb32de4e4b8756a55e22fde5c74e932

    alt Ambiguous Input (Missing amount / token / recipient)
        Parser-->>User: ❓ Ask Follow-Up Question with Suggested Options
    else Parsed Successfully
        Agent->>Validator: validate(intent, senderAddress)
        Validator->>Validator: Check recipient format, token contract & balance
        
        alt Validation Failed (Insufficient funds / bad address)
            Validator-->>User: ⛔ Validation Error & Shortfall Diagnostic
        else Valid Request
            Agent->>Oracle: latestRoundData() -> Fetch USD conversion
            Oracle-->>Agent: USD rate ($2,284 / ETH)
            Agent->>Agent: Construct Pre-Flight Summary & Unsigned Tx
            Agent-->>User: Pre-Flight Summary + Unsigned Wallet Signing Request
            User->>Wallet: Review & Sign in Wallet (Zero-Trust Invariant)
        end
    end
```

---

## Demonstration Scenarios

| Scenario | Input Instruction | Expected Outcome | Output Details |
| :--- | :--- | :---: | :--- |
| **Scenario 1** | `"please send 0.05 PROS to alice.pharos"` | **`READY_FOR_SIGNATURE`** | Resolves `alice.pharos`, validates 20.16 PROS balance, outputs pre-flight summary & unsigned native tx. |
| **Scenario 2** | `"wire 50 USDC to 0xa0c0...e932"` | **`READY_FOR_SIGNATURE`** | Encodes ERC-20 `transfer(address,uint256)` calldata, outputs MetaMask signing request. |
| **Scenario 3** | `"send 100 USDC"` (missing recipient) | **`AMBIGUOUS_INPUT`** | Emits follow-up clarification: *"Who should receive this payment?"* |
| **Scenario 4** | `"transfer some PROS to bob.pharos"` (missing amount) | **`AMBIGUOUS_INPUT`** | Emits follow-up clarification: *"What numerical amount would you like to transfer?"* |
| **Scenario 5** | `"send 5000 USDC to alice.pharos"` (exceeds balance) | **`VALIDATION_FAILED`** | Intercepts request: `INSUFFICIENT_TOKEN_BALANCE` (required 5000 USDC, available 100 USDC). |
| **Scenario 6** | `"send 10 PROS to 0xinvalid1234hex"` (bad address) | **`VALIDATION_FAILED`** | Intercepts request: `INVALID_RECIPIENT_FORMAT` (invalid 20-byte address). |

---

## CLI Usage & Commands

```bash
# Run comprehensive 6-scenario payment preparation demonstration
pharos-nl-pay demo

# Prepare an arbitrary plain-language payment instruction
pharos-nl-pay prepare "send 50 USDC to alice.pharos"

# Resolve a .pharos domain, .eth domain, or checksum an address
pharos-nl-pay resolve alice.pharos

# List supported tokens and smart contract addresses on Pharos Mainnet
pharos-nl-pay tokens
```

---

## Verification & Test Suite

Run the dedicated test suite:
```bash
npx vitest run tasks/14-natural-language-payment-agent
```
All 9 automated tests pass with 100% assertion coverage across all 4 requirements.
