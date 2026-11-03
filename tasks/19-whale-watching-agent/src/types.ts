/**
 * Domain types and schemas for Pharos Whale-Watching Agent.
 * Tracks capital movements across monitored high-net-worth addresses,
 * classifies counterparties with semantic directory tags, and detects high-impact flows.
 */

import { type Address, type Hash } from 'viem';

export type CounterpartyEntityCategory =
  | 'DEX'
  | 'LENDING'
  | 'TREASURY'
  | 'CEX'
  | 'STAKING'
  | 'BRIDGE'
  | 'WHALE_WALLET'
  | 'SYSTEM_NULL'
  | 'UNKNOWN';

export type WhaleFlowDirection =
  | 'OUTBOUND_TRANSFER'
  | 'INBOUND_TRANSFER'
  | 'SELF_TRANSFER'
  | 'DEFI_DEPOSIT'
  | 'DEFI_WITHDRAWAL'
  | 'DEX_SWAP'
  | 'TOKEN_BURN'
  | 'TOKEN_MINT'
  | 'CONTRACT_DEPLOYMENT';

export interface EntityDirectoryEntry {
  readonly address: Address;
  readonly canonicalLabel: string;
  readonly category: CounterpartyEntityCategory;
  readonly description?: string;
  readonly websiteOrDocs?: string;
}

export interface WatchedWhaleAddress {
  readonly address: Address;
  readonly moniker: string;
  readonly tags: readonly string[];
  readonly trackedSinceIso: string;
  readonly customThresholdUsd?: number;
  readonly notes?: string;
}

export interface TokenAssetProfile {
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number;
  readonly contractAddress?: Address;
  readonly fallbackUsdPrice: number;
}

export interface SignificanceThresholdConfig {
  /** Global USD floor for flagging a transaction as whale movement */
  readonly minimumUsdValuation: number;
  /** Explicit token-specific volume thresholds overrides (raw token base units) */
  readonly perTokenMinimumVolume?: Record<string, bigint>;
  /** Ignore moves between the whale's own sub-accounts or internal loops */
  readonly suppressSelfTransfers: boolean;
  /** Alert on zero-token governance/permission invocations by watched whales */
  readonly captureZeroValueContractInteractions: boolean;
}

export interface WhaleRawTransferPayload {
  readonly txHash: Hash;
  readonly blockNumber: bigint;
  readonly blockTimestamp: number;
  readonly fromAddress: Address;
  readonly toAddress: Address;
  readonly tokenSymbol: string;
  readonly rawValue: bigint;
  readonly gasPriceGwei?: number;
  readonly methodSignature?: string;
}

export interface WhaleCapitalFlowEvent {
  readonly eventId: string;
  readonly txHash: Hash;
  readonly blockNumber: bigint;
  readonly timestampIso: string;
  readonly whaleAddress: Address;
  readonly whaleMoniker: string;
  readonly flowDirection: WhaleFlowDirection;
  readonly token: TokenAssetProfile;
  readonly rawAmount: bigint;
  readonly formattedAmount: string;
  readonly estimatedUsdValuation: number;
  readonly counterpartyAddress: Address;
  readonly counterpartyLabel: string;
  readonly counterpartyCategory: CounterpartyEntityCategory;
  readonly narrativeExplanation: string;
  readonly significanceReason: string;
}

export interface ProtocolVolumeShare {
  readonly category: CounterpartyEntityCategory;
  readonly transferCount: number;
  readonly totalUsdVolume: number;
  readonly percentageOfTotal: number;
}

export interface WhaleActivityDigest {
  readonly monitoredWhaleCount: number;
  readonly totalFlowEventsCaptured: number;
  readonly aggregateVolumeUsd: number;
  readonly peakSingleMoveUsd: number;
  readonly mostActiveWhaleMoniker: string;
  readonly topDestinationCategory: CounterpartyEntityCategory;
  readonly protocolDistribution: readonly ProtocolVolumeShare[];
  readonly recentFlows: readonly WhaleCapitalFlowEvent[];
  readonly digestGeneratedAtIso: string;
}
