import { describe, it, expect, beforeEach } from 'vitest';
import { feedStore } from '../src/lib/storage';

describe('Publisher Dashboard & Fee Modification', () => {
  beforeEach(() => {
    feedStore.resetToInitial();
  });

  it('allows publisher to customize fee per call (e.g. 0.001 -> 0.0025 USDC)', () => {
    const slug = 'contract-risk';
    const ok = feedStore.updatePrice(slug, 0.0025);
    expect(ok).toBe(true);

    const updated = feedStore.getFeedBySlug(slug);
    expect(updated?.pricePerCallUsdc).toBe(0.0025);
    expect(updated?.priceAtomicUnits).toBe('2500'); // 2,500 micro-units
  });

  it('rejects fee updates below the minimum economic threshold (< 0.0001 USDC)', () => {
    const slug = 'contract-risk';
    const ok = feedStore.updatePrice(slug, 0.00005);
    expect(ok).toBe(false);

    const feed = feedStore.getFeedBySlug(slug);
    expect(feed?.pricePerCallUsdc).toBe(0.001); // remains intact
  });

  it('tracks micro-revenue settlement accurately', () => {
    const slug = 'dex-volatility';
    const initialFeed = feedStore.getFeedBySlug(slug);
    const initialCalls = initialFeed?.totalCalls || 0;
    const initialRevenue = initialFeed?.grossRevenueUsdc || 0;

    feedStore.recordPurchase(slug, 0.001);

    const updated = feedStore.getFeedBySlug(slug);
    expect(updated?.totalCalls).toBe(initialCalls + 1);
    expect(updated?.grossRevenueUsdc).toBeCloseTo(initialRevenue + 0.001, 4);
  });
});
