# Task 02: Event/Log Monitor

> **Agent Arena Task**: [Event/Log Monitor](https://pharos-agent-arena.vercel.app/tasks/event-log-monitor)  
> **Tier**: Easy  
> **Category**: Chain MCP  
> **Reward**: 50 pts (+50 with video)

---

## 📖 Overview

A real-time on-chain event and log monitor that tracks smart contracts on the **Pharos** blockchain (`Chain ID: 1672`) via the **Pharos Chain MCP** (`https://mcp.pharos.xyz/mcp`). 

Unlike static snapshot tools, this monitor runs **continuously block-by-block**, detects new events without duplicates, decodes raw log topics/data into human-readable parameters (addresses, formatted token amounts, transaction hashes), and prints live alerts.

---

## 🎯 Features

1. **Chain MCP Log Filtering**: Employs the `get_logs` tool on Pharos Chain MCP filtered by contract address and event signature (e.g. `Transfer`, `Approval`).
2. **Continuous Block-by-Block Execution**: Automatically tracks the latest block height (`get_block_number`), fetches logs for newly finalized blocks, and sleeps for a configurable poll interval.
3. **Guaranteed Deduplication**: Employs an in-memory unique key tracker (`${txHash}-${logIndex}`) to ensure no log is ever reported twice.
4. **Human-Readable Parameter Decoding**: Decodes event logs using Viem ABI decoders, calculates token decimals (USDC 6 decimals, WPROS 18 decimals), and prints clickable PharosScan explorer links.
5. **Initial Backfill Demonstration**: Scans recent blocks on startup so reviewers immediately see live on-chain transfers before entering continuous watching mode.

---

## 🚀 How to Run

From the project root:

```bash
# Run the default monitor (watches all ERC20 Transfer events with 20 blocks initial backfill)
npm run task:02

# Filter for a specific contract (e.g. USDC on Pharos Mainnet)
npx tsx tasks/02-event-log-monitor/src/index.ts -c 0xc879c018db60520f4355c26ed1a6d572cdac1815

# Customize polling interval (e.g. every 2 seconds) and backfill window
npx tsx tasks/02-event-log-monitor/src/index.ts -p 2000 -b 50
```

---

## 📋 Sample Live Output

```text
========================================================
       📡  PHAROS ON-CHAIN EVENT & LOG MONITOR         
========================================================
Connecting to Pharos Chain MCP (https://mcp.pharos.xyz/mcp)...
Connected: Pharos (Chain ID: 1672)
Current Block Height: #20,492,935
Event Filter:        Transfer
Contract Filter:     All Contracts
Polling Interval:    3000 ms
--------------------------------------------------------
⏳ Scanning past 20 blocks (from #20,492,915 to #20,492,935) for live events...

🔔 [EVENT #1] Transfer on Block #20,492,920
   📍 Contract: 0xc879...1815 (0xc879c018db60520f4355c26ed1a6d572cdac1815)
   👤 From:     0x912c...f647 (0x912c9aDe24D44d8922f0866D8Dcb079f1363f647)
   🎯 To:       0x9365...b470 (0x936564245B69f5a293b42cbd752E0eE3bb68b470)
   💰 Amount:   39.4708 USDC (Raw: 39470813)
   🔗 Tx Hash:  0x7697a1d789ba3a3e56c7960d35b057b465ca195bd36f67ab21717c671f8e42bb
   🌐 Explorer: https://www.pharosscan.xyz/tx/0x7697a1d789ba3a3e56c7960d35b057b465ca195bd36f67ab21717c671f8e42bb
--------------------------------------------------------
🔔 [EVENT #2] Transfer on Block #20,492,920
   📍 Contract: 0x52c4...f0b0 (0x52c48d4213107b20bc583832b0d951fb9ca8f0b0)
   👤 From:     0x9365...b470 (0x936564245B69f5a293b42cbd752E0eE3bb68b470)
   🎯 To:       0x912c...f647 (0x912c9aDe24D44d8922f0866D8Dcb079f1363f647)
   💰 Amount:   63.7636 WPROS (Raw: 63763560935597096960)
   🔗 Tx Hash:  0x7697a1d789ba3a3e56c7960d35b057b465ca195bd36f67ab21717c671f8e42bb
   🌐 Explorer: https://www.pharosscan.xyz/tx/0x7697a1d789ba3a3e56c7960d35b057b465ca195bd36f67ab21717c671f8e42bb
--------------------------------------------------------
🟢 Continuous real-time monitor active. Waiting for new on-chain events... (Press Ctrl+C to stop)
```

---

## ✅ Requirements Compliance Checklist

- [x] **01. Uses Chain MCP log queries**: Invokes `get_logs` through `PharosMcpClient` with `address` and `topics`.
- [x] **02. Runs continuously with no duplicates**: Tracks seen events via `${txHash}-${logIndex}` and polls block-by-block.
- [x] **03. Decodes each event into readable fields**: Extracts `from`, `to`, `amount` (formatted with decimals), `tx hash`, and `block`.
- [x] **04. Demonstrated catching live events**: Verified with live mainnet transfers on Pharos at block `#20,492,920+`.
