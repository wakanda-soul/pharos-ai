/**
 * Activity Summary Aggregator for Pharos Whale-Watching Agent.
 * Consolidates high-volume capital flow events across all watched accounts,
 * computes protocol destination market share, and pinpoints top mover whales.
 */

import {
  type CounterpartyEntityCategory,
  type ProtocolVolumeShare,
  type WhaleActivityDigest,
  type WhaleCapitalFlowEvent,
} from './types.js';
import { WhaleWatchingEngine } from './whale-engine.js';

export function synthesizeActivityDigest(
  engine: WhaleWatchingEngine,
  eventsOverride?: readonly WhaleCapitalFlowEvent[],
): WhaleActivityDigest {
  const monitoredWhales = engine.getWatchedWhales();
  const capturedEvents = eventsOverride ?? engine.getCapturedMovements();

  if (capturedEvents.length === 0) {
    return {
      monitoredWhaleCount: monitoredWhales.length,
      totalFlowEventsCaptured: 0,
      aggregateVolumeUsd: 0,
      peakSingleMoveUsd: 0,
      mostActiveWhaleMoniker: 'None (no movements logged)',
      topDestinationCategory: 'UNKNOWN',
      protocolDistribution: [],
      recentFlows: [],
      digestGeneratedAtIso: new Date().toISOString(),
    };
  }

  let aggregateVolumeUsd = 0;
  let peakSingleMoveUsd = 0;

  // Track activity tally per whale
  const whaleVolumeMap = new Map<string, { moniker: string; totalUsd: number; count: number }>();
  // Track destination category distribution
  const categoryStatsMap = new Map<
    CounterpartyEntityCategory,
    { count: number; totalUsd: number }
  >();

  for (const event of capturedEvents) {
    aggregateVolumeUsd += event.estimatedUsdValuation;
    if (event.estimatedUsdValuation > peakSingleMoveUsd) {
      peakSingleMoveUsd = event.estimatedUsdValuation;
    }

    // Accumulate whale totals
    const whaleEntry = whaleVolumeMap.get(event.whaleAddress.toLowerCase()) ?? {
      moniker: event.whaleMoniker,
      totalUsd: 0,
      count: 0,
    };
    whaleEntry.totalUsd += event.estimatedUsdValuation;
    whaleEntry.count += 1;
    whaleVolumeMap.set(event.whaleAddress.toLowerCase(), whaleEntry);

    // Accumulate counterparty categories
    const categoryEntry = categoryStatsMap.get(event.counterpartyCategory) ?? {
      count: 0,
      totalUsd: 0,
    };
    categoryEntry.count += 1;
    categoryEntry.totalUsd += event.estimatedUsdValuation;
    categoryStatsMap.set(event.counterpartyCategory, categoryEntry);
  }

  // Determine most active whale by net USD volume
  let mostActiveWhaleMoniker = 'Unspecified';
  let highestWhaleVolume = -1;
  for (const entry of whaleVolumeMap.values()) {
    if (entry.totalUsd > highestWhaleVolume) {
      highestWhaleVolume = entry.totalUsd;
      mostActiveWhaleMoniker = `${entry.moniker} ($${entry.totalUsd.toLocaleString()} across ${entry.count} txs)`;
    }
  }

  // Determine protocol distribution & top destination
  let topCategory: CounterpartyEntityCategory = 'UNKNOWN';
  let highestCategoryVolume = -1;
  const protocolDistribution: ProtocolVolumeShare[] = [];

  for (const [category, stats] of categoryStatsMap.entries()) {
    const percentage =
      aggregateVolumeUsd > 0
        ? Math.round((stats.totalUsd / aggregateVolumeUsd) * 1000) / 10
        : 0;

    protocolDistribution.push({
      category,
      transferCount: stats.count,
      totalUsdVolume: stats.totalUsd,
      percentageOfTotal: percentage,
    });

    if (stats.totalUsd > highestCategoryVolume) {
      highestCategoryVolume = stats.totalUsd;
      topCategory = category;
    }
  }

  // Sort protocol distribution by volume descending
  protocolDistribution.sort((a, b) => b.totalUsdVolume - a.totalUsdVolume);

  return {
    monitoredWhaleCount: monitoredWhales.length,
    totalFlowEventsCaptured: capturedEvents.length,
    aggregateVolumeUsd: Math.round(aggregateVolumeUsd * 100) / 100,
    peakSingleMoveUsd,
    mostActiveWhaleMoniker,
    topDestinationCategory: topCategory,
    protocolDistribution,
    recentFlows: [...capturedEvents].reverse(), // Most recent first
    digestGeneratedAtIso: new Date().toISOString(),
  };
}
