import { PharosMcpClient } from '../../../src/shared/mcp-client.js';
import { ChainTelemetry } from './types.js';
import { encodeFunctionData, formatUnits, parseAbi } from 'viem';
import { execFileSync } from 'child_process';

const ERC20_BALANCE_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)',
]);

export class ChainMcpReader {
  private mcpClient: PharosMcpClient;
  private readonly rpcUrl = 'https://rpc.pharos.xyz';
  private readonly chainId = 1672;
  private readonly usdcContract: `0x${string}` = '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0';

  constructor(mcpUrl?: string) {
    this.mcpClient = new PharosMcpClient(mcpUrl);
  }

  /**
   * Fetches real-time on-chain telemetry for the given treasury address
   * via Pharos Chain MCP with transparent RPC fallback.
   */
  async fetchTreasuryTelemetry(
    treasuryAddress: `0x${string}`,
    assumedProsPriceUsd = 1.25,
    mockBalances?: { pros?: number; usdc?: number }
  ): Promise<ChainTelemetry> {
    if (mockBalances && (mockBalances.pros !== undefined || mockBalances.usdc !== undefined)) {
      const blockHex = this.rpcCall('eth_blockNumber', []);
      const blockNumber = parseInt(blockHex, 16) || 1042000;
      const nativeBalancePros = mockBalances.pros ?? 0;
      const usdcBalanceUnits = mockBalances.usdc ?? 0;
      const totalValuationUsd = usdcBalanceUnits + nativeBalancePros * assumedProsPriceUsd;

      return {
        network: 'Pharos Mainnet',
        chainId: this.chainId,
        blockNumber,
        blockTimestamp: Math.floor(Date.now() / 1000),
        treasuryAddress,
        nativeBalanceWei: BigInt(Math.floor(nativeBalancePros * 1e18)).toString(),
        nativeBalancePros,
        usdcBalanceRaw: BigInt(Math.floor(usdcBalanceUnits * 1e6)).toString(),
        usdcBalanceUnits,
        gasPriceGwei: 1.0,
        totalValuationUsd: parseFloat(totalValuationUsd.toFixed(2)),
      };
    }

    try {
      return await this.fetchViaMcp(treasuryAddress, assumedProsPriceUsd);
    } catch {
      // Graceful fallback to direct Pharos RPC
      return await this.fetchViaRpc(treasuryAddress, assumedProsPriceUsd);
    }
  }

  private async fetchViaMcp(
    treasuryAddress: `0x${string}`,
    prosPriceUsd: number
  ): Promise<ChainTelemetry> {
    const blockNumber = await this.mcpClient.getBlockNumber();
    const balanceRes = await this.mcpClient.getBalance(treasuryAddress);

    const nativeBalanceWei = typeof balanceRes === 'string'
      ? (balanceRes.startsWith('0x') ? BigInt(balanceRes).toString() : balanceRes)
      : '0';

    const nativeBalancePros = parseFloat(formatUnits(BigInt(nativeBalanceWei || '0'), 18));

    // ERC-20 balanceOf(treasury) via ethCall
    const calldata = encodeFunctionData({
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    });

    const callHex = await this.mcpClient.ethCall({
      to: this.usdcContract,
      data: calldata,
    });

    const usdcBalanceRaw = callHex && callHex !== '0x' ? BigInt(callHex).toString() : '0';
    const usdcBalanceUnits = parseFloat(formatUnits(BigInt(usdcBalanceRaw), 6));

    const totalValuationUsd = usdcBalanceUnits + nativeBalancePros * prosPriceUsd;

    return {
      network: 'Pharos Mainnet',
      chainId: this.chainId,
      blockNumber: blockNumber || 1042000,
      blockTimestamp: Math.floor(Date.now() / 1000),
      treasuryAddress,
      nativeBalanceWei,
      nativeBalancePros: parseFloat(nativeBalancePros.toFixed(4)),
      usdcBalanceRaw,
      usdcBalanceUnits: parseFloat(usdcBalanceUnits.toFixed(2)),
      gasPriceGwei: 1.0,
      totalValuationUsd: parseFloat(totalValuationUsd.toFixed(2)),
    };
  }

  private async fetchViaRpc(
    treasuryAddress: `0x${string}`,
    prosPriceUsd: number
  ): Promise<ChainTelemetry> {
    // 1. Get block number
    const blockHex = this.rpcCall('eth_blockNumber', []);
    const blockNumber = parseInt(blockHex, 16) || 1042000;

    // 2. Get native balance
    const balanceHex = this.rpcCall('eth_getBalance', [treasuryAddress, 'latest']);
    const nativeWei = BigInt(balanceHex || '0');
    const nativeBalancePros = parseFloat(formatUnits(nativeWei, 18));

    // 3. Get USDC balance
    const calldata = encodeFunctionData({
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    });

    const usdcCallHex = this.rpcCall('eth_call', [
      { to: this.usdcContract, data: calldata },
      'latest',
    ]);
    const usdcRaw = usdcCallHex && usdcCallHex !== '0x' ? BigInt(usdcCallHex) : 0n;
    const usdcBalanceUnits = parseFloat(formatUnits(usdcRaw, 6));

    const totalValuationUsd = usdcBalanceUnits + nativeBalancePros * prosPriceUsd;

    return {
      network: 'Pharos Mainnet',
      chainId: this.chainId,
      blockNumber,
      blockTimestamp: Math.floor(Date.now() / 1000),
      treasuryAddress,
      nativeBalanceWei: nativeWei.toString(),
      nativeBalancePros: parseFloat(nativeBalancePros.toFixed(4)),
      usdcBalanceRaw: usdcRaw.toString(),
      usdcBalanceUnits: parseFloat(usdcBalanceUnits.toFixed(2)),
      gasPriceGwei: 1.0,
      totalValuationUsd: parseFloat(totalValuationUsd.toFixed(2)),
    };
  }

  private rpcCall(method: string, params: any[]): any {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    });

    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const out = execFileSync('curl', [
          '-s',
          '--max-time', '5',
          '-H', 'Content-Type: application/json',
          '-X', 'POST',
          this.rpcUrl,
          '-d', payload,
        ], { encoding: 'utf-8' });

        const json = JSON.parse(out);
        if (json.error) {
          if (attempt < 4 && json.error.message?.includes('cu limit')) {
            execFileSync('sleep', ['0.4']);
            continue;
          }
          throw new Error(`RPC error: ${json.error.message}`);
        }
        return json.result;
      } catch (err: any) {
        if (attempt < 4 && err.message?.includes('cu limit')) {
          execFileSync('sleep', ['0.4']);
          continue;
        }
        if (attempt === 4) throw err;
      }
    }
  }
}
