---
name: pharos-whale-watching-agent
description: On-chain capital surveillance agent for Pharos that monitors high-net-worth accounts, filters significant transactions via multi-tier thresholds, resolves entity labels, and synthesizes movement narrative reports.
---

# Pharos Skill: Whale-Watching Agent

## Purpose
The **Whale-Watching Agent** monitors large capital flows across high-net-worth accounts on Pharos. It filters noise using configurable thresholds, identifies counterparties (DEX, Lending, CEX, Burns), and provides narrative explanations of whale movements alongside aggregate cross-whale activity summaries.

### Core Capabilities:
1. **Configurable Address Tracking**:
   - Tracks at least 5 configurable addresses with dynamic runtime registration and unregistration.
2. **Multi-Tier Significance Filtering**:
   - Supports global USD thresholds (e.g. $50,000+), token-specific quotas (e.g. minimum 50k USDC or 30k PROS), and per-whale overrides.
   - Suppresses sub-threshold noise and internal self-transfers.
3. **Contextual Entity Resolution & Narratives**:
   - Resolves known counterparties: FaroSwap DEX Router, Harbor/Morpho Lending pools, Binance CEX wallets, and burn addresses (`0x0` / `0xdEaD`).
   - Emits structured reports explaining *what moved, how much, and where to*.
4. **Cross-Whale Activity Digest**:
   - Consolidates total transferred volume, sector share breakdown, and peak single movements.

---

## Quick Start & Usage

```bash
# Run demonstration suite
pharos-whale demo

# List watched addresses
pharos-whale list

# View summary digest
pharos-whale summary
```
