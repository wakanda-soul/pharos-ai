/**
 * Comprehensive Automated Verification Suite for Pharos Whale-Watching Agent.
 * Validates Requirements 01-04:
 * 01: Multi-address tracking (>= 5 configurable addresses)
 * 02: Configurable significant thresholds (USD valuation and per-token nominal minimums)
 * 03: Explanatory reports detailing what, how much, and where to with verified entity labels
 * 04: Cross-whale activity summary digest with protocol market share breakdown
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { type Address } from 'viem';
import {
  DEFAULT_WATCHED_WHALES,
  WhaleWatchingEngine,
} from '../src/whale-engine.js';
import { type WatchedWhaleAddress, type WhaleRawTransferPayload } from '../src/types.js';
import { synthesizeActivityDigest } from '../src/activity-summary.js';

describe('Task 19: Whale-Watching Agent Specification', () => {
  let engine: WhaleWatchingEngine;

  beforeEach(() => {
    // Instantiate fresh engine before each test
    engine = new WhaleWatchingEngine();
  });

  describe('Requirement 01: Tracks at least 5 configurable addresses', () => {
    it('initializes with at least 5 verified monitored whale addresses by default', () => {
      const watched = engine.getWatchedWhales();
      expect(watched.length).toBeGreaterThanOrEqual(5);
      expect(watched.map((w) => w.moniker)).toContain('Pharos Genesis Whale Alpha');
      expect(watched.map((w) => w.moniker)).toContain('Harbor Early Liquidity Provider');
      expect(watched.map((w) => w.moniker)).toContain('FaroSwap Dominant Arbitrageur');
    });

    it('allows dynamic registration of custom watched whale addresses', () => {
      const customWhale: WatchedWhaleAddress = {
        address: '0x9999888877776666555544443333222211110000' as Address,
        moniker: 'Sybil DAO Treasury Allocator',
        tags: ['dao_reserve', 'governance'],
        trackedSinceIso: '2026-03-15T00:00:00Z',
        customThresholdUsd: 75_000,
        notes: 'Monitors large multi-sig payouts',
      };

      engine.registerWatchedWhale(customWhale);
      expect(engine.isWatchedAddress(customWhale.address)).toBe(true);
      expect(engine.getWatchedWhales().length).toBe(DEFAULT_WATCHED_WHALES.length + 1);
    });

    it('allows removal of monitored addresses when untracked', () => {
      const targetAddress = DEFAULT_WATCHED_WHALES[0].address;
      expect(engine.isWatchedAddress(targetAddress)).toBe(true);

      const removed = engine.unregisterWatchedWhale(targetAddress);
      expect(removed).toBe(true);
      expect(engine.isWatchedAddress(targetAddress)).toBe(false);
    });

    it('completely ignores transactions that do not involve any watched address', () => {
      const unmonitoredPayload: WhaleRawTransferPayload = {
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        blockNumber: 120500n,
        blockTimestamp: 1774000000,
        fromAddress: '0x8888000088880000888800008888000088880000' as Address,
        toAddress: '0x7777000077770000777700007777000077770000' as Address,
        tokenSymbol: 'USDC',
        rawValue: 1_000_000n * 10n ** 6n, // 1M USDC, but neither party is watched
      };

      const result = engine.ingestTransfer(unmonitoredPayload);
      expect(result).toBeNull();
      expect(engine.getCapturedMovements()).toHaveLength(0);
    });
  });

  describe('Requirement 02: Configurable "significant" threshold per token or in value terms', () => {
    it('captures transfers exceeding the global USD benchmark ($50,000 default)', () => {
      const watchedSender = DEFAULT_WATCHED_WHALES[0].address; // Alpha whale

      // 60,000 USDC ($60,000 USD) - exceeds $50k
      const significantTx: WhaleRawTransferPayload = {
        txHash: '0xaaaabbbbccccdddd000100010001000100010001000100010001000100010001',
        blockNumber: 130000n,
        blockTimestamp: 1774000100,
        fromAddress: watchedSender,
        toAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap Router
        tokenSymbol: 'USDC',
        rawValue: 60_000n * 10n ** 6n,
      };

      const flow = engine.ingestTransfer(significantTx);
      expect(flow).not.toBeNull();
      expect(flow?.estimatedUsdValuation).toBe(60_000);
      expect(flow?.token.symbol).toBe('USDC');
    });

    it('filters out transfers below the significance threshold', () => {
      const watchedSender = DEFAULT_WATCHED_WHALES[0].address;

      // 5,000 USDC ($5,000 USD) - below $50k floor
      const pettyTx: WhaleRawTransferPayload = {
        txHash: '0xaaaabbbbccccdddd000200020002000200020002000200020002000200020002',
        blockNumber: 130001n,
        blockTimestamp: 1774000110,
        fromAddress: watchedSender,
        toAddress: '0x1000000000000000000000000000000000000001' as Address,
        tokenSymbol: 'USDC',
        rawValue: 5_000n * 10n ** 6n,
      };

      const flow = engine.ingestTransfer(pettyTx);
      expect(flow).toBeNull();
    });

    it('triggers alerts on token-specific nominal threshold even if token price varies', () => {
      const watchedSender = DEFAULT_WATCHED_WHALES[1].address; // Harbor LP whale

      // 30,000 PROS (exceeds 25,000 PROS per-token quota)
      const tokenQuotaTx: WhaleRawTransferPayload = {
        txHash: '0xaaaabbbbccccdddd000300030003000300030003000300030003000300030003',
        blockNumber: 130002n,
        blockTimestamp: 1774000120,
        fromAddress: watchedSender,
        toAddress: '0x2000000000000000000000000000000000000002' as Address, // Harbor Pool
        tokenSymbol: 'PROS',
        rawValue: 30_000n * 10n ** 18n,
      };

      const flow = engine.ingestTransfer(tokenQuotaTx);
      expect(flow).not.toBeNull();
      expect(flow?.significanceReason).toContain('token quota of PROS');
    });

    it('enforces custom whale-specific USD threshold overrides', () => {
      // Register whale with a strict $200,000 USD threshold
      const ultraWhale: WatchedWhaleAddress = {
        address: '0x7777111177771111777711117777111177771111' as Address,
        moniker: 'Institutional Mega-Vault',
        tags: ['institutional'],
        trackedSinceIso: '2026-01-01T00:00:00Z',
        customThresholdUsd: 200_000,
      };
      engine.registerWatchedWhale(ultraWhale);

      // $100k move: Exceeds global $50k, but BELOW ultraWhale custom $200k
      const subQuotaTx: WhaleRawTransferPayload = {
        txHash: '0xaaaabbbbccccdddd000400040004000400040004000400040004000400040004',
        blockNumber: 130003n,
        blockTimestamp: 1774000130,
        fromAddress: ultraWhale.address,
        toAddress: '0x1000000000000000000000000000000000000001' as Address,
        tokenSymbol: 'USDC',
        rawValue: 100_000n * 10n ** 6n,
      };
      expect(engine.ingestTransfer(subQuotaTx)).toBeNull();

      // $250k move: EXCEEDS ultraWhale custom $200k
      const superQuotaTx: WhaleRawTransferPayload = {
        txHash: '0xaaaabbbbccccdddd000500050005000500050005000500050005000500050005',
        blockNumber: 130004n,
        blockTimestamp: 1774000140,
        fromAddress: ultraWhale.address,
        toAddress: '0x1000000000000000000000000000000000000001' as Address,
        tokenSymbol: 'USDC',
        rawValue: 250_000n * 10n ** 6n,
      };
      const flow = engine.ingestTransfer(superQuotaTx);
      expect(flow).not.toBeNull();
      expect(flow?.significanceReason).toContain('custom whale floor of $200,000');
    });
  });

  describe('Requirement 03: Explanatory reports: what moved, how much, and where to (labelled)', () => {
    it('generates labeled report for DEX interactions with FaroSwap Router', () => {
      const alphaWhale = DEFAULT_WATCHED_WHALES[0].address;

      const dexTx: WhaleRawTransferPayload = {
        txHash: '0xdddd000100000000000000000000000000000000000000000000000000000001',
        blockNumber: 131000n,
        blockTimestamp: 1774000500,
        fromAddress: alphaWhale,
        toAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap Router v1
        tokenSymbol: 'USDC',
        rawValue: 125_000n * 10n ** 6n,
      };

      const event = engine.ingestTransfer(dexTx)!;
      expect(event).toBeDefined();
      expect(event.counterpartyLabel).toBe('FaroSwap Router v1');
      expect(event.counterpartyCategory).toBe('DEX');
      expect(event.formattedAmount).toBe('125,000');
      expect(event.flowDirection).toBe('DEX_SWAP');
      expect(event.narrativeExplanation).toContain('Pharos Genesis Whale Alpha');
      expect(event.narrativeExplanation).toContain('125,000 USDC (~$125,000 USD)');
      expect(event.narrativeExplanation).toContain('FaroSwap Router v1');
      expect(event.narrativeExplanation).toContain('imminent token swap execution');
    });

    it('generates labeled report for lending vault deposits (Harbor / Morpho)', () => {
      const morphoWhale = DEFAULT_WATCHED_WHALES[3].address;

      const lendingTx: WhaleRawTransferPayload = {
        txHash: '0xdddd000200000000000000000000000000000000000000000000000000000002',
        blockNumber: 131010n,
        blockTimestamp: 1774000510,
        fromAddress: morphoWhale,
        toAddress: '0x3000000000000000000000000000000000000001' as Address, // Morpho Blue Market
        tokenSymbol: 'WPROS',
        rawValue: 80_000n * 10n ** 18n,
      };

      const event = engine.ingestTransfer(lendingTx)!;
      expect(event.counterpartyLabel).toBe('Morpho Blue Pharos Market');
      expect(event.counterpartyCategory).toBe('LENDING');
      expect(event.flowDirection).toBe('DEFI_DEPOSIT');
      expect(event.narrativeExplanation).toContain('Morpho Collateral Vault Depositor deposited 80,000 WPROS');
      expect(event.narrativeExplanation).toContain('Expands collateral supply');
    });

    it('generates labeled report for CEX hot wallet deposits (Binance)', () => {
      const arbWhale = DEFAULT_WATCHED_WHALES[2].address;

      const cexTx: WhaleRawTransferPayload = {
        txHash: '0xdddd000300000000000000000000000000000000000000000000000000000003',
        blockNumber: 131020n,
        blockTimestamp: 1774000520,
        fromAddress: arbWhale,
        toAddress: '0x6000000000000000000000000000000000000001' as Address, // Binance Hot Wallet 4
        tokenSymbol: 'USDT',
        rawValue: 75_000n * 10n ** 6n,
      };

      const event = engine.ingestTransfer(cexTx)!;
      expect(event.counterpartyLabel).toBe('Binance Custody Hot Wallet 4');
      expect(event.counterpartyCategory).toBe('CEX');
      expect(event.flowDirection).toBe('OUTBOUND_TRANSFER');
      expect(event.narrativeExplanation).toContain('transferred 75,000 USDT');
      expect(event.narrativeExplanation).toContain('liquidate on spot order books');
    });

    it('formats unindexed external counterparties with safely shortened address labels', () => {
      const arbWhale = DEFAULT_WATCHED_WHALES[2].address;
      const unindexedCounterparty = '0x9999000011112222333344445555666677778888' as Address;

      const untrackedTx: WhaleRawTransferPayload = {
        txHash: '0xdddd000400000000000000000000000000000000000000000000000000000004',
        blockNumber: 131030n,
        blockTimestamp: 1774000530,
        fromAddress: arbWhale,
        toAddress: unindexedCounterparty,
        tokenSymbol: 'USDC',
        rawValue: 90_000n * 10n ** 6n,
      };

      const event = engine.ingestTransfer(untrackedTx)!;
      expect(event.counterpartyCategory).toBe('UNKNOWN');
      expect(event.counterpartyLabel).toContain('Unlabeled (0x9999...8888)');
    });

    it('labels token burns sent to null address 0x0 or 0xdEaD as TOKEN_BURN', () => {
      const alphaWhale = DEFAULT_WATCHED_WHALES[0].address;

      const burnTx: WhaleRawTransferPayload = {
        txHash: '0xdddd000500000000000000000000000000000000000000000000000000000005',
        blockNumber: 131040n,
        blockTimestamp: 1774000540,
        fromAddress: alphaWhale,
        toAddress: '0x000000000000000000000000000000000000dEaD' as Address,
        tokenSymbol: 'PROS',
        rawValue: 50_000n * 10n ** 18n,
      };

      const event = engine.ingestTransfer(burnTx)!;
      expect(event.flowDirection).toBe('TOKEN_BURN');
      expect(event.counterpartyCategory).toBe('SYSTEM_NULL');
      expect(event.narrativeExplanation).toContain('permanently burned 50,000 PROS');
      expect(event.narrativeExplanation).toContain('Deflationary reduction');
    });

    it('correctly reports inter-whale direct peer transfers', () => {
      const senderWhale = DEFAULT_WATCHED_WHALES[0].address; // Alpha
      const recipientWhale = DEFAULT_WATCHED_WHALES[1].address; // Harbor LP

      const interWhaleTx: WhaleRawTransferPayload = {
        txHash: '0xdddd000600000000000000000000000000000000000000000000000000000006',
        blockNumber: 131050n,
        blockTimestamp: 1774000550,
        fromAddress: senderWhale,
        toAddress: recipientWhale,
        tokenSymbol: 'USDC',
        rawValue: 200_000n * 10n ** 6n,
      };

      const event = engine.ingestTransfer(interWhaleTx)!;
      expect(event.counterpartyCategory).toBe('WHALE_WALLET');
      expect(event.counterpartyLabel).toContain('Harbor Early Liquidity Provider');
      expect(event.narrativeExplanation).toContain('inter-whale capital shift of 200,000 USDC');
    });
  });

  describe('Requirement 04: Produces a summary view of recent activity across all watched addresses', () => {
    it('aggregates multi-whale volume, protocol distribution, and top movers into a structured digest', () => {
      // Ingest 3 distinct high-impact movements across different whales
      engine.ingestTransfer({
        txHash: '0xeeee000100000000000000000000000000000000000000000000000000000001',
        blockNumber: 140000n,
        blockTimestamp: 1774001000,
        fromAddress: DEFAULT_WATCHED_WHALES[0].address, // Alpha
        toAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap DEX
        tokenSymbol: 'USDC',
        rawValue: 100_000n * 10n ** 6n, // $100k
      });

      engine.ingestTransfer({
        txHash: '0xeeee000200000000000000000000000000000000000000000000000000000002',
        blockNumber: 140005n,
        blockTimestamp: 1774001010,
        fromAddress: DEFAULT_WATCHED_WHALES[1].address, // Harbor LP
        toAddress: '0x2000000000000000000000000000000000000002' as Address, // Harbor Lending
        tokenSymbol: 'USDC',
        rawValue: 150_000n * 10n ** 6n, // $150k
      });

      engine.ingestTransfer({
        txHash: '0xeeee000300000000000000000000000000000000000000000000000000000003',
        blockNumber: 140010n,
        blockTimestamp: 1774001020,
        fromAddress: DEFAULT_WATCHED_WHALES[1].address, // Harbor LP again
        toAddress: '0x6000000000000000000000000000000000000001' as Address, // Binance CEX
        tokenSymbol: 'USDT',
        rawValue: 50_000n * 10n ** 6n, // $50k
      });

      const digest = synthesizeActivityDigest(engine);

      expect(digest.monitoredWhaleCount).toBe(5);
      expect(digest.totalFlowEventsCaptured).toBe(3);
      expect(digest.aggregateVolumeUsd).toBe(300_000);
      expect(digest.peakSingleMoveUsd).toBe(150_000);
      expect(digest.mostActiveWhaleMoniker).toContain('Harbor Early Liquidity Provider');
      expect(digest.topDestinationCategory).toBe('LENDING');

      // Verify category percentage breakdown
      const lendingShare = digest.protocolDistribution.find((p) => p.category === 'LENDING');
      expect(lendingShare?.totalUsdVolume).toBe(150_000);
      expect(lendingShare?.percentageOfTotal).toBe(50.0);

      const dexShare = digest.protocolDistribution.find((p) => p.category === 'DEX');
      expect(dexShare?.totalUsdVolume).toBe(100_000);
      expect(dexShare?.percentageOfTotal).toBe(33.3);

      expect(digest.recentFlows).toHaveLength(3);
      // Most recent tx should be first in timeline
      expect(digest.recentFlows[0].token.symbol).toBe('USDT');
    });

    it('produces clean empty state when no flow events have occurred', () => {
      const digest = synthesizeActivityDigest(engine);
      expect(digest.totalFlowEventsCaptured).toBe(0);
      expect(digest.aggregateVolumeUsd).toBe(0);
      expect(digest.recentFlows).toHaveLength(0);
      expect(digest.protocolDistribution).toHaveLength(0);
    });
  });

  describe('Edge Cases: Self-transfers and contract interaction suppression', () => {
    it('suppresses self-transfers when suppressSelfTransfers is enabled (default)', () => {
      const alphaWhale = DEFAULT_WATCHED_WHALES[0].address;

      const selfTx: WhaleRawTransferPayload = {
        txHash: '0xffff000100000000000000000000000000000000000000000000000000000001',
        blockNumber: 150000n,
        blockTimestamp: 1774002000,
        fromAddress: alphaWhale,
        toAddress: alphaWhale, // Same address
        tokenSymbol: 'USDC',
        rawValue: 500_000n * 10n ** 6n,
      };

      const flow = engine.ingestTransfer(selfTx);
      expect(flow).toBeNull();
    });

    it('labels self-transfers accurately when suppressSelfTransfers is false', () => {
      engine.detector.updateThresholdConfig({ suppressSelfTransfers: false });
      const alphaWhale = DEFAULT_WATCHED_WHALES[0].address;

      const selfTx: WhaleRawTransferPayload = {
        txHash: '0xffff000200000000000000000000000000000000000000000000000000000002',
        blockNumber: 150001n,
        blockTimestamp: 1774002010,
        fromAddress: alphaWhale,
        toAddress: alphaWhale,
        tokenSymbol: 'USDC',
        rawValue: 500_000n * 10n ** 6n,
      };

      const flow = engine.ingestTransfer(selfTx);
      expect(flow).not.toBeNull();
      expect(flow?.flowDirection).toBe('SELF_TRANSFER');
      expect(flow?.counterpartyLabel).toContain('Self / Internal Account');
      expect(flow?.narrativeExplanation).toContain('internal self-transfer');
    });

    it('ignores 0-value calls when captureZeroValueContractInteractions is false', () => {
      const alphaWhale = DEFAULT_WATCHED_WHALES[0].address;

      const zeroValTx: WhaleRawTransferPayload = {
        txHash: '0xffff000300000000000000000000000000000000000000000000000000000003',
        blockNumber: 150002n,
        blockTimestamp: 1774002020,
        fromAddress: alphaWhale,
        toAddress: '0x1000000000000000000000000000000000000001' as Address,
        tokenSymbol: 'USDC',
        rawValue: 0n,
      };

      expect(engine.ingestTransfer(zeroValTx)).toBeNull();
    });
  });
});
