---
name: pharos-x402-paywalled-api
description: HTTP-native x402 micro-payment paywall suite for Pharos Atlantic Testnet (eip155:688689) that monetizes web APIs per request in test USDC via embedded facilitators and EIP-712 payment authorization.
---

# Pharos Skill: x402 Paywalled API

## Purpose
The **x402 Paywalled API Suite** enables machine-to-machine micro-payments on Pharos Atlantic Testnet (`eip155:688689`). It allows autonomous agents and developer clients to pay per API request in test USDC via standard HTTP 402 challenge-response negotiation.

### Core Capabilities:
1. **Tiered Route Structure**:
   - Free route (`GET /health`) for container readiness.
   - Low-cost route (`GET /api/market-depth` at 0.05 USDC).
   - High-value route (`POST /api/ai-inference` at 0.25 USDC).
2. **Embedded Facilitator**:
   - `GET /facilitator/supported`: Exposes network, asset, and scheme metadata.
   - `POST /facilitator/verify`: Validates EIP-712 signatures, amounts, and expiration timestamps.
   - `POST /facilitator/settle`: Atomically burns nonces to prevent replay attacks and emits explorer receipts.
3. **HTTP 402 Negotiation Loop**:
   - Unauthenticated requests receive HTTP 402 with base64 `PAYMENT-REQUIRED` header.
   - Clients sign typed payment authorizations and submit via `X-Payment` header.
   - Successful settlement returns HTTP 200 with `PAYMENT-RESPONSE` header containing Atlantic Scan explorer links.
4. **Underpayment & Replay Sentinel**:
   - Rejects underpaid authorizations, bad signatures, or reused nonces with HTTP 402.
5. **Private Key Isolation**:
   - Loads signing keys strictly from environment variables or ephemeral test accounts.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-x402 demo

# Start local server
pharos-x402 serve

# Run test suite
npx vitest run tasks/17-x402-paywalled-api
```
