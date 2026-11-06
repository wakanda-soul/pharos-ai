import { IntelligenceFeed } from '@/types/feed';
import { PHAROS_CONSTANTS } from './pharos-chain';

export const CURATED_FEEDS_INITIAL: IntelligenceFeed[] = [
  {
    id: 'feed_whale_radar_01',
    name: 'Pharos Whale Movement Radar',
    slug: 'whale-radar',
    description: 'Real-time detection of high-value PROS and USDC balance shifts exceeding 50,000 units on Pharos Mainnet.',
    category: 'MONITORING',
    publisherAddress: '0x71C8364f3B3974E2f35f76AC8615b32935553a71',
    publisherName: 'Pharos On-Chain Analytics Lab',
    pricePerCallUsdc: 0.001,
    priceAtomicUnits: '1000',
    endpointPath: '/api/x402/whale-radar',
    schemaHash: 'sha256-a9f4c3b2810de059e3820fa4817d83b9c02e5b882',
    curationStatus: 'ACTIVE',
    auditedBy: PHAROS_CONSTANTS.curatorHandle,
    totalCalls: 342,
    grossRevenueUsdc: 0.342,
    sampleQuery: '?minAmount=50000&windowHours=4',
    sampleResponse: {
      network: 'Pharos Mainnet',
      detectedWhalesCount: 3,
      largestTransferUsdc: 145000,
      targetProtocol: 'Harbor Protocol Liquidity Staking',
      riskSentiment: 'BULLISH_ACCUMULATION',
    },
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'feed_harbor_solvency_02',
    name: 'Harbor DEX Pool Solvency & Depth',
    slug: 'harbor-solvency',
    description: 'Live reserves audit, utilization rates, and impermanent loss volatility exposure across major Harbor DEX pools.',
    category: 'DEFI',
    publisherAddress: '0x882aD154B52817EcDFf27F1142277dFa068096C6',
    publisherName: 'DeFi Risk Observability Group',
    pricePerCallUsdc: 0.001,
    priceAtomicUnits: '1000',
    endpointPath: '/api/x402/harbor-solvency',
    schemaHash: 'sha256-c774d08e1a3bc883901f44238e8201a0cb8b3012a',
    curationStatus: 'ACTIVE',
    auditedBy: PHAROS_CONSTANTS.curatorHandle,
    totalCalls: 518,
    grossRevenueUsdc: 0.518,
    sampleQuery: '?pool=PROS-USDC&depthLevels=5',
    sampleResponse: {
      pool: 'PROS/USDC (0.05% fee)',
      tvlUsdc: 4280500,
      reserveRatioPros: 0.512,
      reserveRatioUsdc: 0.488,
      solvencyScore: 98.4,
      isSolvent: true,
      slippageTolerance10kUsdc: '0.04%',
    },
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'feed_dex_volatility_03',
    name: 'Pharos Volatility & Price Swing Radar',
    slug: 'dex-volatility',
    description: 'High-frequency price dispersion across on-chain AMMs, detecting sudden arbitrage gaps and impending liquidations.',
    category: 'DEFI',
    publisherAddress: '0x9421A4B758bFe4421160aF15eB0C271d491c9C72',
    publisherName: 'QuantMesh Signal Services',
    pricePerCallUsdc: 0.001,
    priceAtomicUnits: '1000',
    endpointPath: '/api/x402/dex-volatility',
    schemaHash: 'sha256-ff1894a02be098114cd40b99147a22830de15039a',
    curationStatus: 'ACTIVE',
    auditedBy: PHAROS_CONSTANTS.curatorHandle,
    totalCalls: 289,
    grossRevenueUsdc: 0.289,
    sampleQuery: '?pair=PROS-USDC&metric=realized_volatility',
    sampleResponse: {
      pair: 'PROS/USDC',
      realizedVolatility1h: 0.021,
      realizedVolatility24h: 0.048,
      spreadBasisPoints: 4.2,
      activeArbitrageGap: false,
      liquidationRiskZone: 'NORMAL',
    },
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'feed_contract_risk_04',
    name: 'Smart Contract Honeypot & Risk Scanner',
    slug: 'contract-risk',
    description: 'Autonomous bytecode disassembly checking for hidden mint functions, non-standard reentrancy, or blacklist triggers.',
    category: 'SECURITY',
    publisherAddress: '0x321E5bF91421b18361B8c6507A233c70693a10F4',
    publisherName: 'Pharos Sentinel Security DAO',
    pricePerCallUsdc: 0.001,
    priceAtomicUnits: '1000',
    endpointPath: '/api/x402/contract-risk',
    schemaHash: 'sha256-91e0a29381c1bb430932a104085f1c900384aa28e',
    curationStatus: 'ACTIVE',
    auditedBy: PHAROS_CONSTANTS.curatorHandle,
    totalCalls: 194,
    grossRevenueUsdc: 0.194,
    sampleQuery: '?target=0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
    sampleResponse: {
      targetAddress: '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0',
      contractType: 'Official Native USDC ERC-20',
      hasBlacklistLogic: true,
      hasArbitraryMint: false,
      isProxy: true,
      honeypotRiskRating: 'SAFE_VERIFIED',
      securityScore: 99.1,
    },
    lastUpdated: new Date().toISOString(),
  },
];

export function generateIntelligenceData(feedSlug: string, queryParams: Record<string, string> = {}) {
  const timestamp = new Date().toISOString();
  const randomSalt = Math.floor(Math.random() * 100);

  switch (feedSlug) {
    case 'whale-radar':
      return {
        timestamp,
        chain: 'Pharos Mainnet (Chain ID 1672)',
        feed: 'Whale Movement Radar',
        window: queryParams.windowHours ? `${queryParams.windowHours}h` : '4h',
        minThresholdUsdc: Number(queryParams.minAmount || 50000),
        events: [
          {
            txHash: `0x${(1672000000 + randomSalt).toString(16)}...${(9999 + randomSalt).toString(16)}`,
            from: '0x1bF848814D174F5A85bD3FDf9f6C9201',
            to: '0xHarborVault0000000000000000000000000000001',
            token: 'USDC',
            amount: 75000 + randomSalt * 100,
            direction: 'INFLOW_TO_HARBOR_VAULT',
            blockNumber: 14820100 + randomSalt,
          },
          {
            txHash: `0x${(1672111111 + randomSalt).toString(16)}...${(8888 + randomSalt).toString(16)}`,
            from: '0xWhaleTraderA918230000000000000000000000000',
            to: '0x71C8364f3B3974E2f35f76AC8615b32935553a71',
            token: 'PROS',
            amount: 120000 + randomSalt * 250,
            direction: 'DEX_ACCUMULATION',
            blockNumber: 14820108 + randomSalt,
          },
        ],
        marketSummary: 'Net whale accumulation observed over the last 4 hours on Pharos Mainnet.',
      };

    case 'harbor-solvency':
      return {
        timestamp,
        chain: 'Pharos Mainnet (Chain ID 1672)',
        feed: 'Harbor DEX Pool Solvency & Depth',
        poolId: 'HARBOR-POOL-PROS-USDC-005',
        pair: 'PROS/USDC',
        reserves: {
          prosReserve: (1450200 + randomSalt * 10).toLocaleString(),
          usdcReserve: (4280500 + randomSalt * 50).toLocaleString(),
          utilizationRatio: '68.4%',
        },
        depthSummary: {
          bidDepth1PercentUsdc: 245000,
          askDepth1PercentPros: 82000,
          slippageFor1000Usdc: '0.003%',
          slippageFor50000Usdc: '0.18%',
        },
        auditAssessment: {
          isSolvent: true,
          poolHealthIndex: 98.7,
          rebalanceFrequencyMinutes: 15,
          liquidityAdequacy: 'EXCELLENT',
        },
      };

    case 'dex-volatility':
      return {
        timestamp,
        chain: 'Pharos Mainnet (Chain ID 1672)',
        feed: 'Pharos Volatility Radar',
        pair: 'PROS/USDC',
        metrics: {
          currentSpotPriceUsdc: 2.945 + (randomSalt % 10) * 0.002,
          realizedVol1hAnnualized: '18.4%',
          realizedVol24hAnnualized: '32.1%',
          parkinsonHighLowDispersion: 0.0124,
          bidAskSpreadBps: 3.8,
        },
        regime: 'LOW_VOLATILITY_EQUILIBRIUM',
        arbitrageSignals: {
          detectedSpreadVsOffChain: '0.08%',
          actionableArbitrage: false,
          recommendation: 'Optimal conditions for algorithmic market-making.',
        },
      };

    case 'contract-risk':
      return {
        timestamp,
        chain: 'Pharos Mainnet (Chain ID 1672)',
        feed: 'Smart Contract Risk Scanner',
        analyzedTarget: queryParams.target || PHAROS_CONSTANTS.nativeUsdcAddress,
        disassemblyResults: {
          compilerVersion: 'v0.8.20+commit.a1b79de6',
          hasSelfDestruct: false,
          hasDelegateCallInFallback: false,
          hasPausableEmergencyStop: true,
          unrestrictedTransfers: true,
          reentrancyGuardsDetected: true,
        },
        riskVerdict: {
          score: 99.4,
          rating: 'SAFE_VERIFIED',
          honeypotFlags: 0,
          auditedSignatures: ['EIP-2612 Permit', 'EIP-3009 TransferWithAuth'],
        },
      };

    default:
      return {
        timestamp,
        chain: 'Pharos Mainnet',
        feed: feedSlug,
        status: 'GENERIC_INTELLIGENCE_OK',
        payload: { sampleKey: 'Verified mesh data packet' },
      };
  }
}
