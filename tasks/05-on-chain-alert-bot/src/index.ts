import { BotConfig, AlertChannel, AlertEvent } from "./types.js";
import { DedupStore } from "./storage/dedup-store.js";
import { ConsoleChannel } from "./channels/console.js";
import { TelegramChannel } from "./channels/telegram.js";
import { DiscordChannel } from "./channels/discord.js";
import { GenericWebhookChannel } from "./channels/webhook.js";
import { TransferMonitor } from "./monitors/transfer-monitor.js";
import { PriceMonitor } from "./monitors/price-monitor.js";
import { ContractMonitor } from "./monitors/contract-monitor.js";

export class AlertBotEngine {
  private channels: AlertChannel[] = [];
  private dedupStore: DedupStore;
  private isRunning: boolean = false;
  private pollTimer?: NodeJS.Timeout;

  private transferMonitor?: TransferMonitor;
  private priceMonitor?: PriceMonitor;
  private contractMonitor?: ContractMonitor;

  constructor(private config: BotConfig) {
    this.dedupStore = new DedupStore();
    this.setupChannels();
    this.setupMonitors();
  }

  private setupChannels(): void {
    // Console channel is always enabled
    this.channels.push(new ConsoleChannel(this.config.logFilePath));

    if (this.config.telegram?.botToken && this.config.telegram?.chatId) {
      this.channels.push(new TelegramChannel(this.config.telegram));
    }

    if (this.config.discord?.webhookUrl) {
      this.channels.push(new DiscordChannel(this.config.discord));
    }

    if (this.config.webhook?.url) {
      this.channels.push(new GenericWebhookChannel(this.config.webhook));
    }
  }

  private setupMonitors(): void {
    if (this.config.mode === "transfer" || this.config.mode === "all") {
      this.transferMonitor = new TransferMonitor(this.config);
    }
    if (this.config.mode === "price" || this.config.mode === "all") {
      this.priceMonitor = new PriceMonitor(this.config);
    }
    if (this.config.mode === "contract" || this.config.mode === "all") {
      this.contractMonitor = new ContractMonitor(this.config);
    }
  }

  public async pollOnce(): Promise<{ detected: number; dispatched: number }> {
    const rawAlerts: AlertEvent[] = [];

    if (this.transferMonitor) {
      const transferAlerts = await this.transferMonitor.poll();
      rawAlerts.push(...transferAlerts);
    }

    if (this.priceMonitor) {
      const priceAlerts = await this.priceMonitor.poll();
      rawAlerts.push(...priceAlerts);
    }

    if (this.contractMonitor) {
      const contractAlerts = await this.contractMonitor.poll();
      rawAlerts.push(...contractAlerts);
    }

    let dispatchedCount = 0;

    for (const alert of rawAlerts) {
      const isPrice = alert.category === "PRICE";
      const cooldown = isPrice ? this.config.cooldownSeconds : undefined;

      // Deduplication check: zero duplicate spam
      const shouldDispatch = this.dedupStore.shouldAlert(alert.id, cooldown);

      if (!shouldDispatch) {
        continue;
      }

      dispatchedCount++;

      if (this.config.dryRun) {
        console.log(`[DRY-RUN] Alert suppressed from network dispatch: ${alert.title} | ${alert.value}`);
        continue;
      }

      // Dispatch to all configured channels concurrently
      await Promise.allSettled(
        this.channels.map(async (ch) => {
          try {
            await ch.send(alert);
          } catch (err) {
            console.error(`[AlertBot] Failed to send to ${ch.name}:`, err);
          }
        })
      );
    }

    return {
      detected: rawAlerts.length,
      dispatched: dispatchedCount,
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("================================================================================");
    console.log("  🤖  PHAROS ON-CHAIN ALERT BOT (CHAIN MCP POWERED)");
    console.log("================================================================================");
    console.log(`Mode:            ${this.config.mode.toUpperCase()}`);
    console.log(`Network:         ${this.config.network}`);
    console.log(`Active Channels: ${this.channels.map((c) => c.name).join(", ")}`);
    console.log(`Poll Interval:   ${this.config.pollIntervalMs / 1000}s`);
    console.log(`Dedup Cache:     ${this.dedupStore.getCount()} known event fingerprints`);
    if (this.config.minTransferAmount) {
      console.log(`Transfer Min:    >= ${this.config.minTransferAmount}`);
    }
    if (this.config.minPriceThreshold || this.config.maxPriceThreshold) {
      console.log(
        `Price Range:     Floor: $${this.config.minPriceThreshold ?? "-"} | Ceiling: $${this.config.maxPriceThreshold ?? "-"}`
      );
    }
    console.log("================================================================================");

    if (this.config.runOnce) {
      console.log("Executing single polling cycle...");
      const stats = await this.pollOnce();
      console.log(`Finished: ${stats.detected} events detected, ${stats.dispatched} alerts dispatched.`);
      return;
    }

    console.log("Sentinel running. Press Ctrl+C to terminate.\n");

    const cycle = async () => {
      if (!this.isRunning) return;
      try {
        await this.pollOnce();
      } catch (err) {
        console.error("[AlertBot] Cycle error:", err);
      } finally {
        if (this.isRunning) {
          this.pollTimer = setTimeout(cycle, this.config.pollIntervalMs);
        }
      }
    };

    await cycle();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    this.dedupStore.save();
    console.log("\n[AlertBot] Stopped gracefully.");
  }
}

export * from "./types.js";
export * from "./storage/dedup-store.js";
