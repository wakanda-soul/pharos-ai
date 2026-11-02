/**
 * Token catalog for Pharos Mainnet (Chain ID 1672).
 * Maps recognized currency tickers to verified smart contract addresses.
 */

export interface TokenSettlementAsset {
  readonly symbol: string;
  readonly name: string;
  readonly contractAddress?: `0x${string}`;
  readonly decimals: number;
  readonly isNativeAsset: boolean;
}

export const PHAROS_SETTLEMENT_TOKENS: Record<string, TokenSettlementAsset> = {
  PROS: {
    symbol: 'PROS',
    name: 'Pharos Native Utility Coin',
    decimals: 18,
    isNativeAsset: true,
  },
  USDC: {
    symbol: 'USDC',
    name: 'Pharos Native USD Coin',
    contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
    decimals: 6,
    isNativeAsset: false,
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink Token',
    contractAddress: '0x51e233d6dc220bcbe02330f81d1136b69fd571dc',
    decimals: 18,
    isNativeAsset: false,
  },
  WPROS: {
    symbol: 'WPROS',
    name: 'Wrapped PROS',
    contractAddress: '0x2077e62a046c3b88b4d8d1e2e7faad6bb06222b4',
    decimals: 18,
    isNativeAsset: false,
  },
};

// Aliases mapping common currency inputs (e.g. USD, $ -> USDC)
export const CURRENCY_CANONICAL_MAP: Record<string, string> = {
  USD: 'USDC',
  USDC: 'USDC',
  'USD COIN': 'USDC',
  PROS: 'PROS',
  PHAROS: 'PROS',
  LINK: 'LINK',
  WPROS: 'WPROS',
};

export function resolveTokenAsset(rawCurrencyInput?: string): TokenSettlementAsset | undefined {
  if (!rawCurrencyInput) return undefined;
  const sanitizedTicker = rawCurrencyInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const canonicalSymbol = CURRENCY_CANONICAL_MAP[sanitizedTicker];
  if (!canonicalSymbol) return undefined;
  return PHAROS_SETTLEMENT_TOKENS[canonicalSymbol];
}
