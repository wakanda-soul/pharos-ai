#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { PharosDocsService } from "./docs-service.js";

/**
 * Pharos Developer Docs MCP Server
 * Exposes real-time Pharos documentation search and retrieval tools over MCP.
 */
export class PharosDocsMcpServer {
  private server: Server;
  private docsService: PharosDocsService;

  constructor() {
    this.docsService = new PharosDocsService();
    this.server = new Server(
      {
        name: "pharos-developer-docs-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available documentation tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "search_pharos_docs",
            description: "Search official Pharos developer documentation for guides, smart contract tutorials, network specs, and APIs.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Natural-language question or search term (e.g., 'how to deploy with Foundry', 'what is the mainnet chain ID')",
                },
                goal: {
                  type: "string",
                  description: "Optional broader objective or context to tailor the documentation response.",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_network_specs",
            description: "Retrieve official Pharos network parameters for Pacific Mainnet and Atlantic Testnet (Chain IDs, RPC URLs, Explorers).",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  enum: ["mainnet", "testnet", "all"],
                  description: "Target network to inspect (default: 'all')",
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "search_pharos_docs") {
        const query = String(args?.query || "");
        const goal = args?.goal ? String(args.goal) : undefined;

        const result = await this.docsService.search(query, { goal });

        let formattedText = `## Query: ${result.query}\n\n`;
        formattedText += `### Answer\n${result.answer}\n\n`;

        if (result.sources && result.sources.length > 0) {
          formattedText += `### Sources & Official Docs\n`;
          for (const s of result.sources) {
            formattedText += `- [${s.title}](${s.url})\n`;
          }
          formattedText += `\n`;
        }

        if (result.suggestedFollowUps && result.suggestedFollowUps.length > 0) {
          formattedText += `### Suggested Follow-ups\n`;
          for (const f of result.suggestedFollowUps) {
            formattedText += `- ${f}\n`;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: formattedText,
            },
          ],
        };
      }

      if (name === "get_network_specs") {
        const target = (args?.network as string) || "all";
        const mainnetInfo = {
          network: "Pharos Pacific Mainnet",
          chainId: 1672,
          chainIdHex: "0x688",
          rpcUrl: "https://rpc.pharos.xyz",
          currencySymbol: "PROS",
          decimals: 18,
          explorer: "https://pharosscan.xyz",
          hostedMcpUrl: "https://mcp.pharos.xyz/mcp",
        };

        const testnetInfo = {
          network: "Pharos Atlantic Testnet",
          chainId: 688689,
          chainIdHex: "0xa8231",
          rpcUrl: "https://atlantic.dplabs-internal.com",
          currencySymbol: "PHRS",
          decimals: 18,
          explorer: "https://atlantic.pharosscan.xyz",
        };

        let data: any;
        if (target === "mainnet") data = mainnetInfo;
        else if (target === "testnet") data = testnetInfo;
        else data = { mainnet: mainnetInfo, testnet: testnetInfo };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Pharos Developer Docs MCP Server running over stdio.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new PharosDocsMcpServer();
  server.start().catch((err) => {
    console.error("Fatal error starting Docs MCP server:", err);
    process.exit(1);
  });
}
