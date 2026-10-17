# Pharos Agent Arena — Execution Roadmap & Strategy

This document outlines the optimal sequential execution plan for all **30 Agent Arena tasks** in `pharos-ai`, ordered to maximize compounding knowledge, reuse shared modules, and rapidly advance through the Arena rank tiers:

1. **Contributor Rank**: 300 pts (Achieved after Phase 1)
2. **Builder Rank**: 1,200 pts (Achieved after Phase 2)
3. **Advocate Rank**: 2,200 pts (Achieved during Phase 3 & 4)

---

## Architecture & Shared Infrastructure

All tasks share root dependencies and the core runtime located in [`src/shared/`](../src/shared/):
- **[`src/shared/mcp-client.ts`](../src/shared/mcp-client.ts)**: Reusable client for the hosted Pharos Chain MCP server (`https://mcp.pharos.xyz/mcp`).
- **[`src/shared/chain.ts`](../src/shared/chain.ts)**: Viem chain definitions for Mainnet (`1672`) and Atlantic Testnet (`688689`), standard ERC20 ABIs, formatters.
- **[`src/shared/config.ts`](../src/shared/config.ts)**: Central network, token, and endpoint registry.
- **Foundry CLI**: `cast` & `forge` pre-installed globally for SkillEngine tasks.

Each task lives in its own directory under `tasks/` with an executable CLI script, configuration, and a submission-ready `README.md`.

---

## Phase 1: Fast Start & Foundations (Target: 300 pts — Contributor Rank 🎖️)

| # | Task Directory | Title | Category | Tier | Points | Status |
|---|---|---|---|---|---|---|
| 01 | `tasks/01-read-contract-state` | Read Contract State | Chain MCP | Easy | 50 | 🟢 Completed |
| 02 | `tasks/02-event-log-monitor` | Event/Log Monitor | Chain MCP | Easy | 50 | 🟢 Completed |
| 03 | `tasks/03-docs-mcp-onboarding` | Docs MCP Onboarding | Developer Docs MCP | Easy | 50 | 🟢 Completed |
| 04 | `tasks/04-doc-search-cli` | Doc-Search CLI | Developer Docs MCP | Easy | 50 | 🟢 Completed |
| 05 | `tasks/05-on-chain-alert-bot` | On-Chain Alert Bot | Trading / Monitoring | Easy | 50 | ⚪ Pending |
| 06 | `tasks/06-dapp-support-agent` | dApp Support Agent | Support / Reporting | Easy | 50 | ⚪ Pending |

---

## Phase 2: SkillEngine & Composition (Target: +700 pts — Builder Rank 🛠️)

| # | Task Directory | Title | Category | Tier | Points | Status |
|---|---|---|---|---|---|---|
| 07 | `tasks/07-skill-chain-mcp-flow` | Skill + Chain MCP Flow | Composition | Medium | 100 | ⚪ Pending |
| 08 | `tasks/08-docs-chain-mcp-agent` | Docs MCP + Chain MCP Agent | Composition | Medium | 100 | ⚪ Pending |
| 09 | `tasks/09-threshold-guardian` | Threshold Guardian | SkillEngine | Medium | 100 | ⚪ Pending |
| 10 | `tasks/10-dry-run-executor` | Dry-Run Executor | SkillEngine | Medium | 100 | ⚪ Pending |
| 11 | `tasks/11-batch-executor` | Batch Executor | SkillEngine | Medium | 100 | ⚪ Pending |
| 12 | `tasks/12-policy-gatekeeper` | Policy Gatekeeper | SkillEngine | Medium | 100 | ⚪ Pending |
| 13 | `tasks/13-gas-fee-optimizer` | Gas Fee Optimizer | Trading / Monitoring | Medium | 100 | ⚪ Pending |

---

## Phase 3: Payments & DeFi Automation (Target: +800 pts)

| # | Task Directory | Title | Category | Tier | Points | Status |
|---|---|---|---|---|---|---|
| 14 | `tasks/14-natural-language-payment-agent` | Natural-Language Payment Agent | Payments | Medium | 100 | ⚪ Pending |
| 15 | `tasks/15-recurring-payment-agent` | Recurring Payment Agent | Payments | Medium | 100 | ⚪ Pending |
| 16 | `tasks/16-invoice-to-payment-agent` | Invoice-to-Payment Agent | Payments | Medium | 100 | ⚪ Pending |
| 17 | `tasks/17-x402-paywalled-api` | x402 Paywalled API | Payments | Medium | 100 | ⚪ Pending |
| 18 | `tasks/18-liquidation-watchdog` | Liquidation Watchdog | DeFi / Portfolio | Medium | 100 | ⚪ Pending |
| 19 | `tasks/19-whale-watching-agent` | Whale-Watching Agent | Trading / Monitoring | Medium | 100 | ⚪ Pending |
| 20 | `tasks/20-wallet-risk-checker` | Wallet Risk Checker | Compliance / Security | Medium | 100 | ⚪ Pending |
| 21 | `tasks/21-audit-log-agent` | Audit-Log Agent | Compliance / Security | Medium | 100 | ⚪ Pending |

---

## Phase 4: Capstone & Advanced Autonomous Agents (Target: +1,650 pts — Advocate Rank 🚀)

| # | Task Directory | Title | Category | Tier | Points | Status |
|---|---|---|---|---|---|---|
| 22 | `tasks/22-weekly-digest-agent` | Weekly Digest Agent | Support / Reporting | Medium | 100 | ⚪ Pending |
| 23 | `tasks/23-saga-executor` | Saga Executor | SkillEngine | Hard | 200 | ⚪ Pending |
| 24 | `tasks/24-arbitrage-scanner` | Arbitrage Scanner | SkillEngine | Hard | 200 | ⚪ Pending |
| 25 | `tasks/25-trend-watcher` | Trend Watcher | SkillEngine | Hard | 200 | ⚪ Pending |
| 26 | `tasks/26-portfolio-assistant` | Portfolio Assistant | DeFi / Portfolio | Hard | 200 | ⚪ Pending |
| 27 | `tasks/27-yield-optimizer` | Yield Optimizer | DeFi / Portfolio | Hard | 200 | ⚪ Pending |
| 28 | `tasks/28-x402-agent-buyer` | x402 Agent Buyer | Payments | Hard | 200 | ⚪ Pending |
| 29 | `tasks/29-doc-grounded-builder-agent` | Doc-Grounded Builder Agent | Cross-tool / Advanced | Hard | 200 | ⚪ Pending |
| 30 | `tasks/30-multi-protocol-aggregator` | Multi-Protocol Aggregator | Cross-tool / Advanced | Hard | 200 | ⚪ Pending |

---

## Total Pool Potential
- **Base Task Points**: 3,500 pts
- **Video Walkthrough Bonus**: +1,500 pts (+50 pts x 30 tasks)
- **Grand Total**: Up to **5,000 pts**
