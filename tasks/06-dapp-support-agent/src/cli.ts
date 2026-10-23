#!/usr/bin/env node

import { Command } from "commander";
import { DappSupportAnalyzer } from "./analyzer.js";
import { DiagnosticFormatter } from "./formatter.js";
import { DEMO_FAILURE_CASES } from "./demo-cases.js";

const program = new Command();

program
  .name("pharos-support")
  .description("Autonomous AI Support Agent for diagnosing failed Pharos transactions via Chain MCP")
  .version("1.0.0")
  .argument("[txHash]", "Transaction hash to diagnose")
  .option("-n, --network <network>", "Pharos network (mainnet | atlantic-testnet)", "mainnet")
  .option("-j, --json", "Output diagnostic report in structured JSON format", false)
  .option("-t, --ticket", "Generate a markdown-formatted support ticket for Discord / GitHub", false)
  .option("-d, --demo [type]", "Run demonstration of verified failure cases (out-of-gas | insufficient-allowance | slippage-exceeded | all)", false)
  .action(async (txHash, options) => {
    // 1. Handle Demonstration Mode
    if (options.demo !== false) {
      const demoType = typeof options.demo === "string" ? options.demo.toLowerCase() : "all";
      console.log("================================================================================");
      console.log("  🩺  PHAROS DAPP SUPPORT AGENT — DEMONSTRATION MODE");
      console.log("================================================================================");

      const casesToRun =
        demoType === "all"
          ? Object.keys(DEMO_FAILURE_CASES)
          : [demoType];

      for (const key of casesToRun) {
        const item = DEMO_FAILURE_CASES[key];
        if (!item) {
          console.error(`Unknown demo type '${key}'. Available: ${Object.keys(DEMO_FAILURE_CASES).join(", ")}`);
          continue;
        }

        if (options.json) {
          console.log(JSON.stringify(item, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
        } else if (options.ticket) {
          console.log(DiagnosticFormatter.formatMarkdownTicket(item));
          console.log("\n" + "=".repeat(80) + "\n");
        } else {
          console.log(DiagnosticFormatter.formatConsole(item));
        }
      }
      return;
    }

    // 2. Handle Live Transaction Diagnosis
    if (!txHash) {
      console.log("Please provide a transaction hash to analyze or run with --demo.");
      console.log("Usage: pharos-support <txHash> [options]");
      console.log("       pharos-support --demo");
      process.exit(1);
    }

    const analyzer = new DappSupportAnalyzer();

    try {
      console.log(`🔍 Inspecting transaction ${txHash} on Pharos ${options.network} via Chain MCP...`);
      const diagnostic = await analyzer.analyze(txHash, options.network as any);

      if (options.json) {
        console.log(JSON.stringify(diagnostic, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
      } else if (options.ticket) {
        console.log(DiagnosticFormatter.formatMarkdownTicket(diagnostic));
      } else {
        console.log(DiagnosticFormatter.formatConsole(diagnostic));
      }
    } catch (err: any) {
      console.error(`\n❌ Diagnostic failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
