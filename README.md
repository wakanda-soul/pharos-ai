# pharos-ai 🏛️

Autonomous AI agents, tools, and execution pipelines for the **Pharos** blockchain ecosystem (`Chain ID: 1672` / Atlantic Testnet `688689`), built for the **Pharos Agent Arena (Season of AI)**.

---

## 🎯 Project Overview

This repository is dedicated to building, testing, and shipping production-ready AI agents and tooling on the Pharos blockchain using:
- **Pharos Chain MCP**: Direct model context protocol integration with live on-chain state via JSON-RPC.
- **Pharos Skill Engine**: Automated transactions, smart contract deployments, and queries using Foundry (`cast` & `forge`).
- **Anvita Flow**: Multi-agent collaboration, capability routing, and agent wallet management.

---


All ecosystem URLs, network configs, API specifications, and Arena tasks are documented and indexed in the `docs/` directory:


---

## 🌐 Quick Reference: Networks & Endpoints

| Environment | Chain ID | RPC URL | Native Token | Explorer |
|---|---|---|---|---|
| **Atlantic Testnet** | `688689` | `https://atlantic.dplabs-internal.com` | `PHRS` | [atlantic.pharosscan.xyz](https://atlantic.pharosscan.xyz/) |
| **Mainnet** | `1672` | `https://rpc.pharos.xyz` | `PROS` | [pharosscan.xyz](https://www.pharosscan.xyz/) |

### Hosted Chain MCP
- **Endpoint**: `https://mcp.pharos.xyz/mcp` (Streamable HTTP, 120 req/min)
- **Official Skill Engine**: `https://github.com/PharosNetwork/pharos-skill-engine`

---

## 🏆 Agent Arena Progress & Roadmap

Targeting all tiers to climb to **Advocate Rank** (2,200+ pts):

### Tier 1 — Easy (50 pts each)
- [x] 🟢 **[Task 01: Read Contract State](tasks/01-read-contract-state)**: Read live smart contract state via Chain MCP and present in plain language.
- [x] 🟢 **[Task 02: Event/Log Monitor (ProsPixel Game)](tasks/02-event-log-monitor)**: Real-time on-chain game event monitor for [prospixel.xyz](https://prospixel.xyz/) via Chain MCP.
- [x] 🟢 **[Task 03: Docs MCP Onboarding Audit](tasks/03-docs-mcp-onboarding)**: Self-onboarding experience report and gap analysis using `@Pharos Docs MCP`.
- [x] 🟢 **[Task 04: Doc-Search CLI & Docs MCP Server](tasks/04-doc-search-cli)**: Terminal CLI tool and stdio MCP server for searching Pharos developer docs with zero hallucination.
- [x] 🟢 **[Task 05: On-Chain Alert Bot](tasks/05-on-chain-alert-bot)**: Multi-channel on-chain sentinel for price thresholds, whale transfers, and contract events via Chain MCP.
- [x] 🟢 **[Task 06: dApp Support Agent](tasks/06-dapp-support-agent)**: Autonomous transaction failure diagnostic doctor and support ticket generator via Chain MCP.


### Tier 2 — Medium (100 pts each)
- [x] [`threshold-guardian`](tasks/09-threshold-guardian): Multi-condition execution gate evaluating live on-chain oracle prices, gas ceilings, and liquidity depth before firing actions.
- [x] [`dry-run-executor`](tasks/10-dry-run-executor): Pre-flight transaction simulation engine: predicts success/revert, computes USD gas cost via Chainlink, state-diffs balances, and blocks execution on failure.
- [x] [`batch-executor`](tasks/11-batch-executor): Multi-action bundling engine: executes 3+ actions in 1 Multicall3 transaction, cuts gas by 35%+, and isolates partial failures.
- [x] [`policy-gatekeeper`](tasks/12-policy-gatekeeper): Zero-trust policy sentinel: enforces multi-asset spend limits, contract allowlists, and time windows with persistent audit logging.
- [x] [`skill-chain-mcp-flow`](tasks/07-skill-chain-mcp-flow): Composed agent flow combining Pharos Chain MCP and SkillEngine into an autonomous dynamic treasury sentinel.
- [x] [`docs-chain-mcp-agent`](tasks/08-docs-chain-mcp-agent): Explain-Then-Act agent explaining contract functions via Docs MCP, executing on Pharos Mainnet, and contextualizing results.
- [ ] `liquidation-watchdog`: Monitor lending position & alert before liquidation.
- [x] [`natural-language-payment-agent`](tasks/14-natural-language-payment-agent): Intent-to-action payment synthesizer (Harbor pattern): parses plain language, resolves PNS domains, validates solvency, shows pre-flight summary with Chainlink USD, and outputs unsigned transactions.
- [x] [`recurring-payment-agent`](tasks/15-recurring-payment-agent): Autonomous idempotent recurring payment manager: supports weekly & monthly schedules, solvency checks, double-pay locks, and audit ledger.
- [x] [`invoice-to-payment-agent`](tasks/16-invoice-to-payment-agent): Autonomous multi-format invoice parser & payment synthesizer: ingests JSON, plaintext memos, and delimited receipts, enforces zero-guessing sentinels, and binds invoice reference in on-chain calldata.
- [x] [`x402-paywalled-api`](tasks/17-x402-paywalled-api): HTTP-native micro-payment API engine on Atlantic Testnet: monetizes endpoints (0.05 & 0.25 USDC), free /health probe, embedded facilitator (/verify, /settle, /supported), and underpayment guards.
- [ ] `whale-watching-agent`: Track and report significant address moves.
- [x] [`gas-fee-optimizer`](tasks/13-gas-fee-optimizer): Temporal volatility & deadline decay dispatcher: tracks gas percentiles, holds during congestion, triggers on dips, and guarantees zero-miss deadline SLA.
- [ ] `wallet-risk-checker`: Suspicious address flagger.
- [ ] `audit-log-agent`: Wallet activity reporter.
- [ ] `weekly-digest-agent`: Periodic summary of wallet/protocol activity.

### Tier 3 — Hard (200 pts each)
- [ ] `saga-executor`: Multi-step workflow (approve → swap → deposit) with rollback.
- [ ] `arbitrage-scanner`: Price scanner netting fees and executing if profitable.
- [ ] `trend-watcher`: Multi-observation trend evaluator across runs.
- [ ] `portfolio-assistant`: Natural-language cross-protocol portfolio assistant.
- [ ] `yield-optimizer`: Compare yields and rebalance.
- [ ] `x402-agent-buyer`: Autonomous buyer calling x402-paywalled APIs within budget.
- [ ] `doc-grounded-builder-agent`: Docs-grounded agent answering and executing tasks on Pharos.
- [x] [`multi-protocol-aggregator`](tasks/30-multi-protocol-aggregator): Multi-protocol yield & liquidity aggregator across Harbor RWA, Morpho Blue, and FaroSwap with circuit breaker fault isolation.

---

## 🛠️ Getting Started (On Any Machine)

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Git**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/wakanda-soul/pharos-ai.git
cd pharos-ai

# 2. Install dependencies
npm install

# 3. Link CLI tools globally into your system PATH
npm link
```

---

## 🧰 Global CLI Suite

Once `npm link` is run, all tools are executable directly from any folder in your terminal:

| Command | Task | Description | Example |
|---|---|---|---|
| `pharos-state` | **Task 01** | Inspect smart contract state via Chain MCP in plain language | `pharos-state -c USDC` |
| `pharos-events` | **Task 02** | Real-time event monitor for ProsPixel game via Chain MCP | `pharos-events -p 5000` |
| `pharos-docs` | **Task 04** | Fast developer docs search with direct links and zero hallucination | `pharos-docs "how do I deploy a contract?"` |
| `pharos-alert` | **Task 05** | On-chain alert bot for price, whale transfers & contract events | `pharos-alert --mode price --once` |
| `pharos-support` | **Task 06** | Transaction failure diagnostic doctor & support ticket generator | `pharos-support --demo` |
| `pharos-flow` | **Task 07** | Composed flow: Chain MCP live query -> SkillEngine decision -> Action synthesis | `pharos-flow demo` |
| `pharos-explain` | **Task 08** | Explain-Then-Act: Explain function via Docs MCP, execute via Chain MCP, and interpret | `pharos-explain explain oracle:latestRoundData` |
| `pharos-guardian` | **Task 09** | SkillEngine Multi-condition execution gate: Oracle price, gas, and liquidity safety checks | `pharos-guardian demo` |
| `pharos-dry-run` | **Task 10** | Pre-flight transaction simulator: Zero-broadcast simulation, gas pricing & state-diff gate | `pharos-dry-run demo` |
| `pharos-batch` | **Task 11** | Multi-action bundling engine: Multicall3 execution, gas savings report & fault isolation | `pharos-batch demo` |
| `pharos-gatekeeper` | **Task 12** | Zero-trust execution policy sentinel: multi-asset spend limits, allowlists & audit log | `pharos-gatekeeper demo` |
| `pharos-gas-opt` | **Task 13** | Gas fee optimizer: reservation decay curve, opportunistic dip trigger & deadline SLA | `pharos-gas-opt demo` |
| `pharos-nl-pay` | **Task 14** | Natural-language payment agent: free text parsing, PNS domains, pre-flight summary & unsigned tx | `pharos-nl-pay demo` |
| `pharos-recurring` | **Task 15** | Recurring payment agent: weekly & monthly schedules, failure handling & double-pay lock | `pharos-recurring demo` |
| `pharos-invoice` | **Task 16** | Invoice-to-payment agent: multi-format extraction, zero-guessing anomaly sentinel & calldata reference memo | `pharos-invoice demo` |
| `pharos-x402` | **Task 17** | x402 paywalled API engine on Atlantic Testnet: paid endpoints (0.05/0.25 USDC), free /health, facilitator & client | `pharos-x402 demo` |
| `pharos-aggregator` | **Task 30** | Multi-protocol yield router across Harbor, Morpho & FaroSwap with circuit breaker | `pharos-aggregator route --token USDC --amount 10000` |

### Running via NPM Scripts (Without Global Linking)

If you prefer running directly from the repository without modifying system PATH:

```bash
# Task 01: Read Contract State
npm run state:read -- -c USDC

# Task 02: ProsPixel Event Monitor
npm run event:monitor

# Task 04: Doc Search CLI
npm run docs:search -- "what is the mainnet chain ID?"

# Task 05: On-Chain Alert Bot
npm run alert:bot -- --mode transfer --min-amount 100 --once

# Task 06: dApp Support Agent
npm run support -- --demo

# Task 09: Threshold Guardian
npm run guardian -- demo

# Task 10: Dry-Run Executor
npm run dry-run -- demo

# Task 11: Batch Executor
npm run batch -- demo

# Task 12: Policy Gatekeeper
npm run gatekeeper -- demo

# Task 13: Gas Fee Optimizer
npm run gas-opt -- demo

# Task 14: Natural-Language Payment Agent
npm run nl-pay -- demo

# Task 15: Recurring Payment Agent
npm run recurring -- demo

# Task 16: Invoice-to-Payment Agent
npm run invoice -- demo

# Task 17: x402 Paywalled API
npm run x402 -- demo

# Task 30: Multi-Protocol Aggregator
npm run aggregator -- rates
npm run aggregator -- route --token USDC --amount 10000
```
