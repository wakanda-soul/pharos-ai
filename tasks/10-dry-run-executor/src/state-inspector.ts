import {
  PublicClient,
  parseAbi,
  decodeFunctionData,
  formatEther,
  formatUnits,
  slice,
} from 'viem';
import {
  TransactionSimulationRequest,
  StateSnapshot,
  StateDiff,
  GasEstimationBreakdown,
} from './types.js';

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
]);

export interface DecodedCallInfo {
  isErc20: boolean;
  functionName?: string;
  recipient?: `0x${string}`;
  amountRaw?: bigint;
  spender?: `0x${string}`;
  tokenAddress?: `0x${string}`;
  symbol?: string;
  decimals?: number;
}

const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0xc879c018db60520f4355c26ed1a6d572cdac1815': { symbol: 'USDC', decimals: 6 },
  '0x51e233d6dc220bcbe02330f81d1136b69fd571dc': { symbol: 'LINK', decimals: 18 },
  '0x2077e62a046c3b88b4d8d1e2e7faad6bb06222b4': { symbol: 'WPROS', decimals: 18 },
};

export class StateInspector {
  constructor(private client: PublicClient) {}

  /**
   * Analyzes calldata to detect standard ERC-20 calls.
   */
  async decodeCall(to: `0x${string}`, data: `0x${string}`): Promise<DecodedCallInfo> {
    if (!data || data === '0x' || data.length < 10) {
      return { isErc20: false };
    }

    const selector = slice(data, 0, 4);

    try {
      const decoded = decodeFunctionData({
        abi: ERC20_ABI,
        data,
      });

      const known = KNOWN_TOKENS[to.toLowerCase()];
      let symbol = known?.symbol ?? 'TOKEN';
      let decimals = known?.decimals ?? 18;

      try {
        symbol = await this.client.readContract({
          address: to,
          abi: ERC20_ABI,
          functionName: 'symbol',
        });
        decimals = await this.client.readContract({
          address: to,
          abi: ERC20_ABI,
          functionName: 'decimals',
        });
      } catch {
        // Fallback defaults or known tokens if RPC fails or contract doesn't implement ERC20 metadata
      }

      if (decoded.functionName === 'transfer') {
        const [recipient, amount] = decoded.args as [`0x${string}`, bigint];
        return {
          isErc20: true,
          functionName: 'transfer',
          recipient,
          amountRaw: amount,
          tokenAddress: to,
          symbol,
          decimals,
        };
      }

      if (decoded.functionName === 'transferFrom') {
        const [, recipient, amount] = decoded.args as [`0x${string}`, `0x${string}`, bigint];
        return {
          isErc20: true,
          functionName: 'transferFrom',
          recipient,
          amountRaw: amount,
          tokenAddress: to,
          symbol,
          decimals,
        };
      }

      if (decoded.functionName === 'approve') {
        const [spender, amount] = decoded.args as [`0x${string}`, bigint];
        return {
          isErc20: true,
          functionName: 'approve',
          spender,
          amountRaw: amount,
          tokenAddress: to,
          symbol,
          decimals,
        };
      }

      return {
        isErc20: true,
        functionName: decoded.functionName,
        tokenAddress: to,
        symbol,
        decimals,
      };
    } catch {
      return { isErc20: false };
    }
  }

  /**
   * Fetches the current on-chain state for an address.
   */
  async captureSnapshot(
    address: `0x${string}`,
    tokenInfo?: { address: `0x${string}`; symbol: string; decimals: number }
  ): Promise<StateSnapshot> {
    let nativeBalanceWei = 0n;
    let nonce = 0;

    try {
      nativeBalanceWei = await this.client.getBalance({ address });
      nonce = await this.client.getTransactionCount({ address });
    } catch {
      // ignore
    }

    let tokenBalanceRaw: bigint | undefined;
    let tokenBalanceFormatted: string | undefined;

    if (tokenInfo) {
      try {
        tokenBalanceRaw = await this.client.readContract({
          address: tokenInfo.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        });
        tokenBalanceFormatted = `${parseFloat(formatUnits(tokenBalanceRaw, tokenInfo.decimals)).toLocaleString()} ${tokenInfo.symbol}`;
      } catch {
        // ignore
      }
    }

    return {
      address,
      nativeBalanceWei,
      nativeBalanceFormatted: `${parseFloat(formatEther(nativeBalanceWei)).toFixed(6)} PROS`,
      tokenBalanceRaw,
      tokenBalanceFormatted,
      tokenSymbol: tokenInfo?.symbol,
      tokenDecimals: tokenInfo?.decimals,
      nonce,
    };
  }

  /**
   * Computes the predicted post-execution state diff.
   */
  computeStateDiff(
    senderPre: StateSnapshot,
    recipientPre: StateSnapshot | undefined,
    request: TransactionSimulationRequest,
    decodedCall: DecodedCallInfo,
    gasBreakdown: GasEstimationBreakdown
  ): StateDiff {
    const valueWei = typeof request.value === 'bigint' ? request.value : BigInt(request.value ?? 0);
    const gasFeeWei = gasBreakdown.totalGasFeeWei;

    // Sender post-execution state
    const senderPostNativeWei = senderPre.nativeBalanceWei >= (valueWei + gasFeeWei)
      ? senderPre.nativeBalanceWei - valueWei - gasFeeWei
      : 0n;

    let senderPostTokenRaw = senderPre.tokenBalanceRaw;
    if (decodedCall.isErc20 && decodedCall.amountRaw !== undefined && senderPre.tokenBalanceRaw !== undefined) {
      senderPostTokenRaw = senderPre.tokenBalanceRaw >= decodedCall.amountRaw
        ? senderPre.tokenBalanceRaw - decodedCall.amountRaw
        : 0n;
    }

    const senderPost: StateSnapshot = {
      address: senderPre.address,
      nativeBalanceWei: senderPostNativeWei,
      nativeBalanceFormatted: `${parseFloat(formatEther(senderPostNativeWei)).toFixed(6)} PROS`,
      tokenBalanceRaw: senderPostTokenRaw,
      tokenBalanceFormatted: senderPostTokenRaw !== undefined && decodedCall.decimals !== undefined
        ? `${parseFloat(formatUnits(senderPostTokenRaw, decodedCall.decimals)).toLocaleString()} ${decodedCall.symbol}`
        : undefined,
      tokenSymbol: decodedCall.symbol,
      tokenDecimals: decodedCall.decimals,
      nonce: senderPre.nonce + 1,
    };

    // Recipient post-execution state
    let recipientPost: StateSnapshot | undefined;
    if (recipientPre) {
      const recipientPostNativeWei = recipientPre.nativeBalanceWei + valueWei;
      let recipientPostTokenRaw = recipientPre.tokenBalanceRaw;

      if (decodedCall.isErc20 && decodedCall.amountRaw !== undefined && recipientPre.tokenBalanceRaw !== undefined) {
        recipientPostTokenRaw = recipientPre.tokenBalanceRaw + decodedCall.amountRaw;
      }

      recipientPost = {
        address: recipientPre.address,
        nativeBalanceWei: recipientPostNativeWei,
        nativeBalanceFormatted: `${parseFloat(formatEther(recipientPostNativeWei)).toFixed(6)} PROS`,
        tokenBalanceRaw: recipientPostTokenRaw,
        tokenBalanceFormatted: recipientPostTokenRaw !== undefined && decodedCall.decimals !== undefined
          ? `${parseFloat(formatUnits(recipientPostTokenRaw, decodedCall.decimals)).toLocaleString()} ${decodedCall.symbol}`
          : undefined,
        tokenSymbol: decodedCall.symbol,
        tokenDecimals: decodedCall.decimals,
        nonce: recipientPre.nonce,
      };
    }

    const netNativeDeltaWei = valueWei + gasFeeWei;
    const netTokenDeltaRaw = decodedCall.amountRaw;

    return {
      senderPre,
      senderPost,
      recipientPre,
      recipientPost,
      netNativeDeltaWei,
      netNativeDeltaFormatted: `-${parseFloat(formatEther(netNativeDeltaWei)).toFixed(6)} PROS`,
      netTokenDeltaRaw,
      netTokenDeltaFormatted: netTokenDeltaRaw !== undefined && decodedCall.decimals !== undefined
        ? `-${parseFloat(formatUnits(netTokenDeltaRaw, decodedCall.decimals)).toLocaleString()} ${decodedCall.symbol}`
        : undefined,
      tokenSymbol: decodedCall.symbol,
    };
  }
}
