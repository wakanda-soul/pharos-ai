import { defineChain } from 'viem';

/**
 * Official Pharos Mainnet chain definition for Viem and Wagmi.
 * Chain ID: 1672
 * Currency: PROS
 * Native USDC: 0x52c48d4213107b20bc583832b0d951fb9ca8f0b0 (6 decimals)
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
      url: 'https://pharosscan.com',
    },
  },
  testnet: false,
});

export const PHAROS_CONSTANTS = {
  chainId: 1672,
  chainName: 'Pharos Mainnet',
  rpcUrl: 'https://rpc.pharos.xyz',
  explorerUrl: 'https://pharosscan.com',
  nativeUsdcAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0' as `0x${string}`,
  usdcDecimals: 6,
  defaultFeedPriceAtomic: '1000', // 1,000 units = 0.001 USDC
  defaultFeedPriceUsdc: 0.001,
  maxAllowedPricePerCallUsdc: 0.005, // Gatekeeper cap
  registryContractAddress: '0x1672402000000000000000000000000000004021' as `0x${string}`,
  curatorAddress: '0x1bF848814D174F5A85bD3FDf9f6C9201' as `0x${string}`, // wakanda-soul
  curatorHandle: 'wakanda-soul',
};
