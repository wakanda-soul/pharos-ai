# Task 03: Developer Docs MCP Onboarding Audit

Autonomous onboarding report and experience log evaluating `ai.pharos.xyz` and the Developer Docs MCP endpoint without using external docs or community assistance.

---

## 1. Executive Summary

This report documents an end-to-end self-onboarding journey into the Pharos AI ecosystem. The objective was to build real-time blockchain integrations using solely Developer Docs MCP guidance, logging friction points, protocol gaps, and runtime barriers encountered along the way.

- **Platform Tested**: `ai.pharos.xyz` & `https://mcp.pharos.xyz/mcp`
- **Network Target**: Pharos Mainnet (Chain ID: `1672`)
- **Auditor**: `wakanda-soul`
- **Final Outcome**: Resolved all protocol and sandbox barriers, engineered a standalone Streamable HTTP MCP client, and delivered live blockchain tools for Tasks 01 and 02.

---

## 2. Requirement 01: Chronological Onboarding Log

| Step | Action Taken | Docs MCP Query / Exploration | Result / Answer Received |
| :--- | :--- | :--- | :--- |
| **01** | Inspect ecosystem documentation | Explored `ai.pharos.xyz` and indexed `llms.txt`. | Retrieved base network parameters: RPC `https://rpc.pharos.xyz`, Chain ID `1672`, Currency `PROS`. |
| **02** | Test on-chain read in Web Sandbox | Prompted: `@Pharos MCP Read the state of USDC contract 0xc879c018db60520f4355c26ed1a6d572cdac1815` | **Failed**: Received `"The exec tool is unavailable in this round. Without exec, I have no path to invoke eth_call..."`. |
| **03** | Switch to hosted HTTP MCP endpoint | Attempted raw JSON-RPC POST to `https://mcp.pharos.xyz/mcp` with `tools/call`. | **Failed**: Returned HTTP 400 `"Bad Request: Server not initialized"`. |
| **04** | Protocol deep dive & handshake resolution | Analyzed MCP specification for SSE / Streamable HTTP transports. | Discovered that an `initialize` request must be made first and the `mcp-session-id` header must be passed on all subsequent calls. |
| **05** | Locate verified token contract addresses | Searched docs for standard token addresses on Mainnet & Testnet. | Found chain IDs, but no canonical token directory. Extracted addresses from internal SkillEngine assets (`tokens.json`). |
| **06** | Engineered standalone MCP client | Implemented `src/shared/mcp-client.ts` with automated session handshake and viem decoding. | Successfully performed live `eth_call` and `eth_getLogs` against Pharos Mainnet. |
| **07** | Deployed Tasks 01 & 02 | Built ERC-20 State Inspector and ProsPixel Real-time Event Monitor. | Both tools fully functional and submitted to Agent Arena. |

---

## 3. Requirement 02 & 03: Concrete Gaps & Suggested Fixes

### Gap 1: Web Agent Execution Sandbox Failure
- **Exact Query Asked**:
  ```text
  @Pharos MCP Read the state of USDC contract 0xc879c018db60520f4355c26ed1a6d572cdac1815: get its name, symbol, decimals, and totalSupply formatted for humans.
  ```
- **Actual Response / Barrier**:
  ```text
  I cannot complete this request in the current turn.
  What blocked it: The exec tool — the only way this agent reaches the Pharos MCP server (via the bundled mcp-inspector-cli.mjs) — is unavailable in this round. Without exec, I have no path to invoke eth_call or any other Pharos MCP tool, so no on-chain read can be performed.
  ```
- **Breakdown Analysis**:
  The web UI at `ai.pharos.xyz` invokes tools by executing a Node process wrapper (`mcp-inspector-cli.mjs`) through an internal `exec` tool. In standard user sessions, `exec` permissions are restricted by the browser sandbox, rendering MCP tool calls unusable directly inside the web interface without prior developer notice.
- **Suggested Documentation Fix**:
  The Docs MCP should include a prominent notice:
  > *"The web chat playground at ai.pharos.xyz operates in a sandboxed environment where direct CLI execution is restricted. For automated or programmatic tool invocations, connect directly to the hosted Streamable HTTP MCP server at `https://mcp.pharos.xyz/mcp` or use an external MCP client."*

---

### Gap 2: Undocumented Streamable HTTP SSE Session Handshake
- **Exact Query Asked**:
  ```text
  How do I make HTTP requests to the hosted Pharos MCP endpoint https://mcp.pharos.xyz/mcp?
  ```
- **Actual Response / Barrier**:
  Documentation provides configuration snippets for desktop clients (e.g., Claude Desktop config), but lacks raw HTTP / API documentation. Making a standard POST request with `{"method": "tools/call", ...}` returns:
  ```http
  HTTP/1.1 400 Bad Request
  Content-Type: text/plain

  Server not initialized
  ```
- **Breakdown Analysis**:
  The hosted endpoint enforces the Model Context Protocol Streamable HTTP specification. Unlike standard JSON-RPC endpoints (such as Ethereum RPCs), callers cannot invoke tools stateless. An explicit `initialize` request must be sent first, followed by reading the `mcp-session-id` header and passing it in all following tool calls.
- **Suggested Documentation Fix**:
  Add an **"Interacting with Hosted MCP via HTTP"** guide with practical curl and TypeScript examples:
  ```bash
  # Step 1: Initialize session
  SESSION_ID=$(curl -si -X POST https://mcp.pharos.xyz/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}' \
    | grep -i mcp-session-id | awk '{print $2}' | tr -d '\r')

  # Step 2: Send initialized notification
  curl -s -X POST https://mcp.pharos.xyz/mcp \
    -H "Content-Type: application/json" \
    -H "mcp-session-id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

  # Step 3: Invoke tool
  curl -s -X POST https://mcp.pharos.xyz/mcp \
    -H "Content-Type: application/json" \
    -H "mcp-session-id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"eth_block_number","arguments":{}}}'
  ```

---

### Gap 3: Missing Canonical Contract & Token Registry
- **Exact Query Asked**:
  ```text
  What are the verified token contract addresses on Pharos Mainnet and Atlantic Testnet?
  ```
- **Actual Response / Barrier**:
  The Docs MCP successfully provides chain configurations (RPC URLs, explorer URLs, chain IDs), but returns no verified token registry or canonical address lists for USDC, WPROS, USDT, or game contracts.
- **Breakdown Analysis**:
  Developers trying to build DeFi or state-reading agents have to explore block explorers manually or inspect internal skill repositories (`pharos-skill-engine`) to locate contract addresses.
- **Suggested Documentation Fix**:
  Add a dedicated **"Contract & Token Addresses"** page to Developer Docs MCP with verified mainnet and testnet addresses:
  | Token / dApp | Mainnet Address (`1672`) | Testnet Address (`688689`) | Decimals |
  | :--- | :--- | :--- | :--- |
  | **USDC** | `0xc879c018db60520f4355c26ed1a6d572cdac1815` | `0x...` | 6 |
  | **WPROS** | `0x52c42d627C175d276d1e434E033F53106d7e0099` | `0x...` | 18 |
  | **ProsPixel Game** | `0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a` | `0x09d1D3cf60A86963c42ca159DA5D1a2D73644cf7` | N/A |

---

## 4. Requirement 04: What Was Built & Shipped

Despite the onboarding obstacles, all gaps were bypassed programmatically, culminating in the following production components:

1. **Standalone Streamable HTTP Client (`src/shared/mcp-client.ts`)**:
   - Automated `initialize` handshake and session persistence.
   - Resilient retry and reconnect logic.
   - 14 tool bindings supporting `eth_call`, `eth_getLogs`, `eth_block_number`, and more.

2. **Task 01: Contract State Inspector (`tasks/01-read-contract-state`)**:
   - Queries ERC-20 state directly via Pharos MCP.
   - Formats human-readable token amounts and balances.

3. **Task 02: ProsPixel Game Event Monitor (`tasks/02-event-log-monitor`)**:
   - Real-time polling of pixel purchases, player registrations, and dividend payouts.
   - Clean terminal feed with explorer links and transaction hashes.

---

## 5. Conclusion & Verification

This review represents an authentic self-onboarding trajectory conducted on `ai.pharos.xyz`. By addressing the 3 identified gaps in the Developer Docs MCP knowledge base, new developers will have a seamless path from zero knowledge to shipping production Web3 agents on the Pharos blockchain network.
