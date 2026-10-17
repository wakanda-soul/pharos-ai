import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DedupStore } from "../src/storage/dedup-store.js";
import fs from "fs";
import path from "path";

describe("Task 05: DedupStore (Zero Repeat Spam)", () => {
  const testCachePath = path.resolve(process.cwd(), ".test-state", "dedup-test.json");

  beforeEach(() => {
    if (fs.existsSync(testCachePath)) {
      fs.unlinkSync(testCachePath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testCachePath)) {
      fs.unlinkSync(testCachePath);
    }
    const dir = path.dirname(testCachePath);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should allow first-time event and suppress immediate duplicates", () => {
    const store = new DedupStore(testCachePath);
    const eventId = "transfer:1672:0xabc123:0x0";

    // 1st time: should alert
    const firstCheck = store.shouldAlert(eventId);
    expect(firstCheck).toBe(true);
    expect(store.has(eventId)).toBe(true);

    // 2nd time: must suppress (zero duplicate spam)
    const secondCheck = store.shouldAlert(eventId);
    expect(secondCheck).toBe(false);
  });

  it("should respect cooldown period for recurring conditions", async () => {
    const store = new DedupStore(testCachePath);
    const priceEventId = "price:ETH/USD:BELOW:0x1ed3";

    // Cooldown 1 second
    const firstCheck = store.shouldAlert(priceEventId, 1);
    expect(firstCheck).toBe(true);

    // Immediate check -> suppressed
    const immediateCheck = store.shouldAlert(priceEventId, 1);
    expect(immediateCheck).toBe(false);

    // Wait 1.1s for cooldown expiry
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // After cooldown -> allowed
    const afterCooldown = store.shouldAlert(priceEventId, 1);
    expect(afterCooldown).toBe(true);
  });

  it("should persist dedup state across process restarts", () => {
    const store1 = new DedupStore(testCachePath);
    store1.shouldAlert("tx:0x123:0");
    store1.save();

    // New instance reading same cache file
    const store2 = new DedupStore(testCachePath);
    expect(store2.has("tx:0x123:0")).toBe(true);
    expect(store2.shouldAlert("tx:0x123:0")).toBe(false);
  });
});
