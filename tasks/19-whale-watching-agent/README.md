# Task 19: Whale-Watching Agent

> **Pharos Agent Arena · Season of AI**  
> **Category**: `Trading / Monitoring` | **Tier**: `Medium` (100 base pts + 50 video bonus = 150 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous on-chain capital surveillance agent that monitors high-net-worth accounts, filters significant transactions using multi-tier thresholds, annotates counterparties with verified Pharos ecosystem labels, produces human-readable narrative explanations answering **what moved, how much, and where to**, and synthesizes cross-whale activity summary digests.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Tracks at least 5 configurable addresses** | Engine tracks 5 verified high-net-worth accounts by default with support for dynamic registration and unregistration (`src/whale-engine.ts`) | ✅ Complete |
| **02** | **Configurable "significant" threshold per token or in value terms** | Multi-tier detection: global USD benchmark ($50,000 baseline), token-specific base unit minimums (PROS, USDC, USDT, WETH), custom whale overrides, and self-transfer filtering (`src/movement-detector.ts`) | ✅ Complete |
| **03** | **Each report explains the move: what moved, how much, and where to (labelled where known)** | Evaluates transfer semantics and labels verified protocols (FaroSwap, Harbor, Morpho Blue, Binance, Canonical Bridge, Burn Address) with contextual market explanations (`src/whale-engine.ts`, `src/entity-labels.ts`) | ✅ Complete |
| **04** | **Produces a summary view of recent activity across all watched addresses** | Consolidates aggregate USD volume, identifies peak movements, computes protocol sector distribution (DEX vs Lending vs CEX), and formats reverse-chronological flow tables (`src/activity-summary.ts`, `src/formatter.ts`) | ✅ Complete |

---

## Project Structure

```
tasks/19-whale-watching-agent/
├── bin/
│   └── pharos-whale.js           # Global executable CLI entrypoint
├── src/
│   ├── activity-summary.ts       # Cross-whale activity digest & protocol share aggregator
│   ├── cli.ts                    # Command-line interface (demo, list, summary)
│   ├── entity-labels.ts          # Verified protocol address registry & label resolver
│   ├── formatter.ts              # Terminal formatting, alert banners, and ASCII charts
│   ├── index.ts                  # Public library exports
│   ├── movement-detector.ts      # Multi-tier significance threshold evaluator
│   ├── scenarios.ts              # Realistic Pharos mainnet whale transfer scenarios
│   ├── token-registry.ts         # Token metadata, decimals, and USD price feeds
│   ├── types.ts                  # Domain schemas and interfaces
│   └── whale-engine.ts           # Core surveillance engine & narrative synthesizer
├── test/
│   └── whale-watcher.test.ts     # Automated test suite (19 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-whale list` | Introduction to Pharos Whale-Watching Agent. Show 5 monitored whale accounts (Genesis Alpha, Harbor LP, FaroSwap Arbitrageur, Morpho Depositor, Bridge MM) with custom tags and thresholds. |
| **0:25 - 0:55** | Terminal: `pharos-whale demo` | Launch interactive surveillance stream. Point out the active significance thresholds ($50k USD baseline, token quotas). Watch real-time block streaming. |
| **0:55 - 1:25** | Terminal: Inspect Event Banners | Demonstrate labeled explanatory reports: Event 1 (150,000 USDC into FaroSwap Router v1 for DEX swap), Event 2 (80,000 WPROS into Harbor Lending Pool), Event 5 (40,000 PROS burned to Dead Address). Highlight sub-threshold noise filtering on Event 6 ($3,200 USDC ignored). |
| **1:25 - 1:45** | Terminal: Activity Summary Digest | Walk through the cross-whale summary table: $535k aggregate USD volume, sector distribution (DEX 28%, Lending 22.4%, Whale Wallet 20.6%, CEX 17.8%, Burn 11.2%), peak single move ($150k), and reverse-chronological feed. |
| **1:45 - 2:00** | Terminal: `npm test` | Run automated test suite: `19 passed (19)`, demonstrating 100% requirements compliance across all edge cases. |

---

## Verification & Testing

Run the automated test suite covering all requirements and edge cases:
```bash
npm run task:19
# or
npx vitest run tasks/19-whale-watching-agent/test/whale-watcher.test.ts
```

Output:
```
 ✓ tasks/19-whale-watching-agent/test/whale-watcher.test.ts (19 tests)
   ✓ Task 19: Whale-Watching Agent Specification (19)
     ✓ Requirement 01: Tracks at least 5 configurable addresses (4)
     ✓ Requirement 02: Configurable "significant" threshold per token or in value terms (4)
     ✓ Requirement 03: Explanatory reports: what moved, how much, and where to (labelled) (6)
     ✓ Requirement 04: Produces a summary view of recent activity across all watched addresses (2)
     ✓ Edge Cases: Self-transfers and contract interaction suppression (3)

 Test Files  1 passed (1)
      Tests  19 passed (19)
```
