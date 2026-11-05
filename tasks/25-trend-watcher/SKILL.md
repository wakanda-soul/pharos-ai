---
name: pharos-trend-watcher
description: Multi-observation trend detection skill for Pharos with persistent on-disk state storage that requires at least 3 consecutive readings, handles restarts without duplication, and suppresses single-tick spikes.
---

# Pharos Skill: Trend Watcher

## Purpose
The **Trend Watcher** provides stateful memory and noise filtration for autonomous agents on Pharos Mainnet. It persists observations to disk, enforces a minimum 3-observation rule before confirming trends, recovers cleanly across process restarts, and suppresses single-block flash spikes.

### Core Capabilities:
1. **Persistent On-Disk Storage**:
   - Stores observation history using atomic write patterns (`.pharos-storage/trend-watcher/`).
   - Rehydrates full history on restart with duplicate fingerprint suppression.
2. **Configurable Multi-Observation Rule**:
   - Enforces a minimum of 3 consecutive confirming readings ($\ge 3$).
   - Validates directional trajectories (`UPTREND`, `DOWNTREND`) and cumulative percentage hurdles.
3. **Transient Noise & Flash Spike Filtration**:
   - Detects single-tick flash-loan anomalies and suppresses them as `NOISY_SPIKE_REJECTED`.
4. **Trigger Moment Identification**:
   - Accurately highlights the exact observation and timestamp where the trend condition was met.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-trend demo

# Record a new observation
pharos-trend record --metric PROS_USD --value 1.42

# View history and trend status
pharos-trend history --metric PROS_USD
```
