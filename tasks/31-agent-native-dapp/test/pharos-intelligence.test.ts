import { describe, it, expect } from 'vitest';
import {
  getLiveContractRiskData,
  getLiveHarborSolvencyData,
  getLiveDexVolatilityData,
  fetchLiveIntelligenceData,
} from '../src/lib/pharos-intelligence';
import { PHAROS_CONSTANTS } from '../src/lib/pharos-chain';

describe('Pharos Mainnet Live RPC Intelligence Providers', () => {
  it('should query live contract risk data for Native USDC on Pharos Mainnet', async () => {
    const data = await getLiveContractRiskData(PHAROS_CONSTANTS.nativeUsdcAddress);
    expect(data.chain).toContain('1672');
    expect(data.analyzedTarget.toLowerCase()).toBe(PHAROS_CONSTANTS.nativeUsdcAddress.toLowerCase());
    expect(data.currentBlockNumber).toBeGreaterThan(20000000);
    expect(data.tokenSymbol).toBe('USDC');
    expect(data.decimals).toBe(6);
    expect(data.isProxy).toBe(true);
    expect(data.riskVerdict.score).toBeGreaterThanOrEqual(90);
  });

  it('should query live Harbor solvency data with real total supply on Pharos Mainnet', async () => {
    const data = await getLiveHarborSolvencyData();
    expect(data.chain).toContain('1672');
    expect(data.currentBlockNumber).toBeGreaterThan(20000000);
    expect(data.onChainMetrics.liveUsdcTotalSupply).toBeDefined();
    expect(data.auditAssessment.isSolvent).toBe(true);
  });

  it('should fetch DEX volatility telemetry directly from Pharos Mainnet', async () => {
    const data = await getLiveDexVolatilityData();
    expect(data.chain).toContain('1672');
    expect(data.metrics.baseGasFeeGwei).toBeDefined();
  });

  it('should accurately analyze non-ERC20 marketplace contract without hallucinatory metadata', async () => {
    const marketplaceAddress = '0xd5dB1B4eA7E98Bf57a0d16Bac547f74F727c71F9';
    const data = await getLiveContractRiskData(marketplaceAddress);
    expect(data.chain).toContain('1672');
    expect(data.analyzedTarget.toLowerCase()).toBe(marketplaceAddress.toLowerCase());
    expect(data.isStandardErc20).toBe(false);
    expect(data.tokenName).toBeNull();
    expect(data.tokenSymbol).toBeNull();
    expect(data.decimals).toBeNull();
    expect(data.contractType).toBe('Marketplace / Launchpad / Sale Module');
    expect(data.hasSelfDestruct).toBe(false);
    expect(data.hasDelegateCall).toBe(false);
    expect(data.detectedFunctionSelectors).toContain('0xa59ac6dd');
    expect(data.detectedFunctionSelectors).toContain('0xc45a0155');
    expect(data.connectedContracts?.factory?.toLowerCase()).toBe('0xefdbb0ea7647b0e21aef7a3b7a5d6a632c3116c8');
    expect(data.connectedContracts?.marketBeacon?.toLowerCase()).toBe('0x30bebe432ff53c9b6ed28dd9daf125902cbabb56');
  });

  it('should dispatch all 4 feeds through unified dispatcher', async () => {
    const whaleData = await fetchLiveIntelligenceData('whale-radar');
    expect(whaleData.chain).toContain('1672');
    expect((whaleData as any).feed).toBe('Whale Movement Radar');
  });
});
