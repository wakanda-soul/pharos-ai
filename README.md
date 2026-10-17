# pharos-ai 🏛️

Autonomous AI agents, tools, and execution pipelines for the **Pharos** blockchain ecosystem (`Chain ID: 1672` / Atlantic Testnet `688689`), built for the **Pharos Agent Arena (Season of AI)**.

---

## 🎯 Project Overview

This repository is dedicated to building, testing, and shipping production-ready AI agents and tooling on the Pharos blockchain using:
- **Pharos Chain MCP**: Direct model context protocol integration with live on-chain state via JSON-RPC.
- **Pharos Skill Engine**: Automated transactions, smart contract deployments, and queries using Foundry (`cast` & `forge`).
- **Anvita Flow**: Multi-agent collaboration, capability routing, and agent wallet management.

---

## 📚 Knowledge Base & Memory

All ecosystem URLs, network configs, API specifications, and Arena tasks are documented and indexed in the `docs/` directory:

- 📖 **[Ecosystem Reference & Endpoints](docs/ECOSYSTEM.md)**: Network RPCs, Chain IDs, Native tokens, MCP setup, SkillEngine guides, and links.
- 📋 **[Agent Arena Task Catalog](docs/ARENA_TASKS.md)**: Full requirements and specifications for all 30 Agent Arena tasks.
- 📊 **[Arena Tasks (JSON)](docs/arena_tasks.json)**: Machine-readable database of all arena tasks.

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
- [ ] `on-chain-alert-bot`: Price, transfer, or contract alert bot.
- [ ] `dapp-support-agent`: Explains why a transaction failed.

> 🗺️ **Full Strategy & Sequential Execution Plan**: See **[ROADMAP.md](docs/ROADMAP.md)** for all 30 tasks, ranking ladders, and milestones.

### Tier 2 — Medium (100 pts each)
- [ ] `threshold-guardian`: Evaluate multi-conditions before firing actions.
- [ ] `dry-run-executor`: Simulate transaction outcome & cost before submitting.
- [ ] `batch-executor`: Bundle independent actions into one execution.
- [ ] `policy-gatekeeper`: Policy, allowance, and spend checks before execution.
- [ ] `skill-chain-mcp-flow`: Compose SkillEngine + Chain MCP.
- [ ] `docs-chain-mcp-agent`: Explain contract function with Docs MCP, then execute with Chain MCP.
- [ ] `liquidation-watchdog`: Monitor lending position & alert before liquidation.
- [ ] `natural-language-payment-agent`: NL prompt to prepared transaction.
- [ ] `recurring-payment-agent`: Repeating on-chain payments.
- [ ] `invoice-to-payment-agent`: Invoice parser to payment.
- [ ] `x402-paywalled-api`: API charged per request with x402 on Pharos.
- [ ] `whale-watching-agent`: Track and report significant address moves.
- [ ] `gas-fee-optimizer`: Timing transaction submission for lowest gas.
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
- [ ] `multi-protocol-aggregator`: Multi-protocol yield and liquidity aggregator.

---

## 🛠️ Getting Started

```bash
# Clone the repository
git clone https://github.com/wakanda-soul/pharos-ai.git
cd pharos-ai
```
