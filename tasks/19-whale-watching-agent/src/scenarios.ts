/**
 * Realistic Whale Flow Scenarios on Pharos Network.
 * Demonstrates DEX routing, lending collateral provisioning, CEX inflows,
 * peer-whale OTC shifts, token burns, and sub-threshold filtering.
 */

import { type Address } from 'viem';
import { type WhaleRawTransferPayload } from './types.js';
import { DEFAULT_WATCHED_WHALES } from './whale-engine.js';

export interface DemoWhaleScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly payload: WhaleRawTransferPayload;
  readonly expectAlert: boolean;
}

export const WHALE_DEMO_SCENARIOS: readonly DemoWhaleScenario[] = [
  {
    id: 'scenario-dex-faroswap',
    title: 'DEX AMM Capital Injection',
    description: 'Pharos Genesis Whale Alpha moves 150,000 USDC into FaroSwap Router v1 to execute a large spot swap',
    expectAlert: true,
    payload: {
      txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeee0001',
      blockNumber: 1542001n,
      blockTimestamp: Math.floor(Date.now() / 1000) - 180,
      fromAddress: DEFAULT_WATCHED_WHALES[0].address,
      toAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap Router
      tokenSymbol: 'USDC',
      rawValue: 150_000n * 10n ** 6n, // 150k USDC
    },
  },
  {
    id: 'scenario-lending-harbor',
    title: 'DeFi Collateral Deepening',
    description: 'Harbor Early Liquidity Provider supplies 80,000 WPROS into Harbor Lending Market to strengthen collateral ratios',
    expectAlert: true,
    payload: {
      txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeee0002',
      blockNumber: 1542015n,
      blockTimestamp: Math.floor(Date.now() / 1000) - 120,
      fromAddress: DEFAULT_WATCHED_WHALES[1].address,
      toAddress: '0x2000000000000000000000000000000000000002' as Address, // Harbor Pool
      tokenSymbol: 'WPROS',
      rawValue: 80_000n * 10n ** 18n, // 80k WPROS ($120k USD)
    },
  },
  {
    id: 'scenario-cex-binance',
    title: 'Centralized Exchange Liquidation Prep',
    description: 'FaroSwap Dominant Arbitrageur transfers 95,000 USDT to Binance Custody Hot Wallet 4',
    expectAlert: true,
    payload: {
      txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeee0003',
      blockNumber: 1542028n,
      blockTimestamp: Math.floor(Date.now() / 1000) - 90,
      fromAddress: DEFAULT_WATCHED_WHALES[2].address,
      toAddress: '0x6000000000000000000000000000000000000001' as Address, // Binance Hot Wallet
      tokenSymbol: 'USDT',
      rawValue: 95_000n * 10n ** 6n, // 95k USDT
    },
  },
  {
    id: 'scenario-inter-whale-otc',
    title: 'Inter-Whale Strategic Settlement',
    description: 'Morpho Collateral Vault Depositor transfers 110,000 USDC directly to Harbor Early Liquidity Provider',
    expectAlert: true,
    payload: {
      txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeee0004',
      blockNumber: 1542042n,
      blockTimestamp: Math.floor(Date.now() / 1000) - 45,
      fromAddress: DEFAULT_WATCHED_WHALES[3].address,
      toAddress: DEFAULT_WATCHED_WHALES[1].address, // Peer whale
      tokenSymbol: 'USDC',
      rawValue: 110_000n * 10n ** 6n, // 110k USDC
    },
  },
  {
    id: 'scenario-token-burn',
    title: 'Permanent Treasury Supply Deflation',
    description: 'Pharos Genesis Whale Alpha permanently burns 40,000 PROS to dead burn address',
    expectAlert: true,
    payload: {
      txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeee0005',
      blockNumber: 1542055n,
      blockTimestamp: Math.floor(Date.now() / 1000) - 15,
      fromAddress: DEFAULT_WATCHED_WHALES[0].address,
      toAddress: '0x000000000000000000000000000000000000dEaD' as Address, // Dead burn
      tokenSymbol: 'PROS',
      rawValue: 40_000n * 10n ** 18n, // 40k PROS ($60k USD)
    },
  },
  {
    id: 'scenario-petty-noise',
    title: 'Sub-Threshold Background Transfer',
    description: 'Arbitrageur transfers 3,200 USDC ($3,200 USD) - filtered out below the $50k threshold',
    expectAlert: false,
    payload: {
      txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeee0006',
      blockNumber: 1542060n,
      blockTimestamp: Math.floor(Date.now() / 1000) - 5,
      fromAddress: DEFAULT_WATCHED_WHALES[2].address,
      toAddress: '0x1000000000000000000000000000000000000001' as Address,
      tokenSymbol: 'USDC',
      rawValue: 3_200n * 10n ** 6n, // $3.2k USDC
    },
  },
];
