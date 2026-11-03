/**
 * Discord Webhook Dispatcher for Pharos Weekly Digest Agent (Requirement 04).
 * Serializes executive weekly digest into rich Discord Embeds with trend-dependent color coding,
 * metric comparison fields, and top-3 notable events linked to PharosScan explorer.
 */

import type { DeliveryStatusReport, WeeklyDigestReport } from '../types.js';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedPayload {
  title: string;
  description: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: { text: string };
  timestamp: string;
}

export class DiscordDigestDispatcher {
  /**
   * Formats a WeeklyDigestReport into a structured Discord webhook payload.
   */
  public formatDiscordEmbed(report: WeeklyDigestReport): { embeds: DiscordEmbedPayload[] } {
    const targetLabel = report.targetProfile.targetLabel;
    const periodLabel = report.currentPeriod.periodLabel;
    const metrics = report.metricsComparison;

    // Select embed color based on turnover momentum
    let embedColor = 0x38bdf8; // Default blue
    if (metrics.totalTurnoverUsd.trendDirection === 'SURGE' || metrics.totalTurnoverUsd.trendDirection === 'CLIMB') {
      embedColor = 0x10b981; // Emerald green
    } else if (metrics.totalTurnoverUsd.trendDirection === 'DECLINE' || metrics.totalTurnoverUsd.trendDirection === 'PLUMMET') {
      embedColor = 0xf43f5e; // Rose red
    }

    const fields: DiscordEmbedField[] = [
      {
        name: '📊 Turnover & Volume (Δ%)',
        value: `**${metrics.totalTurnoverUsd.formattedCurrentValue}** (${metrics.totalTurnoverUsd.percentageChangeRate >= 0 ? '+' : ''}${metrics.totalTurnoverUsd.percentageChangeRate}%)\n*Prior: ${metrics.totalTurnoverUsd.formattedBaselineValue}*`,
        inline: true,
      },
      {
        name: '⚡ Transactions',
        value: `**${metrics.transactionCount.formattedCurrentValue}** (${metrics.transactionCount.percentageChangeRate >= 0 ? '+' : ''}${metrics.transactionCount.percentageChangeRate}%)\n*Prior: ${metrics.transactionCount.formattedBaselineValue}*`,
        inline: true,
      },
      {
        name: '💰 Net Cashflow',
        value: `**${metrics.netCashflowDeltaUsd.formattedCurrentValue}**\n*Gas: ${metrics.gasFeesExpendedPros.formattedCurrentValue}*`,
        inline: true,
      },
    ];

    // Add Top 3 Notable Events as distinct embed fields
    const notableEventsSummary = report.topNotableEvents
      .map((event) => {
        const signpost = event.category === 'SECURITY_INCIDENT' ? '🚨' : event.category === 'LIQUIDITY_DEPLOYMENT' ? '💧' : '⭐';
        return `${signpost} **#${event.rank} ${event.headline}**\n${event.impactAnalysis}\n🔗 [PharosScan Explorer](${event.pharosscanExplorerUrl})`;
      })
      .join('\n\n');

    fields.push({
      name: '🌟 Top 3 Notable Events of the Week (Requirement 03)',
      value: this.truncateField(notableEventsSummary, 1024),
      inline: false,
    });

    // Add Action Items
    const actionItemsSummary = report.recommendationsAndActionItems
      .slice(0, 3)
      .map((item) => `• ${item}`)
      .join('\n');

    fields.push({
      name: '💡 Strategic Recommendations',
      value: this.truncateField(actionItemsSummary, 1024),
      inline: false,
    });

    const embed: DiscordEmbedPayload = {
      title: `⚡ Pharos Weekly Digest: ${targetLabel}`,
      description: `Periodic accounting summary for **${periodLabel}** on Pharos Mainnet (Chain ID 1672).\n\n${report.executiveDigestSummary}`,
      color: embedColor,
      fields,
      footer: { text: 'Pharos Autonomous Weekly Digest Agent · ai.pharos.xyz' },
      timestamp: report.generatedAtIso,
    };

    return { embeds: [embed] };
  }

  /**
   * Dispatches payload to Discord Webhook endpoint (or mock test dispatch if unset).
   */
  public async dispatchToDiscord(
    report: WeeklyDigestReport,
    webhookUrl?: string,
  ): Promise<DeliveryStatusReport> {
    const payload = this.formatDiscordEmbed(report);
    const targetWebhook = webhookUrl || process.env.DISCORD_WEBHOOK_URL;

    if (!targetWebhook) {
      // Mock / Simulation delivery mode
      return {
        channel: 'DISCORD',
        isDispatched: true,
        destinationTarget: 'Discord Webhook (Simulation Mode)',
        dispatchTimestampIso: new Date().toISOString(),
        deliveryMetadata: {
          embedTitle: payload.embeds[0].title,
          fieldCount: payload.embeds[0].fields.length,
          simulated: true,
        },
      };
    }

    try {
      const response = await fetch(targetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord API returned HTTP ${response.status}: ${await response.text()}`);
      }

      return {
        channel: 'DISCORD',
        isDispatched: true,
        destinationTarget: targetWebhook.replace(/(\/webhooks\/\d+\/)(.+)/, '$1***REDACTED***'),
        dispatchTimestampIso: new Date().toISOString(),
        deliveryMetadata: { httpStatus: response.status },
      };
    } catch (err) {
      return {
        channel: 'DISCORD',
        isDispatched: false,
        destinationTarget: 'Discord Webhook Dispatch',
        dispatchTimestampIso: new Date().toISOString(),
        deliveryMetadata: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  private truncateField(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
}
