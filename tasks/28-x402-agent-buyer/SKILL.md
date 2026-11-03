---
name: pharos-x402-buyer
description: Autonomous x402 micro-payment client agent with strict spend budgets, per-call price caps, safe idempotent retries, and itemized transaction ledgers for Pharos Atlantic Testnet.
---

# Pharos x402 Agent Buyer Skill

This skill equips autonomous AI agents with the ability to safely query and pay for HTTP-402 paywalled endpoints on Pharos Atlantic Testnet (`eip155:688689`).

## Capabilities
1. **Multi-Endpoint Negotiation**: Dispatches requests, handles HTTP 402 challenge responses (`WWW-Authenticate: x402`), and unpacks requirements.
2. **Financial Guardrails Sentinel**: Enforces per-call price ceilings (`maxPerCallLimitUsdc`) and total expenditure budgets (`totalSpendBudgetUsdc`).
3. **Idempotent Retry Engine**: Protects against double-spend hazards during transient network drops (HTTP 5xx) by binding settlement transaction hashes to idempotency keys.
4. **Itemized Audit Ledger**: Automatically logs sequence index, endpoint URL, purchased asset, price, tx hash, running total spend, and remaining budget.

## Usage in Code

```typescript
import { X402AgentBuyer, SpendBudgetPolicy } from './buyer-engine.js';

const policy: SpendBudgetPolicy = {
  totalSpendBudgetUsdc: 0.25,
  maxPerCallLimitUsdc: 0.10,
  currency: 'USDC',
  maxSafeRetries: 3,
  retryBackoffMs: 100,
};

const buyer = new X402AgentBuyer({ policy });

const outcome = await buyer.purchaseResource({
  endpointUrl: '/oracle/market-volatility',
  intendedPurpose: 'Market Volatility Analysis',
  idempotencyKey: 'intent_volatility_step_01',
});

if (outcome.isSuccess) {
  console.log('Purchased data:', outcome.payload);
  console.log('Audit receipt:', outcome.paymentReceipt);
} else {
  console.warn('Purchase halted or refused:', outcome.failureReason);
}
```
