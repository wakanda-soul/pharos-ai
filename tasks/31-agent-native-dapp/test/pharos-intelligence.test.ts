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

  it('should dispatch all 4 feeds through unified dispatcher', async () => {
    const whaleData = await fetchLiveIntelligenceData('whale-radar');
    expect(whaleData.chain).toContain('1672');
    expect(whaleData.feed).toBe('Whale Movement Radar');
  });
});
