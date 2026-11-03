/**
 * Terminal ASCII Formatter for Pharos Weekly Digest Agent.
 * Renders rich terminal scorecards with comparative metrics, trend badges,
 * and Top 3 notable events linked to Pharosscan explorer.
 */

import type { ComparativeMetricGauge, WeeklyDigestReport } from './types.js';

export function formatWeeklyDigestTerminal(report: WeeklyDigestReport): string {
  const target = report.targetProfile;
  const period = report.currentPeriod;
  const metrics = report.metricsComparison;

  const lines: string[] = [];

  const hr = '─────────────────────────────────────────────────────────────────────────────';
  const boxTop = '┌' + '─'.repeat(77) + '┐';
  const boxBottom = '└' + '─'.repeat(77) + '┘';

  lines.push(boxTop);
  lines.push(`│ 📰 PHAROS AUTONOMOUS WEEKLY DIGEST REPORT                                  │`);
  lines.push(`│ Period: ${period.periodLabel.padEnd(58)} │`);
  lines.push(`│ Target: ${target.targetLabel.padEnd(58)} │`);
  lines.push(`│ Chain:  Pharos Mainnet (Chain ID 1672) &bull; Verified on PharosScan       │`);
  lines.push('├' + '─'.repeat(77) + '┤');

  // Executive Summary
  lines.push(`│ 📋 Executive Performance Summary:                                           │`);
  const summaryChunks = wrapText(report.executiveDigestSummary, 73);
  for (const chunk of summaryChunks) {
    lines.push(`│   ${chunk.padEnd(73)} │`);
  }
  lines.push('├' + '─'.repeat(77) + '┤');

  // Comparative Metrics Grid (Requirement 02)
  lines.push(`│ 📊 Key Metrics & Period-over-Period Delta (Requirement 02):                 │`);
  lines.push(`│ ${hr.slice(0, 75)} │`);
  lines.push(formatGaugeLine(metrics.totalTurnoverUsd));
  lines.push(formatGaugeLine(metrics.transactionCount));
  lines.push(formatGaugeLine(metrics.netCashflowDeltaUsd));
  lines.push(formatGaugeLine(metrics.gasFeesExpendedPros));
  lines.push(formatGaugeLine(metrics.inboundCapitalUsd));
  lines.push(formatGaugeLine(metrics.outboundCapitalUsd));
  lines.push('├' + '─'.repeat(77) + '┤');

  // Top 3 Notable Events (Requirement 03)
  lines.push(`│ 🌟 Top 3 Notable Events of the Week (Requirement 03):                       │`);
  lines.push(`│ ${hr.slice(0, 75)} │`);

  for (const event of report.topNotableEvents) {
    const icon = event.category === 'SECURITY_INCIDENT' ? '🚨' : event.category === 'LIQUIDITY_DEPLOYMENT' ? '💧' : '⭐';
    lines.push(`│  ${icon} #${event.rank} ${event.headline.slice(0, 70).padEnd(70)} │`);
    lines.push(`│     Impact:   ${event.impactAnalysis.slice(0, 64).padEnd(64)} │`);
    lines.push(`│     Explorer: ${event.pharosscanExplorerUrl.padEnd(64)} │`);
    lines.push(`│                                                                             │`);
  }

  lines.push('├' + '─'.repeat(77) + '┤');

  // Strategic Action Items
  lines.push(`│ 💡 Strategic Guidance & Action Items:                                       │`);
  for (const item of report.recommendationsAndActionItems) {
    const itemChunks = wrapText(`✔ ${item}`, 73);
    for (const chunk of itemChunks) {
      lines.push(`│   ${chunk.padEnd(73)} │`);
    }
  }

  // Delivery Dispatches (Requirement 04)
  if (report.deliveryDispatches.length > 0) {
    lines.push('├' + '─'.repeat(77) + '┤');
    lines.push(`│ 🚀 Multi-Channel Publication Dispatches (Requirement 04):                   │`);
    for (const dispatch of report.deliveryDispatches) {
      const statusIcon = dispatch.isDispatched ? '✔' : '✖';
      const channelLabel = `[${dispatch.channel}]`.padEnd(17);
      const targetStr = dispatch.destinationTarget.slice(0, 48);
      lines.push(`│   ${statusIcon} ${channelLabel} ➔ ${targetStr.padEnd(50)} │`);
    }
  }

  lines.push(boxBottom);
  return lines.join('\n');
}

function formatGaugeLine(gauge: ComparativeMetricGauge): string {
  const isPositive = gauge.percentageChangeRate > 0;
  const isNegative = gauge.percentageChangeRate < 0;

  const arrow = isPositive ? '▲ +' : isNegative ? '▼ ' : '•  ';
  const deltaBadge = `[${arrow}${Math.abs(gauge.percentageChangeRate)}%]`.padStart(11);
  const metricName = gauge.metricName.slice(0, 30).padEnd(30);
  const currentVal = gauge.formattedCurrentValue.padStart(16);
  const baselineVal = `(Prior: ${gauge.formattedBaselineValue})`.slice(0, 22).padEnd(22);

  return `│  • ${metricName} ${currentVal} ${deltaBadge} ${baselineVal}│`;
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxWidth) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
