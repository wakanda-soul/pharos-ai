import { describe, it, expect } from 'vitest';
import { AggregatorMcpServer } from '../src/mcp-server.js';

describe('Task 30: Aggregator MCP Server (Agent Integration)', () => {
  it('should initialize MCP server instance without error', () => {
    const mcpServer = new AggregatorMcpServer();
    expect(mcpServer).toBeDefined();
    expect(typeof mcpServer.run).toBe('function');
  });
});
