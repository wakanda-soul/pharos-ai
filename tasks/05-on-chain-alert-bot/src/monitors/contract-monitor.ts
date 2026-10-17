import { PharosMcpClient } from "../../../../src/shared/mcp-client.js";
import { AlertEvent, BotConfig } from "../types.js";
import { NETWORKS } from "../../../../src/shared/config.js";

export class ContractMonitor {
  private mcp: PharosMcpClient;
  private lastProcessedBlock: number = 0;
  private contractAddress: string;

  constructor(private config: BotConfig) {
    this.mcp = new PharosMcpClient(config.mcpEndpoint);
    // Default to ProsPixel game contract if none specified
    this.contractAddress = (
      config.contractAddress || "0xf81F6F7B4b14d9b6264d1f2e624c9Fe88aA402D5"
    ).toLowerCase();
  }

  public async poll(): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];
    const network = NETWORKS[this.config.network];

    try {
      const bnRes = await this.mcp.callTool("get_block_number", {});
      const currentBlock = Number(bnRes.parsed?.blockNumber || bnRes.parsed);

      if (isNaN(currentBlock)) {
        return [];
      }

      const lookback = this.config.lookbackBlocks || 50;
      const fromBlockNumber =
        this.lastProcessedBlock > 0
          ? Math.max(this.lastProcessedBlock + 1, currentBlock - lookback)
          : currentBlock - lookback;

      const fromBlockHex = "0x" + fromBlockNumber.toString(16);
      const toBlockHex = "0x" + currentBlock.toString(16);

      const params: Record<string, any> = {
        fromBlock: fromBlockHex,
        toBlock: toBlockHex,
        address: this.contractAddress,
      };

      if (this.config.contractEventTopic) {
        params.topics = [this.config.contractEventTopic];
      }

      const logsRes = await this.mcp.callTool("get_logs", params);
      const logs: any[] = Array.isArray(logsRes.parsed)
        ? logsRes.parsed
        : logsRes.parsed?.logs || [];

      const label = this.config.contractLabel || "Target Contract";

      for (const log of logs) {
        const txHash = log.transactionHash;
        const logIdx = log.logIndex || "0x0";
        const blockNum = Number(log.blockNumber);
        const eventSig = log.topics?.[0] || "Unknown Event";

        alerts.push({
          id: `contract:${network.chainId}:${txHash}:${logIdx}`,
          timestamp: new Date().toISOString(),
          category: "CONTRACT",
          severity: "INFO",
          title: `Smart Contract Event Triggered`,
          description: `Event on ${label} (${this.contractAddress.slice(0, 6)}...${this.contractAddress.slice(-4)}) with topic ${eventSig.slice(0, 10)}...`,
          value: `Event #${logIdx}`,
          txHash,
          blockNumber: blockNum,
          explorerUrl: `${network.explorerUrl}/tx/${txHash}`,
          metadata: {
            contract: this.contractAddress,
            topics: log.topics,
            data: log.data,
          },
        });
      }

      this.lastProcessedBlock = currentBlock;
    } catch (err) {
      console.error("[ContractMonitor] Polling error:", err);
    }

    return alerts;
  }
}
