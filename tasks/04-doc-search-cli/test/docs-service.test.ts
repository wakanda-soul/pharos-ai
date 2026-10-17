import { describe, it, expect } from "vitest";
import { PharosDocsService } from "../src/docs-service.js";

describe("Task 04: PharosDocsService", { timeout: 25000 }, () => {
  const service = new PharosDocsService();

  it("should handle empty or whitespace query gracefully", async () => {
    const res = await service.search("   ");
    expect(res.isFound).toBe(false);
    expect(res.answer).toContain("Please provide a valid question");
    expect(res.sources).toHaveLength(0);
  });

  it("should return offline knowledge for core network specs when requested", async () => {
    const res = await service.search("what is the mainnet chain id");
    expect(res.answer).toContain("1672");
    expect(res.sources.length).toBeGreaterThan(0);
    expect(res.sources[0].url).toContain("docs.pharos.xyz");
  });

  it("should gracefully handle off-topic questions without hallucination", async () => {
    const res = await service.search("how to bake a chocolate cake");
    expect(res.answer.toLowerCase()).toMatch(/cannot find|can’t help|outside|not found/);
  });

  it("should return valid documentation links starting with official base URL", async () => {
    const res = await service.search("how do I deploy a contract with foundry");
    expect(res.sources.length).toBeGreaterThan(0);
    for (const source of res.sources) {
      expect(source.url.startsWith("https://docs.pharos.xyz")).toBe(true);
      expect(source.title).toBeTruthy();
    }
  });

  it("should accept a goal parameter and return response within reasonable time", async () => {
    const res = await service.search("how to query logs with get_logs", {
      goal: "monitor smart contract events",
      timeoutMs: 10000,
    });
    expect(res.answer).toBeTruthy();
    expect(res.responseTimeMs).toBeGreaterThan(0);
  });
});
