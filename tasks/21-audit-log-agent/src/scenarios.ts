/**
 * Benchmark Ledger Data & Historical Scenarios for Pharos Audit-Log Agent.
 * Simulates real-world DeFi treasury activity on Pharos Mainnet.
 */

import { type Address, parseEther } from 'viem';
import { type RawTransactionRecord } from './types.js';

export const DEMO_AUDITED_WALLET: Address = '0x71C80000000000000000000000000000000071C8';

export const BENCHMARK_AUDIT_TRANSACTIONS: readonly RawTransactionRecord[] = [
  // 1. Feb 2, 2026: Transfer In - 25,000 USDC from Binance Hot Wallet
  {
    txHash: '0xbbbb000100000000000000000000000000000000000000000000000000000001',
    blockNumber: 1510100n,
    blockTimestamp: 1770028800, // 2026-02-02T10:40:00Z
    fromAddress: '0x6000000000000000000000000000000000000001' as Address, // Binance
    toAddress: DEMO_AUDITED_WALLET,
    valueWei: 0n,
    gasUsed: 48000n,
    gasPriceGwei: 1.5,
    isSuccess: true,
    tokenTransfers: [
      {
        tokenSymbol: 'USDC',
        contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
        fromAddress: '0x6000000000000000000000000000000000000001' as Address,
        toAddress: DEMO_AUDITED_WALLET,
        rawAmount: 25_000n * 10n ** 6n, // 25,000 USDC ($25k - Notable)
        decimals: 6,
      },
    ],
  },
  // 2. Feb 5, 2026: Token Approval - Unlimited allowance to FaroSwap Router
  {
    txHash: '0xbbbb000200000000000000000000000000000000000000000000000000000002',
    blockNumber: 1510250n,
    blockTimestamp: 1770288000, // 2026-02-05T10:40:00Z
    fromAddress: DEMO_AUDITED_WALLET,
    toAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
    valueWei: 0n,
    gasUsed: 36000n,
    gasPriceGwei: 1.5,
    isSuccess: true,
    functionMethodName: 'approve',
    tokenApprovals: [
      {
        tokenSymbol: 'USDC',
        contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
        ownerAddress: DEMO_AUDITED_WALLET,
        spenderAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap Router
        rawAllowance: 2n ** 256n - 1n,
        isUnlimited: true,
      },
    ],
  },
  // 3. Feb 9, 2026: DEX Swap - Swapped 15,000 USDC for 10,000 PROS on FaroSwap
  {
    txHash: '0xbbbb000300000000000000000000000000000000000000000000000000000003',
    blockNumber: 1510400n,
    blockTimestamp: 1770633600, // 2026-02-09T10:40:00Z
    fromAddress: DEMO_AUDITED_WALLET,
    toAddress: '0x1000000000000000000000000000000000000001' as Address, // FaroSwap Router
    valueWei: 0n,
    gasUsed: 135000n,
    gasPriceGwei: 2.2,
    isSuccess: true,
    functionMethodName: 'swapExactTokensForTokens',
    tokenTransfers: [
      {
        tokenSymbol: 'USDC',
        contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
        fromAddress: DEMO_AUDITED_WALLET,
        toAddress: '0x1000000000000000000000000000000000000001' as Address,
        rawAmount: 15_000n * 10n ** 6n,
        decimals: 6,
      },
      {
        tokenSymbol: 'PROS',
        contractAddress: '0x0000000000000000000000000000000000000003' as Address,
        fromAddress: '0x1000000000000000000000000000000000000001' as Address,
        toAddress: DEMO_AUDITED_WALLET,
        rawAmount: 10_000n * 10n ** 18n,
        decimals: 18,
      },
    ],
  },
  // 4. Feb 14, 2026: Contract Interaction - Collateral deposit into Harbor Lending Pool
  {
    txHash: '0xbbbb000400000000000000000000000000000000000000000000000000000004',
    blockNumber: 1510600n,
    blockTimestamp: 1771065600, // 2026-02-14T10:40:00Z
    fromAddress: DEMO_AUDITED_WALLET,
    toAddress: '0x2000000000000000000000000000000000000002' as Address, // Harbor Pool
    valueWei: parseEther('6000'), // 6,000 PROS ($9,000 USD)
    gasUsed: 85000n,
    gasPriceGwei: 1.8,
    functionMethodName: 'supplyCollateral',
    isSuccess: true,
  },
  // 5. Feb 18, 2026: Transfer Out - Dispatched 3,000 USDC to contractor address
  {
    txHash: '0xbbbb000500000000000000000000000000000000000000000000000000000005',
    blockNumber: 1510800n,
    blockTimestamp: 1771411200, // 2026-02-18T10:40:00Z
    fromAddress: DEMO_AUDITED_WALLET,
    toAddress: '0x9999000011112222333344445555666677778888' as Address,
    valueWei: 0n,
    gasUsed: 45000n,
    gasPriceGwei: 1.5,
    isSuccess: true,
    tokenTransfers: [
      {
        tokenSymbol: 'USDC',
        contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
        fromAddress: DEMO_AUDITED_WALLET,
        toAddress: '0x9999000011112222333344445555666677778888' as Address,
        rawAmount: 3_000n * 10n ** 6n,
        decimals: 6,
      },
    ],
  },
  // 6. Feb 22, 2026: Contract Interaction (Reverted) - Failed flash borrow
  {
    txHash: '0xbbbb000600000000000000000000000000000000000000000000000000000006',
    blockNumber: 1511000n,
    blockTimestamp: 1771756800, // 2026-02-22T10:40:00Z
    fromAddress: DEMO_AUDITED_WALLET,
    toAddress: '0x3000000000000000000000000000000000000001' as Address, // Morpho Blue
    valueWei: 0n,
    gasUsed: 95000n,
    gasPriceGwei: 2.5,
    functionMethodName: 'borrow',
    isSuccess: false, // Reverted
  },
  // 7. OUTSIDE RANGE: Jan 5, 2026 (Exempt from Feb audit)
  {
    txHash: '0xbbbb000700000000000000000000000000000000000000000000000000000007',
    blockNumber: 1475000n,
    blockTimestamp: 1767609600, // 2026-01-05T10:40:00Z
    fromAddress: DEMO_AUDITED_WALLET,
    toAddress: '0x9999000011112222333344445555666677778888' as Address,
    valueWei: parseEther('100'),
    gasUsed: 21000n,
    gasPriceGwei: 1.5,
    isSuccess: true,
  },
];
