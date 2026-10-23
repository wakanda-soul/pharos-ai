import { describe, it, expect } from 'vitest';
import { YieldRouter } from '../src/router.js';
import { ProtocolVenue } from '../src/types.js';

describe('Task 30: YieldRouter Engine', () => {
  const router = new YieldRouter();

  const mockVenues: ProtocolVenue[] = [
    {
      id: 'harbor:vrpc-6m',
      protocolId: 'harbor',
      protocolName: 'Harbor RWA Hub',
      vaultName: 'Axil Consumer Credit 6M',
      underlyingToken: 'USDC',
      tokenAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
      vaultAddress: '0x995321f24953B9803EbF8E7Ce988e0258d4aB979',
      assetClass: 'Fixed Income & Credit',
      lockupTenor: '6m',
      apyPercent: 15.0,
      tvlUsd: 10_000_000,
      minDepositUsd: 100,
      safetyScore: 84,
      isLive: true,
    },
    {
      id: 'harbor:apc3m',
      protocolId: 'harbor',
      protocolName: 'Harbor RWA Hub',
      vaultName: 'Axil Prime 3M',
      underlyingToken: 'USDC',
      tokenAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
      vaultAddress: '0x7141528646B971a8F9BF96b21c172d1F0B180A5F',
      assetClass: 'Fixed Income & Credit',
      lockupTenor: '3m',
      apyPercent: 13.8,
      tvlUsd: 66_000_000,
      minDepositUsd: 2,
      safetyScore: 88,
      isLive: true,
    },
    {
      id: 'morpho:rockawayx-usdc',
      protocolId: 'morpho',
      protocolName: 'Morpho Blue (RockawayX Curated)',
      vaultName: 'RockawayX USDC MetaMorpho Vault',
      underlyingToken: 'USDC',
      tokenAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
      vaultAddress: '0x4422119933AaBbCcDdEeFf001122334455667788',
      assetClass: 'Onchain Lending',
      lockupTenor: 'liquid',
      apyPercent: 8.5,
      tvlUsd: 11_000_000,
      minDepositUsd: 1,
      safetyScore: 94,
      isLive: true,
    },
    {
      id: 'faroswap:wpros-usdc',
      protocolId: 'faroswap',
      protocolName: 'FaroSwap AMM DEX',
      vaultName: 'FaroSwap WPROS/USDC LP',
      underlyingToken: 'USDC',
      tokenAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
      vaultAddress: '0x936564245b69f5a293b42cbd752e0ee3bb68b470',
      assetClass: 'DEX Liquidity Pool',
      lockupTenor: 'liquid',
      apyPercent: 11.2,
      tvlUsd: 1_200_000,
      minDepositUsd: 10,
      safetyScore: 80,
      isLive: true,
    },
  ];

  it('should select highest APY venue when no tenor constraints are given', () => {
    const result = router.route(mockVenues, {
      token: 'USDC',
      amountUsd: 5000,
      maxLockupTenor: '6m',
    });

    expect(result.bestVenue.id).toBe('harbor:vrpc-6m');
    expect(result.bestVenue.apyPercent).toBe(15.0);
    expect(result.projectedYieldUsd).toBe(750);
    expect(result.explanation.primaryReason).toContain('highest-yielding venue (15% APY)');
  });

  it('should filter out locked venues and select best liquid venue when liquid tenor is requested', () => {
    const result = router.route(mockVenues, {
      token: 'USDC',
      amountUsd: 5000,
      maxLockupTenor: 'liquid',
    });

    expect(result.bestVenue.lockupTenor).toBe('liquid');
    expect(result.bestVenue.id).toBe('faroswap:wpros-usdc');
    expect(result.bestVenue.apyPercent).toBe(11.2);
  });

  it('should respect high safety score constraint and choose Morpho Blue', () => {
    const result = router.route(mockVenues, {
      token: 'USDC',
      amountUsd: 5000,
      maxLockupTenor: 'liquid',
      minSafetyScore: 90,
    });

    expect(result.bestVenue.id).toBe('morpho:rockawayx-usdc');
    expect(result.bestVenue.safetyScore).toBeGreaterThanOrEqual(90);
    expect(result.explanation.primaryReason).toContain('RockawayX USDC MetaMorpho Vault');
  });

  it('should disqualify venue if deposit exceeds 25% of pool TVL capacity', () => {
    // Deposit $500k into FaroSwap ($1.2M TVL -> >25% TVL)
    const result = router.route(mockVenues, {
      token: 'USDC',
      amountUsd: 500_000,
      maxLockupTenor: 'liquid',
    });

    // Should disqualify FaroSwap and pick Morpho Blue ($11M TVL)
    expect(result.bestVenue.id).toBe('morpho:rockawayx-usdc');
    const faroswapComparison = result.consideredVenues.find((c) => c.venueId === 'faroswap:wpros-usdc');
    expect(faroswapComparison?.eligible).toBe(false);
    expect(faroswapComparison?.disqualificationReason).toContain('exceeds 25% of pool TVL');
  });

  it('should provide comprehensive plain-English explanation with tradeoffs', () => {
    const result = router.route(mockVenues, {
      token: 'USDC',
      amountUsd: 10_000,
      maxLockupTenor: '3m',
    });

    expect(result.explanation.primaryReason).toBeTruthy();
    expect(result.explanation.tradeoffs.length).toBeGreaterThan(0);
    expect(result.explanation.comparisonNotes).toContain('Compared against');
  });
});
