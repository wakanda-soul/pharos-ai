/**
 * Verified Token Profiles & Valuation Computations for Pharos Network.
 * Normalizes on-chain token precision (e.g. 6 decimals for USDC vs 18 for PROS)
 * and calculates reliable USD estimates for significance checks.
 */

import { type Address, formatUnits } from 'viem';
import { type TokenAssetProfile } from './types.js';

export const VERIFIED_PHAROS_TOKENS: Record<string, TokenAssetProfile> = {
  PROS: {
    symbol: 'PROS',
    name: 'Pharos Native Token',
    decimals: 18,
    fallbackUsdPrice: 1.5, // Reference market quote
  },
  WPROS: {
    symbol: 'WPROS',
    name: 'Wrapped PROS',
    decimals: 18,
    contractAddress: '0x0000000000000000000000000000000000000003' as Address,
    fallbackUsdPrice: 1.5,
  },
  USDC: {
    symbol: 'USDC',
    name: 'Bridged USD Coin',
    decimals: 6,
    contractAddress: '0xc879c018db60520f4355c26ed1a6d572cdac1815' as Address,
    fallbackUsdPrice: 1.0,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x1111111111111111111111111111111111111111' as Address,
    fallbackUsdPrice: 1.0,
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
    contractAddress: '0x2222222222222222222222222222222222222222' as Address,
    fallbackUsdPrice: 2500.0,
  },
};

/**
 * Resolves a token profile by symbol (case-insensitive) or contract address.
 * Defaults to a generic 18-decimal token with zero price if unrecognized.
 */
export function resolveTokenProfile(identifier: string): TokenAssetProfile {
  const normalizedKey = identifier.trim().toUpperCase();
  if (VERIFIED_PHAROS_TOKENS[normalizedKey]) {
    return VERIFIED_PHAROS_TOKENS[normalizedKey];
  }

  // Look up by contract address
  const byAddress = Object.values(VERIFIED_PHAROS_TOKENS).find(
    (profile) => profile.contractAddress?.toLowerCase() === identifier.toLowerCase(),
  );
  if (byAddress) {
    return byAddress;
  }

  // Fallback for custom or unindexed token
  return {
    symbol: normalizedKey.slice(0, 8),
    name: `Custom Token (${identifier.slice(0, 8)})`,
    decimals: 18,
    fallbackUsdPrice: 0.0,
  };
}

/**
 * Formats a raw token amount in base units into human-readable string with comma separators.
 */
export function formatTokenBaseUnits(amount: bigint, decimals: number): string {
  const formatted = formatUnits(amount, decimals);
  const [integerPart, fractionalPart] = formatted.split('.');

  // Humanize integer digits with thousands grouping
  const integerWithCommas = (integerPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (!fractionalPart || fractionalPart === '0') {
    return integerWithCommas;
  }

  // Trim excessive fractional noise beyond 4 decimals for high-precision tokens
  const trimmedFraction = fractionalPart.slice(0, 4);
  return `${integerWithCommas}.${trimmedFraction}`;
}

/**
 * Calculates nominal USD valuation based on token balance units and oracle/reference price.
 */
export function computeUsdValuation(amount: bigint, tokenProfile: TokenAssetProfile): number {
  if (tokenProfile.fallbackUsdPrice <= 0 || amount <= 0n) {
    return 0;
  }

  const normalizedFloat = Number(formatUnits(amount, tokenProfile.decimals));
  return Math.round(normalizedFloat * tokenProfile.fallbackUsdPrice * 100) / 100;
}
