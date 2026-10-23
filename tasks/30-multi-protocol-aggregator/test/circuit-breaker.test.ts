import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../src/circuit-breaker.js';
import { MultiProtocolAggregator } from '../src/aggregator.js';
import { ProtocolAdapter } from '../src/adapters/base-adapter.js';
import { ProtocolVenue } from '../src/types.js';

describe('Task 30: Circuit Breaker & Fault Tolerance', () => {
  it('should trip to OPEN state after 3 consecutive failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeMs: 10000 });

    const failingAction = async () => {
      throw new Error('RPC connection timeout');
    };

    expect(cb.isCallPermitted('harbor')).toBe(true);

    // 1st failure
    await cb.execute('harbor', failingAction);
    expect(cb.getHealth('harbor', 'Harbor').state).toBe('CLOSED');

    // 2nd failure
    await cb.execute('harbor', failingAction);
    expect(cb.getHealth('harbor', 'Harbor').state).toBe('CLOSED');

    // 3rd failure -> should trip to OPEN
    await cb.execute('harbor', failingAction);
    const health = cb.getHealth('harbor', 'Harbor');
    expect(health.state).toBe('OPEN');
    expect(health.isAvailable).toBe(false);
    expect(cb.isCallPermitted('harbor')).toBe(false);
  });

  it('should isolate a broken protocol without crashing the aggregator or other protocols', async () => {
    // Create a mock failing adapter
    const brokenAdapter: ProtocolAdapter = {
      protocolId: 'harbor',
      protocolName: 'Harbor RWA Hub',
      fetchRates: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      fetchPositions: vi.fn().mockResolvedValue([]),
      prepareDeposit: vi.fn(),
      prepareWithdraw: vi.fn(),
    };

    // Create a working adapter
    const healthyVenue: ProtocolVenue = {
      id: 'morpho:rockawayx-usdc',
      protocolId: 'morpho',
      protocolName: 'Morpho Blue',
      vaultName: 'RockawayX USDC',
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
    };

    const healthyAdapter: ProtocolAdapter = {
      protocolId: 'morpho',
      protocolName: 'Morpho Blue',
      fetchRates: vi.fn().mockResolvedValue([healthyVenue]),
      fetchPositions: vi.fn().mockResolvedValue([]),
      prepareDeposit: vi.fn(),
      prepareWithdraw: vi.fn(),
    };

    const aggregator = new MultiProtocolAggregator({
      adapters: [brokenAdapter, healthyAdapter],
    });

    // Run getAllRates - MUST NOT throw!
    const { venues, degradedProtocols } = await aggregator.getAllRates();

    // Broken adapter was gracefully isolated
    expect(degradedProtocols.length).toBe(1);
    expect(degradedProtocols[0].protocolId).toBe('harbor');
    expect(degradedProtocols[0].error).toContain('503 Service Unavailable');

    // Healthy protocol returned its rate cleanly
    expect(venues.length).toBe(1);
    expect(venues[0].id).toBe('morpho:rockawayx-usdc');
    expect(venues[0].apyPercent).toBe(8.5);
  });

  it('should support simulated failure mode for fault-tolerance testing', async () => {
    const aggregator = new MultiProtocolAggregator();

    // Simulate outage on Harbor
    aggregator.simulateFailure('harbor', true);

    const { venues, degradedProtocols } = await aggregator.getAllRates();

    // Harbor should be isolated or in degraded list
    expect(degradedProtocols.some((d) => d.protocolId === 'harbor')).toBe(true);

    // Remaining venues (Morpho and FaroSwap) still successfully returned
    expect(venues.length).toBeGreaterThan(0);
    const harborVenues = venues.filter((v) => v.protocolId === 'harbor');
    expect(harborVenues.length).toBe(0);

    const morphoVenues = venues.filter((v) => v.protocolId === 'morpho');
    expect(morphoVenues.length).toBeGreaterThan(0);
  });
});
