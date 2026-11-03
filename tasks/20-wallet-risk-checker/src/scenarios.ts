/**
 * Benchmark Risk Profiles on Pharos Network.
 * Demonstrates Requirement 04: Evaluates clean vs risky vs cautionary accounts.
 */

import { type Address } from 'viem';
import { type OnChainAccountProfile } from './types.js';

export interface RiskDemoScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly expectedLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly profile: OnChainAccountProfile;
}

export const RISK_DEMO_SCENARIOS: readonly RiskDemoScenario[] = [
  {
    id: 'clean-faroswap-router',
    title: 'Clean Verified Protocol: FaroSwap Router v1',
    description: 'Battle-tested AMM router on Pharos Mainnet. 90+ days in production, verified Solidity source, zero blacklist associations.',
    expectedLevel: 'LOW',
    profile: {
      targetAddress: '0x1000000000000000000000000000000000000001' as Address,
      accountType: 'SMART_CONTRACT',
      firstSeenBlockNumber: 1200000n,
      firstSeenTimestampIso: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
      accountAgeHours: 2160, // 90 days
      transactionCount: 48500,
      nativeBalanceEther: '35.5',
      hasBytecode: true,
      isSourceCodeVerified: true,
      flaggedInteractionsCount: 0,
      highRiskAllowancesCount: 0,
    },
  },
  {
    id: 'risky-honeypot-drainer',
    title: 'High-Risk Malicious Contract: Phishing Honeypot',
    description: 'Brand new unverified contract deployed 1.2 hours ago. Funded directly by Pharos Permit2 Drainer Syndicate with active tainted approvals.',
    expectedLevel: 'HIGH',
    profile: {
      targetAddress: '0xBad0000000000000000000000000000000000bad' as Address,
      accountType: 'SMART_CONTRACT',
      firstSeenBlockNumber: 1542100n,
      firstSeenTimestampIso: new Date(Date.now() - 1.2 * 3600 * 1000).toISOString(),
      accountAgeHours: 1.2, // 72 minutes old
      transactionCount: 2,
      nativeBalanceEther: '0.05',
      hasBytecode: true,
      isSourceCodeVerified: false, // Unverified
      fundingSourceAddress: '0x9999000000000000000000000000000000006666' as Address, // Drainer syndicate
      flaggedInteractionsCount: 3,
      highRiskAllowancesCount: 2,
    },
  },
  {
    id: 'cautionary-burner-wallet',
    title: 'Medium-Risk Active Burner: Disposable EOA',
    description: 'Freshly created wallet (< 12 hours old) with low activity and dangling unlimited token approvals to third-party spenders.',
    expectedLevel: 'MEDIUM',
    profile: {
      targetAddress: '0xCAFE00000000000000000000000000000000cafe' as Address,
      accountType: 'EOA',
      firstSeenBlockNumber: 1541800n,
      firstSeenTimestampIso: new Date(Date.now() - 4.5 * 3600 * 1000).toISOString(),
      accountAgeHours: 4.5,
      transactionCount: 1,
      nativeBalanceEther: '1.2',
      hasBytecode: false,
      isSourceCodeVerified: true,
      flaggedInteractionsCount: 0,
      highRiskAllowancesCount: 1, // 1 dangerous approval
    },
  },
  {
    id: 'uninitialized-payment-recipient',
    title: 'Informational Zero-Nonce: First-Time Recipient',
    description: 'Brand-new keypair receiving its first on-chain transfer. Zero historical nonce, clean posture.',
    expectedLevel: 'LOW',
    profile: {
      targetAddress: '0x0000111122223333444455556666777788889999' as Address,
      accountType: 'UNINITIALIZED_ZERO_NONCE',
      firstSeenBlockNumber: 1542200n,
      firstSeenTimestampIso: new Date().toISOString(),
      accountAgeHours: 0,
      transactionCount: 0,
      nativeBalanceEther: '0.0',
      hasBytecode: false,
      isSourceCodeVerified: true,
      flaggedInteractionsCount: 0,
      highRiskAllowancesCount: 0,
    },
  },
];
