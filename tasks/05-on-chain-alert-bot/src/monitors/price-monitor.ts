import { PharosMcpClient } from "../../../../src/shared/mcp-client.js";
import { AlertEvent, BotConfig } from "../types.js";
import { NETWORKS } from "../../../../src/shared/config.js";

export class PriceMonitor {
  private mcp: PharosMcpClient;
  private feedAddress: string;
  private feedSymbol: string;

  constructor(private config: BotConfig) {
    this.mcp = new PharosMcpClient(config.mcpEndpoint);
    // Default: Pacific Mainnet ETH/USD Chainlink Feed
    this.feedAddress =
      config.priceFeedAddress || "0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8";
    this.feedSymbol = config.priceFeedSymbol || "ETH/USD";
  }

  public async poll(): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];
    const network = NETWORKS[this.config.network];

    try {
      // 0x50d25bcd is selector for latestAnswer()
      const res = await this.mcp.callTool("eth_call", {
        transaction: {
          to: this.feedAddress,
          data: "0x50d25bcd",
        },
      });

      const hexResult = res.parsed?.result || res.parsed;
      if (!hexResult || typeof hexResult !== "string" || !hexResult.startsWith("0x")) {
        console.warn("[PriceMonitor] Unexpected eth_call response:", res);
        return [];
      }

      const rawVal = BigInt(hexResult);
      // Chainlink price feeds on Pharos use 18 decimals
      const price = Number(rawVal) / 1e18;

      const bnRes = await this.mcp.callTool("get_block_number", {});
      const blockNum = Number(bnRes.parsed?.blockNumber || bnRes.parsed);

      let triggered = false;
      let conditionText = "";
      let direction: "ABOVE" | "BELOW" | "CURRENT" = "CURRENT";
      let severity: "INFO" | "WARNING" | "CRITICAL" = "INFO";

      if (
        this.config.minPriceThreshold !== undefined &&
        price <= this.config.minPriceThreshold
      ) {
        triggered = true;
        direction = "BELOW";
        severity = "CRITICAL";
        conditionText = `dropped below floor threshold of $${this.config.minPriceThreshold.toLocaleString()}`;
      } else if (
        this.config.maxPriceThreshold !== undefined &&
        price >= this.config.maxPriceThreshold
      ) {
        triggered = true;
        direction = "ABOVE";
        severity = "WARNING";
        conditionText = `surpassed ceiling threshold of $${this.config.maxPriceThreshold.toLocaleString()}`;
      } else if (
        this.config.minPriceThreshold === undefined &&
        this.config.maxPriceThreshold === undefined
      ) {
        // If no thresholds configured, emit a price check alert
        triggered = true;
        direction = "CURRENT";
        severity = "INFO";
        conditionText = `current live feed observation`;
      }

      if (triggered) {
        alerts.push({
          id: `price:${this.feedSymbol}:${direction}:${this.feedAddress.toLowerCase()}`,
          timestamp: new Date().toISOString(),
          category: "PRICE",
          severity,
          title: `Oracle Price Alert: ${this.feedSymbol}`,
          description: `${this.feedSymbol} ${conditionText}. Observed on-chain via Chainlink Push Engine feed.`,
          value: `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          numericValue: price,
          unit: "USD",
          blockNumber: blockNum,
          explorerUrl: `${network.explorerUrl}/address/${this.feedAddress}`,
          metadata: {
            feedAddress: this.feedAddress,
            rawPrice: rawVal.toString(),
            direction,
          },
        });
      }
    } catch (err) {
      console.error("[PriceMonitor] Polling error:", err);
    }

    return alerts;
  }
}
