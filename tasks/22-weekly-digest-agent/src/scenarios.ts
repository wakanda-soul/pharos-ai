/**
 * Curated On-Chain Activity Scenarios for Pharos Weekly Digest Agent.
 * Contains realistic transaction histories for corporate treasuries and DeFi protocols
 * covering contiguous weekly accounting windows (Week 08 vs Week 07 Baseline).
 */

import type {
  DigestAccountingPeriod,
  DigestTargetProfile,
  RawHistoricalActivityRecord,
} from './types.js';

export const BENCHMARK_TREASURY_WALLET = '0x71C80000000000000000000000000000000071C8' as const;
export const BENCHMARK_FAROSWAP_ROUTER = '0x1000000000000000000000000000000000000001' as const;

export const DEMO_TREASURY_PROFILE: DigestTargetProfile = {
  targetIdentifier: BENCHMARK_TREASURY_WALLET,
  targetLabel: 'Pharos Corporate Liquidity Treasury',
  targetKind: 'WALLET',
  operationalContext: 'Primary institutional multi-asset reserve on Pharos Mainnet (Chain ID 1672)',
};

export const DEMO_PROTOCOL_PROFILE: DigestTargetProfile = {
  targetIdentifier: BENCHMARK_FAROSWAP_ROUTER,
  targetLabel: 'FaroSwap AMM Router v1',
  targetKind: 'PROTOCOL',
  operationalContext: 'Flagship constant-product automated market maker liquidity gateway',
};

export const DEMO_CURRENT_PERIOD: DigestAccountingPeriod = {
  periodLabel: 'Week 08 (Feb 16 - Feb 22, 2026)',
  startEpochMs: 1771200000000,
  endEpochMs: 1771804800000,
  startIso: '2026-02-16T00:00:00.000Z',
  endIso: '2026-02-22T23:59:59.000Z',
};

export const DEMO_BASELINE_PERIOD: DigestAccountingPeriod = {
  periodLabel: 'Week 07 (Feb 09 - Feb 15, 2026)',
  startEpochMs: 1770595200000,
  endEpochMs: 1771199999000,
  startIso: '2026-02-09T00:00:00.000Z',
  endIso: '2026-02-15T23:59:59.000Z',
};

export const BENCHMARK_TREASURY_TRANSACTIONS: RawHistoricalActivityRecord[] = [
  // Current Week (Week 08: Feb 16 - Feb 22)
  {
    transactionHash: '0xcccc000100000000000000000000000000000000000000000000000000000001',
    blockHeight: 1520100,
    timestampEpochMs: 1771300000000, // Feb 17
    senderAddress: '0x6000000000000000000000000000000000000001',
    recipientAddress: BENCHMARK_TREASURY_WALLET,
    nominalAssetAmount: '250000',
    assetSymbol: 'USDC',
    usdValuation: 250000,
    gasFeePros: 0.000072,
    plainDescription: 'Inbound liquidity recapitalization from Binance Custody Omnibus',
    isSuccessful: true,
    counterpartyLabel: 'Binance Custody Hot Wallet 4',
  },
  {
    transactionHash: '0xcccc000200000000000000000000000000000000000000000000000000000002',
    blockHeight: 1520300,
    timestampEpochMs: 1771400000000, // Feb 18
    senderAddress: BENCHMARK_TREASURY_WALLET,
    recipientAddress: '0x2000000000000000000000000000000000000002',
    nominalAssetAmount: '100000',
    assetSymbol: 'USDC',
    usdValuation: 100000,
    gasFeePros: 0.000153,
    actionMethodSelector: 'supplyCollateral',
    plainDescription: 'Collateral deposit into Harbor Lending Pool (WPROS / USDC)',
    isSuccessful: true,
    counterpartyLabel: 'Harbor Lending Pool',
  },
  {
    transactionHash: '0xcccc000300000000000000000000000000000000000000000000000000000003',
    blockHeight: 1520500,
    timestampEpochMs: 1771500000000, // Feb 19
    senderAddress: BENCHMARK_TREASURY_WALLET,
    recipientAddress: BENCHMARK_FAROSWAP_ROUTER,
    nominalAssetAmount: '50000',
    assetSymbol: 'USDC',
    usdValuation: 50000,
    gasFeePros: 0.000297,
    actionMethodSelector: 'swapExactTokensForTokens',
    plainDescription: 'Strategic AMM swap: exchanged 50,000 USDC for 33,333 PROS on FaroSwap',
    isSuccessful: true,
    counterpartyLabel: 'FaroSwap Router v1',
  },
  {
    transactionHash: '0xcccc000400000000000000000000000000000000000000000000000000000004',
    blockHeight: 1520700,
    timestampEpochMs: 1771600000000, // Feb 20
    senderAddress: BENCHMARK_TREASURY_WALLET,
    recipientAddress: '0x3000000000000000000000000000000000000001',
    nominalAssetAmount: '20000',
    assetSymbol: 'PROS',
    usdValuation: 30000,
    gasFeePros: 0.000245,
    actionMethodSelector: 'supply',
    plainDescription: 'Execution call to Morpho Blue Market reverted due to slippage ceiling',
    isSuccessful: false,
    counterpartyLabel: 'Morpho Blue Pharos Market',
  },
  {
    transactionHash: '0xcccc000500000000000000000000000000000000000000000000000000000005',
    blockHeight: 1520900,
    timestampEpochMs: 1771700000000, // Feb 21
    senderAddress: BENCHMARK_TREASURY_WALLET,
    recipientAddress: '0x4000000000000000000000000000000000000001',
    nominalAssetAmount: '15000',
    assetSymbol: 'PROS',
    usdValuation: 22500,
    gasFeePros: 0.000121,
    actionMethodSelector: 'delegate',
    plainDescription: 'Governance delegation to Pharos Foundation Staking Reserve',
    isSuccessful: true,
    counterpartyLabel: 'Pharos Foundation Staking Reserve',
  },

  // Baseline Week (Week 07: Feb 09 - Feb 15)
  {
    transactionHash: '0xbbbb000100000000000000000000000000000000000000000000000000000001',
    blockHeight: 1510100,
    timestampEpochMs: 1770700000000, // Feb 10
    senderAddress: '0x6000000000000000000000000000000000000001',
    recipientAddress: BENCHMARK_TREASURY_WALLET,
    nominalAssetAmount: '120000',
    assetSymbol: 'USDC',
    usdValuation: 120000,
    gasFeePros: 0.000072,
    plainDescription: 'Prior week inbound liquidity transfer',
    isSuccessful: true,
    counterpartyLabel: 'Binance Custody Hot Wallet 4',
  },
  {
    transactionHash: '0xbbbb000200000000000000000000000000000000000000000000000000000002',
    blockHeight: 1510300,
    timestampEpochMs: 1770900000000, // Feb 12
    senderAddress: BENCHMARK_TREASURY_WALLET,
    recipientAddress: '0x9999000011112222333344445555666677778888',
    nominalAssetAmount: '40000',
    assetSymbol: 'USDC',
    usdValuation: 40000,
    gasFeePros: 0.000068,
    plainDescription: 'Prior week operational disbursement',
    isSuccessful: true,
  },
  {
    transactionHash: '0xbbbb000300000000000000000000000000000000000000000000000000000003',
    blockHeight: 1510500,
    timestampEpochMs: 1771100000000, // Feb 14
    senderAddress: BENCHMARK_TREASURY_WALLET,
    recipientAddress: BENCHMARK_FAROSWAP_ROUTER,
    nominalAssetAmount: '30000',
    assetSymbol: 'USDC',
    usdValuation: 30000,
    gasFeePros: 0.000297,
    actionMethodSelector: 'swapExactTokensForTokens',
    plainDescription: 'Prior week FaroSwap DEX swap',
    isSuccessful: true,
  },
];
