import * as fs from 'fs';
import * as path from 'path';
import { IntelligenceFeed, FeedCurationStatus } from '@/types/feed';
import { CURATED_FEEDS_INITIAL } from './pharos-intelligence';
import { PHAROS_CONSTANTS } from './pharos-chain';

/**
 * Global feed state store for the x402 Intelligence Mesh.
 * Supports publisher price modification and curator whitelisting.
 * Any mutation to endpoint or schema automatically revokes active status to PENDING_AUDIT.
 * Persists registered feeds, statuses, and revenue counters to local disk (.state/pharos-feeds.json).
 */
class FeedStore {
  private feeds: Map<string, IntelligenceFeed> = new Map();
  private readonly stateFilePath: string;

  constructor() {
    const fileName =
      process.env.NODE_ENV === 'test'
        ? 'pharos-feeds.test.json'
        : 'pharos-feeds.json';
    const isVercel = !!process.env.VERCEL;
    const baseDir = isVercel ? '/tmp' : path.join(process.cwd(), '.state');
    this.stateFilePath = path.join(baseDir, fileName);
    this.initStore();
  }

  private initStore() {
    const loaded = this.loadFromDisk();
    if (!loaded) {
      this.resetToInitial();
    }
  }

  private loadFromDisk(): boolean {
    try {
      if (typeof fs !== 'undefined' && fs.existsSync(this.stateFilePath)) {
        const rawJson = fs.readFileSync(this.stateFilePath, 'utf-8');
        const parsed: IntelligenceFeed[] = JSON.parse(rawJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.feeds.clear();
          for (const item of parsed) {
            this.feeds.set(item.slug, item);
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('Could not read state file, falling back to initial feeds:', err);
    }
    return false;
  }

  private persistToDisk() {
    try {
      if (typeof fs !== 'undefined') {
        const stateDir = path.dirname(this.stateFilePath);
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }
        const data = JSON.stringify(Array.from(this.feeds.values()), null, 2);
        fs.writeFileSync(this.stateFilePath, data, 'utf-8');
      }
    } catch (err) {
      // In constrained environments (e.g. read-only serverless), stay in memory
      console.warn('FeedStore could not persist to disk, continuing in-memory:', err);
    }
  }

  public resetToInitial() {
    this.feeds.clear();
    for (const feed of CURATED_FEEDS_INITIAL) {
      this.feeds.set(feed.slug, { ...feed });
    }
    this.persistToDisk();
  }

  public getAllFeeds(): IntelligenceFeed[] {
    this.loadFromDisk();
    return Array.from(this.feeds.values());
  }

  public getFeedBySlug(slug: string): IntelligenceFeed | undefined {
    this.loadFromDisk();
    return this.feeds.get(slug);
  }

  public getFeedById(id: string): IntelligenceFeed | undefined {
    this.loadFromDisk();
    return Array.from(this.feeds.values()).find((f) => f.id === id);
  }

  /**
   * Updates feed price (base 0.001 USDC). Publisher privilege.
   */
  public updatePrice(slug: string, newPriceUsdc: number): boolean {
    this.loadFromDisk();
    const feed = this.feeds.get(slug);
    if (!feed) return false;

    // Must be at least 0.0001 USDC
    if (newPriceUsdc < 0.0001) return false;

    feed.pricePerCallUsdc = newPriceUsdc;
    // Calculate atomic units for 6-decimal USDC (1 USDC = 1,000,000 units)
    feed.priceAtomicUnits = Math.round(newPriceUsdc * 1_000_000).toString();
    feed.lastUpdated = new Date().toISOString();
    this.persistToDisk();
    return true;
  }

  /**
   * Mutates endpoint or schema.
   * CRITICAL ANTI-SCAM RULE: Automatically resets status to PENDING_AUDIT!
   */
  public mutateFeedDefinition(
    slug: string,
    newEndpointPath: string,
    newSchemaHash: string
  ): { success: boolean; status: FeedCurationStatus } {
    this.loadFromDisk();
    const feed = this.feeds.get(slug);
    if (!feed) return { success: false, status: 'REVOKED' };

    feed.endpointPath = newEndpointPath;
    feed.schemaHash = newSchemaHash;
    // Auto-revoke on mutation:
    feed.curationStatus = 'PENDING_AUDIT';
    feed.lastUpdated = new Date().toISOString();
    this.persistToDisk();

    return { success: true, status: 'PENDING_AUDIT' };
  }

  /**
   * Curator whitelist administration. Strictly allowed only by curator (wakanda-soul).
   */
  public curateStatus(
    slug: string,
    newStatus: FeedCurationStatus,
    curatorAddress: string
  ): boolean {
    this.loadFromDisk();
    const feed = this.feeds.get(slug);
    if (!feed) return false;

    // In production contract, curator is checked on-chain
    feed.curationStatus = newStatus;
    feed.auditedBy = PHAROS_CONSTANTS.curatorHandle;
    feed.lastUpdated = new Date().toISOString();
    this.persistToDisk();
    return true;
  }

  public recordPurchase(slug: string, pricePaidUsdc: number) {
    this.loadFromDisk();
    const feed = this.feeds.get(slug);
    if (!feed) return;
    feed.totalCalls += 1;
    feed.grossRevenueUsdc = Number((feed.grossRevenueUsdc + pricePaidUsdc).toFixed(4));
    feed.unsettledRevenueUsdc = Number(((feed.unsettledRevenueUsdc || 0) + pricePaidUsdc).toFixed(4));
    feed.lastUpdated = new Date().toISOString();
    this.persistToDisk();
  }

  public registerFeed(feed: IntelligenceFeed) {
    this.loadFromDisk();
    this.feeds.set(feed.slug, {
      ...feed,
      totalCalls: 0,
      grossRevenueUsdc: 0.0,
      unsettledRevenueUsdc: 0.0,
      settledRevenueUsdc: 0.0,
    });
    this.persistToDisk();
  }

  public claimFeedOwnership(slug: string, newPublisherAddress: string, newPublisherName?: string): boolean {
    this.loadFromDisk();
    const feed = this.feeds.get(slug);
    if (!feed) return false;
    feed.publisherAddress = newPublisherAddress;
    if (newPublisherName) {
      feed.publisherName = newPublisherName;
    }
    feed.lastUpdated = new Date().toISOString();
    this.persistToDisk();
    return true;
  }

  public claimAllFeedsOwnership(
    newPublisherAddress: string,
    newPublisherName?: string
  ): { updatedCount: number; slugs: string[] } {
    this.loadFromDisk();
    const slugs: string[] = [];
    for (const feed of this.feeds.values()) {
      feed.publisherAddress = newPublisherAddress;
      if (newPublisherName) {
        feed.publisherName = newPublisherName;
      }
      feed.lastUpdated = new Date().toISOString();
      slugs.push(feed.slug);
    }
    this.persistToDisk();
    return { updatedCount: slugs.length, slugs };
  }

  public settleFeedRevenue(
    publisherAddress: string,
    slug?: string,
    onChainTxHash?: string
  ): {
    success: boolean;
    settledAmount: number;
    receiptId: string;
    onChainTxHash: string | null;
    settledFeeds: string[];
    timestamp: string;
    error?: string;
  } {
    this.loadFromDisk();
    const normalizedPublisher = publisherAddress.toLowerCase();
    const matchingFeeds = Array.from(this.feeds.values()).filter((f) => {
      const isOwner = f.publisherAddress.toLowerCase() === normalizedPublisher;
      if (!isOwner) return false;
      if (slug && f.slug !== slug) return false;
      return true;
    });

    if (matchingFeeds.length === 0) {
      return {
        success: false,
        settledAmount: 0,
        receiptId: '',
        onChainTxHash: null,
        settledFeeds: [],
        timestamp: '',
        error: slug ? `Feed '${slug}' is not owned by ${publisherAddress}` : 'No feeds found for this publisher address',
      };
    }

    let totalToSettle = 0;
    const settledSlugs: string[] = [];

    for (const feed of matchingFeeds) {
      // Determine unsettled amount
      const unsettled =
        typeof feed.unsettledRevenueUsdc === 'number'
          ? feed.unsettledRevenueUsdc
          : Math.max(0, Number((feed.grossRevenueUsdc - (feed.settledRevenueUsdc || 0)).toFixed(4)));

      if (unsettled > 0) {
        totalToSettle += unsettled;
        feed.settledRevenueUsdc = Number(((feed.settledRevenueUsdc || 0) + unsettled).toFixed(4));
        feed.unsettledRevenueUsdc = 0;
        feed.lastUpdated = new Date().toISOString();
        settledSlugs.push(feed.slug);
      }
    }

    if (totalToSettle <= 0) {
      return {
        success: false,
        settledAmount: 0,
        receiptId: '',
        onChainTxHash: null,
        settledFeeds: [],
        timestamp: '',
        error: 'No pending/unsettled micro-revenue available to settle at this time.',
      };
    }

    this.persistToDisk();

    const timestamp = new Date().toISOString();
    const receiptId = `rcpt_settle_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(16)}`;

    return {
      success: true,
      settledAmount: Number(totalToSettle.toFixed(4)),
      receiptId,
      onChainTxHash: onChainTxHash || null,
      settledFeeds: settledSlugs,
      timestamp,
    };
  }

  public reopenUnsettledRevenue(publisherAddress: string): {
    success: boolean;
    restoredAmount: number;
    restoredFeeds: string[];
    error?: string;
  } {
    this.loadFromDisk();
    const normalizedPublisher = publisherAddress.toLowerCase();
    const matchingFeeds = Array.from(this.feeds.values()).filter(
      (f) => f.publisherAddress.toLowerCase() === normalizedPublisher
    );

    if (matchingFeeds.length === 0) {
      return {
        success: false,
        restoredAmount: 0,
        restoredFeeds: [],
        error: `No feeds found for publisher ${publisherAddress}`,
      };
    }

    let totalRestored = 0;
    const restoredSlugs: string[] = [];

    for (const feed of matchingFeeds) {
      const settledAmount = feed.settledRevenueUsdc || 0;
      if (settledAmount > 0) {
        totalRestored += settledAmount;
        feed.unsettledRevenueUsdc = Number(((feed.unsettledRevenueUsdc || 0) + settledAmount).toFixed(4));
        feed.settledRevenueUsdc = 0;
        feed.lastUpdated = new Date().toISOString();
        restoredSlugs.push(feed.slug);
      }
    }

    this.persistToDisk();

    return {
      success: true,
      restoredAmount: Number(totalRestored.toFixed(4)),
      restoredFeeds: restoredSlugs,
    };
  }
}

// Global singleton across API routes in Next.js
const globalFeedStoreKey = Symbol.for('pharos.x402.feedStore');
const globalObject = globalThis as unknown as { [key: symbol]: FeedStore };

export const feedStore: FeedStore =
  globalObject[globalFeedStoreKey] || (globalObject[globalFeedStoreKey] = new FeedStore());
