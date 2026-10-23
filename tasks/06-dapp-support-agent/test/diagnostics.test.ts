import { describe, it, expect } from "vitest";
import { DappSupportAnalyzer } from "../src/analyzer.js";
import { DiagnosticFormatter } from "../src/formatter.js";
import { DEMO_FAILURE_CASES } from "../src/demo-cases.js";

describe("Task 06: dApp Support Agent Diagnostics", () => {
  const analyzer = new DappSupportAnalyzer();

  it("should decode standard Error(string) reverts accurately", () => {
    // Error("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT")
    const slippageHex =
      "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002b556e69737761705632526f757465723a20494e53554646494349454e545f4f55545055545f414d4f554e54000000000000000000000000000000000000000000";

    const decoded = analyzer.decodeRevertData(slippageHex);
    expect(decoded).not.toBeNull();
    expect(decoded?.category).toBe("SLIPPAGE_EXCEEDED");
    expect(decoded?.plainEnglishExplanation).toContain("slippage");
    expect(decoded?.actionableSteps.length).toBeGreaterThan(0);
  });

  it("should decode OpenZeppelin ERC20 custom errors (Insufficient Allowance)", () => {
    // 0xfb8f41b2 = ERC20InsufficientAllowance(address,uint256,uint256)
    const allowanceHex =
      "0xfb8f41b2000000000000000000000000936564245b69f5a293b42cbd752e0ee3bb68b47000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002faf080";

    const decoded = analyzer.decodeRevertData(allowanceHex);
    expect(decoded).not.toBeNull();
    expect(decoded?.category).toBe("INSUFFICIENT_ALLOWANCE");
    expect(decoded?.name).toBe("ERC20InsufficientAllowance");
    expect(decoded?.actionableSteps[0]).toContain("Approve");
  });

  it("should decode Solidity Panic(uint256) runtime errors", () => {
    // Panic(0x11) = Arithmetic underflow/overflow
    const panicHex =
      "0x4e487b710000000000000000000000000000000000000000000000000000000000000011";

    const decoded = analyzer.decodeRevertData(panicHex);
    expect(decoded).not.toBeNull();
    expect(decoded?.category).toBe("MATH_PANIC");
    expect(decoded?.plainEnglishExplanation).toContain("overflow");
  });

  it("should correctly identify OUT_OF_GAS when gasUsed equals gasLimit", () => {
    const oofCase = DEMO_FAILURE_CASES["out-of-gas"];
    expect(oofCase.failureCategory).toBe("OUT_OF_GAS");
    expect(oofCase.gasUsed).toEqual(oofCase.gasLimit);
    expect(oofCase.remedy[0]).toContain("Increase the gas limit");
  });

  it("should format markdown support ticket for community support channels", () => {
    const allowanceCase = DEMO_FAILURE_CASES["insufficient-allowance"];
    const ticket = DiagnosticFormatter.formatMarkdownTicket(allowanceCase);

    expect(ticket).toContain("### 🚨 dApp Incident Report:");
    expect(ticket).toContain("INSUFFICIENT_ALLOWANCE");
    expect(ticket).toContain("Recommended Solution:");
    expect(ticket).toContain("PharosScan Explorer");
  });
});
