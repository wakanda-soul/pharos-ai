import { AlertChannel, AlertEvent, DiscordConfig } from "../types.js";
import { execFileSync } from "child_process";

export class DiscordChannel implements AlertChannel {
  public readonly name = "Discord";

  constructor(private config: DiscordConfig) {}

  public async send(alert: AlertEvent): Promise<boolean> {
    if (!this.config.webhookUrl) {
      return false;
    }

    const color =
      alert.severity === "CRITICAL"
        ? 0xe74c3c // Red
        : alert.severity === "WARNING"
        ? 0xf39c12 // Orange
        : 0x2ecc71; // Green

    const fields = [
      { name: "💰 Value", value: alert.value || "N/A", inline: true },
      { name: "🏷️ Category", value: alert.category, inline: true },
      alert.blockNumber
        ? { name: "🧱 Block", value: `#${alert.blockNumber}`, inline: true }
        : null,
      alert.txHash
        ? {
            name: "🔗 Transaction",
            value: `[\`${alert.txHash.slice(0, 10)}...\`](${alert.explorerUrl})`,
            inline: false,
          }
        : null,
    ].filter(Boolean);

    const payload = {
      username: "Pharos On-Chain Sentinel",
      avatar_url: "https://docs.pharos.xyz/pharos-logo.svg",
      embeds: [
        {
          title: `🚨 ${alert.title}`,
          description: alert.description,
          url: alert.explorerUrl,
          color,
          fields,
          footer: { text: "Pharos Pacific Network Monitoring · Season of AI" },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      const res = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) return true;
      const err = await res.text();
      console.warn(`[DiscordChannel] API error HTTP ${res.status}: ${err}`);
    } catch {
      try {
        execFileSync(
          "curl",
          [
            "-s",
            "-X",
            "POST",
            this.config.webhookUrl,
            "-H",
            "Content-Type: application/json",
            "-d",
            JSON.stringify(payload),
          ],
          { encoding: "utf-8", timeout: 5000 }
        );
        return true;
      } catch (curlErr) {
        console.error(`[DiscordChannel] Failed delivery:`, curlErr);
      }
    }

    return false;
  }
}
