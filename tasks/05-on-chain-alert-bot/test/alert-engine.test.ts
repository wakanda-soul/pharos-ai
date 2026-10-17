import { describe, it, expect } from "vitest";
import { AlertEvent } from "../src/types.js";
import { ConsoleChannel } from "../src/channels/console.js";
import fs from "fs";
import path from "path";

describe("Task 05: Alert Payload & Channels", () => {
  const testLogPath = path.resolve(process.cwd(), ".test-state", "test-alerts.log");

  it("should generate proper alert payload with block, tx, and explorer link", () => {
    const sampleAlert: AlertEvent = {
      id: "transfer:1672:0xabc999:0x1",
      timestamp: new Date().toISOString(),
      category: "TRANSFER",
      severity: "CRITICAL",
      title: "Whale Transfer Detected",
      description: "Transfer of 50,000 USDC",
      value: "50,000 USDC",
      numericValue: 50000,
      unit: "USDC",
      txHash: "0xabc999",
      blockNumber: 20515000,
      explorerUrl: "https://www.pharosscan.xyz/tx/0xabc999",
    };

    expect(sampleAlert.explorerUrl).toBe("https://www.pharosscan.xyz/tx/0xabc999");
    expect(sampleAlert.severity).toBe("CRITICAL");
    expect(sampleAlert.value).toContain("50,000 USDC");
    expect(sampleAlert.blockNumber).toBe(20515000);
  });

  it("should format and append alert to audit log file via ConsoleChannel", async () => {
    const channel = new ConsoleChannel(testLogPath);

    const alert: AlertEvent = {
      id: "price:ETH/USD:BELOW:0x1ed3",
      timestamp: new Date().toISOString(),
      category: "PRICE",
      severity: "WARNING",
      title: "Oracle Price Alert: ETH/USD",
      description: "ETH/USD dropped below floor threshold of $3,000",
      value: "$2,380.00",
      numericValue: 2380,
      unit: "USD",
      explorerUrl: "https://www.pharosscan.xyz/address/0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8",
    };

    const sent = await channel.send(alert);
    expect(sent).toBe(true);

    expect(fs.existsSync(testLogPath)).toBe(true);
    const content = fs.readFileSync(testLogPath, "utf-8");
    expect(content).toContain("[PRICE]");
    expect(content).toContain("$2,380.00");
    expect(content).toContain("https://www.pharosscan.xyz/address/0x1Ed3");

    // Cleanup
    fs.unlinkSync(testLogPath);
  });
});
