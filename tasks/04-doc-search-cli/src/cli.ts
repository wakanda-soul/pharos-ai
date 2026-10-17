#!/usr/bin/env node
import { Command } from "commander";
import { PharosDocsService } from "./docs-service.js";

async function main() {
  const program = new Command();
  const docsService = new PharosDocsService();

  program
    .name("pharos-docs")
    .description("Search Pharos Developer Documentation directly from your terminal")
    .argument("[question...]", "Natural-language question to search in Pharos docs")
    .option("-g, --goal <goal>", "Broader task or goal to tailor the answer")
    .option("-j, --json", "Output response in structured JSON")
    .option("-v, --verbose", "Show detailed network timings and raw metadata")
    .action(async (questionParts: string[], options) => {
      const question = questionParts.join(" ").trim();

      if (!question) {
        console.error("Error: Please provide a question to search. Example:");
        console.error('  pharos-docs "how do I deploy a contract?"');
        process.exit(1);
      }

      const result = await docsService.search(question, {
        goal: options.goal,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      printFormattedResult(result, options.verbose);
    });

  await program.parseAsync(process.argv);
}

function printFormattedResult(result: import("./types.js").DocSearchResult, verbose?: boolean): void {
  console.log("================================================================================");
  console.log("  🔍  PHAROS DEVELOPER DOC-SEARCH CLI  [Developer Docs MCP]                     ");
  console.log("================================================================================");
  console.log(`Query:        "${result.query}"`);
  console.log(`Status:       ${result.isFound ? "🟢 Answer Found" : "⚠️  No Relevant Doc Found"}`);
  if (verbose && result.responseTimeMs !== undefined) {
    console.log(`Latency:      ${result.responseTimeMs}ms`);
  }
  console.log("--------------------------------------------------------------------------------\n");

  if (result.isFound) {
    console.log("📖 CONCISE ANSWER:");
    console.log(result.answer.trim());
    console.log("");

    if (result.sources && result.sources.length > 0) {
      console.log("--------------------------------------------------------------------------------");
      console.log("🔗 SOURCE DOCUMENTATION SECTIONS:");
      result.sources.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.title}`);
        console.log(`     -> ${s.url}`);
      });
      console.log("");
    }

    if (result.suggestedFollowUps && result.suggestedFollowUps.length > 0) {
      console.log("--------------------------------------------------------------------------------");
      console.log("💡 SUGGESTED FOLLOW-UP QUESTIONS:");
      result.suggestedFollowUps.forEach((f) => {
        console.log(`  • ${f}`);
      });
      console.log("");
    }
  } else {
    console.log("⚠️  NOTICE:");
    console.log(`   ${result.answer.trim()}\n`);
    console.log("📚 RECOMMENDED PHAROS TOPICS YOU CAN SEARCH INSTEAD:");
    console.log("  • Network Setup:    \"what is the mainnet chain ID and RPC URL?\"");
    console.log("  • Smart Contracts:  \"how do I deploy a contract with Foundry?\"");
    console.log("  • Chain MCP:        \"how do I query events with get_logs?\"");
    console.log("  • Tokens:           \"how do I write an ERC-20 token?\"");
    console.log("  • Nodes:            \"how do I deploy a validator node?\"\n");
    console.log("🌐 OFFICIAL DOCUMENTATION INDEX:");
    console.log("   https://docs.pharos.xyz/sitemap.md\n");
  }

  console.log("================================================================================");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

export { main, printFormattedResult };
