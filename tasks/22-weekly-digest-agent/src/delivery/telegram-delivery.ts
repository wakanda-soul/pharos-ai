/**
 * Telegram Channel Dispatcher for Pharos Weekly Digest Agent (Requirement 04).
 * Serializes weekly digest into clean HTML-formatted messages compatible with Telegram Bot API
 * sendMessage method, with direct Pharosscan hyperlinks and formatted metrics.
 */

import type { DeliveryStatusReport, WeeklyDigestReport } from '../types.js';

export class TelegramDigestDispatcher {
  /**
   * Formats the report into a Telegram HTML message text.
   */
  public formatTelegramMessage(report: WeeklyDigestReport): string {
    const target = report.targetProfile;
    const period = report.currentPeriod;
    const metrics = report.metricsComparison;

    const sign = metrics.totalTurnoverUsd.percentageChangeRate >= 0 ? '+' : '';
    const arrow = metrics.totalTurnoverUsd.percentageChangeRate >= 0 ? '▲' : '▼';

    const eventsHtml = report.topNotableEvents
      .map((event) => {
        const icon = event.category === 'SECURITY_INCIDENT' ? '🚨' : event.category === 'LIQUIDITY_DEPLOYMENT' ? '💧' : '⭐';
        return `${icon} <b>#${event.rank} ${event.headline}</b>\n${event.impactAnalysis}\n👉 <a href="${event.pharosscanExplorerUrl}">Pharosscan Explorer</a>`;
      })
      .join('\n\n');

    const actionItemsHtml = report.recommendationsAndActionItems
      .slice(0, 3)
      .map((item) => `• ${item}`)
      .join('\n');

    return (
      `📋 <b>PHAROS WEEKLY ACTIVITY DIGEST</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Target:</b> ${target.targetLabel} (<code>${target.targetIdentifier}</code>)\n` +
      `<b>Period:</b> ${period.periodLabel}\n\n` +
      `📊 <b>Key Metrics & WoW Delta:</b>\n` +
      `• Turnover: <b>${metrics.totalTurnoverUsd.formattedCurrentValue}</b> (${arrow} ${sign}${metrics.totalTurnoverUsd.percentageChangeRate}%)\n` +
      `• Tx Count: <b>${metrics.transactionCount.formattedCurrentValue}</b> (${metrics.transactionCount.percentageChangeRate >= 0 ? '+' : ''}${metrics.transactionCount.percentageChangeRate}%)\n` +
      `• Net Cashflow: <b>${metrics.netCashflowDeltaUsd.formattedCurrentValue}</b>\n` +
      `• Gas Expended: <b>${metrics.gasFeesExpendedPros.formattedCurrentValue}</b>\n\n` +
      `🌟 <b>Top 3 Notable Events:</b>\n` +
      `${eventsHtml}\n\n` +
      `💡 <b>Recommendations:</b>\n` +
      `${actionItemsHtml}\n\n` +
      `<i>Pharos Autonomous Weekly Digest Agent · Chain ID 1672</i>`
    );
  }

  /**
   * Dispatches the Telegram HTML digest message via Bot API or mock simulation.
   */
  public async dispatchToTelegram(
    report: WeeklyDigestReport,
    botToken?: string,
    chatId?: string,
  ): Promise<DeliveryStatusReport> {
    const messageText = this.formatTelegramMessage(report);
    const activeToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    const activeChatId = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!activeToken || !activeChatId) {
      // Mock / Simulation mode
      return {
        channel: 'TELEGRAM',
        isDispatched: true,
        destinationTarget: 'Telegram Channel (Simulation Mode)',
        dispatchTimestampIso: new Date().toISOString(),
        deliveryMetadata: {
          characterCount: messageText.length,
          simulated: true,
        },
      };
    }

    try {
      const endpoint = `https://api.telegram.org/bot${activeToken}/sendMessage`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: activeChatId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram Bot API returned HTTP ${response.status}: ${await response.text()}`);
      }

      return {
        channel: 'TELEGRAM',
        isDispatched: true,
        destinationTarget: `Telegram Chat ${activeChatId}`,
        dispatchTimestampIso: new Date().toISOString(),
        deliveryMetadata: { httpStatus: response.status },
      };
    } catch (err) {
      return {
        channel: 'TELEGRAM',
        isDispatched: false,
        destinationTarget: `Telegram Chat ${activeChatId}`,
        dispatchTimestampIso: new Date().toISOString(),
        deliveryMetadata: { error: err instanceof Error ? err.message : String(err) },
      };
    }
  }
}
