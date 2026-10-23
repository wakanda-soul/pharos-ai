import { MCP_CONFIG } from "./config";
import { execFileSync } from "node:child_process";

export interface McpToolResult<T = any> {
  content?: Array<{ type: string; text?: string; [key: string]: any }>;
  isError?: boolean;
  parsed?: T;
  raw?: any;
}

export class PharosMcpClient {
  private url: string;
  private sessionId: string | null = null;
  private messageId: number = 0;

  constructor(url: string = MCP_CONFIG.url) {
    this.url = url;
  }

  private async post(body: any, customHeaders: Record<string, string> = {}): Promise<{ text: string; sessionId?: string | null }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
      ...customHeaders,
    };
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
    }

    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      const returnedSessionId = res.headers.get("mcp-session-id");
      const text = await res.text();
      return { text, sessionId: returnedSessionId };
    } catch {
      // High-reliability system curl fallback
      const curlHeaders: string[] = [];
      for (const [k, v] of Object.entries(headers)) {
        curlHeaders.push("-H", `${k}: ${v}`);
      }
      const out = execFileSync("curl", [
        "-s",
        "-i",
        "--max-time", "8",
        "-X", "POST",
        this.url,
        ...curlHeaders,
        "-d", JSON.stringify(body),
      ], { encoding: "utf-8" });

      const headerEndIndex = out.indexOf("\r\n\r\n") !== -1 ? out.indexOf("\r\n\r\n") : out.indexOf("\n\n");
      const headerPart = headerEndIndex !== -1 ? out.slice(0, headerEndIndex) : "";
      const bodyPart = headerEndIndex !== -1 ? out.slice(headerEndIndex).trim() : out;

      const sessionMatch = headerPart.match(/mcp-session-id:\s*([^\r\n]+)/i);
      return { text: bodyPart, sessionId: sessionMatch ? sessionMatch[1].trim() : null };
    }
  }

  /**
   * Initializes the MCP connection and extracts the session ID.
   */
  async initialize(): Promise<void> {
    if (this.sessionId) return;

    const { text, sessionId } = await this.post({
      jsonrpc: "2.0",
      id: ++this.messageId,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "pharos-ai-agent",
          version: "1.0.0",
        },
      },
    });

    if (sessionId) {
      this.sessionId = sessionId;
    }

    const data = this.parseSseOrJson(text);
    if (data.error) {
      throw new Error(`MCP Initialization failed: ${JSON.stringify(data.error)}`);
    }
  }

  /**
   * Lists available tools from the Pharos MCP server.
   */
  async listTools(): Promise<any[]> {
    await this.initialize();
    const res = await this.sendRpc("tools/list", {});
    return res.result?.tools || [];
  }

  /**
   * Calls a tool by name with arguments.
   */
  async callTool<T = any>(name: string, args: Record<string, any> = {}): Promise<McpToolResult<T>> {
    await this.initialize();
    const rpcRes = await this.sendRpc("tools/call", {
      name,
      arguments: args,
    });

    if (rpcRes.error) {
      return {
        isError: true,
        content: [{ type: "text", text: rpcRes.error.message || JSON.stringify(rpcRes.error) }],
        raw: rpcRes.error,
      };
    }

    const content = rpcRes.result?.content || [];
    let parsed: any = null;

    if (content.length > 0 && content[0].text) {
      try {
        parsed = JSON.parse(content[0].text);
      } catch {
        parsed = content[0].text;
      }
    }

    return {
      content,
      isError: rpcRes.result?.isError || false,
      parsed: parsed as T,
      raw: rpcRes.result,
    };
  }

  // Typed convenience helper methods

  async getChainInfo(): Promise<any> {
    const res = await this.callTool("get_chain_info");
    return res.parsed;
  }

  async getBlockNumber(): Promise<number> {
    const res = await this.callTool("get_block_number");
    const val = res.parsed;
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseInt(val, 10) || parseInt(val, 16);
    if (val && val.blockNumber) return parseInt(val.blockNumber, 10);
    if (val && val.blockNumberHex) return parseInt(val.blockNumberHex, 16);
    return 0;
  }

  async getBalance(address: string, block: string = "latest"): Promise<string> {
    const res = await this.callTool("get_balance", { address, block });
    return res.parsed;
  }

  async getCode(address: string, block: string = "latest"): Promise<string> {
    const res = await this.callTool("get_code", { address, block });
    return res.parsed;
  }

  async getStorageAt(address: string, position: string, block: string = "latest"): Promise<string> {
    const res = await this.callTool("get_storage_at", { address, position, block });
    return res.parsed;
  }

  async ethCall(transaction: { to: string; data: string; from?: string; value?: string }, block: string = "latest"): Promise<`0x${string}`> {
    const res = await this.callTool("eth_call", { transaction, block });
    if (res.isError) {
      throw new Error(`eth_call reverted or failed: ${JSON.stringify(res.parsed)}`);
    }
    const hex = res.parsed?.result || (typeof res.parsed === "string" ? res.parsed : "0x");
    return hex as `0x${string}`;
  }

  async getLogs(filter: { address?: string | string[]; topics?: (string | string[] | null)[]; fromBlock?: string | number; toBlock?: string | number }): Promise<any[]> {
    const res = await this.callTool("get_logs", filter);
    return res.parsed || [];
  }

  private async sendRpc(method: string, params: any): Promise<any> {
    const { text, sessionId } = await this.post({
      jsonrpc: "2.0",
      id: ++this.messageId,
      method,
      params,
    });

    if (sessionId) {
      this.sessionId = sessionId;
    }

    return this.parseSseOrJson(text);
  }

  private parseSseOrJson(text: string): any {
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fallback to SSE parsing
      }
    }

    // Parse SSE lines
    const lines = trimmed.split("\n");
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        try {
          return JSON.parse(payload);
        } catch {
          // Continue
        }
      }
    }

    throw new Error(`Unable to parse MCP response: ${trimmed.slice(0, 200)}`);
  }
}
