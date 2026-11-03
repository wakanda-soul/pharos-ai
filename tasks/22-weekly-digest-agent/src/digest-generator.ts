/**
 * Master Weekly Digest Synthesizer for Pharos Network (Requirements 01, 02, 03).
 * Integrates scheduling intervals, metric comparative analytics, top-3 event curation,
 * and executive summary formulation into unified WeeklyDigestReport documents.
 */

import { MetricsComparator } from './metrics-comparator.js';
import { EventCurator } from './event-curator.js';
import type {
  DigestAccountingPeriod,
  DigestTargetProfile,
  RawHistoricalActivityRecord,
  WeeklyDigestReport,
} from './types.js';

export class DigestGenerator {
  private metricsComparator: MetricsComparator;
  private eventCurator: EventCurator;

  constructor() {
    this.metricsComparator = new MetricsComparator();
    this.eventCurator = new EventCurator();
  }

  /**
   * Generates a comprehensive periodic digest report for a target wallet or protocol.
   */
  public generateWeeklyDigest(
    targetProfile: DigestTargetProfile,
    currentPeriod: DigestAccountingPeriod,
    baselinePeriod: DigestAccountingPeriod,
    allActivityRecords: RawHistoricalActivityRecord[],
  ): WeeklyDigestReport {
    // Partition transaction stream strictly by accounting interval
    const currentPeriodLogs = allActivityRecords.filter(
      (tx) => tx.timestampEpochMs >= currentPeriod.startEpochMs && tx.timestampEpochMs <= currentPeriod.endEpochMs,
    );

    const baselinePeriodLogs = allActivityRecords.filter(
      (tx) => tx.timestampEpochMs >= baselinePeriod.startEpochMs && tx.timestampEpochMs <= baselinePeriod.endEpochMs,
    );

    const targetIdentifier = typeof targetProfile.targetIdentifier === 'string'
      ? targetProfile.targetIdentifier
      : String(targetProfile.targetIdentifier);

    // 1. Run metric comparative analysis (Requirement 02)
    const metricsComparison = this.metricsComparator.comparePeriods(
      currentPeriodLogs,
      baselinePeriodLogs,
      targetIdentifier,
    );

    // 2. Select top 3 notable events (Requirement 03)
    const topNotableEvents = this.eventCurator.curateTopThreeNotableEvents(
      currentPeriodLogs,
      targetProfile.targetLabel,
    );

    // 3. Synthesize human executive narrative & actionable recommendations
    const executiveSummary = this.composeExecutiveSummary(
      targetProfile,
      currentPeriod,
      metricsComparison,
      topNotableEvents,
    );

    const recommendations = this.deriveActionableRecommendations(
      metricsComparison,
      topNotableEvents,
      targetProfile,
    );

    const digestId = `digest-${targetProfile.targetLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${currentPeriod.periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    return {
      digestId,
      generatedAtIso: new Date().toISOString(),
      targetProfile,
      currentPeriod,
      baselinePeriod,
      metricsComparison,
      topNotableEvents,
      executiveDigestSummary: executiveSummary,
      recommendationsAndActionItems: recommendations,
      deliveryDispatches: [],
    };
  }

  private composeExecutiveSummary(
    targetProfile: DigestTargetProfile,
    period: DigestAccountingPeriod,
    metrics: WeeklyDigestReport['metricsComparison'],
    topEvents: WeeklyDigestReport['topNotableEvents'],
  ): string {
    const turnoverGauge = metrics.totalTurnoverUsd;
    const txGauge = metrics.transactionCount;
    const cashflowGauge = metrics.netCashflowDeltaUsd;

    const leadEvent = topEvents[0];
    const targetTypeNoun = targetProfile.targetKind === 'WALLET' ? 'wallet' : 'protocol';

    return (
      `Weekly performance digest for ${targetTypeNoun} "${targetProfile.targetLabel}" covering ${period.periodLabel}. ` +
      `During this period, total on-chain turnover recorded ${turnoverGauge.formattedCurrentValue} across ${txGauge.formattedCurrentValue}, ` +
      `representing a ${turnoverGauge.trendDirection.toLowerCase()} of ${turnoverGauge.percentageChangeRate >= 0 ? '+' : ''}${turnoverGauge.percentageChangeRate}% ` +
      `relative to the prior week baseline (${turnoverGauge.formattedBaselineValue}). ` +
      `Net cashflow position concluded at ${cashflowGauge.formattedCurrentValue}. ` +
      `The foremost notable event of the week was: "${leadEvent.headline}" (Rank #1, ${leadEvent.pharosscanExplorerUrl}).`
    );
  }

  private deriveActionableRecommendations(
    metrics: WeeklyDigestReport['metricsComparison'],
    topEvents: WeeklyDigestReport['topNotableEvents'],
    targetProfile: DigestTargetProfile,
  ): string[] {
    const actionItems: string[] = [];

    // Security & revert check
    const hasSecurityAlert = topEvents.some((ev) => ev.category === 'SECURITY_INCIDENT');
    if (hasSecurityAlert) {
      actionItems.push(
        'Audit EVM execution revert: review calldata parameters and simulate pre-flight states before re-broadcasting failed calls.',
      );
    }

    // Capital velocity recommendation
    if (metrics.totalTurnoverUsd.trendDirection === 'SURGE') {
      actionItems.push(
        'High capital velocity detected: reconcile off-chain books with on-chain settlement receipts to ensure liquidity alignment.',
      );
    } else if (metrics.totalTurnoverUsd.trendDirection === 'PLUMMET') {
      actionItems.push(
        'Transaction throughput declined sharply: inspect whether deposit gates or automated liquidity bots require re-activation.',
      );
    }

    // Gas efficiency check
    if (metrics.gasFeesExpendedPros.currentPeriodQuantity > 0.005) {
      actionItems.push(
        'Gas expenditures elevated: consider batching non-urgent operations via Multicall3 to optimize network fee overhead.',
      );
    } else {
      actionItems.push(
        'Gas expenditure efficiency maintained within nominal baseline limits across all on-chain operations.',
      );
    }

    // Target context recommendation
    if (targetProfile.targetKind === 'WALLET') {
      actionItems.push(
        'Verify active ERC-20 token allowance permissions to ensure obsolete spenders do not retain access to treasury funds.',
      );
    } else {
      actionItems.push(
        'Monitor pool utilization rates and oracle heartbeat freshness on Pharos Mainnet to prevent collateral liquidation cascades.',
      );
    }

    return actionItems;
  }
}
