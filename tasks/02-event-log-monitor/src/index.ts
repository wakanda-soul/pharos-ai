#!/usr/bin/env node
import { PharosMcpClient } from "../../../src/shared/mcp-client";
import { ERC20_ABI, formatAddress, formatTokenAmount } from "../../../src/shared/chain";
import { decodeEventLog, toEventSelector } from "viem";
import { Command } from "commander";

// Common event signatures
const EVENT_TOPICS: Record<string, `0x${string}`> = {
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  Approval: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
};

// Known token decimals on Pharos Mainnet
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0xc879c018db60520f4355c26ed1a6d572cdac1815": { symbol: "USDC", decimals: 6 },
  "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0": { symbol: "WPROS", decimals: 18 },
  "0x51e2a24742db77604b881d6781ee16b5b8fcbe29": { symbol: "LINK", decimals: 18 },
  "0x1f4b7011ee3d53969bb67f59428a9ec0477856e9": { symbol: "WETH", decimals: 18 },
};

interface MonitorOptions {
  contract?: string;
  event: string;
  pollIntervalMs: number;
  backfillBlocks: number;
}

export class EventLogMonitor {
  private client: PharosMcpClient;
  private seenEvents = new Set<string>();
  private lastCheckedBlock: number = 0;
  private isRunning = false;
  private options: MonitorOptions;

  constructor(options: MonitorOptions) {
    this.options = options;
    this.client = new PharosMcpClient();
  }

  async start(): Promise<void> {
    console.log("========================================================");
    console.log("       📡  PHAROS ON-CHAIN EVENT & LOG MONITOR         ");
    console.log("========================================================");
    console.log(`Connecting to Pharos Chain MCP (https://mcp.pharos.xyz/mcp)...`);

    await this.client.initialize();
    const chainInfo = await this.client.getChainInfo();
    const currentBlock = await this.client.getBlockNumber();

    console.log(`Connected: ${chainInfo.name} (Chain ID: ${chainInfo.chainId})`);
    console.log(`Current Block Height: #${currentBlock.toLocaleString()}`);
    console.log(`Event Filter:        ${this.options.event}`);
    console.log(`Contract Filter:     ${this.options.contract || "All Contracts"}`);
    console.log(`Polling Interval:    ${this.options.pollIntervalMs} ms`);
    console.log("--------------------------------------------------------");

    // 1. Initial backfill scan to immediately catch and display recent events
    const startBlock = Math.max(0, currentBlock - this.options.backfillBlocks);
    console.log(`⏳ Scanning past ${this.options.backfillBlocks} blocks (from #${startBlock.toLocaleString()} to #${currentBlock.toLocaleString()}) for live events...\n`);

    await this.pollLogs(startBlock, currentBlock);
    this.lastCheckedBlock = currentBlock;

    // 2. Continuous monitoring loop
    this.isRunning = true;
    console.log(`🟢 Continuous real-time monitor active. Waiting for new on-chain events... (Press Ctrl+C to stop)\n`);

    while (this.isRunning) {
      await new Promise((resolve) => setTimeout(resolve, this.options.pollIntervalMs));
      try {
        const latestBlock = await this.client.getBlockNumber();
        if (latestBlock > this.lastCheckedBlock) {
          const from = this.lastCheckedBlock + 1;
          const to = latestBlock;
          await this.pollLogs(from, to);
          this.lastCheckedBlock = to;
        }
      } catch (err: any) {
        console.error(`⚠️ Polling error: ${err.message || err}`);
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log("\n🛑 Event monitor stopped.");
  }

  private async pollLogs(fromBlock: number, toBlock: number): Promise<void> {
    const topic = EVENT_TOPICS[this.options.event] || EVENT_TOPICS.Transfer;

    const filter: Record<string, any> = {
      topics: [topic],
      fromBlock,
      toBlock,
    };

    if (this.options.contract) {
      filter.address = this.options.contract;
    }

    const res = await this.client.callTool("get_logs", filter);
    const logs: any[] = Array.isArray(res.parsed) ? res.parsed : [];

    for (const log of logs) {
      const eventKey = `${log.transactionHash}-${log.logIndex}`;
      if (this.seenEvents.has(eventKey)) {
        continue; // Deduplicate
      }
      this.seenEvents.add(eventKey);

      this.processAndPrintLog(log);
    }
  }

  private processAndPrintLog(log: any): void {
    const blockNum = typeof log.blockNumber === "string" ? parseInt(log.blockNumber, 16) : log.blockNumber;
    const contractAddr = (log.address || "").toLowerCase();
    const tokenInfo = KNOWN_TOKENS[contractAddr] || { symbol: "TOKEN", decimals: 18 };

    try {
      const decoded = decodeEventLog({
        abi: ERC20_ABI,
        data: log.data,
        topics: log.topics,
      });

      const { from, to, value } = (decoded.args as any) || {};

      console.log(`🔔 [EVENT #${this.seenEvents.size}] ${decoded.eventName} on Block #${blockNum.toLocaleString()}`);
      console.log(`   📍 Contract: ${formatAddress(log.address)} (${log.address})`);
      console.log(`   👤 From:     ${formatAddress(from)} (${from})`);
      console.log(`   🎯 To:       ${formatAddress(to)} (${to})`);
      if (value !== undefined) {
        const formattedAmount = formatTokenAmount(value, tokenInfo.decimals);
        console.log(`   💰 Amount:   ${formattedAmount} ${tokenInfo.symbol} (Raw: ${value.toString()})`);
      }
      console.log(`   🔗 Tx Hash:  ${log.transactionHash}`);
      console.log(`   🌐 Explorer: https://www.pharosscan.xyz/tx/${log.transactionHash}`);
      console.log("--------------------------------------------------------");
    } catch (e: any) {
      // Fallback for custom or undeclared formats
      console.log(`🔔 [EVENT #${this.seenEvents.size}] Log at Block #${blockNum.toLocaleString()}`);
      console.log(`   📍 Contract: ${log.address}`);
      console.log(`   🔗 Tx Hash:  ${log.transactionHash}`);
      console.log(`   📦 Data:     ${log.data}`);
      console.log("--------------------------------------------------------");
    }
  }
}

async function main() {
  const program = new Command();
  program
    .name("event-log-monitor")
    .description("Continuous on-chain event and log monitor via Pharos Chain MCP")
    .option("-c, --contract <address>", "Contract address to filter on (default: any)")
    .option("-e, --event <name>", "Event name to monitor (Transfer, Approval)", "Transfer")
    .option("-p, --poll-interval <ms>", "Polling frequency in milliseconds", "3000")
    .option("-b, --backfill <blocks>", "Number of recent blocks to scan on startup", "200")
    .action(async (opts) => {
      const monitor = new EventLogMonitor({
        contract: opts.contract,
        event: opts.event,
        pollIntervalMs: parseInt(opts.pollInterval, 10),
        backfillBlocks: parseInt(opts.backfill, 10),
      });

      process.on("SIGINT", () => {
        monitor.stop();
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        monitor.stop();
        process.exit(0);
      });

      await monitor.start();
    });

  await program.parseAsync(process.argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
