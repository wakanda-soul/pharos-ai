import { describe, it, expect, beforeEach } from 'vitest';
import { feedStore } from '../src/lib/storage';
import { PHAROS_CONSTANTS } from '../src/lib/pharos-chain';
import { PolicyGatekeeper } from '../src/lib/policy-gatekeeper';

describe('x402 Payment Gateway & Curation Verification', () => {
  beforeEach(() => {
    feedStore.resetToInitial();
  });

  it('initializes curated feeds with 0.001 USDC base price on Pharos Mainnet', () => {
    const feeds = feedStore.getAllFeeds();
    expect(feeds.length).toBeGreaterThanOrEqual(4);

    const whaleRadar = feedStore.getFeedBySlug('whale-radar');
    expect(whaleRadar).toBeDefined();
    expect(whaleRadar?.pricePerCallUsdc).toBe(0.001);
    expect(whaleRadar?.priceAtomicUnits).toBe('1000');
    expect(whaleRadar?.curationStatus).toBe('ACTIVE');
  });

  it('enforces automatic status revocation to PENDING_AUDIT upon endpoint or schema mutation', () => {
    const slug = 'harbor-solvency';
    const initialFeed = feedStore.getFeedBySlug(slug);
    expect(initialFeed?.curationStatus).toBe('ACTIVE');

    // Simulate publisher attempting to alter endpoint or schema
    const mutationResult = feedStore.mutateFeedDefinition(
      slug,
      '/api/x402/harbor-solvency-v2-injected',
      'sha256-mutated-hash-value'
    );

    expect(mutationResult.success).toBe(true);
    expect(mutationResult.status).toBe('PENDING_AUDIT');

    // Verify stored status is now unapproved
    const mutatedFeed = feedStore.getFeedBySlug(slug);
    expect(mutatedFeed?.curationStatus).toBe('PENDING_AUDIT');
  });

  it('allows designated curator (wakanda-soul) to re-approve a mutated feed', () => {
    const slug = 'harbor-solvency';
    feedStore.mutateFeedDefinition(slug, '/api/x402/harbor-solvency-v2', 'sha256-hash');

    const approveOk = feedStore.curateStatus(slug, 'ACTIVE', PHAROS_CONSTANTS.curatorAddress);
    expect(approveOk).toBe(true);

    const reApprovedFeed = feedStore.getFeedBySlug(slug);
    expect(reApprovedFeed?.curationStatus).toBe('ACTIVE');
    expect(reApprovedFeed?.auditedBy).toBe(PHAROS_CONSTANTS.curatorHandle);
  });
});
