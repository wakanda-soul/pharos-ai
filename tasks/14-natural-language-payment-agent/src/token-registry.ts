import { TokenInfo } from './types.js';

export const PHAROS_TOKENS: Record<string, TokenInfo> = {
  PROS: {
    symbol: 'PROS',
    name: 'Pharos Native Coin',
    address: 'NATIVE',
    decimals: 18,
    isNative: true,
  },
  USDC: {
    symbol: 'USDC',
    name: 'Pharos Native USD Coin',
    address: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
    decimals: 6,
    isNative: false,
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink Token',
    address: '0x51e2A24742Db77604B881d6781Ee16B5b8fcBE29',
    decimals: 18,
    isNative: false,
  },
};

const TOKEN_SYNONYMS: Record<string, string> = {
  'pros': 'PROS',
  'pharos': 'PROS',
  'eth': 'PROS', // Common user generalization on EVM L1/L2
  'usdc': 'USDC',
  'usd': 'USDC',
  'dollar': 'USDC',
  'dollars': 'USDC',
  'bucks': 'USDC',
  'link': 'LINK',
  'chainlink': 'LINK',
};

export class PharosTokenRegistry {
  private customTokens: Map<string, TokenInfo> = new Map();

  constructor() {
    for (const [k, v] of Object.entries(PHAROS_TOKENS)) {
      this.customTokens.set(k.toUpperCase(), v);
    }
  }

  resolveToken(symbolOrAlias: string): TokenInfo | undefined {
    const clean = symbolOrAlias.trim().toLowerCase();

    // Check direct synonyms
    if (TOKEN_SYNONYMS[clean]) {
      const canonical = TOKEN_SYNONYMS[clean];
      return this.customTokens.get(canonical);
    }

    // Check direct uppercase match
    const upper = clean.toUpperCase();
    if (this.customTokens.has(upper)) {
      return this.customTokens.get(upper);
    }

    return undefined;
  }

  registerToken(token: TokenInfo): void {
    this.customTokens.set(token.symbol.toUpperCase(), token);
  }

  getAllTokens(): TokenInfo[] {
    return Array.from(this.customTokens.values());
  }
}
