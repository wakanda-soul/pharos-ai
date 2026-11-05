---
name: pharos-wallet-risk-checker
description: Pre-transaction security audit agent for Pharos that evaluates on-chain counterparty history across 5 risk signals, scores threat levels (0-100), and outputs plain-language safety appraisals.
---

# Pharos Skill: Wallet Risk Checker

## Purpose
The **Wallet Risk Checker** performs pre-transaction security audits on Pharos Mainnet. It inspects counterparty addresses across 5 signals (contract age, verified code, threat blacklist linkage, unusual approval patterns, and funding freshness) to protect users and agents from drainers and honeypots.

### Core Capabilities:
1. **5 Security Signal Evaluators**:
   - Contract Age: Flags ephemeral contracts deployed < 24 hours.
   - Code Verification: Flags unverified opaque bytecode.
   - Flagged Association: Detects funding linkages to known drainers or exploiters.
   - Approval Anomalies: Identifies dangling unlimited token allowances.
   - Funding Freshness: Flags newly initialized accounts with immediate high outflows.
2. **Deterministic Risk Rating**:
   - Calculates threat scores from 0 to 100 and classifies accounts as `LOW`, `MEDIUM`, or `HIGH` risk.
3. **Plain-Language Explanations**:
   - Explains observed risks in clear, non-jargon terms with actionable recommendations.
4. **Clean vs Risky Benchmarking**:
   - Tested against mature verified contracts and known threat profiles.

---

## Quick Start & Usage

```bash
# Run comparative demonstration
pharos-risk demo

# Audit an address
pharos-risk check 0xba3b00c3b0632b6fa622f990924976725227b68a

# View threat directory
pharos-risk threats
```
