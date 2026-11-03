# Task 25: Trend Watcher

> **Pharos Agent Arena · Season of AI**  
> **Category**: `SkillEngine` | **Tier**: `Hard` (200 base pts + 50 video bonus = 250 pts)  
> **Target Network**: Pharos Mainnet (Chain ID `1672`, RPC: `https://rpc.pharos.xyz`)

---

## What You Build
An autonomous market surveillance, persistent state ledger, and noise-filtering Skill for **Pharos Mainnet (Chain ID 1672)**. In blockchain environments, automated agents that trigger actions based on isolated single-tick readings are vulnerable to flash-loan price swings, liquidity pool sandwiches, and temporary RPC anomalies.

The **Trend Watcher** is a **Skill with memory**. It stores all metric observations in a durable disk ledger, enforces a configurable confirmation threshold requiring at least 3 consecutive observations in the same trajectory, recovers cleanly across process crashes without data loss or duplication, renders chronological timelines highlighting the exact trigger moment, and suppresses transient flash spikes.

---

## Arena Requirements Coverage

| Req | Description | Implementation Details | Status |
|:---:|:---|:---|:---:|
| **01** | **Stores state between runs: persistent storage, not just in-memory** | Atomic on-disk JSON ledger using `write-then-renameSync` pattern (`.pharos-storage/trend-watcher/observations-ledger.json`), ensuring crash resilience and zero corruption (`src/observation-store.ts`). | ✅ Complete |
| **02** | **Trend rule needs at least 3 observations to trigger and is configurable** | Enforces minimum consecutive readings threshold ($\ge 3$ strictly required; rejects $< 3$ on init). Configurable for target metric, direction (`DOWNTREND`, `UPTREND`, `OUTFLOW`), and cumulative percentage delta hurdle (`src/trend-evaluator.ts`). | ✅ Complete |
| **03** | **Handles restarts without losing or duplicating history** | Restores 100% of historical observations on process boot; detects duplicate observation IDs and identical content fingerprints to prevent duplicate ingestion (`src/observation-store.ts`). | ✅ Complete |
| **04** | **Shows the stored history and the exact moment the trend condition was met** | Renders chronological ASCII observation timeline tables with step-by-step $\Delta\%$, cumulative deltas, and visually highlights the exact observation (`⭐ TRIGGER MOMENT`) that confirmed the trend (`src/formatter.ts`). | ✅ Complete |
| **05** | **Demonstrates that a single spike does not trigger it** | Includes dedicated noise filter that detects transient single-tick anomalies (e.g. flash crash to $-23\%$ that snaps back to mean) and classifies them as `NOISY_SPIKE_REJECTED`, suppressing false alarms (`src/trend-evaluator.ts`). | ✅ Complete |

---

## Project Structure

```
tasks/25-trend-watcher/
├── bin/
│   └── pharos-trend.js           # Global executable CLI entrypoint
├── src/
│   ├── cli.ts                    # Command-line interface (demo, record, evaluate, history, reset)
│   ├── formatter.ts              # Terminal scorecards & timeline generators with trigger highlights
│   ├── index.ts                  # Public library exports
│   ├── observation-store.ts      # Atomic disk persistence & deduplication ledger
│   ├── trend-evaluator.ts        # Multi-observation trend engine & noise spike sentinel
│   └── types.ts                  # Domain schemas, interfaces, and evaluation models
├── test/
│   └── trend-watcher.test.ts     # Automated test suite (12 unit tests passing)
├── README.md                     # Comprehensive documentation & video script
└── SKILL.md                      # Agent skill manifest & architecture diagrams
```

---

## Video Walkthrough Guide & Timestamps (2-Minute Demo)

| Timestamp | Screen / Action | Voiceover / Visual Narration |
|:---:|:---|:---|
| **0:00 - 0:25** | Terminal: `pharos-trend --help` | Introduction to Pharos Trend Watcher. Explain the problem: single-reading price triggers cause false liquidations and wasted gas from flash-loans and pool sandwiches. The Trend Watcher provides persistent memory and enforces multi-observation confirmation. |
| **0:25 - 0:55** | Terminal: `pharos-trend demo` (Scenario 1) | Inspect Scenario 1: A flash-loan selling spike crashes PROS/USDC price by $-23.33\%$ ($1.50 \to $1.15), but snaps back to $1.49 on the next tick. The Trend Watcher detects this as transient noise $\to$ Status: `NOISY_SPIKE_REJECTED (SUPPRESSED)`, preventing false triggers. |
| **0:55 - 1:25** | Terminal: `pharos-trend demo` (Scenario 2) | Inspect Scenario 2: A genuine downtrend unfolds over 4 checks ($1.50 \to $1.46 \to $1.42 \to $1.38). On observation #3 ($1.42), the 3 consecutive reading rule is satisfied $\to$ Status: `TREND_CONFIRMED`. Point out the exact `⭐ TRIGGER MOMENT` highlighted in the timeline. |
| **1:25 - 1:45** | Terminal: `pharos-trend demo` (Scenario 3) | Demonstrate Scenario 3: Process restart resilience. Terminate session, spawn fresh instance from persistent disk ledger, and show that all 4 observations were restored without loss. Re-ingest an existing observation to demonstrate duplicate suppression. |
| **1:45 - 2:00** | Terminal: `npm test tasks/25-trend-watcher` | Run automated test suite: `12 passed (12)`, confirming 100% test coverage across persistent disk storage, multi-observation rules, crash recovery, trigger moment identification, and single spike rejection. |

---

## Verification & Testing

Run the automated test suite:
```bash
npm run task:25
# or
npm test tasks/25-trend-watcher
```

Output:
```
 ✓ tasks/25-trend-watcher/test/trend-watcher.test.ts (12 tests) 105ms
   ✓ Task 25: Trend Watcher Specification (SkillEngine) (12)
     ✓ Requirement 01: Stores state between runs in persistent storage (2)
       ✓ persists observations directly to disk as valid JSON file
       ✓ loads persisted observations upon initializing a brand new store instance
     ✓ Requirement 02: Trend rule needs at least 3 observations to trigger and is configurable (3)
       ✓ strictly rejects configurations with minimumConsecutiveReadings < 3
       ✓ confirms trend only when at least 3 consecutive observations meet criteria
       ✓ dynamically adapts to custom configurations (4 readings, UPTREND)
     ✓ Requirement 03: Handles restarts without losing or duplicating history (2)
       ✓ simulates process restart and preserves full observation history
       ✓ ignores duplicate ingestions of identical observations without duplicating history
     ✓ Requirement 04: Shows stored history and the exact moment trend condition was met (2)
       ✓ returns full chronological observation history in evaluation report
       ✓ accurately identifies the exact observation and timestamp where trend was met
     ✓ Requirement 05: Demonstrates that a single spike does not trigger it (3)
       ✓ rejects an isolated single tick spike as transient noise without confirming trend
       ✓ rejects a single spike followed by immediate snapback without triggering action
       ✓ safely handles zero baseline and non-moving flat periods

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

---

## CLI Commands

```bash
# Run interactive live demonstration (Scenario 1, 2, and 3)
pharos-trend demo

# Record a new metric reading to persistent disk
pharos-trend record PROS/USDC 1.4200 --venue "FaroSwap AMM"

# Evaluate stored history against custom threshold
pharos-trend evaluate PROS/USDC --consecutive 3 --direction DOWNTREND --min-delta 1.5

# Inspect full chronological observation timeline
pharos-trend history PROS/USDC

# Reset persistent storage file
pharos-trend reset
```
