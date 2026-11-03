/**
 * Core Whale Watching Engine for Pharos Network.
 * Maintains the roster of monitored high-net-worth addresses, ingests transfers,
 * evaluates thresholds, and generates contextual narrative reports explaining each move.
 */

import { type Address, getAddress } from 'viem';
import {
  type CounterpartyEntityCategory,
  type EntityDirectoryEntry,
  type SignificanceThresholdConfig,
  type TokenAssetProfile,
  type WatchedWhaleAddress,
  type WhaleCapitalFlowEvent,
  type WhaleFlowDirection,
  type WhaleRawTransferPayload,
} from './types.js';
import { defaultEntityRegistry, EntityDirectoryRegistry } from './entity-labels.js';
import { formatTokenBaseUnits, resolveTokenProfile } from './token-registry.js';
import { WhaleMovementDetector } from './movement-detector.js';

export const DEFAULT_WATCHED_WHALES: readonly WatchedWhaleAddress[] = [
  {
    address: '0xAaAa11111111111111111111111111111111AaAa' as Address,
    moniker: 'Pharos Genesis Whale Alpha',
    tags: ['early_backer', 'treasury_allocator'],
    trackedSinceIso: '2026-01-01T00:00:00Z',
    notes: 'Primary seed holder with extensive native PROS reserves',
  },
  {
    address: '0xBbBb22222222222222222222222222222222bBbB' as Address,
    moniker: 'Harbor Early Liquidity Provider',
    tags: ['lending_whale', 'collateral_custodian'],
    trackedSinceIso: '2026-01-15T00:00:00Z',
    notes: 'Major liquidity supplier in Harbor WPROS/USDC pools',
  },
  {
    address: '0xCcCc33333333333333333333333333333333CcCc' as Address,
    moniker: 'FaroSwap Dominant Arbitrageur',
    tags: ['dex_trader', 'mev_arbitrage'],
    trackedSinceIso: '2026-02-01T00:00:00Z',
    notes: 'High-frequency swaps across AMM pools and CEX gateways',
  },
  {
    address: '0xDdDd44444444444444444444444444444444dDdD' as Address,
    moniker: 'Morpho Collateral Vault Depositor',
    tags: ['isolated_lending', 'institutional'],
    trackedSinceIso: '2026-02-10T00:00:00Z',
    notes: 'Institutional treasury managing leveraged borrowing',
  },
  {
    address: '0xEEeE55555555555555555555555555555555eEeE' as Address,
    moniker: 'Cross-Chain Bridge Market Maker',
    tags: ['bridge_relayer', 'cross_chain'],
    trackedSinceIso: '2026-03-01T00:00:00Z',
    notes: 'Facilitates fast cross-chain liquidity between Ethereum L1 and Pharos',
  },
];

export class WhaleWatchingEngine {
  private readonly watchedWhalesMap = new Map<string, WatchedWhaleAddress>();
  private readonly capturedMovementsList: WhaleCapitalFlowEvent[] = [];
  private readonly movementDetector: WhaleMovementDetector;
  private readonly entityRegistry: EntityDirectoryRegistry;

  constructor(options?: {
    initialWhales?: readonly WatchedWhaleAddress[];
    thresholdConfig?: Partial<SignificanceThresholdConfig>;
    customEntityRegistry?: EntityDirectoryRegistry;
  }) {
    this.movementDetector = new WhaleMovementDetector(options?.thresholdConfig);
    this.entityRegistry = options?.customEntityRegistry ?? defaultEntityRegistry;

    const initialRoster = options?.initialWhales ?? DEFAULT_WATCHED_WHALES;
    for (const whale of initialRoster) {
      this.registerWatchedWhale(whale);
    }
  }

  /**
   * Enrolls a new high-value address into the active surveillance roster.
   */
  public registerWatchedWhale(whale: WatchedWhaleAddress): void {
    const checksummed = getAddress(whale.address);
    this.watchedWhalesMap.set(checksummed.toLowerCase(), {
      ...whale,
      address: checksummed,
    });
  }

  /**
   * Removes an address from surveillance. Returns true if removed, false if not found.
   */
  public unregisterWatchedWhale(rawAddress: string): boolean {
    const key = rawAddress.toLowerCase();
    return this.watchedWhalesMap.delete(key);
  }

  /**
   * Returns current active roster of watched addresses.
   */
  public getWatchedWhales(): readonly WatchedWhaleAddress[] {
    return Array.from(this.watchedWhalesMap.values());
  }

  /**
   * Checks whether a given address belongs to the watched roster.
   */
  public isWatchedAddress(rawAddress: string): boolean {
    return this.watchedWhalesMap.has(rawAddress.toLowerCase());
  }

  /**
   * Ingests a raw transfer payload, evaluates whether it involves a watched whale,
   * validates significance thresholds, annotates counterparty labels,
   * and produces a structured capital flow event.
   */
  public ingestTransfer(rawPayload: WhaleRawTransferPayload): WhaleCapitalFlowEvent | null {
    const fromNormalized = rawPayload.fromAddress.toLowerCase();
    const toNormalized = rawPayload.toAddress.toLowerCase();

    const fromWhale = this.watchedWhalesMap.get(fromNormalized);
    const toWhale = this.watchedWhalesMap.get(toNormalized);

    // If neither sender nor receiver is in surveillance list, ignore immediately
    if (!fromWhale && !toWhale) {
      return null;
    }

    const token = resolveTokenProfile(rawPayload.tokenSymbol);

    // Primary whale perspective (sender has precedence for outbound analytics)
    const primaryWhale = fromWhale ?? toWhale!;
    const isOutbound = Boolean(fromWhale);

    // Check significance against thresholds
    const evaluation = this.movementDetector.evaluateMovement(
      rawPayload,
      token,
      primaryWhale.customThresholdUsd,
    );

    if (!evaluation.isSignificant) {
      return null;
    }

    // Determine counterparty details
    const counterpartyRawAddress = isOutbound ? rawPayload.toAddress : rawPayload.fromAddress;
    const counterpartyDirectoryEntry = this.resolveCounterpartyMeta(
      counterpartyRawAddress,
      isOutbound ? toWhale : fromWhale,
    );

    // Classify flow direction
    const flowDirection = this.deduceFlowDirection(
      rawPayload,
      isOutbound,
      counterpartyDirectoryEntry.category,
      evaluation.isSelfTransfer,
    );

    // Synthesize human narrative explanation
    const formattedAmount = formatTokenBaseUnits(rawPayload.rawValue, token.decimals);
    const narrativeExplanation = this.synthesizeNarrativeExplanation({
      whaleMoniker: primaryWhale.moniker,
      formattedAmount,
      tokenSymbol: token.symbol,
      estimatedUsd: evaluation.computedValuationUsd,
      counterpartyLabel: counterpartyDirectoryEntry.canonicalLabel,
      counterpartyCategory: counterpartyDirectoryEntry.category,
      flowDirection,
      isOutbound,
    });

    const flowEvent: WhaleCapitalFlowEvent = {
      eventId: `flow-${rawPayload.txHash.slice(0, 10)}-${this.capturedMovementsList.length + 1}`,
      txHash: rawPayload.txHash,
      blockNumber: rawPayload.blockNumber,
      timestampIso: new Date(rawPayload.blockTimestamp * 1000).toISOString(),
      whaleAddress: primaryWhale.address,
      whaleMoniker: primaryWhale.moniker,
      flowDirection,
      token,
      rawAmount: rawPayload.rawValue,
      formattedAmount,
      estimatedUsdValuation: evaluation.computedValuationUsd,
      counterpartyAddress: getAddress(counterpartyRawAddress),
      counterpartyLabel: counterpartyDirectoryEntry.canonicalLabel,
      counterpartyCategory: counterpartyDirectoryEntry.category,
      narrativeExplanation,
      significanceReason: evaluation.triggeredThresholdRule ?? 'Significant volume trigger',
    };

    this.capturedMovementsList.push(flowEvent);
    return flowEvent;
  }

  /**
   * Returns all captured movements stored in the buffer.
   */
  public getCapturedMovements(): readonly WhaleCapitalFlowEvent[] {
    return [...this.capturedMovementsList];
  }

  /**
   * Clears internal event buffer (e.g. for fresh testing or session rollover).
   */
  public clearCapturedMovements(): void {
    this.capturedMovementsList.length = 0;
  }

  public get detector(): WhaleMovementDetector {
    return this.movementDetector;
  }

  public get entities(): EntityDirectoryRegistry {
    return this.entityRegistry;
  }

  /**
   * Helper to deduce counterparty entity info, prioritizing another monitored whale label.
   */
  private resolveCounterpartyMeta(
    rawAddress: Address,
    otherMonitoredWhale?: WatchedWhaleAddress,
  ): EntityDirectoryEntry {
    if (otherMonitoredWhale) {
      return {
        address: otherMonitoredWhale.address,
        canonicalLabel: `${otherMonitoredWhale.moniker} (Monitored Whale)`,
        category: 'WHALE_WALLET',
        description: otherMonitoredWhale.notes ?? 'Peer monitored whale wallet',
      };
    }
    return this.entityRegistry.resolveCounterparty(rawAddress);
  }

  /**
   * Deduces high-level economic action from counterparty category and transfer direction.
   */
  private deduceFlowDirection(
    rawPayload: WhaleRawTransferPayload,
    isOutbound: boolean,
    category: CounterpartyEntityCategory,
    isSelfTransfer: boolean,
  ): WhaleFlowDirection {
    if (isSelfTransfer) {
      return 'SELF_TRANSFER';
    }

    if (category === 'DEX') {
      return 'DEX_SWAP';
    }
    if (category === 'LENDING') {
      return isOutbound ? 'DEFI_DEPOSIT' : 'DEFI_WITHDRAWAL';
    }
    return isOutbound ? 'OUTBOUND_TRANSFER' : 'INBOUND_TRANSFER';
  }

  /**
   * Builds an expressive, non-robotic explanation answering:
   * 1. What moved & how much
   * 2. Where to (with verified entity labeling)
   * 3. Market context on why it matters
   */
  private synthesizeNarrativeExplanation(params: {
    whaleMoniker: string;
    formattedAmount: string;
    tokenSymbol: string;
    estimatedUsd: number;
    counterpartyLabel: string;
    counterpartyCategory: CounterpartyEntityCategory;
    flowDirection: WhaleFlowDirection;
    isOutbound: boolean;
  }): string {
    const usdBadge =
      params.estimatedUsd > 0 ? ` (~$${params.estimatedUsd.toLocaleString()} USD)` : '';
    const assetString = `${params.formattedAmount} ${params.tokenSymbol}${usdBadge}`;

    switch (params.flowDirection) {
      case 'DEX_SWAP':
        return `${params.whaleMoniker} routed ${assetString} into ${params.counterpartyLabel}. Indicates imminent token swap execution or Automated Market Maker pool liquidity replenishment.`;

      case 'DEFI_DEPOSIT':
        return `${params.whaleMoniker} deposited ${assetString} into ${params.counterpartyLabel}. Expands collateral supply or deepens lending liquidity buffer.`;

      case 'DEFI_WITHDRAWAL':
        return `${params.whaleMoniker} unlocked & withdrew ${assetString} from ${params.counterpartyLabel}. May signal collateral deleveraging or risk mitigation ahead of market volatility.`;

      case 'SELF_TRANSFER':
        return `${params.whaleMoniker} performed an internal self-transfer of ${assetString}. Portfolio reorganization across sub-vaults with zero net market delta.`;

      case 'OUTBOUND_TRANSFER':
        if (params.counterpartyCategory === 'CEX') {
          return `${params.whaleMoniker} transferred ${assetString} off-chain to ${params.counterpartyLabel}. Possible intent to liquidate on spot order books.`;
        }
        if (params.counterpartyCategory === 'BRIDGE') {
          return `${params.whaleMoniker} transferred ${assetString} to ${params.counterpartyLabel}. Cross-chain bridge migration heading outside Pharos.`;
        }
        return `${params.whaleMoniker} transferred ${assetString} to ${params.counterpartyLabel}. Direct external capital transfer.`;

      case 'INBOUND_TRANSFER':
        if (params.counterpartyCategory === 'CEX') {
          return `${params.whaleMoniker} received ${assetString} withdrawn from ${params.counterpartyLabel}. Inflow of centralized capital onto Pharos mainnet.`;
        }
        return `${params.whaleMoniker} received inbound flow of ${assetString} from ${params.counterpartyLabel}. High-volume capital accumulation.`;

      default:
        return `${params.whaleMoniker} moved ${assetString} interacting with ${params.counterpartyLabel}.`;
    }
  }
}
