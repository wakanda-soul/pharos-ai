import { IntelligenceFeed, FeedCurationStatus } from '@/types/feed';
import { CURATED_FEEDS_INITIAL } from './pharos-intelligence';
import { PHAROS_CONSTANTS } from './pharos-chain';

/**
 * Global feed state store for the x402 Intelligence Mesh.
 * Supports publisher price modification and curator whitelisting.
 * Any mutation to endpoint or schema automatically revokes active status to PENDING_AUDIT.
 */
class FeedStore {
  private feeds: Map<string, IntelligenceFeed> = new Map();

  constructor() {
    this.resetToInitial();
  }

  public resetToInitial() {
    this.feeds.clear();
    for (const feed of CURATED_FEEDS_INITIAL) {
      this.feeds.set(feed.slug, { ...feed });
    }
  }

  public getAllFeeds(): IntelligenceFeed[] {
    return Array.from(this.feeds.values());
  }

  public getFeedBySlug(slug: string): IntelligenceFeed | undefined {
    return this.feeds.get(slug);
  }

  public getFeedById(id: string): IntelligenceFeed | undefined {
    return Array.from(this.feeds.values()).find((f) => f.id === id);
  }

  /**
   * Updates feed price (base 0.001 USDC). Publisher privilege.
   */
  public updatePrice(slug: string, newPriceUsdc: number): boolean {
    const feed = this.feeds.get(slug);
    if (!feed) return false;

    // Must be at least 0.0001 USDC
    if (newPriceUsdc < 0.0001) return false;

    feed.pricePerCallUsdc = newPriceUsdc;
    // Calculate atomic units for 6-decimal USDC (1 USDC = 1,000,000 units)
    feed.priceAtomicUnits = Math.round(newPriceUsdc * 1_000_000).toString();
    feed.lastUpdated = new Date().toISOString();
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
    const feed = this.feeds.get(slug);
    if (!feed) return { success: false, status: 'REVOKED' };

    feed.endpointPath = newEndpointPath;
    feed.schemaHash = newSchemaHash;
    // Auto-revoke on mutation:
    feed.curationStatus = 'PENDING_AUDIT';
    feed.lastUpdated = new Date().toISOString();

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
    const feed = this.feeds.get(slug);
    if (!feed) return false;

    // In production contract, curator is checked on-chain
    feed.curationStatus = newStatus;
    feed.auditedBy = PHAROS_CONSTANTS.curatorHandle;
    feed.lastUpdated = new Date().toISOString();
    return true;
  }

  public recordPurchase(slug: string, pricePaidUsdc: number) {
    const feed = this.feeds.get(slug);
    if (!feed) return;
    feed.totalCalls += 1;
    feed.grossRevenueUsdc = Number((feed.grossRevenueUsdc + pricePaidUsdc).toFixed(4));
    feed.lastUpdated = new Date().toISOString();
  }

  public registerFeed(feed: IntelligenceFeed) {
    this.feeds.set(feed.slug, { ...feed, totalCalls: 0, grossRevenueUsdc: 0.0 });
  }
}

// Global singleton across API routes in Next.js
const globalFeedStoreKey = Symbol.for('pharos.x402.feedStore');
const globalObject = globalThis as unknown as { [key: symbol]: FeedStore };

export const feedStore: FeedStore =
  globalObject[globalFeedStoreKey] || (globalObject[globalFeedStoreKey] = new FeedStore());
