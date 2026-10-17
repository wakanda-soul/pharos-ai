import { AlertChannel, AlertEvent } from "../types.js";
import fs from "fs";
import path from "path";

export class ConsoleChannel implements AlertChannel {
  public readonly name = "Console";

  constructor(private logFilePath?: string) {}

  public async send(alert: AlertEvent): Promise<boolean> {
    const divider = "=".repeat(80);
    const subDivider = "-".repeat(80);

    const severityIcon =
      alert.severity === "CRITICAL"
        ? "🔴 CRITICAL"
        : alert.severity === "WARNING"
        ? "🟠 WARNING"
        : "🔵 INFO";

    const lines = [
      divider,
      `  🚨  PHAROS ON-CHAIN ALERT: ${alert.title.toUpperCase()}`,
      divider,
      `Timestamp:    ${alert.timestamp}`,
      `Category:     ${alert.category}  [${severityIcon}]`,
      `Trigger Value: ${alert.value}`,
      `Details:      ${alert.description}`,
      alert.blockNumber ? `Block:        #${alert.blockNumber}` : null,
      alert.txHash ? `Transaction:  ${alert.txHash}` : null,
      alert.explorerUrl ? `Explorer:     ${alert.explorerUrl}` : null,
      subDivider,
    ].filter(Boolean);

    console.log(lines.join("\n"));

    // File logging if configured or default
    const targetFile =
      this.logFilePath || path.resolve(process.cwd(), "logs", "alerts.log");
    try {
      const dir = path.dirname(targetFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const logRecord = `[${alert.timestamp}] [${alert.severity}] [${alert.category}] ${alert.title} | Value: ${alert.value} | Tx: ${alert.txHash || "N/A"} | Explorer: ${alert.explorerUrl || "N/A"}\n`;
      fs.appendFileSync(targetFile, logRecord, "utf-8");
    } catch (err) {
      console.warn(`[ConsoleChannel] Failed to append to log file:`, err);
    }

    return true;
  }
}
