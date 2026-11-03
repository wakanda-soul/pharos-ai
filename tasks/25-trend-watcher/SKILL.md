---
name: pharos-trend-watcher
description: Autonomous multi-observation trend evaluator, persistent state ledger, and noise sentinel skill for Pharos Mainnet. Stores observations across runs in atomic disk storage, enforces configurable multi-observation confirmation rules (minimum >= 3 observations), recovers cleanly from process crashes without history loss or duplicate ingestion, visualizes chronological observation timelines with trigger moment highlights, and suppresses transient flash-loan and sandwich spikes.
---

# Pharos SkillEngine: Trend Watcher Skill

## Overview
The **Pharos Trend Watcher** is an autonomous market surveillance and stateful trend confirmation Skill engineered for **Pharos Mainnet (Chain ID 1672)**. In blockchain architectures and decentralized finance, reacting to single noisy ticks (such as temporary illiquid pool slippage, MEV sandwich attacks, flash-loans, or momentary RPC lags) causes severe whipsaws, erroneous liquidations, and wasted gas fees.

The Trend Watcher solves this by acting as a **Skill with memory**. It stores all metric observations in an atomic on-disk ledger, enforces a configurable confirmation threshold requiring at least 3 consecutive confirming observations, gracefully survives process crashes and container restarts without losing or duplicating data, and pinpoints the exact moment a genuine trend is confirmed.

### Core Capabilities:
1. **Persistent On-Disk State Storage (Requirement 01)**:
   - Persists observations directly to disk using atomic temporary-file swaps (`write-then-renameSync`).
   - Ensures memory state survives daemon restarts, container reboots, and network disconnections without data corruption.
2. **Configurable Multi-Observation Rule (Requirement 02)**:
   - Enforces a minimum confirmation threshold of $\ge 3$ consecutive observations before allowing downstream action.
   - Configurable for any on-chain metric (`PROS/USDC` spot price, Harbor Protocol TVL, Pharos base fee).
   - Supports trend directions: `DOWNTREND`, `UPTREND`, and `OUTFLOW`, combined with minimum cumulative percentage delta hurdles.
3. **Crash & Restart Recovery with Zero Duplication (Requirement 03)**:
   - Seamlessly rehydrates historical observation windows on boot.
   - Enforces deterministic content-based fingerprinting and observation IDs to ignore duplicate incoming readings cleanly.
4. **Observation Timeline & Trigger Moment Highlight (Requirement 04)**:
   - Renders formatted ASCII chronological timelines showing step-by-step $\Delta\%$, cumulative window change, and venue provenance.
   - Visually tags the exact observation (`⭐ TRIGGER MOMENT`) that satisfied the multi-observation threshold.
5. **Transient Single Spike Suppression (Requirement 05)**:
   - Evaluates isolated flash-crashes or pump-and-dump spikes that snap back to mean.
   - Flags transient noise as `NOISY_SPIKE_REJECTED` and suppresses automated triggers.

---

## Architecture Flow

```mermaid
flowchart TD
    A["Incoming Metric Reading\n(e.g., PROS/USDC Spot Price: $1.4200)"] --> B["Deduplication Sentinel & Content Fingerprint"]
    
    B -->|Duplicate Observation| C["Skip Ingestion\n(Zero History Duplication)"]
    B -->|New Observation| D["Atomic Disk Persistence\n(write-then-renameSync to observations-ledger.json)"]

    D --> E["Hydrate Chronological History Window"]
    
    E --> F{"Evaluate Consecutive Transitions\n(Streak Counter & Delta %)"]
    
    F -->|Single Tick Anomaly (>5% spike snapped back)| G["NOISY_SPIKE_REJECTED\n(Hold Action, Suppress False Alert)"]
    
    F -->|Adheres to Direction, Count < Threshold| H["ACCUMULATING_TREND\n(Buffering: e.g. 2 / 3 required)"]
    
    F -->|Counter-Trend Tick Detected| I["TREND_INVALIDATED\n(Reset Consecutive Counter to 0)"]
    
    F -->|Count >= Threshold (>= 3) & Delta >= Hurdle| J["TREND_CONFIRMED\n(Action Approved: Alert / Rebalance / Hedge)"]
    
    J --> K["Highlight Trigger Moment in Visual Timeline\n(Identify Exact Observation & Timestamp)"]
```

---

## CLI Usage

```bash
# Run interactive live demonstration (Single Spike Rejection, Multi-Observation Trend, Restart Recovery)
pharos-trend demo
npm run trend -- demo

# Record a live metric reading into persistent disk storage
pharos-trend record PROS/USDC 1.4200 --venue "FaroSwap AMM"

# Evaluate stored history against custom trend criteria
pharos-trend evaluate PROS/USDC --consecutive 3 --direction DOWNTREND --min-delta 2.0

# View complete historical timeline and trigger highlights
pharos-trend history PROS/USDC

# Reset persistent storage ledger
pharos-trend reset
```
