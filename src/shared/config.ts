import dotenv from "dotenv";
dotenv.config();

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  nativeToken: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    name: "Pharos Mainnet",
    chainId: 1672,
    rpcUrl: process.env.PHAROS_MAINNET_RPC || "https://rpc.pharos.xyz",
    explorerUrl: "https://www.pharosscan.xyz",
    explorerApiUrl: "https://api.socialscan.io/pharos-mainnet",
    nativeToken: {
      name: "Pharos",
      symbol: "PROS",
      decimals: 18,
    },
  },
  "atlantic-testnet": {
    name: "Pharos Atlantic Testnet",
    chainId: 688689,
    rpcUrl: process.env.PHAROS_TESTNET_RPC || "https://atlantic.dplabs-internal.com",
    explorerUrl: "https://atlantic.pharosscan.xyz",
    explorerApiUrl: "https://api.socialscan.io/pharos-atlantic-testnet",
    nativeToken: {
      name: "Pharos Testnet Token",
      symbol: "PHRS",
      decimals: 18,
    },
  },
};

export const DEFAULT_NETWORK = "mainnet";

export const MCP_CONFIG = {
  url: process.env.PHAROS_MCP_URL || "https://mcp.pharos.xyz/mcp",
  rateLimitPerMin: 120,
};
