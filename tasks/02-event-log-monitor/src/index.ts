#!/usr/bin/env node
import { PharosMcpClient } from "../../../src/shared/mcp-client";
import { formatAddress } from "../../../src/shared/chain";
import { decodeEventLog, parseAbi, formatEther } from "viem";
import { Command } from "commander";

// Official PROS Pixel Game Contracts (https://prospixel.xyz/)
export const PROS_PIXEL_CONTRACTS = {
  mainnet: "0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a",
  testnet: "0x09d1D3cf60A86963c42ca159DA5D1a2D73644cf7",
};

// ABI for ProsPixel Game Events
export const PROS_PIXEL_ABI = parseAbi([
  "event BatchPixelsBought(address indexed user, address indexed inviter, uint256 indexed round, uint16[] x, uint16[] y, uint24[] colors, uint256 totalValue, uint256 totalInviterReward)",
  "event Registered(address indexed user, address indexed inviter)",
  "event Claimed(address indexed to, uint256 principal, uint256 premium, uint256 inviterReward)",
  "event PixelPremiumDistributed(address indexed lastOwner, uint256 indexed round, uint16 x, uint16 y, uint256 lastPrice, uint256 premiumToSeller)",
  "event FomoRewardClaimed(address indexed to, uint256 round, uint256 totalReward)",
  "event ContributorRewardClaimed(address indexed to, uint256 round, uint256 totalReward)",
  "event NextRound(uint256 round)",
  "event PeriodFinalized(uint256 periodIndex)",
  // Generic ERC20 fallback
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
]);

interface MonitorConfig {
  contractAddress: string;
  pollIntervalMs: number;
  backfillBlocks: number;
}

export class ProsPixelLogMonitor {
  private client: PharosMcpClient;
  private seenEvents = new Set<string>();
  private lastCheckedBlock: number = 0;
  private isRunning: boolean = false;
  private config: MonitorConfig;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.client = new PharosMcpClient();
  }

  async start(): Promise<void> {
    console.log("================================================================================");
    console.log("       🎮  PHAROS PROSPIXEL (https://prospixel.xyz/) GAME MONITOR              ");
    console.log("================================================================================");
    console.log(`Connecting to Pharos Chain MCP (https://mcp.pharos.xyz/mcp)...`);

    await this.client.initialize();
    const chainInfo = await this.client.getChainInfo();
    const currentBlock = await this.client.getBlockNumber();

    console.log(`📡 Network:          ${chainInfo.name} (Chain ID: ${chainInfo.chainId})`);
    console.log(`📍 Game Contract:    ${this.config.contractAddress}`);
    console.log(`📦 Current Block:    #${currentBlock.toLocaleString()}`);
    console.log(`⏱️  Polling Interval: Every ${this.config.pollIntervalMs / 1000} seconds via Pharos MCP`);
    console.log("================================================================================\n");

    // 1. Initial backfill to display recent events immediately
    const startBlock = Math.max(0, currentBlock - this.config.backfillBlocks);
    console.log(`⏳ Scanning recent blocks (#${startBlock.toLocaleString()} -> #${currentBlock.toLocaleString()}) for latest game activity...\n`);

    await this.fetchLogsInRange(startBlock, currentBlock);
    this.lastCheckedBlock = currentBlock;

    // 2. Real-time continuous polling loop (every 10 seconds)
    this.isRunning = true;
    console.log(`🟢 [LIVE MONITOR ACTIVE] Listening for new game events every ${this.config.pollIntervalMs / 1000}s... (Ctrl+C to stop)\n`);

    while (this.isRunning) {
      await new Promise((r) => setTimeout(r, this.config.pollIntervalMs));
      try {
        const latestBlock = await this.client.getBlockNumber();
        if (latestBlock > this.lastCheckedBlock) {
          const from = this.lastCheckedBlock + 1;
          const to = latestBlock;
          await this.fetchLogsInRange(from, to);
          this.lastCheckedBlock = to;
        }
      } catch (err: any) {
        console.error(`⚠️ Polling error: ${err.message || err}`);
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log("\n🛑 ProsPixel Monitor stopped.");
  }

  private async fetchLogsInRange(fromBlock: number, toBlock: number): Promise<void> {
    // Pharos MCP limit is max 1000 blocks per call. Page through if range > 1000.
    const step = 999;
    for (let cur = fromBlock; cur <= toBlock; cur += step) {
      const chunkTo = Math.min(cur + step - 1, toBlock);
      const res = await this.client.callTool("get_logs", {
        address: this.config.contractAddress,
        fromBlock: cur,
        toBlock: chunkTo,
      });

      const logs: any[] = Array.isArray(res.parsed) ? res.parsed : [];
      for (const log of logs) {
        const eventKey = `${log.transactionHash}-${log.logIndex}`;
        if (this.seenEvents.has(eventKey)) continue;
        this.seenEvents.add(eventKey);

        this.formatAndDisplayEvent(log);
      }
    }
  }

  private formatAndDisplayEvent(log: any): void {
    const blockNum = typeof log.blockNumber === "string" ? parseInt(log.blockNumber, 16) : log.blockNumber;
    
    // Format timestamp
    let dateStr = "Recent";
    if (log.blockTimestamp) {
      const ts = typeof log.blockTimestamp === "string" ? parseInt(log.blockTimestamp, 16) : log.blockTimestamp;
      dateStr = new Date(ts * 1000).toLocaleString("ru-RU", { timeZone: "UTC" }) + " UTC";
    } else {
      dateStr = new Date().toLocaleString("ru-RU") + " (Local)";
    }

    try {
      const decoded = decodeEventLog({
        abi: PROS_PIXEL_ABI,
        data: log.data,
        topics: log.topics,
      });

      const args: any = decoded.args || {};
      const txUrl = `https://www.pharosscan.xyz/tx/${log.transactionHash}`;

      switch (decoded.eventName) {
        case "BatchPixelsBought": {
          const pixelCount = Array.isArray(args.x) ? args.x.length : 1;
          const coords = Array.isArray(args.x) && args.x.length <= 4
            ? args.x.map((xVal: number, i: number) => `(${xVal}, ${args.y[i]})`).join(", ")
            : `${pixelCount} пикселей`;
          const paidPros = formatEther(args.totalValue || 0n);
          const inviterReward = formatEther(args.totalInviterReward || 0n);

          console.log(`🎨 [${dateStr}] Блок #${blockNum.toLocaleString()}`);
          console.log(`   ⚡ ДЕЙСТВИЕ:          Покупка пикселей в игре (BatchPixelsBought)`);
          console.log(`   👤 КОШЕЛЕК ИГРОКА:    ${args.user}`);
          console.log(`   💸 СКОЛЬКО ЗАПЛАТИЛ:   ${paidPros} PROS`);
          console.log(`   🎁 ЧТО ПОЛУЧИЛ:       ${pixelCount} пиксель(-ей) на холсте ${coords}`);
          if (args.inviter && args.inviter !== "0x0000000000000000000000000000000000000000") {
            console.log(`   🤝 Инвайтер:          ${args.inviter} (награда: ${inviterReward} PROS)`);
          }
          console.log(`   🔗 ХЕШ ТРАНЗАКЦИИ:    ${log.transactionHash}`);
          console.log(`   🌐 ССЫЛКА В ЭКСПЛОРЕР: ${txUrl}`);
          console.log("--------------------------------------------------------------------------------");
          break;
        }

        case "Claimed": {
          const principal = formatEther(args.principal || 0n);
          const premium = formatEther(args.premium || 0n);
          const inviter = formatEther(args.inviterReward || 0n);
          const totalReceived = (
            parseFloat(principal) +
            parseFloat(premium) +
            parseFloat(inviter)
          ).toFixed(4);

          console.log(`💰 [${dateStr}] Блок #${blockNum.toLocaleString()}`);
          console.log(`   ⚡ ДЕЙСТВИЕ:          Клейм наград из игры (Claimed)`);
          console.log(`   👤 КОШЕЛЕК ИГРОКА:    ${args.to}`);
          console.log(`   💸 СКОЛЬКО ЗАПЛАТИЛ:   0 PROS (только gas за транзакцию)`);
          console.log(`   🎁 ЧТО ПОЛУЧИЛ:       ${totalReceived} PROS (Тело: ${principal} + Премия: ${premium} + Реферальные: ${inviter})`);
          console.log(`   🔗 ХЕШ ТРАНЗАКЦИИ:    ${log.transactionHash}`);
          console.log(`   🌐 ССЫЛКА В ЭКСПЛОРЕР: ${txUrl}`);
          console.log("--------------------------------------------------------------------------------");
          break;
        }

        case "PixelPremiumDistributed": {
          const premium = formatEther(args.premiumToSeller || 0n);
          const lastPrice = formatEther(args.lastPrice || 0n);

          console.log(`📈 [${dateStr}] Блок #${blockNum.toLocaleString()}`);
          console.log(`   ⚡ ДЕЙСТВИЕ:          Выплата премии за перекупленный пиксель (PixelPremiumDistributed)`);
          console.log(`   👤 КОШЕЛЕК ВЛАДЕЛЬЦА: ${args.lastOwner}`);
          console.log(`   💸 СКОЛЬКО ЗАПЛАТИЛ:   0 PROS (пассивный доход)`);
          console.log(`   🎁 ЧТО ПОЛУЧИЛ:       +${premium} PROS премии за пиксель (${args.x}, ${args.y}) при цене ${lastPrice} PROS`);
          console.log(`   🔗 ХЕШ ТРАНЗАКЦИИ:    ${log.transactionHash}`);
          console.log(`   🌐 ССЫЛКА В ЭКСПЛОРЕР: ${txUrl}`);
          console.log("--------------------------------------------------------------------------------");
          break;
        }

        case "Registered": {
          console.log(`📝 [${dateStr}] Блок #${blockNum.toLocaleString()}`);
          console.log(`   ⚡ ДЕЙСТВИЕ:          Регистрация нового игрока (Registered)`);
          console.log(`   👤 КОШЕЛЕК ИГРОКА:    ${args.user}`);
          console.log(`   💸 СКОЛЬКО ЗАПЛАТИЛ:   0 PROS (бесплатная регистрация)`);
          console.log(`   🎁 ЧТО ПОЛУЧИЛ:       Доступ к игре (Инвайтер: ${args.inviter})`);
          console.log(`   🔗 ХЕШ ТРАНЗАКЦИИ:    ${log.transactionHash}`);
          console.log(`   🌐 ССЫЛКА В ЭКСПЛОРЕР: ${txUrl}`);
          console.log("--------------------------------------------------------------------------------");
          break;
        }

        default: {
          console.log(`🔔 [${dateStr}] Блок #${blockNum.toLocaleString()}`);
          console.log(`   ⚡ ДЕЙСТВИЕ:          ${decoded.eventName}`);
          console.log(`   📍 КОНТРАКТ:          ${log.address}`);
          console.log(`   🔗 ХЕШ ТРАНЗАКЦИИ:    ${log.transactionHash}`);
          console.log(`   🌐 ССЫЛКА В ЭКСПЛОРЕР: ${txUrl}`);
          console.log("--------------------------------------------------------------------------------");
          break;
        }
      }
    } catch {
      // Fallback
      console.log(`🔔 [${dateStr}] Лог на блоке #${blockNum.toLocaleString()}`);
      console.log(`   📍 Контракт:          ${log.address}`);
      console.log(`   🔗 Хеш транзакции:    ${log.transactionHash}`);
      console.log(`   🌐 Ссылка в эксплорер: https://www.pharosscan.xyz/tx/${log.transactionHash}`);
      console.log("--------------------------------------------------------------------------------");
    }
  }
}

async function main() {
  const program = new Command();
  program
    .name("prospixel-monitor")
    .description("Live Event & Log Monitor for ProsPixel (https://prospixel.xyz/) via Pharos Chain MCP")
    .option("-c, --contract <address>", "Contract address to monitor", PROS_PIXEL_CONTRACTS.mainnet)
    .option("-p, --poll-interval <ms>", "Polling frequency in milliseconds (default: 10000 = 10s)", "10000")
    .option("-b, --backfill <blocks>", "Number of recent blocks to scan on launch for latest activity", "5000")
    .action(async (opts) => {
      const monitor = new ProsPixelLogMonitor({
        contractAddress: opts.contract,
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
