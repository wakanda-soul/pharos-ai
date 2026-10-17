# Task 01: Read Contract State

> **Agent Arena Task**: [Read Contract State](https://pharos-agent-arena.vercel.app/tasks/read-contract-state)  
> **Tier**: Easy  
> **Category**: Chain MCP  
> **Reward**: 50 pts (+50 with video)

---

## 📖 Overview

An autonomous script that inspects live state from deployed smart contracts on the **Pharos** blockchain (`Chain ID: 1672`) through the **Pharos Chain MCP** (`https://mcp.pharos.xyz/mcp`) and renders raw on-chain data into plain, human-readable language.

---

## 🎯 Chosen Contracts

This tool inspects production ERC20 contracts on Pharos Mainnet:
- **USDC (Preset: `USDC`)**: `0xc879c018db60520f4355c26ed1a6d572cdac1815` (Decimals: 6)
- **Wrapped PROS (Preset: `WPROS`)**: `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` (Decimals: 18)
- **Chainlink Token (Preset: `LINK`)**: `0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29` (Decimals: 18)
- *Any arbitrary contract address passed via `-c <address>`.*

---

## ⚙️ How It Works (via Chain MCP)

1. **MCP Session & Handshake**: Connects to `https://mcp.pharos.xyz/mcp` via Streamable HTTP and establishes an active MCP session.
2. **Block Height & Verification**:
   - Calls `get_chain_info` to get chain parameters.
   - Calls `get_block_number` to record the exact block height at which the state snapshot is taken.
   - Calls `get_code` to confirm active contract bytecode is deployed at the target address.
3. **On-Chain View Invocations (`eth_call`)**:
   - `name()`: Reads the human-readable token name.
   - `symbol()`: Reads the ticker symbol.
   - `decimals()`: Reads the token decimal precision.
   - `totalSupply()`: Reads the cumulative token issuance.
   - `balanceOf(holder)`: Reads the balance for a designated holder address.
4. **Human-Readable Formatting**:
   - Applies decimal shifting (`formatUnits`) so raw values like `41288142533576` base units become `41,288,142.5336 USDC`.
   - Labels and shortens hex addresses (`0xa0c0...e932`).

---

## 🚀 How to Run

From the project root:

```bash
# Query default USDC contract
npm run task:01

# Query Wrapped PROS (WPROS)
npx tsx tasks/01-read-contract-state/src/index.ts -c WPROS

# Query custom contract with a specific wallet address
npx tsx tasks/01-read-contract-state/src/index.ts -c 0xc879c018db60520f4355c26ed1a6d572cdac1815 -h 0xa0c048d1afb32de4e4b8756a55e22fde5c74e932

# Machine-readable JSON output
npx tsx tasks/01-read-contract-state/src/index.ts -c USDC --json
```

---

## 📋 Sample Output

```text
🔍 Inspecting contract state via Pharos Chain MCP...

========================================================
       🏛️  PHAROS SMART CONTRACT STATE INSPECTOR       
========================================================
📡 Network:             Pharos (Chain ID: 1672)
📦 Read at Block:       #20,487,740
📍 Contract Address:    0xc879c018db60520f4355c26ed1a6d572cdac1815
📜 Contract Bytecode:   1,798 bytes deployed
--------------------------------------------------------
               HUMAN-READABLE STATE DATA                
--------------------------------------------------------
🏷️  Token Name:          USDC
🔤 Symbol:              USDC
🔢 Decimals:            6
💰 Total Supply:        41,288,142.5336 USDC
   (Raw Value):         41288142533576 base units
👤 Sample Holder:       0xa0c0...e932 (0xa0c048d1afb32de4e4b8756a55e22fde5c74e932)
💳 Holder Balance:      0 USDC
   (Raw Value):         0 base units
--------------------------------------------------------
✅ Verified via Pharos Chain MCP (https://mcp.pharos.xyz/mcp)
========================================================
```

---

## ✅ Requirements Compliance Checklist

- [x] **01. Reads at least 3 different values**: Reads `name`, `symbol`, `decimals`, `totalSupply`, and `balanceOf`.
- [x] **02. Shows contract address and block number**: Both displayed prominently.
- [x] **03. Formats raw values for humans**: Token decimals applied, addresses formatted, base units explained.
- [x] **04. Short README included**: Details contract choice, run commands, and sample output.
