/**
 * Threat Intelligence & Malicious Address Directory for Pharos Network.
 * Maintains curated lists of known drainers, exploiters, mixers,
 * and verified high-trust contracts to cross-reference counterparty risks.
 */

import { type Address, getAddress } from 'viem';
import { type FlaggedEntityRecord } from './types.js';

export const KNOWN_FLAGGED_THREAT_ENTITIES: readonly FlaggedEntityRecord[] = [
  {
    address: '0x9999000000000000000000000000000000006666' as Address,
    entityName: 'Pharos Permit2 Drainer Syndicate',
    threatCategory: 'PHISHING_DRAINER',
    dateIdentifiedIso: '2026-02-14T12:00:00Z',
    referenceNoticeUrl: 'https://security.pharos.xyz/alerts/pharos-drainer-01',
  },
  {
    address: '0x8888000000000000000000000000000000007777' as Address,
    entityName: 'Harbor Protocol Flash-Loan Exploiter Wallet',
    threatCategory: 'EXPLOITER',
    dateIdentifiedIso: '2026-01-20T08:30:00Z',
  },
  {
    address: '0x7777000000000000000000000000000000008888' as Address,
    entityName: 'Sanctioned Anonymity Tumbler Gateway',
    threatCategory: 'MIXER_TUMBLER',
    dateIdentifiedIso: '2026-02-01T00:00:00Z',
  },
  {
    address: '0x6666000000000000000000000000000000009999' as Address,
    entityName: 'Fake PROS Token Honeypot Deployer',
    threatCategory: 'FAKED_TOKEN_IMPERSONATOR',
    dateIdentifiedIso: '2026-03-01T15:00:00Z',
  },
];

export class ThreatIntelligenceRegistry {
  private readonly threatMap = new Map<string, FlaggedEntityRecord>();

  constructor(initialThreats: readonly FlaggedEntityRecord[] = KNOWN_FLAGGED_THREAT_ENTITIES) {
    for (const record of initialThreats) {
      this.registerThreat(record);
    }
  }

  public registerThreat(record: FlaggedEntityRecord): void {
    const checksummed = getAddress(record.address);
    this.threatMap.set(checksummed.toLowerCase(), {
      ...record,
      address: checksummed,
    });
  }

  public isFlaggedAddress(rawAddress: string): boolean {
    return this.threatMap.has(rawAddress.toLowerCase());
  }

  public lookupThreat(rawAddress: string): FlaggedEntityRecord | undefined {
    return this.threatMap.get(rawAddress.toLowerCase());
  }

  public get totalThreatCount(): number {
    return this.threatMap.size;
  }
}

export const defaultThreatRegistry = new ThreatIntelligenceRegistry();
