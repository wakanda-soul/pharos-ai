import {
  LendingAssetMetadata,
  WatchdogThresholdConfig,
} from './types.js';

export const PHAROS_CHAIN_ID = 1672;
export const PHAROS_RPC_URL = 'https://rpc.pharos.xyz';
export const PHAROS_CHAINLINK_ORACLE = '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8' as `0x${string}`;

export const WPROS_ASSET: LendingAssetMetadata = {
  symbol: 'WPROS',
  name: 'Wrapped Pharos',
  address: '0x2077e62a046c3b88b4d8d1e2e7faad6bb06222b4',
  decimals: 18,
};

export const USDC_ASSET: LendingAssetMetadata = {
  symbol: 'USDC',
  name: 'USD Coin',
  address: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
  decimals: 6,
};

export const DEFAULT_WATCHDOG_CONFIG: WatchdogThresholdConfig = {
  warningHealthFactor: 1.30,
  criticalHealthFactor: 1.10,
  targetSafeHealthFactor: 1.50,
  minPollIntervalMs: 5000,
};
