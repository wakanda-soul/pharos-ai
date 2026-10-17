import { AlertChannel, AlertEvent, TelegramConfig } from "../types.js";
import { execFileSync } from "child_process";

export class TelegramChannel implements AlertChannel {
  public readonly name = "Telegram";

  constructor(private config: TelegramConfig) {}

  public async send(alert: AlertEvent): Promise<boolean> {
    if (!this.config.botToken || !this.config.chatId) {
      return false;
    }

    const text = [
      `🚨 *PHAROS ON-CHAIN ALERT* [${alert.severity}]`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Type:* ${escapeMarkdown(alert.title)}`,
      `*Value:* \`${escapeMarkdown(alert.value)}\``,
      `*Details:* ${escapeMarkdown(alert.description)}`,
      alert.blockNumber ? `*Block:* \`#${alert.blockNumber}\`` : null,
      alert.explorerUrl ? `🔗 [PharosScan Explorer](${alert.explorerUrl})` : null,
      `⏰ _${alert.timestamp}_`,
    ]
      .filter(Boolean)
      .join("\n");

    const endpoint = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    const payload = {
      chat_id: this.config.chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) return true;
      const errText = await res.text();
      console.warn(`[TelegramChannel] API error HTTP ${res.status}: ${errText}`);
    } catch {
      // Fallback via curl if Node fetch experiences socket issues
      try {
        const out = execFileSync(
          "curl",
          [
            "-s",
            "-X",
            "POST",
            endpoint,
            "-H",
            "Content-Type: application/json",
            "-d",
            JSON.stringify(payload),
          ],
          { encoding: "utf-8", timeout: 5000 }
        );
        const data = JSON.parse(out);
        return Boolean(data.ok);
      } catch (curlErr) {
        console.error(`[TelegramChannel] Failed delivery:`, curlErr);
      }
    }

    return false;
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");
}
