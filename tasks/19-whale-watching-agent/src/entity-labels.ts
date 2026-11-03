/**
 * Entity Directory & Counterparty Label Registry for Pharos Ecosystem.
 * Associates raw hex addresses with verified dApps, vaults, CEX gateways, and protocols
 * so raw whale moves turn into actionable market intelligence.
 */

import { type Address, getAddress } from 'viem';
import { type CounterpartyEntityCategory, type EntityDirectoryEntry } from './types.js';

// Pre-seeded directory of prominent Pharos ecosystem protocols and liquidity hubs
const CANONICAL_PHAROS_ENTITIES: readonly EntityDirectoryEntry[] = [
  {
    address: '0x1000000000000000000000000000000000000001' as Address,
    canonicalLabel: 'FaroSwap Router v1',
    category: 'DEX',
    description: 'Primary automated market maker router for Pharos Mainnet',
    websiteOrDocs: 'https://docs.pharos.xyz/faroswap',
  },
  {
    address: '0x1000000000000000000000000000000000000002' as Address,
    canonicalLabel: 'FaroSwap Factory v1',
    category: 'DEX',
    description: 'Pool factory managing liquidity pair deployments',
  },
  {
    address: '0x2000000000000000000000000000000000000001' as Address,
    canonicalLabel: 'Harbor Protocol Treasury',
    category: 'TREASURY',
    description: 'Autonomous protocol reserve and fee accumulation vault',
    websiteOrDocs: 'https://harbor.fi',
  },
  {
    address: '0x2000000000000000000000000000000000000002' as Address,
    canonicalLabel: 'Harbor Lending Pool (WPROS / USDC)',
    category: 'LENDING',
    description: 'Isolated collateralized debt market on Pharos',
  },
  {
    address: '0x3000000000000000000000000000000000000001' as Address,
    canonicalLabel: 'Morpho Blue Pharos Market',
    category: 'LENDING',
    description: 'Permissionless lending engine with external oracle feeds',
  },
  {
    address: '0x4000000000000000000000000000000000000001' as Address,
    canonicalLabel: 'Pharos Foundation Staking Reserve',
    category: 'STAKING',
    description: 'Validator staking and delegation rewards contract',
  },
  {
    address: '0x5000000000000000000000000000000000000001' as Address,
    canonicalLabel: 'Pharos Canonical Bridge Custody',
    category: 'BRIDGE',
    description: 'Multi-sig gateway bridging assets to Ethereum L1',
  },
  {
    address: '0x6000000000000000000000000000000000000001' as Address,
    canonicalLabel: 'Binance Custody Hot Wallet 4',
    category: 'CEX',
    description: 'Centralized exchange deposit/withdrawal gateway',
  },
  {
    address: '0x6000000000000000000000000000000000000002' as Address,
    canonicalLabel: 'OKX Settlement Hot Wallet 2',
    category: 'CEX',
    description: 'Institutional exchange omnibus clearing account',
  },
  {
    address: '0x0000000000000000000000000000000000000000' as Address,
    canonicalLabel: 'Null Burn Address (0x0)',
    category: 'SYSTEM_NULL',
    description: 'Unrecoverable burn or genesis issuance address',
  },
  {
    address: '0x000000000000000000000000000000000000dEaD' as Address,
    canonicalLabel: 'Dead Burn Address (0xdEaD)',
    category: 'SYSTEM_NULL',
    description: 'Standard token burn recipient',
  },
];

export class EntityDirectoryRegistry {
  private readonly entityStore = new Map<string, EntityDirectoryEntry>();

  constructor(initialEntries: readonly EntityDirectoryEntry[] = CANONICAL_PHAROS_ENTITIES) {
    for (const entry of initialEntries) {
      this.registerEntity(entry);
    }
  }

  /**
   * Registers or updates a known protocol address in the directory.
   * Addresses are strictly normalized to checksummed lowercase keys for lookup.
   */
  public registerEntity(entry: EntityDirectoryEntry): void {
    const normalizedKey = entry.address.toLowerCase();
    this.entityStore.set(normalizedKey, {
      ...entry,
      address: getAddress(entry.address),
    });
  }

  /**
   * Resolves a raw counterparty address into a verified protocol entity.
   * Falls back gracefully to shortened hex label when the address is uncataloged.
   */
  public resolveCounterparty(rawAddress: string): EntityDirectoryEntry {
    let normalizedAddress: Address;
    try {
      normalizedAddress = getAddress(rawAddress);
    } catch {
      // In case an unpadded or distorted hex string is passed
      normalizedAddress = rawAddress as Address;
    }

    const key = normalizedAddress.toLowerCase();
    const existing = this.entityStore.get(key);
    if (existing) {
      return existing;
    }

    // Unregistered counterparty - return formatted short label
    const shortLabel = `Unlabeled (${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)})`;
    return {
      address: normalizedAddress,
      canonicalLabel: shortLabel,
      category: 'UNKNOWN',
      description: 'Unindexed external account or unverified contract',
    };
  }

  /**
   * Returns total registered entities for telemetry and diagnostics
   */
  public get registeredEntityCount(): number {
    return this.entityStore.size;
  }
}

/** Global default registry instance for convenient agent reuse */
export const defaultEntityRegistry = new EntityDirectoryRegistry();
