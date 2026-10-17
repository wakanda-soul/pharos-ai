import { AlertChannel, AlertEvent, WebhookConfig } from "../types.js";
import { execFileSync } from "child_process";

export class GenericWebhookChannel implements AlertChannel {
  public readonly name = "GenericWebhook";

  constructor(private config: WebhookConfig) {}

  public async send(alert: AlertEvent): Promise<boolean> {
    if (!this.config.url) return false;

    const payload = {
      source: "pharos-alert-bot",
      alert,
    };

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "PharosAlertBot/1.0",
      ...(this.config.headers || {}),
    };

    try {
      const res = await fetch(this.config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      try {
        const headerArgs: string[] = [];
        for (const [k, v] of Object.entries(headers)) {
          headerArgs.push("-H", `${k}: ${v}`);
        }
        execFileSync(
          "curl",
          [
            "-s",
            "-X",
            "POST",
            this.config.url,
            ...headerArgs,
            "-d",
            JSON.stringify(payload),
          ],
          { encoding: "utf-8", timeout: 5000 }
        );
        return true;
      } catch (curlErr) {
        console.error(`[GenericWebhookChannel] Delivery failed:`, curlErr);
      }
    }
    return false;
  }
}
