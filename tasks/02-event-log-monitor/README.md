# Task 02: On-Chain Event/Log Monitor (ProsPixel Game)

> **Agent Arena Task**: [Event/Log Monitor](https://pharos-agent-arena.vercel.app/tasks/event-log-monitor)  
> **Tier**: Easy  
> **Category**: Chain MCP  
> **Reward**: 50 pts (+50 with video)  
> **Target Game**: [PROS Pixel](https://prospixel.xyz/) — Collaborative Pixel Art Game on Pharos  
> **Contract Address**: `0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a` (Pharos Mainnet `1672`)

---

## 📖 Overview

A real-time on-chain game event monitor built for the **PROS Pixel** game ([prospixel.xyz](https://prospixel.xyz/)) on the **Pharos** blockchain. 

The monitor connects directly to the **Pharos Chain MCP** (`https://mcp.pharos.xyz/mcp`) over Streamable HTTP and polls for new on-chain events every **10 seconds**.

For every action in the game, the monitor parses and displays:
1. **Date & Time (UTC)** and exact **Block Number**.
2. **Player Wallet Address** (`user` / `to` / `lastOwner`).
3. **Action Performed**:
   - 🎨 **Buy / Paint Pixels** (`BatchPixelsBought`)
   - 💰 **Claim Rewards** (`Claimed`)
   - 📈 **Passive Resale Premium** (`PixelPremiumDistributed`)
   - 📝 **Player Registration** (`Registered`)
4. **Amount Paid**: Native PROS spent by the player.
5. **What was Received**: Number of pixels with (X, Y) canvas coordinates or claimed PROS rewards.
6. **Transaction Hash & Explorer Link**: Direct link to [pharosscan.xyz](https://www.pharosscan.xyz).

---

## ⚙️ How It Works (via Chain MCP)

1. **Chain MCP Handshake**: Establishes session with `https://mcp.pharos.xyz/mcp`.
2. **Log Query (`get_logs`)**: Queries event logs filtered by the ProsPixel contract `0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a`.
3. **Continuous Polling**: Polls every 10 seconds block-by-block for newly finalized transactions.
4. **Deduplication**: Tracks unique `${txHash}-${logIndex}` keys to guarantee zero duplicates.
5. **ABI Event Decoding**: Decodes raw event data and indexed topics into structured game parameters.

---

## 🚀 Installation & Setup (On Any Machine)

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **Git**

### Step-by-Step Setup
```bash
# 1. Clone repository
git clone https://github.com/wakanda-soul/pharos-ai.git
cd pharos-ai

# 2. Install dependencies
npm install

# 3. Link CLI globally (optional, makes `pharos-events` executable anywhere)
npm link
```

---

## 💻 How to Run

### Option A: Global CLI (After `npm link`)
```bash
# Run the ProsPixel game monitor (polls every 10s, with initial recent activity scan)
pharos-events

# Customize polling interval (e.g. 5s) and backfill block scan window
pharos-events -p 5000 -b 5000
```

### Option B: From Repository (Without Global Link)
```bash
# Via npm script
npm run event:monitor
npm run task:02

# Custom options via tsx
npx tsx tasks/02-event-log-monitor/src/index.ts -p 10000 -b 5000
```

---

## 📋 Sample Terminal Stream Output

```text
================================================================================
       🎮  PHAROS PROSPIXEL (https://prospixel.xyz/) GAME MONITOR              
================================================================================
Connecting to Pharos Chain MCP (https://mcp.pharos.xyz/mcp)...
📡 Network:          Pharos (Chain ID: 1672)
📍 Game Contract:    0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a
📦 Current Block:    #20,493,477
⏱️  Polling Interval: Every 10 seconds via Pharos MCP
================================================================================

⏳ Scanning recent blocks (#20,488,477 -> #20,493,477) for latest game activity...

📈 [2026-10-17 14:51:54 UTC] Block #20,488,976
   ⚡ ACTION:        PixelPremiumDistributed (Passive Resale Premium)
   👤 OWNER WALLET:  0x84CE7ce5da712361216082a67CFa930c0B9E83f6
   💸 AMOUNT PAID:   0 PROS (Passive Income)
   🎁 RECEIVED:      +0.431323749776713491 PROS premium for pixel (414, 484) sold at 1.64313809438747997 PROS
   🔗 TX HASH:       0xc51d8c6f0a7a68e8332cda6e464050d145fe7f864afed18d521db731d7be122e
   🌐 EXPLORER:      https://www.pharosscan.xyz/tx/0xc51d8c6f0a7a68e8332cda6e464050d145fe7f864afed18d521db731d7be122e
--------------------------------------------------------------------------------
🎨 [2026-10-17 14:51:54 UTC] Block #20,488,976
   ⚡ ACTION:        BatchPixelsBought (Canvas Pixels Painted)
   👤 PLAYER WALLET: 0x84CE7ce5da712361216082a67CFa930c0B9E83f6
   💸 AMOUNT PAID:   5.031273899080267659 PROS
   🎁 RECEIVED:      2 pixel(s) on canvas at (414, 484), (434, 621)
   🤝 INVITER:       0xBC00E7866C5F2276320887735C435283A36dd987 (Reward: 0.031970694710931257 PROS)
   🔗 TX HASH:       0xc51d8c6f0a7a68e8332cda6e464050d145fe7f864afed18d521db731d7be122e
   🌐 EXPLORER:      https://www.pharosscan.xyz/tx/0xc51d8c6f0a7a68e8332cda6e464050d145fe7f864afed18d521db731d7be122e
--------------------------------------------------------------------------------
💰 [2026-10-17 14:52:08 UTC] Block #20,488,991
   ⚡ ACTION:        Claimed (Game Rewards Withdrawn)
   👤 PLAYER WALLET: 0x84CE7ce5da712361216082a67CFa930c0B9E83f6
   💸 AMOUNT PAID:   0 PROS (Gas only)
   🎁 RECEIVED:      4.6454 PROS (Principal: 3.653793681249286609 + Premium: 0.959120841327937733 + Referral: 0.032441595691834187)
   🔗 TX HASH:       0xd7d0188619e951b8b3312af40cf34510c5be2d191ad57dde7304a26bde1e602a
   🌐 EXPLORER:      https://www.pharosscan.xyz/tx/0xd7d0188619e951b8b3312af40cf34510c5be2d191ad57dde7304a26bde1e602a
--------------------------------------------------------------------------------
🟢 [LIVE MONITOR ACTIVE] Listening for new game events every 10s... (Ctrl+C to stop)
```

---

## ✅ Requirements Compliance Checklist

- [x] **01. Uses Chain MCP log queries**: Invokes `get_logs` through `PharosMcpClient` filtered by ProsPixel contract `0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a`.
- [x] **02. Runs continuously with no duplicates**: Polls every 10 seconds block-by-block with strict deduplication (`${txHash}-${logIndex}`).
- [x] **03. Decodes each event into readable fields**: Date & time, wallet, action performed, paid amount, received rewards/pixels, tx hash, explorer link.
- [x] **04. Demonstrated catching live events**: Verified with real mainnet game transactions (pixels bought, premiums distributed, rewards claimed).
