/**
 * Multi-Protocol Aggregator Types & Data Models
 * Supporting Harbor RWA Hub, Morpho Blue Lending, and FaroSwap AMM on Pharos Network.
 */

export type ProtocolId = 'harbor' | 'morpho' | 'faroswap';

export type AssetClass = 
  | 'Fixed Income & Credit' 
  | 'Onchain Lending' 
  | 'DEX Liquidity Pool' 
  | 'Secondary Market Strategy';

export type LockupTenor = 'liquid' | '1d' | '3m' | '6m';

export interface ProtocolVenue {
  id: string; // e.g. "harbor:apc3m", "morpho:rockawayx-usdc", "faroswap:wpros-usdc"
  protocolId: ProtocolId;
  protocolName: string;
  vaultName: string;
  underlyingToken: string; // e.g. "USDC", "WPROS", "ETH"
  tokenAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  assetClass: AssetClass;
  lockupTenor: LockupTenor;
  apyPercent: number; // e.g. 13.8 for 13.8%
  tvlUsd: number;
  minDepositUsd: number;
  safetyScore: number; // 1-100 rating based on audit, collateralization, and track record
  isLive: boolean;
  statusMessage?: string;
}

export interface UserPosition {
  venueId: string;
  protocolId: ProtocolId;
  protocolName: string;
  vaultName: string;
  underlyingToken: string;
  depositedAmount: string; // Human readable formatted, e.g. "5000.00"
  depositedValueUsd: number;
  earnedYieldUsd: number;
  currentApyPercent: number;
  lockupTenor: LockupTenor;
  sharesBalance: string;
  vaultAddress: `0x${string}`;
}

export interface UnsignedTransaction {
  to: `0x${string}`;
  from?: `0x${string}`;
  data: `0x${string}`;
  value: string; // Hex string e.g. "0x0"
  chainId: number;
  gasLimit?: string;
  methodName: string;
  argsSummary: Record<string, any>;
  humanReadable: string;
  castCommand: string; // Ready-to-execute Foundry `cast send` CLI command
}

export interface RoutingPreference {
  token: string;
  amountUsd: number;
  maxLockupTenor?: LockupTenor; // e.g. "liquid" restricts to no-lockup vaults
  minSafetyScore?: number;
  preferredProtocol?: ProtocolId;
}

export interface RoutingComparisonVenue {
  venueId: string;
  protocolName: string;
  vaultName: string;
  apyPercent: number;
  tvlUsd: number;
  lockupTenor: LockupTenor;
  safetyScore: number;
  projectedAnnualYieldUsd: number;
  eligible: boolean;
  disqualificationReason?: string;
}

export interface RoutingResult {
  bestVenue: ProtocolVenue;
  inputToken: string;
  depositAmountUsd: number;
  projectedYieldUsd: number;
  explanation: {
    primaryReason: string;
    tradeoffs: string[];
    comparisonNotes: string;
  };
  consideredVenues: RoutingComparisonVenue[];
  preparedDepositTx?: UnsignedTransaction;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProtocolHealthStatus {
  protocolId: ProtocolId;
  protocolName: string;
  state: CircuitState;
  failureCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  averageLatencyMs: number;
  isAvailable: boolean;
}
