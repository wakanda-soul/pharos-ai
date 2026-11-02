---
name: pharos-docs-chain-mcp-agent
description: Autonomous Explain-Then-Act agent combining Developer Docs MCP and Chain MCP to explain smart contract functions, execute them on Pharos Mainnet, and interpret on-chain results in context.
---

# Pharos Docs MCP + Chain MCP Agent Skill

## Overview
This skill implements the **Explain-Then-Act** architectural paradigm:
1. When asked about a smart contract function, the agent queries the **Pharos Developer Docs MCP** to retrieve official specifications, parameter definitions, and documentation source citations.
2. The agent executes the exact contract function on-chain via **Pharos Chain MCP** on Pacific Mainnet (Chain ID `1672`).
3. The agent synthesizes a contextual interpretation binding the theoretical documentation to the live on-chain state.

## Supported Verified Presets
- `oracle:latestRoundData`: Explains AggregatorV3Interface specifications and reads live spot price from the Pharos Decentralized Price Feed Oracle (`0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8`).
- `usdc:totalSupply`: Explains ERC-20 circulating supply mechanics and reads the unburned USDC supply from `0xc879c018db60520f4355c26ed1a6d572cdac1815`.
- `oracle:description`: Explains price proxy architecture and retrieves the feed identifier string.
- `link:totalSupply`: Explains tokenomics and queries the total minted supply of Chainlink Token (`0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29`).

## CLI Usage
```bash
# Explain and execute Oracle price feed
pharos-explain explain oracle:latestRoundData

# Explain and execute USDC total supply
pharos-explain explain usdc:totalSupply

# List all available contract presets
pharos-explain list

# Run multi-contract demo
pharos-explain demo
```
