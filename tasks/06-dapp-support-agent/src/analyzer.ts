import { PharosMcpClient } from "../../../src/shared/mcp-client.js";
import { NETWORKS } from "../../../src/shared/config.js";
import { TransactionDiagnostic, FailureCategory } from "./types.js";
import {
  KNOWN_CUSTOM_ERRORS,
  PANIC_CODES,
  matchKnownStringReverts,
  DecodedError,
} from "./error-registry.js";
import { decodeErrorResult, decodeAbiParameters, parseAbiParameters, formatEther, formatGwei } from "viem";

export class DappSupportAnalyzer {
  private mcp: PharosMcpClient;

  constructor(private mcpEndpoint: string = "https://mcp.pharos.xyz/mcp") {
    this.mcp = new PharosMcpClient(mcpEndpoint);
  }

  /**
   * Analyzes an on-chain transaction hash and produces an actionable diagnostic report.
   */
  async analyze(txHash: string, networkName: "mainnet" | "atlantic-testnet" = "mainnet"): Promise<TransactionDiagnostic> {
    const network = NETWORKS[networkName];
    const explorerUrl = `${network.explorerUrl}/tx/${txHash}`;

    // 1. Fetch transaction and receipt via Chain MCP
    const [txRes, receiptRes] = await Promise.all([
      this.mcp.callTool("get_transaction", { hash: txHash }),
      this.mcp.callTool("get_transaction_receipt", { hash: txHash }),
    ]);

    const tx = txRes.parsed?.transaction || txRes.parsed;
    const receipt = receiptRes.parsed?.receipt || receiptRes.parsed;

    if (!tx || !receipt) {
      throw new Error(`Transaction or receipt not found on ${network.name} for hash: ${txHash}`);
    }

    const blockNum = Number(BigInt(receipt.blockNumber || tx.blockNumber || 0));
    const gasLimit = BigInt(tx.gas || tx.gasLimit || 0);
    const gasUsed = BigInt(receipt.gasUsed || 0);
    const gasPrice = BigInt(receipt.effectiveGasPrice || tx.gasPrice || 0);
    const valueBigInt = BigInt(tx.value || 0);
    const effectiveGasCost = gasUsed * gasPrice;

    const baseDiagnostic: TransactionDiagnostic = {
      txHash,
      blockNumber: blockNum,
      from: tx.from,
      to: tx.to || "0xContractCreation",
      value: `${formatEther(valueBigInt)} ${network.nativeToken.symbol}`,
      gasLimit,
      gasUsed,
      gasPriceGwei: formatGwei(gasPrice),
      effectiveGasCost: `${formatEther(effectiveGasCost)} ${network.nativeToken.symbol}`,
      status: receipt.status === "0x1" ? "SUCCESS" : "FAILED",
      network: networkName,
      explorerUrl,
      explanation: "",
      remedy: [],
    };

    // If transaction actually succeeded on-chain
    if (receipt.status === "0x1") {
      baseDiagnostic.explanation =
        "The transaction was mined successfully on the Pharos blockchain with status OK (0x1). If the dApp UI displayed an error, it was likely a front-end timeout or local client issue rather than an on-chain failure.";
      baseDiagnostic.remedy = [
        "Check your wallet activity or explorer link above to confirm the transaction succeeded.",
        "Refresh the dApp page to allow the frontend to sync with the latest block state.",
      ];
      return baseDiagnostic;
    }

    // --- FAILURE DIAGNOSIS PIPELINE ---

    // Check 1: Out of Gas
    if (gasLimit > 0n && gasUsed >= (gasLimit * 98n) / 100n) {
      baseDiagnostic.failureCategory = "OUT_OF_GAS";
      baseDiagnostic.explanation = `The transaction ran out of gas during EVM execution. It consumed ${gasUsed.toLocaleString()} units out of the ${gasLimit.toLocaleString()} limit (100%).`;
      baseDiagnostic.remedy = [
        "Increase the gas limit in your wallet settings (e.g. Advanced Gas Controls in MetaMask/Rabby) by 30% to 50% before retrying.",
        "If you were executing a batch operation (e.g. multiple swaps or mints), try executing in smaller batches.",
        `Ensure you have at least ${(Number(formatEther(gasLimit * gasPrice)) * 1.5).toFixed(4)} ${network.nativeToken.symbol} to cover the increased gas ceiling.`,
      ];
      return baseDiagnostic;
    }

    // Check 2: On-chain re-simulation via Chain MCP eth_call
    let revertHex: string | null = null;
    let revertReason: string | null = null;

    try {
      const prevBlockHex = "0x" + Math.max(0, blockNum - 1).toString(16);
      const callRes = await this.mcp.callTool("eth_call", {
        transaction: {
          from: tx.from,
          to: tx.to,
          value: tx.value,
          data: tx.input,
        },
        block: prevBlockHex,
      });

      if (callRes.isError) {
        const errorText = callRes.content?.[0]?.text || "";
        const hexMatch = errorText.match(/0x[a-fA-F0-9]{8,}/);
        if (hexMatch) {
          revertHex = hexMatch[0];
        }
        revertReason = errorText;
      }
    } catch (simErr: any) {
      revertReason = simErr.message;
    }

    // Step 3: Decode Revert Data (Custom Errors, Error(string), Panic)
    if (revertHex) {
      baseDiagnostic.revertDataHex = revertHex;
      const decoded = this.decodeRevertData(revertHex, tx);
      if (decoded) {
        baseDiagnostic.failureCategory = decoded.category;
        baseDiagnostic.rawRevertReason = decoded.name;
        baseDiagnostic.explanation = decoded.plainEnglishExplanation;
        baseDiagnostic.remedy = decoded.actionableSteps;
        if (decoded.suggestedFixCommand) {
          baseDiagnostic.suggestedCastCommand = decoded.suggestedFixCommand(tx.to, tx.from);
        }
        return baseDiagnostic;
      }
    }

    // Step 4: String Matching if raw revert reason string is present
    if (revertReason) {
      const matched = matchKnownStringReverts(revertReason);
      if (matched) {
        baseDiagnostic.failureCategory = matched.category;
        baseDiagnostic.rawRevertReason = matched.name;
        baseDiagnostic.explanation = matched.plainEnglishExplanation;
        baseDiagnostic.remedy = matched.actionableSteps;
        return baseDiagnostic;
      }
    }

    // Step 5: Check sender native balance
    try {
      const balanceRes = await this.mcp.getBalance(tx.from);
      const balanceBigInt = BigInt(balanceRes || "0");
      if (balanceBigInt < valueBigInt + effectiveGasCost) {
        baseDiagnostic.failureCategory = "INSUFFICIENT_BALANCE";
        baseDiagnostic.explanation = `Your wallet balance (${formatEther(balanceBigInt)} ${network.nativeToken.symbol}) was lower than the total value plus gas needed for this call.`;
        baseDiagnostic.remedy = [
          `Top up your wallet with at least ${formatEther(valueBigInt + effectiveGasCost)} ${network.nativeToken.symbol}.`,
          "On testnet, request testnet tokens from the faucet.",
        ];
        return baseDiagnostic;
      }
    } catch {
      // Ignore balance lookup error
    }

    // Default Fallback Revert
    baseDiagnostic.failureCategory = "CUSTOM_CONTRACT_REVERT";
    baseDiagnostic.explanation =
      "The smart contract reverted execution via an on-chain require/revert condition. This usually happens when an internal business logic check (e.g. mint cap reached, game round ended, or cooldown active) fails.";
    baseDiagnostic.remedy = [
      "Review the parameters and requirements of the target contract function.",
      "Check the dApp's documentation or Discord announcements to verify if the contract or pool is currently paused or inactive.",
      `Inspect recent transactions to this contract on PharosScan: ${network.explorerUrl}/address/${tx.to}`,
    ];

    return baseDiagnostic;
  }

  /**
   * Decodes hex revert payload into standard OpenZeppelin custom error, Error(string), or Panic(uint256).
   */
  public decodeRevertData(dataHex: string, txContext?: any): DecodedError | null {
    if (!dataHex || dataHex.length < 10) return null;

    const selector = dataHex.slice(0, 10).toLowerCase();

    // 1. Standard Error(string) -> 0x08c379a0
    if (selector === "0x08c379a0") {
      try {
        const decoded = decodeAbiParameters(
          parseAbiParameters("string"),
          `0x${dataHex.slice(10)}`
        );
        const reason = decoded[0] as string;
        const matched = matchKnownStringReverts(reason);
        if (matched) return matched;

        return {
          category: "CUSTOM_CONTRACT_REVERT",
          name: `Revert("${reason}")`,
          summary: `Contract reverted with message: "${reason}"`,
          plainEnglishExplanation: `The smart contract explicitly halted execution with message: "${reason}".`,
          actionableSteps: [
            `Address the contract condition: "${reason}".`,
            "Verify all function arguments before submitting the transaction again.",
          ],
        };
      } catch {
        // Fall through
      }
    }

    // 2. Solidity Panic(uint256) -> 0x4e487b71
    if (selector === "0x4e487b71") {
      try {
        const decoded = decodeAbiParameters(
          parseAbiParameters("uint256"),
          `0x${dataHex.slice(10)}`
        );
        const code = Number(decoded[0]);
        const panicDesc = PANIC_CODES[code] || `Internal EVM Panic code 0x${code.toString(16)}`;

        return {
          category: "MATH_PANIC",
          name: `Panic(0x${code.toString(16)})`,
          summary: panicDesc,
          plainEnglishExplanation: `An internal arithmetic or runtime safety check failed inside the contract: ${panicDesc}.`,
          actionableSteps: [
            "Check that your input numbers or token amounts do not cause an overflow or divide-by-zero.",
            "If swapping or staking, verify that the pool has sufficient liquidity reserves.",
          ],
        };
      } catch {
        // Fall through
      }
    }

    // 3. Known Custom Errors (e.g. OpenZeppelin ERC20 / Ownable)
    const custom = KNOWN_CUSTOM_ERRORS[selector];
    if (custom) {
      return {
        category: custom.category,
        name: custom.name,
        summary: custom.explain,
        plainEnglishExplanation: custom.explain,
        actionableSteps: custom.steps,
        suggestedFixCommand: custom.fixCommand,
      };
    }

    return null;
  }
}
