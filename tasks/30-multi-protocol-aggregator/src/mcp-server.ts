#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MultiProtocolAggregator } from './aggregator.js';
import { LockupTenor, ProtocolId } from './types.js';

/**
 * Pharos Multi-Protocol Yield Aggregator MCP Server
 * Exposes cross-protocol yield routing, rate discovery, and transaction preparation
 * directly to autonomous AI agents via Model Context Protocol (MCP).
 */
export class AggregatorMcpServer {
  private server: Server;
  private aggregator: MultiProtocolAggregator;

  constructor() {
    this.aggregator = new MultiProtocolAggregator();
    this.server = new Server(
      {
        name: 'pharos-multi-protocol-aggregator-mcp',
        version: '1.0.0',
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
    // 1. Declare available MCP tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_pharos_rates',
            description:
              'Query live yields (APY), total value locked (TVL), safety scores, and lockup terms across integrated Pharos protocols (Harbor RWA Hub, Morpho Blue Lending, FaroSwap AMM).',
            inputSchema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'Filter by underlying token symbol (e.g. "USDC", "WPROS").',
                },
                protocol: {
                  type: 'string',
                  enum: ['harbor', 'morpho', 'faroswap'],
                  description: 'Filter by protocol identifier.',
                },
              },
            },
          },
          {
            name: 'route_yield',
            description:
              'Evaluate all available venues against user risk, amount, and lockup horizon preferences. Selects the highest-performing venue, explains WHY it was chosen, details tradeoffs, and prepares an unsigned transaction payload.',
            inputSchema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'Asset token symbol to deposit (e.g. "USDC").',
                },
                amount_usd: {
                  type: 'number',
                  description: 'Amount in USD to deposit (e.g. 10000).',
                },
                max_lockup_tenor: {
                  type: 'string',
                  enum: ['liquid', '1d', '3m', '6m'],
                  description:
                    'Maximum acceptable lockup horizon. Use "liquid" for 0-day instant withdrawals (Morpho Blue / FaroSwap), or "3m"/"6m" for higher RWA yields.',
                },
                min_safety_score: {
                  type: 'number',
                  description:
                    'Minimum acceptable safety rating (0-100). E.g. 90 ensures only overcollateralized lending (Morpho Blue) is considered.',
                },
                user_address: {
                  type: 'string',
                  description: 'User wallet address on Pharos to receive vault shares/LP tokens.',
                },
              },
              required: ['token', 'amount_usd'],
            },
          },
          {
            name: 'get_user_positions',
            description:
              'Retrieve and aggregate active deposit positions and earned yield for a user across all connected protocols, calculating the weighted average APY.',
            inputSchema: {
              type: 'object',
              properties: {
                user_address: {
                  type: 'string',
                  description: 'User wallet address to inspect.',
                },
              },
              required: ['user_address'],
            },
          },
          {
            name: 'prepare_deposit',
            description:
              'Generate raw calldata, target contract address, and ready-to-run Foundry `cast send` CLI command for depositing into a specific vault venue.',
            inputSchema: {
              type: 'object',
              properties: {
                venue_id: {
                  type: 'string',
                  description: 'Venue identifier (e.g. "harbor:apc3m", "morpho:rockawayx-usdc", "faroswap:wpros-usdc").',
                },
                amount: {
                  type: 'string',
                  description: 'Amount of tokens to deposit (e.g. "5000").',
                },
                user_address: {
                  type: 'string',
                  description: 'User wallet address.',
                },
              },
              required: ['venue_id', 'amount', 'user_address'],
            },
          },
          {
            name: 'prepare_withdraw',
            description:
              'Generate raw calldata and Foundry `cast send` CLI command for withdrawing or redeeming shares from a specific vault venue.',
            inputSchema: {
              type: 'object',
              properties: {
                venue_id: {
                  type: 'string',
                  description: 'Venue identifier (e.g. "harbor:apc3m", "morpho:rockawayx-usdc").',
                },
                amount: {
                  type: 'string',
                  description: 'Amount of shares or underlying tokens to withdraw.',
                },
                user_address: {
                  type: 'string',
                  description: 'User wallet address.',
                },
              },
              required: ['venue_id', 'amount', 'user_address'],
            },
          },
          {
            name: 'check_protocol_health',
            description:
              'Inspect Circuit Breaker state (CLOSED / OPEN / HALF_OPEN), latency metrics, and failure counts across integrated Pharos protocols.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // 2. Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_pharos_rates': {
            const tokenFilter = (args?.token as string) || undefined;
            const protocolFilter = (args?.protocol as string) || undefined;

            const { venues, degradedProtocols } = await this.aggregator.getAllRates();
            let filtered = venues;
            if (tokenFilter) {
              filtered = filtered.filter(
                (v) => v.underlyingToken.toUpperCase() === tokenFilter.toUpperCase()
              );
            }
            if (protocolFilter) {
              filtered = filtered.filter(
                (v) => v.protocolId.toLowerCase() === protocolFilter.toLowerCase()
              );
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      count: filtered.length,
                      venues: filtered,
                      degradedProtocols,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'route_yield': {
            const token = (args?.token as string) || 'USDC';
            const amountUsd = Number(args?.amount_usd) || 1000;
            const maxTenor = (args?.max_lockup_tenor as LockupTenor) || '6m';
            const minSafety = Number(args?.min_safety_score) || 0;
            const userAddress =
              (args?.user_address as `0x${string}`) ||
              '0x1000000000000000000000000000000000000001';

            const result = await this.aggregator.routeAndPrepareDeposit(
              {
                token,
                amountUsd,
                maxLockupTenor: maxTenor,
                minSafetyScore: minSafety,
              },
              userAddress
            );

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      selectedVenue: result.bestVenue,
                      projectedYieldUsd: result.projectedYieldUsd,
                      explanation: result.explanation,
                      consideredVenues: result.consideredVenues,
                      preparedTx: result.preparedDepositTx,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'get_user_positions': {
            const userAddress = (args?.user_address as `0x${string}`) || '0x0';
            const portfolio = await this.aggregator.getUserPositions(userAddress);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      userAddress,
                      totalDepositedUsd: portfolio.totalDepositedUsd,
                      totalEarnedUsd: portfolio.totalEarnedUsd,
                      weightedAverageApy: portfolio.weightedAverageApy,
                      positions: portfolio.positions,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case 'prepare_deposit': {
            const venueId = args?.venue_id as string;
            const amount = args?.amount as string;
            const userAddress = args?.user_address as `0x${string}`;

            const tx = await this.aggregator.prepareDeposit(venueId, amount, userAddress);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, transaction: tx }, null, 2),
                },
              ],
            };
          }

          case 'prepare_withdraw': {
            const venueId = args?.venue_id as string;
            const amount = args?.amount as string;
            const userAddress = args?.user_address as `0x${string}`;

            const tx = await this.aggregator.prepareWithdraw(venueId, amount, userAddress);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, transaction: tx }, null, 2),
                },
              ],
            };
          }

          case 'check_protocol_health': {
            const health = this.aggregator.getHealthStatus();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, health }, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${err?.message || String(err)}`,
            },
          ],
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Pharos Multi-Protocol Aggregator MCP Server running on stdio');
  }
}

// Auto-run if executed directly as entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const mcp = new AggregatorMcpServer();
  mcp.run().catch((err) => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}
