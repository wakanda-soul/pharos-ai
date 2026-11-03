---
name: pharos-wallet-risk-checker
description: Autonomous pre-transaction security audit & risk evaluation agent for Pharos Mainnet. Analyzes wallets and smart contracts across 5 signals (contract deployment age, bytecode verification transparency, threat directory blacklist linkage, unlimited token allowances, and fresh burner wallet funding), outputs discrete Risk Levels (LOW, MEDIUM, HIGH) with numerical scores (0-100), and provides actionable plain-language recommendations before interacting.
---

# Pharos Compliance & Security: Wallet Risk Checker Skill

## Overview
The **Pharos Wallet Risk Checker** is an autonomous pre-transaction security audit and counterparty verification agent engineered for **Pharos Mainnet (Chain ID 1672)**. It protects users, institutional treasuries, and autonomous AI agents from interacting with phishing drainers, flash-loan exploiters, unverified honeypots, and disposable sybil burner wallets by examining on-chain account history across **5 distinct security signals**.

### Core Capabilities:
1. **Multi-Signal Threat Radar (Requirement 01)**:
   - **Signal 1 (Contract Age & Maturity)**: Identifies flash-deployed smart contracts (< 24 hours = CRITICAL; < 7 days = MEDIUM).
   - **Signal 2 (Bytecode Transparency)**: Detects opaque, unverified EVM bytecode lacking open-source verification on PharosScan (CRITICAL).
   - **Signal 3 (Threat Directory Association)**: Cross-references direct transactions or inbound funding from known drainers, exploiters, or mixers (CRITICAL).
   - **Signal 4 (Approval Anomalies)**: Flags dangerous unlimited (MaxUint256) ERC-20 allowances granted to untrusted external spenders (HIGH).
   - **Signal 5 (Funding Freshness)**: Distinguishes disposable burner wallets (< 12 hours old, <= 2 txs) from established accounts and uninitialized addresses.
2. **Deterministic Risk Rating & Scoring Engine (Requirement 02)**:
   - Evaluates total numerical risk score (0 to 100).
   - Classifies accounts into 3 discrete risk tiers:
     - `LOW RISK · CLEAN` (Score 0-24, zero critical triggers, safe to transact)
     - `MEDIUM RISK · CAUTION` (Score 25-59, cautionary warnings, proceed with care)
     - `HIGH RISK DETECTED` (Score 60-100 or any CRITICAL trigger, immediate danger, do not transact)
3. **Plain-Language Explanations (Requirement 03)**:
   - For every triggered flag, provides clear, human explanations explaining *what* was detected and *why* it presents a threat, avoiding bureaucratic jargon.
4. **Comparative Benchmark Demonstrations (Requirement 04)**:
   - Built-in benchmarks demonstrating clean verified protocols (FaroSwap Router v1), dangerous honeypots/drainers, disposable burners, and uninitialized addresses.

---

## Architecture Flow

```mermaid
flowchart TD
    A["Target Address / Contract\n(Pharos Mainnet 1672)"] --> B["OnChainHistoryAnalyzer\n(Bytecode, Nonce, Balances, Age)"]
    B --> C["OnChainAccountProfile"]

    C --> D1["Signal 1: Contract Age & Maturity\n(< 24h = CRITICAL, < 7d = MEDIUM)"]
    C --> D2["Signal 2: Bytecode Source Verification\n(Unverified Opaque = CRITICAL)"]
    C --> D3["Signal 3: Threat Directory Linkage\n(Drainer / Exploiter / Mixer = CRITICAL)"]
    C --> D4["Signal 4: Unusual Token Allowances\n(Unlimited Spenders = HIGH)"]
    C --> D5["Signal 5: Funding Freshness\n(Burner Wallet < 12h = HIGH)"]

    D1 --> E["WalletRiskEvaluator\nCompute Aggregate Score (0-100)"]
    D2 --> E
    D3 --> E
    D4 --> E
    D5 --> E

    E --> F{"Risk Level Determination"}
    F -->|"Score < 25"| G["LOW RISK · CLEAN\nSafe to Transact"]
    F -->|"25 <= Score < 60"| H["MEDIUM RISK · CAUTION\nTest with Small Amounts"]
    F -->|"Score >= 60 || CRITICAL"| I["HIGH RISK DETECTED\nDO NOT TRANSACT · DRAINER / EXPLOIT"]

    G --> J["RiskAssessmentReport\n(Terminal Scorecard & Plain-Language Advice)"]
    H --> J
    I --> J
```

---

## CLI Commands

```bash
# Run comparative simulation demonstrating clean vs risky accounts
pharos-risk demo
npm run risk -- demo

# Audit any on-chain address or contract live on Pharos Mainnet
pharos-risk check 0x1000000000000000000000000000000000000001
pharos-risk check 0xBad0000000000000000000000000000000000bad

# View known threat intelligence directory
pharos-risk threats
```
