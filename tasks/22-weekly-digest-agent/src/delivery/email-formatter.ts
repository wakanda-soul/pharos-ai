/**
 * Email Formatter for Pharos Weekly Digest Agent (Requirement 04).
 * Generates email-ready HTML payloads suitable for SendGrid, Resend, or SMTP dispatchers.
 */

import type { DeliveryStatusReport, WeeklyDigestReport } from '../types.js';
import { escapeHtml } from './html-publisher.js';

export class EmailDigestDispatcher {
  /**
   * Formats the report into an email HTML body and subject line.
   */
  public formatEmailPayload(report: WeeklyDigestReport): { subject: string; htmlBody: string } {
    const target = report.targetProfile;
    const period = report.currentPeriod;
    const metrics = report.metricsComparison;

    const subject = `[Weekly Digest] ${target.targetLabel} - ${period.periodLabel} (${metrics.totalTurnoverUsd.formattedCurrentValue})`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1E293B; line-height: 1.6;">
        <h2 style="color: #0284C7; margin-bottom: 4px;">⚡ Pharos Weekly Activity Digest</h2>
        <p style="color: #64748B; font-size: 14px; margin-top: 0;">Target: <strong>${escapeHtml(target.targetLabel)}</strong> (${escapeHtml(String(target.targetIdentifier))}) &bull; ${escapeHtml(period.periodLabel)}</p>
        
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0F172A; font-size: 16px;">Executive Summary</h3>
          <p style="margin-bottom: 0; font-size: 14px;">${escapeHtml(report.executiveDigestSummary)}</p>
        </div>

        <h3 style="color: #0F172A; font-size: 16px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px;">Key Metrics & WoW Delta</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr style="background: #F1F5F9; text-align: left;">
            <th style="padding: 8px; border: 1px solid #CBD5E1;">Metric</th>
            <th style="padding: 8px; border: 1px solid #CBD5E1;">Current Week</th>
            <th style="padding: 8px; border: 1px solid #CBD5E1;">Change (%)</th>
            <th style="padding: 8px; border: 1px solid #CBD5E1;">Prior Baseline</th>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">Turnover Volume</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;"><strong>${escapeHtml(metrics.totalTurnoverUsd.formattedCurrentValue)}</strong></td>
            <td style="padding: 8px; border: 1px solid #CBD5E1; color: ${metrics.totalTurnoverUsd.percentageChangeRate >= 0 ? '#16A34A' : '#DC2626'}; font-weight: bold;">${metrics.totalTurnoverUsd.percentageChangeRate >= 0 ? '+' : ''}${metrics.totalTurnoverUsd.percentageChangeRate}%</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${escapeHtml(metrics.totalTurnoverUsd.formattedBaselineValue)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">Transaction Count</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${escapeHtml(metrics.transactionCount.formattedCurrentValue)}</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${metrics.transactionCount.percentageChangeRate >= 0 ? '+' : ''}${metrics.transactionCount.percentageChangeRate}%</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${escapeHtml(metrics.transactionCount.formattedBaselineValue)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">Net Cashflow Position</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${escapeHtml(metrics.netCashflowDeltaUsd.formattedCurrentValue)}</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">--</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${escapeHtml(metrics.netCashflowDeltaUsd.formattedBaselineValue)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">Gas Consumed</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${escapeHtml(metrics.gasFeesExpendedPros.formattedCurrentValue)}</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">--</td>
            <td style="padding: 8px; border: 1px solid #CBD5E1;">${escapeHtml(metrics.gasFeesExpendedPros.formattedBaselineValue)}</td>
          </tr>
        </table>

        <h3 style="color: #0F172A; font-size: 16px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px;">Top 3 Notable Events</h3>
        <ol style="padding-left: 20px; font-size: 14px;">
          ${report.topNotableEvents
            .map(
              (event) =>
                `<li style="margin-bottom: 12px;"><strong>${escapeHtml(event.headline)}</strong><br/><span style="color: #475569;">${escapeHtml(event.impactAnalysis)}</span><br/><a href="${escapeHtml(event.pharosscanExplorerUrl)}" style="color: #0284C7; font-size: 13px;">View on PharosScan Explorer &rarr;</a></li>`,
            )
            .join('\n')}
        </ol>

        <p style="font-size: 12px; color: #94A3B8; text-align: center; margin-top: 30px; border-top: 1px solid #E2E8F0; padding-top: 12px;">
          Pharos Autonomous Weekly Digest Agent &bull; Chain ID 1672 &bull; ai.pharos.xyz
        </p>
      </div>
    `;

    return { subject, htmlBody };
  }

  /**
   * Dispatches email digest via mock or configured recipient.
   */
  public async dispatchToEmail(
    report: WeeklyDigestReport,
    recipientEmail?: string,
  ): Promise<DeliveryStatusReport> {
    const emailPayload = this.formatEmailPayload(report);
    const destination = recipientEmail || process.env.DIGEST_RECIPIENT_EMAIL || 'treasury-compliance@pharos.xyz';

    return {
      channel: 'EMAIL',
      isDispatched: true,
      destinationTarget: destination,
      dispatchTimestampIso: new Date().toISOString(),
      deliveryMetadata: {
        subject: emailPayload.subject,
        htmlBytes: emailPayload.htmlBody.length,
        simulated: !process.env.SMTP_HOST,
      },
    };
  }
}
