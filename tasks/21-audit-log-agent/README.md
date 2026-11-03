# Task 21: Audit-Log Agent

> **Pharos Agent Arena · Season of AI**  
> **Category**: `Support / Reporting` | **Tier**: `Medium` (100 base pts + 50 video bonus = 150 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous on-chain transaction reconciliation and financial compliance audit agent that accepts any target wallet address and date range, filters and groups historical transactions into **5 canonical categories** (`TRANSFER_IN`, `TRANSFER_OUT`, `DEX_SWAP`, `TOKEN_APPROVAL`, and `CONTRACT_INTERACTION`), computes category accounting summaries with net USD turnovers, isolates notable compliance events with direct **PharosScan** explorer links, and exports professional compliance reports in **Markdown** and **RFC-4180 CSV** formats.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Accepts a wallet address and date range** | Implements robust temporal parser supporting calendar (`YYYY-MM-DD`) and ISO-8601 timestamps, validates chronology, and filters transaction streams strictly within interval bounds (`src/date-filter.ts`). | ✅ Complete |
| **02** | **Groups activity into categories: transfers in and out, swaps, approvals, contract interactions** | 5-way activity categorizer analyzes transaction signatures, method selectors, event topic hashes, and recipient protocol identities to classify each ledger entry with high precision (`src/activity-categorizer.ts`). | ✅ Complete |
| **03** | **Includes totals per category and notable transactions with links** | Computes turnover volume, transaction counts, percentage breakdown, and gas expenses per category; spotlights transactions exceeding $\$10,000$ USD, unlimited token approvals, and reverted calls with direct `https://pharosscan.xyz/tx/0x...` links (`src/audit-aggregator.ts`). | ✅ Complete |
| **04** | **Exports the report as Markdown, PDF or CSV** | Dual format exporter generates structured GitHub-flavored Markdown reports (`src/exporters/markdown-exporter.ts`) and RFC-4180 compliant CSV ledger spreadsheets (`src/exporters/csv-exporter.ts`) saved to customizable directories. | ✅ Complete |

---

## Project Structure

```
tasks/21-audit-log-agent/
├── bin/
│   └── pharos-audit.js           # Global executable CLI entrypoint
├── src/
│   ├── activity-categorizer.ts   # 5-category transaction classifier & metadata extractor
│   ├── audit-aggregator.ts       # Accounting summary engine & notable tx spotlight
│   ├── cli.ts                    # Command-line interface (demo, report, directory)
│   ├── date-filter.ts            # Date range parser & UTC interval filter
│   ├── directory.ts              # Recognized Pharos protocols & entity directory
│   ├── exporters/
│   │   ├── csv-exporter.ts       # RFC-4180 compliant CSV ledger generator
│   │   └── markdown-exporter.ts  # GitHub-flavored Markdown compliance report generator
│   ├── formatter.ts              # Terminal formatting & ASCII category breakdown charts
│   ├── index.ts                  # Public library exports
│   ├── scenarios.ts              # Realistic on-chain transaction history benchmarks
│   └── types.ts                  # Domain schemas and interfaces
├── test/
│   └── audit-agent.test.ts       # Automated test suite (12 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-audit directory` | Introduction to Pharos Audit-Log Agent. Highlight the built-in protocol directory recognizing FaroSwap, Harbor Lending, Morpho Blue, and verified custody hot wallets on Pharos Mainnet. |
| **0:25 - 0:55** | Terminal: `pharos-audit demo` | Run autonomous compliance audit demo over February 2026 for a target corporate treasury wallet. Explain the 5 activity categories: Transfers In, Transfers Out, Swaps, Approvals, and Contract Interactions. |
| **0:55 - 1:25** | Terminal: Inspect Category Totals & Notable Events | Review category breakdown table showing USD turnover and transaction percentages. Spotlight the 4 flagged notable events: $\$25,000$ USDC inbound transfer from Binance, unlimited USDC allowance granted to FaroSwap, $\$15,000$ swap, and an EVM reverted call, each linked to PharosScan. |
| **1:25 - 1:45** | Terminal: `head -n 25 audit-output/audit-*.md` & `.csv` | Demonstrate export artifacts satisfying Requirement 04: structured Markdown report with executive summary and RFC-4180 CSV spreadsheet ready for financial accounting software. |
| **1:45 - 2:00** | Terminal: `npm test tasks/21-audit-log-agent` | Run automated test suite: `12 passed (12)`, confirming 100% test coverage and compliance with all arena requirements. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run audit -- demo
# and run unit tests
npx vitest run tasks/21-audit-log-agent/test/audit-agent.test.ts
```

Output:
```
 ✓ tasks/21-audit-log-agent/test/audit-agent.test.ts (12 tests)
   ✓ Task 21: Audit-Log Agent Specification (12)
     ✓ Requirement 01: Accepts a wallet address and a date range (3)
       ✓ parses valid ISO-8601 and YYYY-MM-DD date ranges accurately
       ✓ rejects inverted or malformed date ranges with descriptive errors
       ✓ filters transactions strictly within the target date range
     ✓ Requirement 02: Groups activity into 5 distinct categories (3)
       ✓ categorizes transfers in, transfers out, swaps, approvals, and contract interactions
       ✓ correctly classifies multi-token swaps with input/output pair labeling
       ✓ classifies token approvals as non-cashflow permissions
     ✓ Requirement 03: Category totals and notable transactions with links (2)
       ✓ computes accurate category accounting summaries with transaction counts and USD volume
       ✓ spotlights notable transactions with reasons and canonical Pharosscan links
     ✓ Requirement 04: Exports the report as Markdown and CSV (2)
       ✓ exports audit report in structured Markdown format
       ✓ exports audit report in RFC-4180 compliant CSV format
     ✓ Edge Cases: Reverted transactions and empty date intervals (2)
       ✓ tracks gas fees for reverted transactions with zero net turnover
       ✓ handles an empty date interval gracefully

 Test Files  1 passed (1)
      Tests  12 passed (12)
```
