---
name: pharos-weekly-digest-agent
description: Periodic executive reporting agent for Pharos that aggregates wallet and protocol metrics on a configurable schedule, compares performance against baseline periods, highlights top 3 notable events, and delivers multi-channel digests.
---

# Pharos Skill: Weekly Digest Agent

## Purpose
The **Weekly Digest Agent** automates periodic executive summaries for on-chain wallets and protocols on Pharos Mainnet. It runs on a scheduled cadence (default: weekly Mondays at 09:00 UTC), compares key metrics against the previous period, spotlights the Top 3 notable events with explorer links, and delivers to Discord, Telegram, Email, and published HTML pages.

### Core Capabilities:
1. **Configurable Recurrence Scheduling**:
   - Defaults to weekly execution (`0 9 * * 1`), with support for daily, biweekly, or custom cron intervals.
   - Automatically derives contiguous accounting windows for period-over-period comparisons.
2. **Period-over-Period Performance Analytics**:
   - Measures turnover, transaction throughput, inflows, outflows, net cashflow, and gas usage.
   - Computes percentage changes ($\Delta\%$) and assigns trend badges (`SURGE`, `CLIMB`, `STABLE`, `DECLINE`).
3. **Top 3 Notable Event Curation**:
   - Scores transactions by significance and curates strictly the Top 3 events with direct PharosScan links.
4. **Multi-Channel Dispatcher**:
   - Publishes responsive dark-mode HTML pages.
   - Delivers formatted payloads to Discord webhooks, Telegram bots, and HTML email.

---

## Quick Start & Usage

```bash
# Run demonstration digest
pharos-digest demo

# Inspect schedule
pharos-digest schedule

# Generate digest
pharos-digest generate 0x6119871b4eb66db137dcfad59655853ea6fe58ce --publish-html
```
