import { describe, it, expect } from "vitest";
import { formatAddress, formatTokenAmount } from "../../../src/shared/chain.js";
import { NETWORKS } from "../../../src/shared/config.js";

describe("Task 01: Chain Utils & Formatting", () => {
  it("should format addresses with ellipsis", () => {
    const full = "0xc879c018db60520f4355c26ed1a6d572cdac1815";
    const formatted = formatAddress(full);
    expect(formatted).toBe("0xc879...1815");
  });

  it("should correctly format token amounts with custom decimals", () => {
    // 6 decimals (e.g. USDC)
    const usdcRaw = 100000000n; // 100 USDC
    expect(formatTokenAmount(usdcRaw, 6)).toBe("100");

    // 18 decimals (e.g. PROS)
    const prosRaw = 1500000000000000000n; // 1.5 PROS
    expect(formatTokenAmount(prosRaw, 18)).toBe("1.5");
  });

  it("should have correct network configurations for Pharos", () => {
    expect(NETWORKS.mainnet.chainId).toBe(1672);
    expect(NETWORKS.mainnet.nativeToken.symbol).toBe("PROS");
    expect(NETWORKS.mainnet.rpcUrl).toBe("https://rpc.pharos.xyz");

    expect(NETWORKS["atlantic-testnet"].chainId).toBe(688689);
    expect(NETWORKS["atlantic-testnet"].nativeToken.symbol).toBe("PHRS");
  });
});
