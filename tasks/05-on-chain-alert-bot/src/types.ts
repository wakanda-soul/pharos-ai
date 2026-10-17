export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AlertCategory = "TRANSFER" | "PRICE" | "CONTRACT";

export interface AlertEvent {
  id: string; // Unique deduplication fingerprint
  timestamp: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  value: string;
  numericValue?: number;
  unit?: string;
  txHash?: string;
  blockNumber?: number;
  explorerUrl?: string;
  metadata?: Record<string, any>;
}

export interface AlertChannel {
  readonly name: string;
  send(alert: AlertEvent): Promise<boolean>;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface DiscordConfig {
  webhookUrl: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface BotConfig {
  mode: "transfer" | "price" | "contract" | "all";
  network: "mainnet" | "atlantic-testnet";
  mcpEndpoint: string;
  
  // Transfer condition
  minTransferAmount?: number;
  transferTokenAddress?: string;
  transferTokenSymbol?: string;
  transferTokenDecimals?: number;
  
  // Price condition
  priceFeedAddress?: string;
  priceFeedSymbol?: string;
  minPriceThreshold?: number;
  maxPriceThreshold?: number;
  
  // Contract condition
  contractAddress?: string;
  contractEventTopic?: string;
  contractLabel?: string;
  
  // Delivery channels
  telegram?: TelegramConfig;
  discord?: DiscordConfig;
  webhook?: WebhookConfig;
  logFilePath?: string;
  
  // Polling & Dedup
  pollIntervalMs: number;
  cooldownSeconds: number;
  lookbackBlocks: number;
  runOnce: boolean;
  dryRun: boolean;
}
