# Task 18: Liquidation Watchdog

> **Pharos Agent Arena — DeFi / Portfolio Category (Medium Tier: 100 pts + 50 pts Video Walkthrough = 150 pts)**  
> **Challenge Slug**: `tasks/liquidation-watchdog`  
> **Target Network**: [Pharos Mainnet](https://scan.pharos.xyz) (Chain ID: `1672`, RPC: `https://rpc.pharos.xyz`)  
> **Pattern**: **On-Chain Health Factor Sentinel & Actionable Remediation Advisory Pattern**

---

## Executive Summary

The **Pharos Liquidation Watchdog** is an autonomous risk sentinel and insolvency mitigation agent engineered for DeFi lending markets (such as Morpho Blue and Harbor Lending) on **Pharos Mainnet (Chain ID 1672)**. It continuously monitors borrower positions against live Chainlink price feeds (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`), calculates real-time Health Factors ($HF$), evaluates configurable risk thresholds (Warning at 1.30, Critical at 1.10), and broadcasts multi-channel alerts with precise mathematical remediation advice (exact debt to repay or collateral to deposit) before liquidation occurs.

### Core Architectural Features:
1. **On-Chain Position Reading & Mathematical Health Factors (Requirement 01)**:
   - Reads collateral balances, outstanding debts, and live Chainlink oracle valuations on Pharos Mainnet.
   - Computes canonical DeFi lending metrics:
     $$HF = \frac{\text{Collateral Value (USD)} \times \text{Liquidation Threshold}}{\text{Debt Value (USD)}}$$
     $$\text{Liquidation Price} = \frac{\text{Debt Value (USD)}}{\text{Collateral Units} \times \text{Liquidation Threshold}}$$
2. **Configurable Warning & Critical Risk Thresholds (Requirement 02)**:
   - Evaluates positions across 4 risk tiers: `SAFE`, `WARNING`, `CRITICAL`, and `LIQUIDATION_IMMINENT`.
   - Thresholds are fully configurable (default: `warningHealthFactor = 1.30`, `criticalHealthFactor = 1.10`, `targetSafeHealthFactor = 1.50`).
3. **Multi-Channel Alert Dispatcher (Requirement 03)**:
   - **Console Notification Channel**: Formats structured terminal alerts with ISO-8601 timestamps and urgency indicators.
   - **Discord Notification Channel**: Webhook alerts with embedded color indicators (Orange for Warning, Red for Critical).
   - **In-Memory Audit Ledger**: Records all dispatched alerts for audit compliance and automated test verification.
4. **Concrete Actionable Remediation Advisories (Requirement 04)**:
   - Computes exact capital requirements to bring position back to target safe Health Factor (e.g. 1.50):
     - **Debt Repayment**: $\Delta \text{Debt USD} = \text{Debt} - \frac{\text{Collateral} \times \text{LT}}{\text{targetHF}}$ (converted to debt asset units).
     - **Collateral Top-Up**: $\Delta \text{Collateral USD} = \frac{\text{Debt} \times \text{targetHF}}{\text{LT}} - \text{Collateral}$ (converted to native collateral units).

---

## Arena Requirements Compliance Matrix

| Requirement | Description | Implementation Details & Proof | Status |
| :--- | :--- | :--- | :---: |
| **01** | **Reads the position's collateral, debt and health factor (or equivalent) from chain** | Implemented in `src/position-reader.ts` and `src/position-calculator.ts`. Queries Chainlink oracle on Pharos Mainnet (`0x1Ed3...`) and computes collateral, debt, LTV, and HF. Verified in `test/watchdog.test.ts`. | ✅ Compliant |
| **02** | **Configurable warning thresholds, e.g. warn at 1.3 and critical at 1.1** | Implemented in `src/watchdog-engine.ts` via `WatchdogThresholdConfig`. Supports warning at 1.30, critical at 1.10, and custom institutional thresholds. Verified in `test/watchdog.test.ts`. | ✅ Compliant |
| **03** | **Sends alerts through at least one channel: Telegram, Discord, email, or a console with timestamps** | Implemented in `src/alert-channels.ts` (`ConsoleNotificationChannel` with ISO timestamps, `DiscordNotificationChannel`, and `InMemoryAlertLedger`). Verified in `test/watchdog.test.ts`. | ✅ Compliant |
| **04** | **Suggests a concrete action in each alert, e.g. "repay X or add Y collateral"** | Implemented in `src/position-calculator.ts` (`calculateRemediationPlan`). Computes exact USD and token amounts for debt repayment and collateral additions. Verified in `test/watchdog.test.ts`. | ✅ Compliant |

---

## Architectural Architecture

```
tasks/18-liquidation-watchdog/
├── bin/
│   └── pharos-watchdog.js          # Executable wrapper binary
├── src/
│   ├── types.ts                    # TypeScript types (Position, Alert, Thresholds)
│   ├── config.ts                   # Pharos Mainnet addresses, assets & default thresholds
│   ├── position-calculator.ts      # Health factor, liquidation price & remediation math
│   ├── alert-channels.ts           # Multi-channel dispatchers (Console, Discord, Ledger)
│   ├── position-reader.ts          # On-chain position & Chainlink oracle reader
│   ├── watchdog-engine.ts          # Core risk evaluation & alert engine
│   ├── scenarios.ts                # Production scenarios (Safe, Warning, Critical, Flash Crash)
│   ├── formatter.ts                # Terminal UI formatters & audit tables
│   ├── cli.ts                      # Commander CLI commands (`demo`, `inspect`)
│   └── index.ts                    # Barrel exports
├── test/
│   └── watchdog.test.ts            # 9 Vitest tests verifying Requirements 01-04
├── README.md                       # Comprehensive documentation & video script
└── SKILL.md                        # Antigravity agent skill specification
```

---

## CLI Commands & Usage

Global command: `pharos-watchdog` or via `npm run watchdog`:

### 1. Interactive Demonstration
Executes all 4 market scenarios (Baseline Safe, Market Pullback Warning, Volatility Critical, Flash Crash Imminent):
```bash
pharos-watchdog demo
# or
npm run watchdog -- demo
```

### 2. Custom Threshold Demonstration
```bash
pharos-watchdog demo --warn 1.40 --crit 1.20
```

### 3. Inspect Live Position
```bash
pharos-watchdog inspect --address 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --collateral 5.0 --debt 5000
```

---

## Automated Vitest Suite

Run the full test suite:
```bash
npx vitest run tasks/18-liquidation-watchdog
```

Results (9/9 passing):
```
 ✓ tasks/18-liquidation-watchdog/test/watchdog.test.ts (9 tests) 1675ms
   ✓ Task 18: Liquidation Watchdog Engine (Requirements 01-04) (9)
     ✓ Requirement 01: On-Chain Lending Position Reading & Health Factor Calculation (2)
       ✓ should read position metrics and calculate collateral value, debt value, and health factor
       ✓ should query live Chainlink oracle or realistic fallback without throwing
     ✓ Requirement 02: Configurable Warning & Critical Thresholds (4)
       ✓ should classify position as SAFE when Health Factor is above warning threshold (HF = 1.70 >= 1.30)
       ✓ should trigger WARNING alert when Health Factor drops between critical and warning (1.10 <= HF = 1.25 < 1.30)
       ✓ should trigger CRITICAL alert when Health Factor drops below critical threshold (HF = 1.05 < 1.10)
       ✓ should support custom institutional thresholds (e.g. warn at 1.45 and critical at 1.25)
     ✓ Requirement 03: Multi-Channel Alert Delivery with Timestamps (1)
       ✓ should dispatch alert to console and discord channels with ISO timestamps and formatted numbers
     ✓ Requirement 04: Concrete Actionable Remediation Suggestions (2)
       ✓ should compute exact debt repayment and additional collateral needed to restore Health Factor to safe target
       ✓ should handle zero debt safely without suggesting negative repayment

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

---

## Video Walkthrough Guide (50 pts Bonus)

| Timestamp | Visual Action | Accompanying Explanation / Subtitle |
| :--- | :--- | :--- |
| `00:00 - 00:15` | Terminal: `pharos-watchdog --help` | "Pharos Liquidation Watchdog: Autonomous DeFi lending position monitor and liquidation prevention sentinel." |
| `00:15 - 00:40` | `pharos-watchdog demo` (Step 1 & 2) | "Requirement 01 & 02: Reads collateral, debt, and oracle prices from chain. Triggers WARNING when HF drops below 1.30." |
| `00:40 - 01:10` | Step 3 & 4 (Critical Alert & Flash Crash) | "Requirement 03: Sends timestamped alerts with liquidation price buffer and urgency indicators." |
| `01:10 - 01:40` | Remediation Action text highlight | "Requirement 04: Computes exact actionable steps: 'Repay $2,083 USDC or add 2.10 WPROS to restore Health Factor to 1.50'." |
| `01:40 - 02:00` | Terminal: `npm test` | "All 9 unit tests passing covering position math, thresholds, channels, and remediation advice." |
