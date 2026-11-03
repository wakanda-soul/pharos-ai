/**
 * Domain types and schema models for the Pharos Weekly Digest Agent.
 * Tracks periodic activity summaries for wallets and protocols, comparative metrics,
 * top-3 notable events, cron recurrence schedules, and multi-channel publication targets.
 */

import type { Address } from 'viem';

export type DigestTargetKind = 'WALLET' | 'PROTOCOL';

export interface DigestTargetProfile {
  targetIdentifier: Address | string;
  targetLabel: string;
  targetKind: DigestTargetKind;
  operationalContext: string;
}

export interface DigestAccountingPeriod {
  periodLabel: string;
  startEpochMs: number;
  endEpochMs: number;
  startIso: string;
  endIso: string;
}

export type MetricTrendDirection = 'SURGE' | 'CLIMB' | 'STABLE' | 'DECLINE' | 'PLUMMET';

export interface ComparativeMetricGauge {
  metricName: string;
  currentPeriodQuantity: number;
  baselinePeriodQuantity: number;
  absoluteDifference: number;
  percentageChangeRate: number; // e.g. +34.2% or -12.5%
  trendDirection: MetricTrendDirection;
  formattedCurrentValue: string;
  formattedBaselineValue: string;
  humanNarrativeInsight: string;
}

export interface DigestMetricsPackage {
  totalTurnoverUsd: ComparativeMetricGauge;
  transactionCount: ComparativeMetricGauge;
  inboundCapitalUsd: ComparativeMetricGauge;
  outboundCapitalUsd: ComparativeMetricGauge;
  netCashflowDeltaUsd: ComparativeMetricGauge;
  gasFeesExpendedPros: ComparativeMetricGauge;
  uniqueCounterpartiesEngaged: ComparativeMetricGauge;
}

export type NotableEventRank = 1 | 2 | 3;

export type NotableEventCategory =
  | 'LARGE_TRANSFER'
  | 'LIQUIDITY_DEPLOYMENT'
  | 'DEX_ARBITRAGE_SWAP'
  | 'PROTOCOL_GOVERNANCE'
  | 'SECURITY_INCIDENT'
  | 'TREASURY_DISBURSEMENT';

export interface NotableEventHighlight {
  rank: NotableEventRank;
  headline: string;
  category: NotableEventCategory;
  transactionHash: `0x${string}`;
  blockHeight: number;
  timestampIso: string;
  notionalValuationUsd: number;
  pharosscanExplorerUrl: string;
  impactAnalysis: string;
}

export type ScheduleRecurrenceCadence = 'WEEKLY' | 'BIWEEKLY' | 'DAILY' | 'HOURLY_TEST';

export interface DigestScheduleProfile {
  scheduleIdentifier: string;
  cadence: ScheduleRecurrenceCadence;
  cronExpression: string; // e.g., "0 9 * * 1" for Monday 09:00 UTC
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  executionHourUtc: number;
  isEnabled: boolean;
  targetEntities: DigestTargetProfile[];
  preferredDeliveryChannels: DeliveryChannelKind[];
}

export type DeliveryChannelKind = 'TELEGRAM' | 'DISCORD' | 'EMAIL' | 'PUBLISHED_PAGE';

export interface DeliveryStatusReport {
  channel: DeliveryChannelKind;
  isDispatched: boolean;
  destinationTarget: string;
  dispatchTimestampIso: string;
  deliveryMetadata?: Record<string, unknown>;
}

export interface RawHistoricalActivityRecord {
  transactionHash: `0x${string}`;
  blockHeight: number;
  timestampEpochMs: number;
  senderAddress: Address;
  recipientAddress: Address;
  nominalAssetAmount: string;
  assetSymbol: string;
  usdValuation: number;
  gasFeePros: number;
  actionMethodSelector?: string;
  plainDescription: string;
  isSuccessful: boolean;
  counterpartyLabel?: string;
}

export interface WeeklyDigestReport {
  digestId: string;
  generatedAtIso: string;
  targetProfile: DigestTargetProfile;
  currentPeriod: DigestAccountingPeriod;
  baselinePeriod: DigestAccountingPeriod;
  metricsComparison: DigestMetricsPackage;
  topNotableEvents: [NotableEventHighlight, NotableEventHighlight, NotableEventHighlight];
  executiveDigestSummary: string;
  recommendationsAndActionItems: string[];
  deliveryDispatches: DeliveryStatusReport[];
}
