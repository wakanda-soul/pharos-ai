import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { feedStore } from '../src/lib/storage';
import { PHAROS_CONSTANTS } from '../src/lib/pharos-chain';
import { handleX402Paywall } from '../src/lib/x402-gateway';
import { X402_EIP712_DOMAIN, X402_PAYMENT_VOUCHER_TYPES } from '../src/types/x402';

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

  it('emits HTTP 402 Payment Required challenge with standard x402 headers on unauthenticated request', async () => {
    const req = new NextRequest('http://localhost:3000/api/x402/whale-radar');
    const res = await handleX402Paywall(req, 'whale-radar', () => ({ telemetry: 'ok' }));

    expect(res.status).toBe(402);
    expect(res.headers.get('WWW-Authenticate')).toContain('x402 token=');
    expect(res.headers.get('X-402-Price-USDC')).toBe('0.001');
    expect(res.headers.get('X-402-Chain-Id')).toBe('1672');

    const body = await res.json();
    expect(body.error).toBe('Payment Required');
    expect(body.challenge.recipientAddress).toBeDefined();
  });

  it('rejects invalid JSON proof payload with HTTP 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/x402/whale-radar', {
      headers: {
        Authorization: 'x402 not-valid-json-data',
      },
    });

    const res = await handleX402Paywall(req, 'whale-radar', () => ({ telemetry: 'ok' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid x402 payment proof');
  });

  it('rejects forged cryptographic signature with HTTP 401 Unauthorized', async () => {
    const legitKey = generatePrivateKey();
    const legitAccount = privateKeyToAccount(legitKey);

    const forgedPayload = {
      buyerAddress: legitAccount.address,
      authorizationSignature: '0x' + '11'.repeat(65), // Invalid forged signature
      nonce: Date.now(),
      queryHash: '0xabc123',
    };

    const req = new NextRequest('http://localhost:3000/api/x402/whale-radar', {
      headers: {
        Authorization: `x402 ${JSON.stringify(forgedPayload)}`,
      },
    });

    const res = await handleX402Paywall(req, 'whale-radar', () => ({ telemetry: 'ok' }));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('Payment authorization signature verification failed');
  });

  it('authenticates and settles payment when signed with real EIP-712 session key signature', async () => {
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const nonce = Date.now();
    const feed = feedStore.getFeedBySlug('whale-radar')!;

    // Generate genuine cryptographic EIP-712 signature
    const realSignature = await sessionAccount.signTypedData({
      domain: X402_EIP712_DOMAIN,
      types: X402_PAYMENT_VOUCHER_TYPES,
      primaryType: 'X402PaymentVoucher',
      message: {
        buyerAddress: sessionAccount.address,
        feedSlug: 'whale-radar',
        priceUsdcAtomic: BigInt(feed.priceAtomicUnits),
        nonce: BigInt(nonce),
        timestamp: BigInt(nonce),
      },
    });

    const validPayload = {
      buyerAddress: sessionAccount.address,
      authorizationSignature: realSignature,
      nonce,
      queryHash: '0xrealquery123',
    };

    const req = new NextRequest('http://localhost:3000/api/x402/whale-radar', {
      headers: {
        Authorization: `x402 ${JSON.stringify(validPayload)}`,
      },
    });

    const mockDataProvider = () => ({ liveData: 'whales-detected-on-chain', block: 22400100 });
    const res = await handleX402Paywall(req, 'whale-radar', mockDataProvider);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(200);
    expect(body.receipt.buyer).toBe(sessionAccount.address);
    expect(body.receipt.paidUsdc).toBe(0.001);
    expect(body.receipt.verifiedEip712).toBe(true);
    expect(body.intelligence.liveData).toBe('whales-detected-on-chain');
  });

  it('strictly rejects simulated mock strings (e.g. 0xValidEip712SessionKeySignature) with HTTP 401 Unauthorized', async () => {
    const sessionPrivateKey = generatePrivateKey();
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const nonce = Date.now();

    const mockPayload = {
      buyerAddress: sessionAccount.address,
      authorizationSignature: '0xValidEip712SessionKeySignaturePharosMainnet',
      nonce,
      queryHash: '0xmockquery123',
    };

    const req = new NextRequest('http://localhost:3000/api/x402/whale-radar', {
      headers: {
        Authorization: `x402 ${JSON.stringify(mockPayload)}`,
      },
    });

    const res = await handleX402Paywall(req, 'whale-radar', () => ({ telemetry: 'ok' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Payment authorization signature verification failed');
    expect(body.message).toContain('signature does not match');
  });
});
