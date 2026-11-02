# Task 17: x402 Paywalled API

> **Pharos Agent Arena — Payments Category (Medium Tier: 100 pts + 50 pts Video Walkthrough = 150 pts)**  
> **Challenge Slug**: `tasks/x402-paywalled-api`  
> **Target Network**: [Pharos Atlantic Testnet](https://atlantic-scan.pharos.xyz) (Chain ID: `688689`, Identifier: `eip155:688689`, RPC: `https://atlantic.dplabs-internal.com`)  
> **Pattern**: **HTTP-Native Micro-Payments via Autonomous x402 Facilitator & EIP-712 Challenge-Response**

---

## Executive Summary

The **Pharos x402 Paywalled API Suite** is an enterprise implementation of the **x402 open HTTP-native micro-payment specification** engineered for **Pharos Atlantic Testnet (`eip155:688689`)**. It monetizes developer and AI services on-chain, enabling automated software-to-software commerce charged per request in test USDC.

### Core Architectural Features:
1. **Atlantic Testnet Native Configuration (Requirement 01)**:
   - Built specifically for Pharos Atlantic Testnet (`eip155:688689`, Chain ID `688689`).
   - Prices all paywalled operations in test USDC (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`).
2. **Tiered Route Architecture (Requirement 02)**:
   - **Free Public Route**: `GET /health` probe (HTTP 200 without payment).
   - **Low-Cost Paid Route**: `GET /api/market-depth` (0.05 USDC for orderbook liquidity data).
   - **High-Value Paid Route**: `POST /api/ai-inference` (0.25 USDC for on-demand credit risk intelligence).
3. **Autonomous Embedded Facilitator (Requirement 03)**:
   - Runs its own protocol facilitator providing `GET /facilitator/supported`, `POST /facilitator/verify`, and `POST /facilitator/settle`.
   - Validates cryptographic EIP-712 typed signatures, token contracts, pricing thresholds, and expiration TTLs.
4. **Complete 402 Negotiation & Explorer Settlement (Requirement 04)**:
   - Returns HTTP `402 Payment Required` with Base64 `PAYMENT-REQUIRED` headers.
   - Client automatically signs typed EIP-712 payment authorizations and resubmits via `X-Payment` headers.
   - On settlement, server returns HTTP `200 OK` with `PAYMENT-RESPONSE` headers containing on-chain transaction hashes linked directly to the explorer (`https://atlantic-scan.pharos.xyz/tx/0x...`).
5. **Strict Underpayment & Replay Sentinel (Requirement 05)**:
   - Rejects underpaid authorizations (e.g. sending 0.01 USDC for a 0.05 USDC route) with HTTP `402 Payment Required` and explicit error diagnostics.
   - Atomic nonce burning prevents double-spending and replay attacks.
6. **Zero-Secret Hardcoding Invariant (Requirement 06)**:
   - Private keys are loaded strictly from environment variables (`process.env.EVM_PRIVATE_KEY`) or `.private_key` files.
   - Ephemeral random accounts are used in automated test environments, ensuring zero secret leakage in code or git history.

---

## Arena Requirements Compliance Matrix

| Requirement | Description | Implementation Details & Proof | Status |
| :--- | :--- | :--- | :---: |
| **01** | **Runs on Atlantic Testnet (eip155:688689), priced in test USDC** | Implemented in `src/types.ts` (`ATLANTIC_TESTNET.networkIdentifier = 'eip155:688689'`, USDC `0x3c49...`). Verified in `test/x402-paywall.test.ts`. | ✅ Compliant |
| **02** | **Has at least 2 paid routes at different prices and 1 free route, such as /health** | Implemented in `src/paywall-server.ts`: `GET /health` (Free), `GET /api/market-depth` (0.05 USDC), `POST /api/ai-inference` (0.25 USDC). Verified in `test/x402-paywall.test.ts`. | ✅ Compliant |
| **03** | **Runs its own facilitator with /verify, /settle and /supported** | Implemented in `src/facilitator.ts` (`X402FacilitatorEngine`) with full EIP-712 verification and atomic nonce settlement. Verified in `test/x402-paywall.test.ts`. | ✅ Compliant |
| **04** | **Shows full flow in demo: 402 -> signed payment -> 200 with PAYMENT-RESPONSE header & explorer tx link** | Implemented in `src/cli.ts` (`pharos-x402 demo`) and `src/x402-client.ts`. Displays 402 challenge, EIP-712 signature, and 200 response with explorer link. Verified in `test/x402-paywall.test.ts`. | ✅ Compliant |
| **05** | **Rejects a bad or underpaid payment with another 402** | Implemented in `src/facilitator.ts` and `src/paywall-server.ts`. Rejects underpayments, bad signatures, and replayed nonces with HTTP 402. Verified in `test/x402-paywall.test.ts`. | ✅ Compliant |
| **06** | **Keeps private keys in env vars or a file, never in code or prompts** | Implemented in `src/key-loader.ts` (`SecureKeyProvider`). Resolves from `EVM_PRIVATE_KEY` / `.private_key` with ephemeral generation fallback. Verified in `test/x402-paywall.test.ts`. | ✅ Compliant |

---

## Architectural Architecture

```
tasks/17-x402-paywalled-api/
├── bin/
│   └── pharos-x402.js              # Executable wrapper binary
├── src/
│   ├── types.ts                    # x402 protocol types & Atlantic Testnet constants
│   ├── key-loader.ts               # Secure private key provider (env/file isolation)
│   ├── facilitator.ts              # Embedded facilitator (/verify, /settle, /supported)
│   ├── paywall-server.ts           # Route dispatcher & 402 negotiation middleware
│   ├── x402-client.ts              # Autonomous buyer client (EIP-712 auto-signing)
│   ├── formatter.ts                # Terminal UI output formatter
│   ├── cli.ts                      # Commander CLI commands (`demo`, `supported`)
│   └── index.ts                    # Barrel exports
├── test/
│   └── x402-paywall.test.ts        # 13 Vitest tests verifying all 6 requirements
├── README.md                       # Comprehensive documentation & video script
└── SKILL.md                        # Antigravity agent skill specification
```

---

## CLI Commands & Usage

Global command: `pharos-x402` or via `npm run x402`:

### 1. Interactive Demonstration
Executes all 5 production scenarios:
```bash
pharos-x402 demo
# or
npm run x402 -- demo
```

### 2. Query Facilitator Capabilities
```bash
pharos-x402 supported
```

---

## Automated Vitest Suite

Run the full test suite:
```bash
npx vitest run tasks/17-x402-paywalled-api
```

Results (13/13 passing):
```
 ✓ tasks/17-x402-paywalled-api/test/x402-paywall.test.ts (13 tests) 53ms
   ✓ Task 17: x402 Paywalled API on Pharos Atlantic Testnet (13)
     ✓ Requirement 01: Atlantic Testnet (eip155:688689) & Test USDC Configuration (1)
       ✓ should be configured for Atlantic Testnet chainId 688689 and test USDC
     ✓ Requirement 02: Route Hierarchy (1 Free Route, at least 2 Paid Routes at different prices) (3)
       ✓ should allow free access to GET /health with HTTP 200 without payment header
       ✓ should return HTTP 402 on GET /api/market-depth priced at 0.05 USDC
       ✓ should return HTTP 402 on POST /api/ai-inference priced at 0.25 USDC
     ✓ Requirement 03: Embedded Facilitator (/verify, /settle, /supported) (2)
       ✓ should serve GET /facilitator/supported listing Atlantic Testnet and USDC
       ✓ should handle POST /facilitator/verify and POST /facilitator/settle endpoints
     ✓ Requirement 04: Full 402 Negotiation & Explorer-Linked Settlement Flow (2)
       ✓ should complete full flow: 402 challenge -> signed payment -> 200 with PAYMENT-RESPONSE and explorer tx link for 0.05 USDC route
       ✓ should complete full flow for the 0.25 USDC AI inference endpoint
     ✓ Requirement 05: Rejection of Bad, Underpaid, or Replayed Payments (Another 402) (3)
       ✓ should reject underpaid payment with HTTP 402 and reason
       ✓ should reject corrupted signature with HTTP 402
       ✓ should reject replay attacks with duplicate nonces
     ✓ Requirement 06: Private Key Security & Env/File Isolation (2)
       ✓ should resolve signer key from environment variable when EVM_PRIVATE_KEY is set
       ✓ should generate an ephemeral key rather than ever hardcoding keys in code when env is absent

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

---

## Video Walkthrough Guide (50 pts Bonus)

| Timestamp | Visual Action | Accompanying Explanation / Subtitle |
| :--- | :--- | :--- |
| `00:00 - 00:15` | Terminal: `pharos-x402 --help` | "Pharos x402 Paywalled API: HTTP-native micro-payments on Pharos Atlantic Testnet (eip155:688689)." |
| `00:15 - 00:40` | `pharos-x402 demo` (Scenario 1 & 2) | "Requirement 01 & 02: Free /health route returns 200 OK; paid /api/market-depth challenges with 402 demanding 0.05 test USDC." |
| `00:40 - 01:10` | Scenario 3 (0.25 USDC AI endpoint) & Facilitator | "Requirement 03 & 04: Buyer client signs EIP-712 authorization; embedded facilitator verifies & settles, returning 200 with PAYMENT-RESPONSE and explorer link." |
| `01:10 - 01:40` | Scenario 4 & 5 (Rejections) | "Requirement 05: Underpayments (0.01 USDC) and replay attacks are rejected with HTTP 402." |
| `01:40 - 02:00` | Code / Key inspection | "Requirement 06: Private keys are isolated in env vars or files, never hardcoded." |
| `02:00 - 02:15` | Terminal: `npm test` | "All 13 unit tests passing with full coverage of all arena requirements." |
