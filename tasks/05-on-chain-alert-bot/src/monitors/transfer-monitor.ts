import { PharosMcpClient } from "../../../../src/shared/mcp-client.js";
import { AlertEvent, BotConfig } from "../types.js";
import { NETWORKS } from "../../../../src/shared/config.js";

// Known Pharos tokens
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0xc8797f66a2c80749e7cf9a80a68a7eb532414376": { symbol: "USDC", decimals: 6 },
  "0xc879c018db60520f4355c26ed1a6d572cdac1815": { symbol: "USDC", decimals: 6 },
};

export class TransferMonitor {
  private mcp: PharosMcpClient;
  private lastProcessedBlock: number = 0;

  constructor(private config: BotConfig) {
    this.mcp = new PharosMcpClient(config.mcpEndpoint);
  }

  public async poll(): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];

    try {
      const bnRes = await this.mcp.callTool("get_block_number", {});
      const currentBlock = Number(bnRes.parsed?.blockNumber || bnRes.parsed);

      if (isNaN(currentBlock)) {
        console.warn("[TransferMonitor] Could not parse block number:", bnRes);
        return [];
      }

      const lookback = this.config.lookbackBlocks || 20;
      const fromBlockNumber =
        this.lastProcessedBlock > 0
          ? Math.max(this.lastProcessedBlock + 1, currentBlock - lookback)
          : currentBlock - lookback;

      const fromBlockHex = "0x" + fromBlockNumber.toString(16);
      const toBlockHex = "0x" + currentBlock.toString(16);

      const params: Record<string, any> = {
        fromBlock: fromBlockHex,
        toBlock: toBlockHex,
        topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"], // Transfer
      };

      if (this.config.transferTokenAddress) {
        params.address = this.config.transferTokenAddress;
      }

      const logsRes = await this.mcp.callTool("get_logs", params);
      const logs: any[] = Array.isArray(logsRes.parsed)
        ? logsRes.parsed
        : logsRes.parsed?.logs || [];

      const minAmount = this.config.minTransferAmount ?? 100;
      const network = NETWORKS[this.config.network];

      for (const log of logs) {
        if (!log.data || log.data === "0x" || !log.topics || log.topics.length < 3) {
          continue;
        }

        const tokenAddr = (log.address || "").toLowerCase();
        const tokenMeta = KNOWN_TOKENS[tokenAddr] || {
          symbol: this.config.transferTokenSymbol || "TOKEN",
          decimals: this.config.transferTokenDecimals || 18,
        };

        const rawAmountBigInt = BigInt(log.data);
        const divisor = 10 ** tokenMeta.decimals;
        const formattedAmount = Number(rawAmountBigInt) / divisor;

        if (formattedAmount >= minAmount) {
          const fromAddr = "0x" + (log.topics[1] || "").slice(-40);
          const toAddr = "0x" + (log.topics[2] || "").slice(-40);
          const txHash = log.transactionHash;
          const logIdx = log.logIndex || "0x0";
          const blockNum = Number(log.blockNumber);

          const isWhale = formattedAmount >= minAmount * 5;
          const severity = isWhale ? "CRITICAL" : formattedAmount >= minAmount * 2 ? "WARNING" : "INFO";

          alerts.push({
            id: `transfer:${network.chainId}:${txHash}:${logIdx}`,
            timestamp: new Date().toISOString(),
            category: "TRANSFER",
            severity,
            title: isWhale ? `Whale Transfer Detected` : `Large Token Transfer`,
            description: `Transfer of ${formattedAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${tokenMeta.symbol} from ${fromAddr.slice(0, 6)}...${fromAddr.slice(-4)} to ${toAddr.slice(0, 6)}...${toAddr.slice(-4)}`,
            value: `${formattedAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${tokenMeta.symbol}`,
            numericValue: formattedAmount,
            unit: tokenMeta.symbol,
            txHash,
            blockNumber: blockNum,
            explorerUrl: `${network.explorerUrl}/tx/${txHash}`,
            metadata: {
              token: tokenAddr,
              from: fromAddr,
              to: toAddr,
              rawAmount: rawAmountBigInt.toString(),
            },
          });
        }
      }

      this.lastProcessedBlock = currentBlock;
    } catch (err) {
      console.error("[TransferMonitor] Polling error:", err);
    }

    return alerts;
  }
}
