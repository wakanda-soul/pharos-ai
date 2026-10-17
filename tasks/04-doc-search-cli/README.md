# Task 04: Doc-Search CLI & Developer Docs MCP Server

A developer CLI tool and Model Context Protocol (MCP) server built on top of the **Pharos Developer Docs MCP** ecosystem. Enables developers and AI agents to search official Pharos documentation directly from their terminal, receiving concise answers with direct source links, follow-up suggestions, and zero hallucination.

---

## 1. Features & Architecture

- **Natural-Language Search**: Query documentation using natural questions (e.g. `pharos-docs "how do I deploy a contract?"`).
- **Sourced Answers**: Returns direct instructions, code commands, and verified markdown links (`https://docs.pharos.xyz/...`).
- **No Hallucination**: Gracefully identifies when a question is outside the scope of Pharos documentation and suggests related official topics instead of inventing false information.
- **Dual Transport**:
  1. **CLI Executable**: Fast terminal utility with styled output (`pharos-docs` or `npx tsx tasks/04-doc-search-cli/src/cli.ts`).
  2. **MCP Server**: Stdio-based MCP server (`@modelcontextprotocol/sdk`) ready for Claude Desktop, Cursor, Windsurf, or custom agent pipelines.
- **Structured JSON Support**: Supports `--json` flag for automated pipelines, CI/CD, and agent tool execution.

---

## 2. Installation & Quickstart

### Option A: Global CLI
```bash
# Run globally anywhere on the system
pharos-docs "how do I deploy a contract?"
```

### Option B: From Repository Root
```bash
# Using tsx from repository
npx tsx tasks/04-doc-search-cli/src/cli.ts "what is the mainnet chain ID and RPC URL?"

# Or via npm script
npm run task:04 -- "how do I deploy a contract?"
```

---

## 3. Usage & Options

```text
Usage: pharos-docs [options] [question...]

Search Pharos Developer Documentation directly from your terminal

Arguments:
  question           Natural-language question to search in Pharos docs

Options:
  -g, --goal <goal>  Broader task or goal to tailor the answer
  -j, --json         Output response in structured JSON
  -v, --verbose      Show detailed network timings and raw metadata
  -h, --help         Display help for command
```

---

## 4. Real Example Queries & Terminal Outputs (3 Examples)

### Example 1: Smart Contract Deployment (Foundry)
```bash
pharos-docs "how do I deploy a contract?"
```

**Output**:
```text
================================================================================
  🔍  PHAROS DEVELOPER DOC-SEARCH CLI  [Developer Docs MCP]                     
================================================================================
Query:        "how do I deploy a contract?"
Status:       🟢 Answer Found
--------------------------------------------------------------------------------

📖 CONCISE ANSWER:
For a Solidity contract on Pharos, you can deploy with Foundry:

1. Compile and test your contract:

   ```sh
   forge build
   forge test
   ```
2. Create a Foundry deployment script that loads your deployer key with `vm.envUint("PRIVATE_KEY")`, starts broadcasting, and creates your contract.
3. Set the key and deploy:

   ```sh
   export PRIVATE_KEY=<your-private-key>
   forge script script/DeployToken.s.sol --rpc-url <PHAROS_RPC_URL> --broadcast
   ```

Replace the script name and RPC URL as needed. Make sure the deploying wallet has enough testnet tokens to cover deployment costs. The Write Your First Token guide includes a complete script example.

--------------------------------------------------------------------------------
🔗 SOURCE DOCUMENTATION SECTIONS:
  1. Write Your First Uniswap Contract
     -> https://docs.pharos.xyz/developer-guide/foundry/write-your-first-uniswap-contract.md
  2. Write Your First Uniswap Contract
     -> https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-uniswap-contract.md
  3. Validator Node Deployment
     -> https://docs.pharos.xyz/node-and-validator-guide/validator-node-deployment.md
  4. Write Your First Token
     -> https://docs.pharos.xyz/developer-guide/foundry/write-your-first-token.md
  5. Write Your First NFT
     -> https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-nft.md

--------------------------------------------------------------------------------
💡 SUGGESTED FOLLOW-UP QUESTIONS:
  • Where to find example DeployToken.s.sol?
  • How to set PHAROS_RPC_URL correctly?
  • What if forge script fails with gas error?

================================================================================
```

---

### Example 2: Network Parameters & RPC
```bash
pharos-docs "what is the mainnet chain ID and RPC URL?"
```

**Output**:
```text
================================================================================
  🔍  PHAROS DEVELOPER DOC-SEARCH CLI  [Developer Docs MCP]                     
================================================================================
Query:        "what is the mainnet chain ID and RPC URL?"
Status:       🟢 Answer Found
--------------------------------------------------------------------------------

📖 CONCISE ANSWER:
Pharos Pacific Mainnet uses:

* **Chain ID:** `1672`
* **RPC URL:** `https://rpc.pharos.xyz`

See Pacific Mainnet for full configuration details.

--------------------------------------------------------------------------------
🔗 SOURCE DOCUMENTATION SECTIONS:
  1. Pacific Mainnet
     -> https://docs.pharos.xyz/getting-started/network/pacific-mainnet.md
  2. Atlantic Testnet
     -> https://docs.pharos.xyz/getting-started/network/atlantic-testnet.md
  3. ZAN RPC
     -> https://docs.pharos.xyz/tooling-and-infrastructure/rpc/zan.md
  4. Alchemy RPC
     -> https://docs.pharos.xyz/tooling-and-infrastructure/rpc/alchemy.md

--------------------------------------------------------------------------------
💡 SUGGESTED FOLLOW-UP QUESTIONS:
  • What about Atlantic testnet details?
  • Any alternative RPCs for Pacific?
  • How to verify chain ID in code?

================================================================================
```

---

### Example 3: Handling "No Good Answer Found" (Zero Hallucination)
```bash
pharos-docs "how to bake a chocolate cake"
```

**Output**:
```text
================================================================================
  🔍  PHAROS DEVELOPER DOC-SEARCH CLI  [Developer Docs MCP]                     
================================================================================
Query:        "how to bake a chocolate cake"
Status:       ⚠️  No Relevant Doc Found
--------------------------------------------------------------------------------

⚠️  NOTICE:
   I can’t help with baking a chocolate cake. I’m here to help with information in these docs.

📚 RECOMMENDED PHAROS TOPICS YOU CAN SEARCH INSTEAD:
  • Network Setup:    "what is the mainnet chain ID and RPC URL?"
  • Smart Contracts:  "how do I deploy a contract with Foundry?"
  • Chain MCP:        "how do I query events with get_logs?"
  • Tokens:           "how do I write an ERC-20 token?"
  • Nodes:            "how do I deploy a validator node?"

🌐 OFFICIAL DOCUMENTATION INDEX:
   https://docs.pharos.xyz/sitemap.md

================================================================================
```

---

## 5. Integrating with MCP Clients (Cursor, Claude Desktop)

To use the Developer Docs MCP server inside Claude Desktop or Cursor:

```json
{
  "mcpServers": {
    "pharos-docs": {
      "command": "npx",
      "args": ["-y", "tsx", "/root/pharos-ai/tasks/04-doc-search-cli/src/docs-mcp-server.ts"]
    }
  }
}
```

### Available MCP Tools

| Tool Name | Parameters | Description |
|:---|:---|:---|
| `search_pharos_docs` | `query` (string, required), `goal` (string, optional) | Queries official Pharos docs and returns concise answer + markdown links. |
| `get_network_specs` | `network` ("mainnet" \| "testnet" \| "all") | Returns official network parameters and RPC URLs in structured JSON. |
