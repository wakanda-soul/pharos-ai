---
name: pharos-multi-protocol-aggregator
description: Harbor-style autonomous agent skill for cross-protocol yield discovery, smart routing, portfolio aggregation, and deposit/withdrawal preparation across Harbor RWA Hub, Morpho Blue Lending, and FaroSwap AMM on Pharos Network (Chain ID: 1672).
---

# Pharos Multi-Protocol Aggregator Agent Skill

## Overview
This skill empowers an autonomous AI agent (on `ai.pharos.xyz`, Antigravity CLI, or any MCP-enabled assistant) to act as a **Harbor-style Smart Yield & Liquidity Agent** across the Pharos blockchain ecosystem.

Instead of locking users into a single protocol, the agent queries live rates, evaluates liquidity depth and safety scores, isolates degraded venues via an integrated Circuit Breaker, and prepares executable transactions with exact calldata and Foundry `cast` commands.

---

## When to Activate This Skill
Activate this skill whenever the user:
- Asks for the highest or best yield/APY on Pharos (e.g., *"Where can I deposit 5,000 USDC on Pharos?"*).
- Asks to compare yields between institutional RWA credit (Harbor), overcollateralized lending (Morpho Blue), and DEX liquidity pools (FaroSwap).
- Requests a deposit or withdrawal transaction prepared for wallet signing.
- Wants an overview of their cross-protocol active positions and weighted average return.
- Asks about protocol availability, safety ratings, or what happens when an external protocol goes offline.

---

## Integrated Protocols & Parameters

| Venue ID | Protocol Name | Underlying | Typical APY | Tenor / Lockup | Safety Score | Contract Address |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `harbor:apc3m` | Harbor RWA Hub (Axil Prime 3M) | USDC | 13.80% | 3 months | 88 / 100 | `0x7141528646B971a8F9BF96b21c172d1F0B180A5F` |
| `harbor:sharpbyte-usdc` | Harbor RWA Hub (SharpByte) | USDC | 14.18% | 3 months | 86 / 100 | `0x889234b6F045431614De476695276D329Ac5b18B` |
| `harbor:vrpc-6m` | Harbor RWA Hub (Axil Consumer 6M) | USDC | 15.00% | 6 months | 84 / 100 | `0x995321f24953B9803EbF8E7Ce988e0258d4aB979` |
| `harbor:vrpc-1d` | Harbor RWA Hub (Axil Consumer 1D) | USDC | 8.00% | 1 day | 90 / 100 | `0x334418a09b354Db925b45281519d5Bf5F8Ff419c` |
| `morpho:rockawayx-usdc` | Morpho Blue (Curated by RockawayX) | USDC | 8.50% | Instant Liquid | 94 / 100 | `0x4422119933AaBbCcDdEeFf001122334455667788` |
| `faroswap:wpros-usdc` | FaroSwap AMM DEX (WPROS/USDC LP) | USDC | 11.20% | Instant Liquid | 80 / 100 | `0x936564245b69f5a293b42cbd752e0ee3bb68b470` |

---

## Available MCP Tools

### 1. `get_pharos_rates`
* **Purpose**: Query real-time yields and TVL across all venues.
* **Arguments**:
  - `token` *(optional string)*: Filter by asset symbol (e.g. `"USDC"`).
  - `protocol` *(optional string)*: `"harbor"`, `"morpho"`, or `"faroswap"`.

### 2. `route_yield`
* **Purpose**: Multi-criteria routing to find the optimal venue and prepare calldata.
* **Arguments**:
  - `token` *(required string)*: e.g. `"USDC"`.
  - `amount_usd` *(required number)*: Deposit amount.
  - `max_lockup_tenor` *(optional)*: `"liquid"`, `"1d"`, `"3m"`, or `"6m"`.
  - `min_safety_score` *(optional number)*: e.g. `90` for lowest risk.
  - `user_address` *(optional)*: Sender wallet address.

### 3. `get_user_positions`
* **Purpose**: Aggregate portfolio positions across all protocols and calculate weighted APY.
* **Arguments**:
  - `user_address` *(required string)*: Target address.

### 4. `prepare_deposit` & `prepare_withdraw`
* **Purpose**: Directly generate ERC-4626 or Uniswap V2 calldata and Foundry `cast` commands.

### 5. `check_protocol_health`
* **Purpose**: Inspect Circuit Breaker states (`CLOSED`, `OPEN`, `HALF_OPEN`).

---

## Agent Response Guidelines
1. **Always Explain the Rationale**:
   When recommending a venue, present:
   - Primary reason (e.g., highest APY, highest safety, or zero lockup).
   - Expected annual return in USD.
   - Explicit tradeoffs (e.g., 3-month lockup vs instant liquid redemption).
2. **Transparent Risk Comparison**:
   Point out why other venues were not selected (e.g., skipped due to lockup constraint or safety threshold).
3. **Actionable Calldata**:
   Provide the prepared transaction details and copy-pasteable `cast send` CLI command for instant signing.
4. **Resilience**:
   If an external protocol API is temporarily unreachable, notify the user that the Circuit Breaker has safely isolated it while continuing to serve recommendations from the remaining operational venues.
