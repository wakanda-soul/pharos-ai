import { defineChain, createPublicClient, http } from 'viem';

/**
 * Official Pharos Mainnet chain definition for Viem, Wagmi, and EIP-1193 providers.
 * Chain ID: 1672 (0x688)
 * Currency: PROS (18 decimals)
 * Native USDC: 0xc879c018db60520f4355c26ed1a6d572cdac1815 (6 decimals)
 * WPROS: 0x52c48d4213107b20bc583832b0d951fb9ca8f0b0 (18 decimals)
 */
export const pharosMainnet = defineChain({
  id: 1672,
  name: 'Pharos Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Pharos',
    symbol: 'PROS',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.pharos.xyz'],
    },
    public: {
      http: ['https://rpc.pharos.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PharosScan',
      url: 'https://pharosscan.xyz',
    },
  },
  testnet: false,
});

export const PHAROS_CONSTANTS = {
  chainId: 1672,
  chainIdHex: '0x688',
  chainName: 'Pharos Mainnet',
  rpcUrl: 'https://rpc.pharos.xyz',
  explorerUrl: 'https://pharosscan.xyz',
  nativeUsdcAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as `0x${string}`,
  wprosAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0' as `0x${string}`,
  usdcDecimals: 6,
  prosDecimals: 18,
  defaultFeedPriceAtomic: '1000', // 1,000 units = 0.001 USDC
  defaultFeedPriceUsdc: 0.001,
  maxAllowedPricePerCallUsdc: 0.005, // Gatekeeper cap
  registryContractAddress: '0x1672402000000000000000000000000000004021' as `0x${string}`,
  curatorAddress: '0x1bF848814D174F5A85bD3FDf9f6C920100000000' as `0x${string}`,
  curatorHandle: 'wakanda-soul',
};

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export const pharosPublicClient = createPublicClient({
  chain: pharosMainnet,
  transport: http(PHAROS_CONSTANTS.rpcUrl),
});
