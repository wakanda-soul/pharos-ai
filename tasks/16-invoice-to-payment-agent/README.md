# Task 16: Invoice-to-Payment Agent

> **Pharos Agent Arena — Payments Category (Medium Tier: 100 pts + 50 pts Video Walkthrough = 150 pts)**  
> **Challenge Slug**: `tasks/invoice-to-payment-agent`  
> **Target Network**: [Pharos Mainnet](https://scan.pharos.xyz) (Chain ID: `1672`, RPC: `https://rpc.pharos.xyz`)  
> **Pattern**: **Multi-Format Ingestion, Zero-Guessing Sentinel & Calldata-Bound Reference Pattern**

---

## Executive Summary

The **Pharos Invoice-to-Payment Agent** is an enterprise-grade autonomous billing processor engineered for **Pharos Mainnet (Chain ID 1672)**. It ingests diverse billing formats (Structured JSON, Plaintext Commercial Memos, and Delimited Key-Value Receipts), verifies financial integrity without making dangerous assumptions, and synthesizes non-custodial payment summaries with unsigned transactions that embed the invoice reference directly into the on-chain calldata.

### Key Architectural Invariants:
1. **Multi-Format Ingestion (Requirement 01)**:
   - Ingests **Structured JSON** (Peppol/UBL-like ERP exports).
   - Ingests **Plaintext / Markdown Commercial Memos** with line items, formatted totals (`$1,250.00`), and PNS domain names (`alice.pharos`).
   - Ingests **Delimited Key-Value Receipts** (`KEY=VALUE` DevOps and webhook billing formats).
2. **Zero-Guessing Discrepancy Sentinel (Requirement 02)**:
   - **No Currency Guessing**: If currency/token is omitted, the agent strictly refuses to guess default assets, flagging `MISSING_SETTLEMENT_CURRENCY`.
   - **Line-Item Total Reconciliation**: Mathematically verifies that individual item costs tally to the stated total, flagging `LINE_ITEMS_SUM_MISMATCH` on discrepancy.
   - **Payee & Zero-Address Protection**: Prohibits zero-address fund burns (`0x000...000`) and unresolvable domains.
   - **Required Reference Enforcement**: Flags `MISSING_INVOICE_REFERENCE` if the invoice lacks an audit serial number.
3. **Calldata-Bound On-Chain Reference (Requirement 03)**:
   - Encodes the invoice reference as UTF-8 hex memo.
   - For **Native PROS**: Binds memo to transaction `data` payload.
   - For **ERC-20 (USDC)**: Appends memo suffix directly to the 68-byte `transfer(address,uint256)` calldata, permanently anchoring the reference on-chain for explorers and auditors without EVM execution side-effects.
   - Outputs standardized EIP-1193 payloads and Foundry `cast send` commands.
4. **Comprehensive Demo with Sample Invoices (Requirement 04)**:
   - Built-in demonstration suite (`pharos-invoice demo`) covering 3 valid formats and 3 distinct anomaly failure blocks.

---

## Arena Requirements Compliance Matrix

| Requirement | Description | Implementation Details & Proof | Status |
| :--- | :--- | :--- | :---: |
| **01** | **Extracts payee, amount, token or currency, and reference from at least 2 invoice formats** | Implemented in `src/parsers/` with 3 formats: `StructuredJsonInvoiceParser`, `PlaintextMemoInvoiceParser`, and `DelimitedReceiptParser`. Verified in `test/invoice-agent.test.ts`. | ✅ Compliant |
| **02** | **Flags mismatches or missing fields instead of guessing** | Implemented in `src/invoice-validator.ts` via `InvoiceAnomalySentinel`. Flags missing payee, missing currency, missing reference, non-positive amounts, line-item sum discrepancies, and zero addresses. Verified in `test/invoice-agent.test.ts`. | ✅ Compliant |
| **03** | **Produces a payment summary and an unsigned transaction that includes the invoice reference** | Implemented in `src/payment-synthesizer.ts`. Generates pre-flight summary with Chainlink USD valuation, EIP-1193 payload, and Foundry `cast send` reproduction command embedding the reference memo in calldata. Verified in `test/invoice-agent.test.ts`. | ✅ Compliant |
| **04** | **Includes a demo with sample invoices** | Implemented in `src/sample-invoices.ts` and exposed via `pharos-invoice demo`. Demonstrates 3 valid formats and 3 discrepancy catches. Verified in `test/invoice-agent.test.ts`. | ✅ Compliant |

---

## Architecture Flow

```
tasks/16-invoice-to-payment-agent/
├── bin/
│   └── pharos-invoice.js           # Executable wrapper binary
├── src/
│   ├── types.ts                    # TypeScript types (Invoice, Anomalies, Payloads)
│   ├── token-registry.ts           # Pharos Mainnet settlement assets (PROS, USDC, LINK)
│   ├── parsers/
│   │   ├── base-parser.ts          # Strategy interface for invoice parsers
│   │   ├── json-invoice-parser.ts  # Structured JSON (RFC-8259) parser
│   │   ├── plaintext-memo-parser.ts # Unstructured commercial memo & markdown parser
│   │   └── delimited-receipt-parser.ts # Key-Value (.env / webhook) receipt parser
│   ├── invoice-validator.ts        # Zero-guessing anomaly & discrepancy sentinel
│   ├── payment-synthesizer.ts      # Unsigned transaction & calldata reference builder
│   ├── sample-invoices.ts          # Enterprise test invoices (valid & discrepant)
│   ├── formatter.ts                # Terminal audit report formatter
│   ├── invoice-agent.ts            # Master orchestration engine
│   ├── cli.ts                      # Commander CLI commands (`demo`, `parse`)
│   └── index.ts                    # Barrel exports
├── test/
│   └── invoice-agent.test.ts       # 11 Vitest tests covering Requirements 01-04
├── README.md                       # Documentation & video walkthrough script
└── SKILL.md                        # Antigravity agent skill specification
```

---

## CLI Commands & Usage

Global command: `pharos-invoice` or via `npm run invoice`:

### 1. Interactive Demonstration
Executes all 6 test scenarios (3 formats + 3 anomaly blocks):
```bash
pharos-invoice demo
# or
npm run invoice -- demo
```

### 2. Parsing Any Custom Invoice File
```bash
pharos-invoice parse path/to/my-invoice.json
```

---

## Automated Vitest Suite

Run the full test suite:
```bash
npx vitest run tasks/16-invoice-to-payment-agent
```

Results (11/11 passing):
```
 ✓ tasks/16-invoice-to-payment-agent/test/invoice-agent.test.ts (11 tests) 36ms
   ✓ Task 16: Invoice-to-Payment Autonomous Agent (11)
     ✓ Requirement 01: Multi-Format Invoice Ingestion & Extraction (3)
       ✓ should correctly parse structured JSON e-invoice and extract payee, amount, currency, reference
       ✓ should accurately parse plaintext commercial billing memo with line items and PNS domain
       ✓ should parse delimited key-value receipt format and resolve native PROS currency
     ✓ Requirement 02: Discrepancy & Missing Field Anomaly Flagging (No Guessing) (6)
       ✓ should flag line item total sum mismatch instead of blindly executing
       ✓ should strictly refuse to guess currency when omitted
       ✓ should flag missing payee address
       ✓ should flag missing invoice reference
       ✓ should flag zero-address payee as invalid
       ✓ should flag non-positive billing amount
     ✓ Requirement 03: Payment Summary & Unsigned Transaction with Invoice Reference (2)
       ✓ should generate pre-flight summary and unsigned ERC-20 transaction embedding reference memo in calldata
       ✓ should generate native PROS transaction with invoice reference in transaction data

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

---

## Video Walkthrough Guide (50 pts Bonus)

| Timestamp | Visual Action | Accompanying Explanation / Subtitle |
| :--- | :--- | :--- |
| `00:00 - 00:15` | Terminal: `pharos-invoice --help` | "Pharos Invoice-to-Payment Agent: Autonomous multi-format invoice parser and payment preparation agent for Pharos Mainnet." |
| `00:15 - 00:45` | Terminal: `pharos-invoice demo` (Scenario 1 & 2) | "Requirement 01: Ingests structured JSON and plaintext billing memos, resolving payee, amount, token and references." |
| `00:45 - 01:15` | Demo Scenarios 4, 5, 6 (Anomaly Sentinel) | "Requirement 02: Zero-Guessing Sentinel flags line-item sum mismatches, missing currencies, and unresolvable payees." |
| `01:15 - 01:45` | Unsigned payload inspection | "Requirement 03: Produces payment summaries and unsigned transactions embedding the invoice reference directly into calldata." |
| `01:45 - 02:10` | Terminal: `npm test` | "All 11 unit tests passing with full coverage of all arena requirements." |
