export type FeedCurationStatus = 'ACTIVE' | 'PENDING_AUDIT' | 'SUSPENDED' | 'REVOKED';

export type FeedCategory = 'MONITORING' | 'SECURITY' | 'DEFI' | 'GOVERNANCE';

export interface IntelligenceFeed {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: FeedCategory;
  publisherAddress: string;
  publisherName: string;
  pricePerCallUsdc: number; // e.g. 0.001 USDC
  priceAtomicUnits: string; // "1000" (6 decimals)
  endpointPath: string;
  schemaHash: string;
  curationStatus: FeedCurationStatus;
  auditedBy?: string;
  totalCalls: number;
  grossRevenueUsdc: number;
  unsettledRevenueUsdc?: number;
  settledRevenueUsdc?: number;
  sampleQuery: string;
  sampleResponse: Record<string, unknown>;
  lastUpdated: string;
}

export interface CuratorAuditRecord {
  feedId: string;
  curatorAddress: string;
  decision: 'APPROVE' | 'REJECT' | 'REVOKE';
  reason: string;
  timestamp: string;
}
