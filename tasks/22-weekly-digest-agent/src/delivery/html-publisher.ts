/**
 * Standalone HTML Page Publisher for Pharos Weekly Digest Agent (Requirement 04).
 * Publishes responsive, publication-ready HTML executive reports with dark-mode styling,
 * comparative metric KPI cards, trend momentum badges, and Top 3 notable event spotlight.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ComparativeMetricGauge, WeeklyDigestReport } from '../types.js';

export function escapeHtml(unsafeText: string): string {
  return unsafeText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class HtmlDigestPublisher {
  /**
   * Generates a self-contained HTML page and writes it to the designated publishing directory.
   */
  public publishReportToHtmlPage(
    report: WeeklyDigestReport,
    outputDirectory: string = './published-digests',
  ): { filePath: string; fileUrl: string; htmlContent: string } {
    const resolvedDir = path.resolve(process.cwd(), outputDirectory);
    fs.mkdirSync(resolvedDir, { recursive: true });

    const safeTargetSlug = report.targetProfile.targetLabel
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    const safePeriodSlug = report.currentPeriod.periodLabel
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');

    const fileName = `digest-${safeTargetSlug}-${safePeriodSlug}.html`;
    const filePath = path.join(resolvedDir, fileName);

    const htmlContent = this.renderHtmlContent(report);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');

    return {
      filePath,
      fileUrl: `file://${filePath}`,
      htmlContent,
    };
  }

  /**
   * Renders the complete HTML document string.
   */
  public renderHtmlContent(report: WeeklyDigestReport): string {
    const targetLabel = escapeHtml(report.targetProfile.targetLabel);
    const periodLabel = escapeHtml(report.currentPeriod.periodLabel);
    const context = escapeHtml(report.targetProfile.operationalContext);
    const targetId = escapeHtml(String(report.targetProfile.targetIdentifier));
    const executiveSummary = escapeHtml(report.executiveDigestSummary);

    const metrics = report.metricsComparison;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Digest · ${targetLabel} · Pharos Mainnet</title>
  <style>
    :root {
      --bg: #0B0F19;
      --card-bg: #151D2E;
      --border: #23304B;
      --text-main: #E2E8F0;
      --text-muted: #94A3B8;
      --primary: #38BDF8;
      --green: #10B981;
      --green-bg: rgba(16, 185, 129, 0.15);
      --red: #F43F5E;
      --red-bg: rgba(244, 63, 94, 0.15);
      --amber: #F59E0B;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font);
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container {
      max-width: 1080px;
      margin: 0 auto;
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.12);
      color: var(--primary);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 6px;
    }
    .meta-subtitle {
      color: var(--text-muted);
      font-size: 15px;
      margin-bottom: 28px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: #FFFFFF;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-text {
      font-size: 15px;
      color: #CBD5E1;
      line-height: 1.7;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: #0E1626;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
    }
    .metric-header {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 22px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 6px;
    }
    .trend-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .trend-positive {
      background: var(--green-bg);
      color: var(--green);
    }
    .trend-negative {
      background: var(--red-bg);
      color: var(--red);
    }
    .trend-neutral {
      background: rgba(148, 163, 184, 0.15);
      color: var(--text-muted);
    }
    .metric-baseline {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
    }
    .events-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .event-card {
      background: #0E1626;
      border-left: 4px solid var(--primary);
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
    }
    .event-topline {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .event-rank {
      font-size: 12px;
      font-weight: 700;
      background: rgba(56, 189, 248, 0.2);
      color: var(--primary);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .event-date {
      font-size: 12px;
      color: var(--text-muted);
    }
    .event-headline {
      font-size: 16px;
      font-weight: 600;
      color: #FFFFFF;
      margin-bottom: 6px;
    }
    .event-analysis {
      font-size: 14px;
      color: #CBD5E1;
      margin-bottom: 10px;
    }
    .explorer-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    .explorer-link:hover {
      text-decoration: underline;
    }
    .recommendations-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .recommendations-list li {
      position: relative;
      padding-left: 24px;
      font-size: 14px;
      color: #CBD5E1;
    }
    .recommendations-list li::before {
      content: "✔";
      position: absolute;
      left: 0;
      color: var(--green);
      font-weight: bold;
    }
    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 40px;
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-badge">⚡ Pharos Network · Chain ID 1672</div>
    <h1>Weekly Activity Digest: ${targetLabel}</h1>
    <div class="meta-subtitle">
      Reporting Period: <strong>${periodLabel}</strong> &bull; Target: <code>${targetId}</code> (${context})
    </div>

    <!-- Executive Summary Card -->
    <div class="card">
      <div class="card-title">📋 Executive Performance Summary</div>
      <p class="summary-text">${executiveSummary}</p>
    </div>

    <!-- Metric Comparison Grid -->
    <div class="card">
      <div class="card-title">📊 Key Metrics & Period-over-Period Delta (Requirement 02)</div>
      <div class="metrics-grid">
        ${this.renderMetricCardHtml(metrics.totalTurnoverUsd)}
        ${this.renderMetricCardHtml(metrics.transactionCount)}
        ${this.renderMetricCardHtml(metrics.netCashflowDeltaUsd)}
        ${this.renderMetricCardHtml(metrics.gasFeesExpendedPros)}
        ${this.renderMetricCardHtml(metrics.inboundCapitalUsd)}
        ${this.renderMetricCardHtml(metrics.outboundCapitalUsd)}
      </div>
    </div>

    <!-- Top 3 Notable Events -->
    <div class="card">
      <div class="card-title">🌟 Top 3 Notable Events Spotlight (Requirement 03)</div>
      <div class="events-list">
        ${report.topNotableEvents.map((event) => this.renderEventCardHtml(event)).join('\n')}
      </div>
    </div>

    <!-- Strategic Guidance & Next Steps -->
    <div class="card">
      <div class="card-title">💡 Strategic Guidance & Action Items</div>
      <ul class="recommendations-list">
        ${report.recommendationsAndActionItems.map((rec) => `<li>${escapeHtml(rec)}</li>`).join('\n')}
      </ul>
    </div>

    <footer>
      Autonomous Weekly Digest Agent &bull; Verified on Pharos Mainnet &bull; Generated: ${report.generatedAtIso}
    </footer>
  </div>
</body>
</html>`;
  }

  private renderMetricCardHtml(gauge: ComparativeMetricGauge): string {
    const isPositive = gauge.percentageChangeRate > 0;
    const isNegative = gauge.percentageChangeRate < 0;

    let badgeClass = 'trend-neutral';
    let arrow = '&bull;';
    if (isPositive) {
      badgeClass = 'trend-positive';
      arrow = '▲ +';
    } else if (isNegative) {
      badgeClass = 'trend-negative';
      arrow = '▼ ';
    }

    return `
      <div class="metric-card">
        <div class="metric-header">${escapeHtml(gauge.metricName)}</div>
        <div class="metric-value">${escapeHtml(gauge.formattedCurrentValue)}</div>
        <div>
          <span class="trend-badge ${badgeClass}">
            ${arrow}${Math.abs(gauge.percentageChangeRate)}%
          </span>
        </div>
        <div class="metric-baseline">Prior Week: ${escapeHtml(gauge.formattedBaselineValue)}</div>
      </div>
    `;
  }

  private renderEventCardHtml(event: WeeklyDigestReport['topNotableEvents'][number]): string {
    const rankLabel = `#${event.rank} PRIORITY EVENT`;
    const dateFormatted = event.timestampIso.slice(0, 10);
    const headline = escapeHtml(event.headline);
    const analysis = escapeHtml(event.impactAnalysis);
    const explorerUrl = escapeHtml(event.pharosscanExplorerUrl);

    return `
      <div class="event-card">
        <div class="event-topline">
          <span class="event-rank">${rankLabel}</span>
          <span class="event-date">${dateFormatted} &bull; Block ${event.blockHeight}</span>
        </div>
        <div class="event-headline">${headline}</div>
        <div class="event-analysis">${analysis}</div>
        <div>
          <a class="explorer-link" href="${explorerUrl}" target="_blank" rel="noreferrer">
            View on PharosScan Explorer ↗
          </a>
        </div>
      </div>
    `;
  }
}
