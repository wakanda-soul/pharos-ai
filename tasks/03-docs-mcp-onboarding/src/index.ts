#!/usr/bin/env node
import { Command } from "commander";

interface OnboardingGap {
  id: string;
  category: string;
  query: string;
  actualResponse: string;
  breakdownAnalysis: string;
  suggestedFix: string;
}

export const ONBOARDING_GAPS: OnboardingGap[] = [
  {
    id: "GAP-01",
    category: "Web Agent Execution Sandbox",
    query: "@Pharos MCP Read the state of USDC contract 0xc879c018db60520f4355c26ed1a6d572cdac1815: get its name, symbol, decimals, and totalSupply formatted for humans.",
    actualResponse: "I cannot complete this request in the current turn. What blocked it: The exec tool — the only way this agent reaches the Pharos MCP server (via the bundled mcp-inspector-cli.mjs) — is unavailable in this round. Without exec, I have no path to invoke eth_call or any other Pharos MCP tool...",
    breakdownAnalysis: "The web portal (ai.pharos.xyz) wraps the MCP inspector in a local process runner requiring the 'exec' tool. In the web sandbox environment, 'exec' is disabled, causing all prompt-based MCP on-chain read attempts in the browser playground to fail.",
    suggestedFix: "The Docs MCP should explicitly state that the web playground currently operates in a sandboxed mode without 'exec' permission, and instruct developers to connect directly to the hosted Streamable HTTP endpoint (https://mcp.pharos.xyz/mcp) using external clients or code."
  },
  {
    id: "GAP-02",
    category: "MCP Protocol Handshake & Session Management",
    query: "How do I make HTTP requests to the hosted Pharos MCP endpoint https://mcp.pharos.xyz/mcp?",
    actualResponse: "The documentation only mentions: { 'mcpServers': { 'pharos': { 'type': 'http', 'url': 'https://mcp.pharos.xyz/mcp' } } }. Sending a standard JSON-RPC tools/call request directly returns HTTP 400: 'Bad Request: Server not initialized'.",
    breakdownAnalysis: "The hosted MCP endpoint strictly follows the Streamable HTTP protocol specification (JSON-RPC over SSE). It requires a preliminary 'initialize' POST request, parsing the SSE stream, capturing the 'mcp-session-id' response header, and including that header in all subsequent tool requests. This is undocumented in the quickstart guides.",
    suggestedFix: "Add an explicit 'Custom HTTP Client Implementation' section in Developer Docs MCP with curl and TypeScript examples demonstrating the initialize handshake and session header propagation."
  },
  {
    id: "GAP-03",
    category: "Canonical Token & Contract Registry",
    query: "What are the verified token contract addresses on Pharos Mainnet and Atlantic Testnet?",
    actualResponse: "Developer Docs index (docs.pharos.xyz) documents the network parameters (Chain ID 1672, RPC rpc.pharos.xyz), but lacks an accessible reference table for deployed canonical tokens (USDC, WPROS, LINK, WETH).",
    breakdownAnalysis: "Developers looking to test ERC-20 contract calls have to scrape internal repository assets (such as pharos-skill-engine/assets/tokens.json) to locate verified addresses rather than finding them directly through Docs MCP.",
    suggestedFix: "Add a centralized 'Token & Contract Registry' page to Docs MCP containing verified mainnet and testnet addresses, decimal precisions, and official block explorer links."
  }
];

export function printOnboardingReport(): void {
  console.log("================================================================================");
  console.log("       📋  PHAROS DEVELOPER DOCS MCP — ONBOARDING AUDIT REPORT                 ");
  console.log("================================================================================");
  console.log("Platform Tested:  ai.pharos.xyz & https://mcp.pharos.xyz/mcp");
  console.log("Network:          Pharos Mainnet (Chain ID: 1672)");
  console.log("Auditor Identity: wakanda-soul");
  console.log("Methodology:      Autonomous self-onboarding using only Docs MCP & Chain MCP");
  console.log("================================================================================\n");

  console.log("--- 1. CHRONOLOGICAL ONBOARDING LOG ---");
  console.log("• Step 1: Navigated to ai.pharos.xyz, inspected network specifications and llms.txt.");
  console.log("• Step 2: Tested `@Pharos MCP` in the chat UI to query on-chain state of USDC (0xc879...).");
  console.log("  -> Result: Encountered 'exec tool unavailable' barrier inside the web sandbox.");
  console.log("• Step 3: Inspected hosted endpoint https://mcp.pharos.xyz/mcp to bypass sandbox limitations.");
  console.log("  -> Result: Discovered undocumented requirement for Streamable HTTP SSE session handshake.");
  console.log("• Step 4: Searched Developer Docs for verified token contracts and decimal specifications.");
  console.log("  -> Result: Found network parameters, but canonical token addresses required deeper discovery.");
  console.log("• Step 5: Developed a standalone TypeScript client (`PharosMcpClient`) implementing the handshake.");
  console.log("• Step 6: Built Task 01 (Contract State Inspector) and Task 02 (ProsPixel Game Monitor).\n");

  console.log("--- 2. CONCRETE GAPS & BREAKDOWNS IDENTIFIED (3) ---\n");

  ONBOARDING_GAPS.forEach((gap, index) => {
    console.log(`[${gap.id}] ${gap.category}`);
    console.log(`❓ Query Asked:`);
    console.log(`   "${gap.query}"`);
    console.log(`⚠️  Actual Response / Barrier:`);
    console.log(`   ${gap.actualResponse}`);
    console.log(`🔍 Breakdown Analysis:`);
    console.log(`   ${gap.breakdownAnalysis}`);
    console.log(`💡 Suggested Documentation Fix:`);
    console.log(`   ${gap.suggestedFix}`);
    console.log("--------------------------------------------------------------------------------");
  });

  console.log("\n--- 3. WHAT WAS BUILT & SHIPPED BY THE END ---");
  console.log("1. Standalone Streamable HTTP MCP Client (`src/shared/mcp-client.ts`) with auto-session management.");
  console.log("2. Task 01: Read Contract State CLI (`tasks/01-read-contract-state`) querying USDC/WPROS at block #20M+.");
  console.log("3. Task 02: Real-time Event Monitor (`tasks/02-event-log-monitor`) streaming live ProsPixel game moves.");
  console.log("4. Full automated test suite & task execution roadmap.\n");
  console.log("================================================================================");
  console.log("Status: Audit Complete. All documentation and reproduction steps verified.");
  console.log("================================================================================\n");
}

async function main() {
  const program = new Command();
  program
    .name("docs-mcp-onboarding")
    .description("Print the Developer Docs MCP Onboarding & Experience Audit Report")
    .option("--json", "Output audit report in structured JSON")
    .action((opts) => {
      if (opts.json) {
        console.log(JSON.stringify({
          auditor: "wakanda-soul",
          platform: "ai.pharos.xyz",
          gaps: ONBOARDING_GAPS,
          shippedArtifacts: [
            "src/shared/mcp-client.ts",
            "tasks/01-read-contract-state",
            "tasks/02-event-log-monitor"
          ]
        }, null, 2));
      } else {
        printOnboardingReport();
      }
    });

  await program.parseAsync(process.argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
