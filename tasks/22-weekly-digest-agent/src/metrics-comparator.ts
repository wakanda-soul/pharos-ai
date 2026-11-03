/**
 * Metrics Comparison Engine for Pharos Weekly Digest Agent (Requirement 02).
 * Aggregates on-chain financial metrics for current and baseline periods, calculates
 * absolute deltas, percentage rate of change (Δ%), determines trend classifications,
 * and formulates human-readable executive insights.
 */

import type {
  ComparativeMetricGauge,
  DigestMetricsPackage,
  MetricTrendDirection,
  RawHistoricalActivityRecord,
} from './types.js';

export interface AggregatedPeriodLedger {
  turnoverUsd: number;
  txCount: number;
  inboundCapitalUsd: number;
  outboundCapitalUsd: number;
  netCashflowUsd: number;
  gasFeesPros: number;
  counterparties: Set<string>;
}

export class MetricsComparator {
  /**
   * Compares the current period's transaction logs against the preceding baseline period,
   * producing a structured comparison package for all core financial and operational KPIs.
   */
  public comparePeriods(
    currentPeriodLogs: RawHistoricalActivityRecord[],
    baselinePeriodLogs: RawHistoricalActivityRecord[],
    targetAddressOrProtocol: string,
  ): DigestMetricsPackage {
    const currentMetrics = this.tallyPeriodMetrics(currentPeriodLogs, targetAddressOrProtocol);
    const baselineMetrics = this.tallyPeriodMetrics(baselinePeriodLogs, targetAddressOrProtocol);

    return {
      totalTurnoverUsd: this.gaugeMetricDelta(
        'Total Turnover Volume',
        currentMetrics.turnoverUsd,
        baselineMetrics.turnoverUsd,
        'USD',
      ),
      transactionCount: this.gaugeMetricDelta(
        'Transaction Throughput',
        currentMetrics.txCount,
        baselineMetrics.txCount,
        'COUNT',
      ),
      inboundCapitalUsd: this.gaugeMetricDelta(
        'Inbound Capital Receipts',
        currentMetrics.inboundCapitalUsd,
        baselineMetrics.inboundCapitalUsd,
        'USD',
      ),
      outboundCapitalUsd: this.gaugeMetricDelta(
        'Outbound Capital Disbursements',
        currentMetrics.outboundCapitalUsd,
        baselineMetrics.outboundCapitalUsd,
        'USD',
      ),
      netCashflowDeltaUsd: this.gaugeMetricDelta(
        'Net Cashflow Position',
        currentMetrics.netCashflowUsd,
        baselineMetrics.netCashflowUsd,
        'USD_SIGNED',
      ),
      gasFeesExpendedPros: this.gaugeMetricDelta(
        'Network Gas Expended',
        currentMetrics.gasFeesPros,
        baselineMetrics.gasFeesPros,
        'PROS',
      ),
      uniqueCounterpartiesEngaged: this.gaugeMetricDelta(
        'Active Counterparties Engaged',
        currentMetrics.counterparties.size,
        baselineMetrics.counterparties.size,
        'COUNT',
      ),
    };
  }

  /**
   * Aggregates raw blockchain activity records into consolidated totals for an accounting window.
   */
  public tallyPeriodMetrics(
    records: RawHistoricalActivityRecord[],
    targetEntity: string,
  ): AggregatedPeriodLedger {
    const normalizedTarget = targetEntity.toLowerCase();
    const ledger: AggregatedPeriodLedger = {
      turnoverUsd: 0,
      txCount: records.length,
      inboundCapitalUsd: 0,
      outboundCapitalUsd: 0,
      netCashflowUsd: 0,
      gasFeesPros: 0,
      counterparties: new Set<string>(),
    };

    for (const record of records) {
      ledger.turnoverUsd += record.usdValuation;
      ledger.gasFeesPros += record.gasFeePros;

      const senderNorm = record.senderAddress.toLowerCase();
      const recipientNorm = record.recipientAddress.toLowerCase();

      // Inbound vs outbound capital attribution
      if (recipientNorm === normalizedTarget) {
        ledger.inboundCapitalUsd += record.usdValuation;
        ledger.counterparties.add(record.senderAddress);
      } else if (senderNorm === normalizedTarget) {
        ledger.outboundCapitalUsd += record.usdValuation;
        ledger.counterparties.add(record.recipientAddress);
      } else {
        // Interacted as protocol or caller
        ledger.counterparties.add(record.senderAddress);
        ledger.counterparties.add(record.recipientAddress);
      }
    }

    ledger.netCashflowUsd = ledger.inboundCapitalUsd - ledger.outboundCapitalUsd;
    return ledger;
  }

  /**
   * Calculates delta statistics and trend direction for a single metric gauge.
   */
  public gaugeMetricDelta(
    metricName: string,
    currentValue: number,
    baselineValue: number,
    unitType: 'USD' | 'USD_SIGNED' | 'COUNT' | 'PROS',
  ): ComparativeMetricGauge {
    const absoluteDiff = currentValue - baselineValue;

    // Handle baseline division and zero-activity scenarios
    let percentageRate = 0;
    if (baselineValue === 0) {
      if (currentValue === 0) {
        percentageRate = 0;
      } else {
        // Clean handling when baseline had zero volume: represent as +100% bootstrap growth
        percentageRate = 100.0;
      }
    } else {
      percentageRate = Number(((absoluteDiff / Math.abs(baselineValue)) * 100).toFixed(1));
    }

    const trend = this.classifyTrendDirection(percentageRate);
    const formattedCurrent = this.formatQuantity(currentValue, unitType);
    const formattedBaseline = this.formatQuantity(baselineValue, unitType);

    const narrative = this.synthesizeMetricNarrative(
      metricName,
      percentageRate,
      trend,
      absoluteDiff,
      unitType,
    );

    return {
      metricName,
      currentPeriodQuantity: currentValue,
      baselinePeriodQuantity: baselineValue,
      absoluteDifference: absoluteDiff,
      percentageChangeRate: percentageRate,
      trendDirection: trend,
      formattedCurrentValue: formattedCurrent,
      formattedBaselineValue: formattedBaseline,
      humanNarrativeInsight: narrative,
    };
  }

  /**
   * Classifies growth or contraction into discrete momentum tiers.
   */
  public classifyTrendDirection(percentageRate: number): MetricTrendDirection {
    if (percentageRate >= 25) return 'SURGE';
    if (percentageRate >= 5) return 'CLIMB';
    if (percentageRate > -5) return 'STABLE';
    if (percentageRate > -25) return 'DECLINE';
    return 'PLUMMET';
  }

  private formatQuantity(value: number, unitType: 'USD' | 'USD_SIGNED' | 'COUNT' | 'PROS'): string {
    switch (unitType) {
      case 'USD':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD`;
      case 'USD_SIGNED': {
        const sign = value > 0 ? '+' : value < 0 ? '-' : '';
        return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD`;
      }
      case 'PROS':
        return `${value.toFixed(4)} PROS`;
      case 'COUNT':
        return `${Math.round(value)} txs`;
    }
  }

  private synthesizeMetricNarrative(
    metricName: string,
    percentageRate: number,
    trend: MetricTrendDirection,
    diff: number,
    unitType: 'USD' | 'USD_SIGNED' | 'COUNT' | 'PROS',
  ): string {
    const formattedDelta = this.formatQuantity(Math.abs(diff), unitType);
    const signPrefix = diff >= 0 ? '+' : '-';

    switch (trend) {
      case 'SURGE':
        return `${metricName} experienced major expansion of ${signPrefix}${percentageRate}% (${signPrefix}${formattedDelta}) over baseline period.`;
      case 'CLIMB':
        return `${metricName} gained moderate momentum (+${percentageRate}%, +${formattedDelta}) compared to prior week.`;
      case 'STABLE':
        return `${metricName} remained balanced within equilibrium (${signPrefix}${percentageRate}%) relative to previous period.`;
      case 'DECLINE':
        return `${metricName} contracted by ${percentageRate}% (-${formattedDelta}) from previous week baseline.`;
      case 'PLUMMET':
        return `${metricName} recorded substantial contraction of ${percentageRate}% (-${formattedDelta}) versus prior reporting period.`;
    }
  }
}
