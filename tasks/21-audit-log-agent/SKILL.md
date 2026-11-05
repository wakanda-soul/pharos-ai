---
name: pharos-audit-log-agent
description: On-chain financial reconciliation and activity reporting agent for Pharos that categorizes wallet transactions over a date range, calculates category totals, spotlights notable events, and exports Markdown and CSV reports.
---

# Pharos Skill: Audit-Log Agent

## Purpose
The **Audit-Log Agent** produces plain-language accounting reports for on-chain wallets on Pharos Mainnet. It classifies transactions into 5 distinct categories, calculates turnover totals, highlights notable security and financial events with explorer links, and exports compliance reports in Markdown and CSV formats.

### Core Capabilities:
1. **Address & Date Range Filtering**:
   - Accepts any wallet address and calendar or ISO-8601 interval bounds.
2. **5-Category Activity Classification**:
   - Groups activity into `TRANSFER_IN`, `TRANSFER_OUT`, `DEX_SWAP`, `TOKEN_APPROVAL`, and `CONTRACT_INTERACTION`.
3. **Category Totals & Notable Transaction Highlights**:
   - Computes transaction counts, USD turnover volume, and gas expenses per category.
   - Highlights transactions > $10,000 USD, unlimited token allowances, and reverted calls with direct PharosScan links.
4. **Dual Format Export**:
   - Generates structured Markdown compliance summaries and RFC-4180 CSV spreadsheets.

---

## Quick Start & Usage

```bash
# Run demonstration audit
pharos-audit demo

# Generate report for a target wallet
pharos-audit report 0x6119871b4eb66db137dcfad59655853ea6fe58ce --from 2026-02-01 --to 2026-02-28

# Run test suite
npx vitest run tasks/21-audit-log-agent
```
