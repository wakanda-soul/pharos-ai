/**
 * Counterparty Label Registry & Explorer URL Builder for Pharos Network (Chain ID 1672).
 * Annotates hex addresses with human-readable entity labels for audit reports
 * and generates official Pharosscan transaction links.
 */

import { type Address, getAddress } from 'viem';

export const KNOWN_PHAROS_ENTITIES: Record<string, { label: string; role: string }> = {
  '0x1000000000000000000000000000000000000001': {
    label: 'FaroSwap Router v1',
    role: 'Automated Market Maker (DEX)',
  },
  '0x1000000000000000000000000000000000000002': {
    label: 'FaroSwap Factory v1',
    role: 'AMM Pair Factory',
  },
  '0x2000000000000000000000000000000000000001': {
    label: 'Harbor Protocol Treasury',
    role: 'Protocol Yield & Fee Reserve',
  },
  '0x2000000000000000000000000000000000000002': {
    label: 'Harbor Lending Pool (WPROS / USDC)',
    role: 'Collateralized Lending Market',
  },
  '0x3000000000000000000000000000000000000001': {
    label: 'Morpho Blue Pharos Market',
    role: 'Permissionless Lending Engine',
  },
  '0x4000000000000000000000000000000000000001': {
    label: 'Pharos Foundation Staking Reserve',
    role: 'Validator Delegation Contract',
  },
  '0x5000000000000000000000000000000000000001': {
    label: 'Pharos Canonical Bridge Custody',
    role: 'Cross-Chain Bridge Gateway',
  },
  '0x6000000000000000000000000000000000000001': {
    label: 'Binance Custody Hot Wallet 4',
    role: 'Centralized Exchange Omnibus Account',
  },
  '0x0000000000000000000000000000000000000000': {
    label: 'Null Genesis / Burn Address (0x0)',
    role: 'System Null Address',
  },
  '0x000000000000000000000000000000000000dead': {
    label: 'Dead Burn Address (0xdEaD)',
    role: 'Deflationary Burn Recipient',
  },
};

/**
 * Resolves an on-chain address into an accounting-friendly counterparty label.
 */
export function resolveAuditCounterparty(rawAddress: string): { label: string; role?: string } {
  let normalized: string;
  try {
    normalized = getAddress(rawAddress).toLowerCase();
  } catch {
    normalized = rawAddress.toLowerCase();
  }

  const match = KNOWN_PHAROS_ENTITIES[normalized];
  if (match) {
    return { label: match.label, role: match.role };
  }

  // Gracefully truncate unknown external counterparty
  const shortHex = `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  return { label: `External Account (${shortHex})` };
}

/**
 * Builds the canonical Pharosscan transaction URL.
 */
export function buildPharosExplorerUrl(txHash: string): string {
  return `https://pharosscan.xyz/tx/${txHash}`;
}
