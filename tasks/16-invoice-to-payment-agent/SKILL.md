---
name: pharos-invoice-to-payment-agent
description: Invoice processing agent for Pharos that parses multi-format invoices, enforces zero-guessing anomaly detection, and synthesizes unsigned transactions with calldata-bound invoice references.
---

# Pharos Skill: Invoice-to-Payment Agent

## Purpose
The **Invoice-to-Payment Agent** ingests incoming billing documents across multiple formats (JSON, commercial memos, delimited receipts), validates financial integrity without making assumptions, and produces unsigned transactions with embedded invoice references for on-chain reconciliation.

### Core Capabilities:
1. **Multi-Format Extraction**:
   - Parses structured JSON, plaintext memos (with line items and PNS aliases), and delimited key-value receipts.
   - Extracts payee, billed total, currency, and invoice reference numbers.
2. **Zero-Guessing Discrepancy Sentinel**:
   - Refuses to execute if currency is missing (`MISSING_SETTLEMENT_CURRENCY`).
   - Verifies itemized arithmetic, flagging mismatches between line totals and declared totals (`LINE_ITEMS_SUM_MISMATCH`).
   - Rejects zero-address payees and missing invoice references.
3. **Calldata-Bound On-Chain Reference**:
   - Encodes invoice references as UTF-8 hex memos.
   - Binds memo to native PROS data field or appends it to ERC-20 `transfer(address,uint256)` calldata for permanent on-chain auditability.
4. **Pre-Flight Summaries & Unsigned Payloads**:
   - Displays clear human-readable payment summaries with Chainlink USD valuation.
   - Emits standardized unsigned EIP-1193 payloads and Foundry `cast send` commands.

---

## Quick Start & Usage

```bash
# Run demonstration with sample invoices
pharos-invoice demo

# Process a local invoice
pharos-invoice process ./invoice.json
```
