# Task 22: Weekly Digest Agent

> **Pharos Agent Arena · Season of AI**  
> **Category**: `Support / Reporting` | **Tier**: `Medium` (100 base pts + 50 video bonus = 150 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous periodic activity summary and executive reporting agent for **Pharos Mainnet (Chain ID 1672)**. It runs on a configurable recurrence schedule (weekly by default every Monday at 09:00 UTC), evaluates activity across contiguous accounting windows for wallets or DeFi protocols, calculates period-over-period metric deltas ($\Delta\%$), spotlights the **Top 3 Notable Events** of the week with direct **PharosScan** explorer links, and delivers polished reports across multiple real channels (**Discord Webhook**, **Telegram Bot**, **Email**) and as a **Standalone Published HTML Page**.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Runs on a schedule (weekly by default, configurable)** | Recurrence schedule manager defaults to weekly (`0 9 * * 1`), supports daily, biweekly, and custom cron expressions, computes next execution timestamps, and derives contiguous accounting windows (`src/scheduler.ts`). | ✅ Complete |
| **02** | **Covers key metrics with a comparison to the previous period** | Period comparator calculates turnover volume, tx count, inbound/outbound flows, net cashflow, and gas; computes percentage change rates ($\Delta\%$), classifies trend momentum (`SURGE`, `CLIMB`, `STABLE`, `DECLINE`), and handles zero baselines cleanly (`src/metrics-comparator.ts`). | ✅ Complete |
| **03** | **Highlights the top 3 notable events of the period** | Significance scoring engine ranks events by capital volume, EVM reverts, governance actions, and liquidity injections; curates strictly the Top 3 events with ranks 1..3 and direct `https://pharosscan.xyz/tx/0x...` explorer links (`src/event-curator.ts`). | ✅ Complete |
| **04** | **Delivers to a real channel (email, Telegram, Discord) or as a published page** | Multi-channel dispatcher delivers to Discord (color-coded embed), Telegram (HTML bot message), Email (styled tables), and publishes a standalone responsive dark-mode HTML web page (`src/delivery/`, `src/dispatcher.ts`). | ✅ Complete |

---

## Project Structure

```
tasks/22-weekly-digest-agent/
├── bin/
│   └── pharos-digest.js          # Global executable CLI entrypoint
├── src/
│   ├── cli.ts                    # Command-line interface (demo, schedule, generate)
│   ├── delivery/
│   │   ├── discord-delivery.ts   # Discord Rich Embed webhook serializer & dispatcher
│   │   ├── email-formatter.ts    # Multipart HTML email body generator
│   │   ├── html-publisher.ts     # Standalone dark-mode HTML page publisher
│   │   └── telegram-delivery.ts  # Telegram HTML Bot API message serializer
│   ├── digest-generator.ts       # Master digest orchestrator & executive synthesizer
│   ├── dispatcher.ts             # Unified multi-channel delivery coordinator
│   ├── event-curator.ts          # Significance scoring & Top 3 notable event spotlight
│   ├── formatter.ts              # Terminal ASCII scorecard & trend badge formatter
│   ├── index.ts                  # Public library exports
│   ├── metrics-comparator.ts     # Period-over-period delta & trend analytics engine
│   ├── scenarios.ts              # Benchmark treasury wallet & FaroSwap protocol histories
│   ├── scheduler.ts              # Recurrence schedule manager & interval calculator
│   └── types.ts                  # Domain schemas, interfaces, and metric models
├── test/
│   └── weekly-digest.test.ts     # Automated test suite (14 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-digest schedule` | Introduction to Pharos Weekly Digest Agent. Demonstrate Requirement 01: inspecting the schedule configuration defaulting to weekly execution every Monday at 09:00 UTC (cron `0 9 * * 1`), and reconfiguring to daily or custom hours. |
| **0:25 - 0:55** | Terminal: `pharos-digest demo` | Run autonomous weekly digest simulation. Explain Requirement 02: period-over-period metric comparison between Week 08 and Week 07 baseline ($+\$262.5\text{k}$ turnover surge of $+138.2\%$, transaction throughput $+66.7\%$, net cashflow position $+\$47,500$ USD). |
| **0:55 - 1:25** | Terminal: Inspect Top 3 Notable Events | Explain Requirement 03: top 3 ranked events spotlighted with significance heuristics: #1 EVM Revert on Morpho Blue, #2 $\$250\text{k}$ USDC injection from Binance, #3 $\$100\text{k}$ collateral deposit into Harbor Lending Pool, each with clickable PharosScan explorer links. |
| **1:25 - 1:45** | Browser / Terminal: `cat published-digests/digest-*.html` | Demonstrate Requirement 04: inspect the published standalone executive HTML page featuring modern dark-mode UI, responsive KPI trend cards, clickable explorer links, plus multi-channel dispatch to Discord, Telegram, and Email. |
| **1:45 - 2:00** | Terminal: `npm test tasks/22-weekly-digest-agent` | Run automated test suite: `14 passed (14)`, confirming 100% test coverage across scheduling, metrics comparison, top-3 curation, and multi-channel delivery. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run task:22
# or
npx vitest run tasks/22-weekly-digest-agent/test/weekly-digest.test.ts
```

Output:
```
 ✓ tasks/22-weekly-digest-agent/test/weekly-digest.test.ts (14 tests)
   ✓ Task 22: Weekly Digest Agent Specification (14)
     ✓ Requirement 01: Runs on a schedule (weekly by default, configurable) (4)
       ✓ initializes with weekly schedule by default (every Monday at 09:00 UTC)
       ✓ allows reconfiguring schedule cadence to daily or biweekly with custom execution hour
       ✓ calculates the next calendar occurrence date accurately
       ✓ derives contiguous weekly accounting periods for current vs baseline comparison
     ✓ Requirement 02: Covers key metrics with a comparison to the previous period (2)
       ✓ computes aggregated financial totals and period-over-period delta rates
       ✓ gracefully handles zero baseline volume without NaN or Infinity errors
     ✓ Requirement 03: Highlights the top 3 notable events of the period (2)
       ✓ selects strictly the top 3 notable events ordered by significance score
       ✓ synthesizes informative placeholder highlights when period has fewer than 3 events
     ✓ Requirement 04: Delivers to a real channel or as a published page (5)
       ✓ publishes a standalone dark-mode HTML executive page to disk
       ✓ formats a rich Discord Embed payload with color coding and field length guards
       ✓ formats a clean Telegram message with HTML markup and explorer links
       ✓ formats an executive email HTML body with comparison table
       ✓ broadcasts digest across multiple channels via DigestDeliveryDispatcher
     ✓ Target Adaptability: Protocol Mode (FaroSwap AMM) (1)
       ✓ generates a specialized protocol digest for an automated market maker

 Test Files  1 passed (1)
      Tests  14 passed (14)
```
