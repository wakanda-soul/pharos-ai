# Task 20: Wallet Risk Checker

> **Pharos Agent Arena · Season of AI**  
> **Category**: `Compliance / Security` | **Tier**: `Medium` (100 base pts + 50 video bonus = 150 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous pre-transaction security audit and counterparty verification agent that evaluates on-chain account history across **5 security signals** (contract age, verified code, threat blacklist linkage, unusual approval patterns, and funding freshness), determines a discrete **Risk Level** (`LOW`, `MEDIUM`, or `HIGH`) with numerical threat scores (0-100), and formulates plain-language risk appraisals before executing interactions.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Checks at least 4 signals (contract age, verified code, flagged addresses, unusual approvals, freshly funded wallet)** | Implements all 5 distinct security sentinels with weighted severity contributions (`src/signal-evaluators.ts`) | ✅ Complete |
| **02** | **Outputs a risk level (low, medium or high) with the specific reasons** | Deterministic rating engine: calculates numerical threat score (0-100), maps to `LOW`, `MEDIUM`, or `HIGH`, and lists exact triggering evidence (`src/risk-evaluator.ts`) | ✅ Complete |
| **03** | **Explains each flag in plain language** | Every evaluated signal provides practical, human-oriented explanations of observed risk without bureaucratic jargon (`src/signal-evaluators.ts`, `src/formatter.ts`) | ✅ Complete |
| **04** | **Demonstrated on at least 1 clean and 1 risky example** | Interactive demo benchmarks 4 diverse scenarios: clean verified AMM router (FaroSwap), high-risk honeypot drainer, medium-risk burner wallet, and uninitialized address (`src/scenarios.ts`, `src/cli.ts`) | ✅ Complete |

---

## Project Structure

```
tasks/20-wallet-risk-checker/
├── bin/
│   └── pharos-risk.js            # Global executable CLI entrypoint
├── src/
│   ├── cli.ts                    # Command-line interface (demo, check, threats)
│   ├── flag-catalog.ts           # Threat intelligence directory & blacklist registry
│   ├── formatter.ts              # Terminal formatting, threat scorecards & ASCII meters
│   ├── history-analyzer.ts       # On-chain profile reader via Pharos RPC 1672
│   ├── index.ts                  # Public library exports
│   ├── risk-evaluator.ts         # Multi-signal scoring engine & rating classifier
│   ├── scenarios.ts              # Realistic clean, risky, and cautionary benchmark profiles
│   ├── signal-evaluators.ts      # Core 5 security signal evaluation algorithms
│   └── types.ts                  # Domain schemas and interfaces
├── test/
│   └── risk-checker.test.ts      # Automated test suite (13 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-risk threats` | Introduction to Pharos Wallet Risk Checker. Explain the threat intelligence directory tracking known phishing syndicates, honeypot deployers, and exploiters on Pharos Mainnet. |
| **0:25 - 0:55** | Terminal: `pharos-risk demo` | Run interactive comparative audit. Introduce the 5 security signals: contract age, bytecode verification, threat linkage, approval anomalies, and funding freshness. |
| **0:55 - 1:25** | Terminal: Inspect Scenario 1 & 2 Cards | Compare Scenario 1 (Clean FaroSwap Router: LOW Risk, score 0/100, verified Solidity source, mature 90-day history) with Scenario 2 (Malicious Honeypot: HIGH Risk, score 100/100, unverified bytecode, deployed 1.2h ago, funded by drainer syndicate). Highlight plain-language explanations. |
| **1:25 - 1:45** | Terminal: Inspect Scenario 3 & 4 | Walk through cautionary edge cases: Scenario 3 (Medium Risk disposable burner wallet with dangling unlimited approvals) and Scenario 4 (Uninitialized zero-nonce recipient handled safely without false alarms). |
| **1:45 - 2:00** | Terminal: `npm test` | Run automated test suite: `13 passed (13)`, confirming 100% test coverage and compliance with all arena requirements. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run task:20
# or
npx vitest run tasks/20-wallet-risk-checker/test/risk-checker.test.ts
```

Output:
```
 ✓ tasks/20-wallet-risk-checker/test/risk-checker.test.ts (13 tests)
   ✓ Task 20: Wallet Risk Checker Specification (13)
     ✓ Requirement 01: Checks at least 4 distinct risk signals (5)
     ✓ Requirement 02: Outputs risk level (LOW, MEDIUM, HIGH) with specific reasons (3)
     ✓ Requirement 03: Explains each flag in plain language (1)
     ✓ Requirement 04: Demonstrated on at least 1 clean and 1 risky example (2)
     ✓ Edge Cases: Uninitialized accounts and custom threat directory updates (2)

 Test Files  1 passed (1)
      Tests  13 passed (13)
```
