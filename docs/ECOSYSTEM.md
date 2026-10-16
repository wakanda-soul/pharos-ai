# Pharos AI Ecosystem & Reference Memory

This document stores essential knowledge, endpoints, links, and operational guides for building agents in the **Pharos** ecosystem and participating in the **Pharos Agent Arena**.

---

## 1. Essential Links

| Resource | URL | Description |
|---|---|---|
| **Agent Arena** | `https://pharos-agent-arena.vercel.app/` | Task board, submissions, points ladder, leaderboard |
| **DevHub** | `https://www.pharos.xyz/devhub` | Official developer portal, templates, ecosystem links |
| **AI Portal** | `https://ai.pharos.xyz/` | Web workspace for interacting with Pharos agents, MCP, and skills |
| **Pharos MCP Docs** | `https://ai.pharos.xyz/pharos-mcp` | Chain MCP interactive overview |
| **Build Tools** | `https://ai.pharos.xyz/build-tools` | Quickstart commands & tooling templates |
| **Skill Engine** | `https://ai.pharos.xyz/skill-engine` | Official SkillEngine docs and installation commands |
| **llms.txt** | `https://www.pharos.xyz/llms.txt` | Complete curated AI documentation index |
| **Official Docs** | `https://docs.pharos.xyz/` | Full technical documentation |
| **Full LLMs Bundle** | `https://docs.pharos.xyz/llms-full.txt` | Unabridged LLM documentation text |
| **GitHub pharos-mcp** | `https://github.com/PharosNetwork/pharos-mcp` | Source code & self-hosting instructions for Pharos Chain MCP |
| **GitHub pharos-skill-engine** | `https://github.com/PharosNetwork/pharos-skill-engine` | Foundry-based skills, CLI wrappers, script generators |
| **Anvita Flow Dashboard** | `https://flow.anvita.xyz/dashboard` | Manage agent wallet, top-up balance, capability sharing |

---

## 2. Network Specifications

Pharos is an EVM-compatible Layer 1 blockchain built for high-throughput, agentic workloads.

### Atlantic Testnet (Default for testing & Arena builds)
- **Network Name**: `atlantic-testnet`
- **Chain ID**: `688689` (`0xa8231`)
- **RPC URL**: `https://atlantic.dplabs-internal.com`
- **Native Token**: `PHRS` (18 decimals)
- **Explorer**: `https://atlantic.pharosscan.xyz/`
- **Explorer API**: `https://api.socialscan.io/pharos-atlantic-testnet`

### Mainnet
- **Network Name**: `mainnet`
- **Chain ID**: `1672` (`0x688`)
- **RPC URL**: `https://rpc.pharos.xyz`
- **Alternative RPC**: `https://api.zan.top/node/v1/pharos/mainnet/...`
- **Native Token**: `PROS` (18 decimals)
- **Explorer**: `https://www.pharosscan.xyz/`
- **Explorer API**: `https://api.socialscan.io/pharos-mainnet`

---

## 3. Pharos Chain MCP (Model Context Protocol)

Pharos provides a hosted Streamable HTTP MCP server that exposes on-chain data directly to AI agents.

### Hosted Endpoint
- **URL**: `https://mcp.pharos.xyz/mcp`
- **Protocol**: Streamable HTTP
- **Rate Limit**: 120 requests / minute per IP
- **Auth**: None required for read-only queries

### Configuration for MCP Clients

#### Native Streamable HTTP:
```json
{
  "mcpServers": {
    "pharos": {
      "type": "http",
      "url": "https://mcp.pharos.xyz/mcp"
    }
  }
}
```

#### Stdio Bridge (via `mcp-remote`):
```json
{
  "mcpServers": {
    "pharos": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.pharos.xyz/mcp"]
    }
  }
}
```

### 13 Available Read-Only Tools

1. `get_chain_info`: Retrieve chain ID, client version, latest block height.
2. `get_block_number`: Current block height.
3. `get_balance`: Native balance (PHRS/PROS) for an address.
4. `get_transaction_count`: Nonce for an address.
5. `get_gas_price`: Current network gas price & max priority fee.
6. `get_block`: Block details by tag (`latest`, `earliest`, `pending`) or height.
7. `get_transaction`: Details of a transaction by hash.
8. `get_transaction_receipt`: Receipt and status of an executed transaction.
9. `get_code`: Bytecode of a deployed contract.
10. `get_storage_at`: Read raw contract storage slot.
11. `eth_call`: Read-only contract call (view/pure functions).
12. `estimate_gas`: Estimate gas cost for a transaction.
13. `get_logs`: Query event logs by address, topics, block range (up to 1,000 blocks).

> Note: `send_raw_transaction` is disabled on the public hosted endpoint for non-custodial security. Write operations are performed using self-hosted nodes or the **Skill Engine** with local signing.

---

## 4. Pharos Skill Engine

The Skill Engine enables AI agents to perform complex, automated on-chain interactions using Foundry CLI tools (`cast` and `forge`).

### Installation
```bash
# Add skill via package manager
npx skills add https://github.com/PharosNetwork/pharos-skill-engine
# Or with pnpm
pnpm dlx skills add https://github.com/PharosNetwork/pharos-skill-engine
```

### Foundry CLI Requirements
Foundry (`cast`, `forge`) is mandatory for write operations and local signing:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
cast --version
```

### Core Capabilities
- **Query balance & assets**: `cast balance <address> --rpc-url <rpc>`
- **Read contract state**: `cast call <contract> "<sig>" <args> --rpc-url <rpc>`
- **Send native transfer**: `cast send <to> --value <amount> --rpc-url <rpc> --private-key $PRIVATE_KEY`
- **Write contract interaction**: `cast send <contract> "<sig>" <args> --rpc-url <rpc> --private-key $PRIVATE_KEY`
- **Deploy contracts**: `forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast --private-key $PRIVATE_KEY`
- **Verify contracts**: `forge verify-contract <address> <contract> --chain-id <id> --verifier-url <explorerApiUrl>`
- **Batch transfers / Airdrops**: Hardened batch distribution scripts supporting single and multi-batch execution.

---

## 5. Anvita Flow Collaboration Framework

Anvita Flow provides agent collaboration infrastructure for directed capability sharing:
- Discovers and calls specialized subagents (finance, analytics, trading, auditing).
- Manages agent wallet, micro-payments for paid agent-to-agent (A2A) calls.
- Enforces access control policies and permission scopes.
- Dashboard: `https://flow.anvita.xyz/dashboard`

---

## 6. Agent Arena Strategy & Guidelines

### Scoring Rules
- **Easy**: 50 points
- **Medium**: 100 points
- **Hard**: 200 points
- **Video Walkthrough**: +50 bonus points per task
- **Reviewer Bonus**: Awarded for clean code, solid documentation, production readiness.

### Ranking Ladders
- **Contributor**: 300 pts (Basic onboarding + first builds shipped)
- **Builder**: 1,200 pts (Consistent series of operational agents)
- **Advocate**: 2,200 pts (High-impact cross-stack agents)

### Submission Requirements for Every Task
1. Working agent/script with clean repository structure.
2. Clear `README.md` containing:
   - Target contract / scenario chosen.
   - Setup & running instructions.
   - Sample inputs and outputs.
3. Proof link:
   - Live share link from `ai.pharos.xyz`, OR
   - On-chain transaction hash on `atlantic.pharosscan.xyz` / `pharosscan.xyz`, OR
   - Public repository / demo link.
4. Optional video demo link (+50 pts).
