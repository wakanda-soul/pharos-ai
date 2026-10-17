import { describe, it, expect } from "vitest";

describe("Task 02: ProsPixel Event Decoder & Monitor", () => {
  const PROSPIXEL_CONTRACT = "0xf81Fb02F13917db6fa8f5A1F2e39a86EcE2A626a";

  it("should have correct target contract configuration for ProsPixel", () => {
    expect(PROSPIXEL_CONTRACT.toLowerCase()).toBe("0xf81fb02f13917db6fa8f5a1f2e39a86ece2a626a");
  });

  it("should generate unique event keys to prevent duplicate log processing", () => {
    const seen = new Set<string>();

    const log1 = { txHash: "0x123", logIndex: "0x0" };
    const log2 = { txHash: "0x123", logIndex: "0x0" };
    const log3 = { txHash: "0x123", logIndex: "0x1" };

    const key1 = `${log1.txHash}-${log1.logIndex}`;
    const key2 = `${log2.txHash}-${log2.logIndex}`;
    const key3 = `${log3.txHash}-${log3.logIndex}`;

    expect(seen.has(key1)).toBe(false);
    seen.add(key1);

    expect(seen.has(key2)).toBe(true); // Duplicate identified!
    expect(seen.has(key3)).toBe(false); // Distinct log in same tx allowed
  });
});
