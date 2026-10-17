import {
  defineChain,
  createPublicClient,
  http,
  formatUnits,
  parseAbi,
  type PublicClient,
  type Address,
} from "viem";
import { NETWORKS } from "./config";

export const pharosMainnet = defineChain({
  id: NETWORKS.mainnet.chainId,
  name: NETWORKS.mainnet.name,
  nativeCurrency: NETWORKS.mainnet.nativeToken,
  rpcUrls: {
    default: {
      http: [NETWORKS.mainnet.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "PharosScan",
      url: NETWORKS.mainnet.explorerUrl,
    },
  },
});

export const pharosAtlanticTestnet = defineChain({
  id: NETWORKS["atlantic-testnet"].chainId,
  name: NETWORKS["atlantic-testnet"].name,
  nativeCurrency: NETWORKS["atlantic-testnet"].nativeToken,
  rpcUrls: {
    default: {
      http: [NETWORKS["atlantic-testnet"].rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "PharosScan Atlantic",
      url: NETWORKS["atlantic-testnet"].explorerUrl,
    },
  },
});

export function getPublicClient(networkName: "mainnet" | "atlantic-testnet" = "mainnet"): PublicClient {
  const chain = networkName === "mainnet" ? pharosMainnet : pharosAtlanticTestnet;
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });
}

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function owner() view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(amount: bigint | string, decimals: number = 18): string {
  const val = typeof amount === "string" ? BigInt(amount) : amount;
  return Number(formatUnits(val, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
}
