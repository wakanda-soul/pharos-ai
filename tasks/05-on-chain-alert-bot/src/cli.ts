#!/usr/bin/env node

import { Command } from "commander";
import dotenv from "dotenv";
import { AlertBotEngine } from "./index.js";
import { BotConfig } from "./types.js";
import { DedupStore } from "./storage/dedup-store.js";

dotenv.config();

const program = new Command();

program
  .name("pharos-alert")
  .description("Real-time On-Chain Alert Bot for the Pharos Blockchain via Chain MCP")
  .version("1.0.0")
  .option(
    "-m, --mode <mode>",
    "Alert monitoring mode (transfer | price | contract | all)",
    "transfer"
  )
  .option(
    "-n, --network <network>",
    "Target network (mainnet | atlantic-testnet)",
    "mainnet"
  )
  .option(
    "--min-amount <number>",
    "Minimum transfer amount to trigger alert",
    (val) => parseFloat(val),
    100
  )
  .option("--token <address>", "Specific token address to monitor")
  .option(
    "--min-price <number>",
    "Minimum price threshold to trigger alert",
    (val) => parseFloat(val)
  )
  .option(
    "--max-price <number>",
    "Maximum price threshold to trigger alert",
    (val) => parseFloat(val)
  )
  .option("--price-feed <address>", "Chainlink price feed contract address")
  .option("--contract <address>", "Specific smart contract address to watch")
  .option(
    "--telegram-bot-token <token>",
    "Telegram Bot API Token (env: TELEGRAM_BOT_TOKEN)"
  )
  .option(
    "--telegram-chat-id <id>",
    "Telegram Chat ID (env: TELEGRAM_CHAT_ID)"
  )
  .option(
    "--discord-webhook <url>",
    "Discord Webhook URL (env: DISCORD_WEBHOOK_URL)"
  )
  .option(
    "--webhook-url <url>",
    "Generic Webhook HTTP endpoint (env: WEBHOOK_URL)"
  )
  .option(
    "-i, --interval <seconds>",
    "Polling interval in seconds",
    (val) => parseInt(val, 10),
    10
  )
  .option(
    "-c, --cooldown <seconds>",
    "Alert cooldown in seconds for repeating threshold conditions",
    (val) => parseInt(val, 10),
    300
  )
  .option(
    "-l, --lookback <blocks>",
    "Number of historical blocks to inspect on initial run",
    (val) => parseInt(val, 10),
    20
  )
  .option("--once", "Run a single polling cycle and exit", false)
  .option("--dry-run", "Simulate alerts without dispatching external webhooks", false)
  .option("--clear-cache", "Clear local deduplication cache before starting", false);

program.parse(process.argv);

const opts = program.opts();

if (opts.clearCache) {
  const store = new DedupStore();
  store.clear();
  console.log("🧹 Deduplication cache cleared.");
}

const telegramBotToken =
  opts.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = opts.telegramChatId || process.env.TELEGRAM_CHAT_ID;
const discordWebhookUrl =
  opts.discordWebhook || process.env.DISCORD_WEBHOOK_URL;
const webhookUrl = opts.webhookUrl || process.env.WEBHOOK_URL;

const config: BotConfig = {
  mode: opts.mode as any,
  network: opts.network as any,
  mcpEndpoint: process.env.PHAROS_MCP_ENDPOINT || "https://mcp.pharos.xyz/mcp",
  minTransferAmount: opts.minAmount,
  transferTokenAddress: opts.token,
  minPriceThreshold: opts.minPrice,
  maxPriceThreshold: opts.maxPrice,
  priceFeedAddress: opts.priceFeed,
  contractAddress: opts.contract,
  telegram:
    telegramBotToken && telegramChatId
      ? { botToken: telegramBotToken, chatId: telegramChatId }
      : undefined,
  discord: discordWebhookUrl ? { webhookUrl: discordWebhookUrl } : undefined,
  webhook: webhookUrl ? { url: webhookUrl } : undefined,
  pollIntervalMs: opts.interval * 1000,
  cooldownSeconds: opts.cooldown,
  lookbackBlocks: opts.lookback,
  runOnce: Boolean(opts.once),
  dryRun: Boolean(opts.dryRun),
};

const engine = new AlertBotEngine(config);

process.on("SIGINT", () => {
  engine.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  engine.stop();
  process.exit(0);
});

engine.start().catch((err) => {
  console.error("Fatal Alert Bot Error:", err);
  process.exit(1);
});
