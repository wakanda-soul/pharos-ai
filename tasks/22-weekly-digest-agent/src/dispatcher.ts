/**
 * Unified Multi-Channel Delivery Dispatcher for Pharos Weekly Digest Agent (Requirement 04).
 * Coordinates publishing across Discord, Telegram, Email, and Standalone Published HTML Pages.
 */

import { DiscordDigestDispatcher } from './delivery/discord-delivery.js';
import { TelegramDigestDispatcher } from './delivery/telegram-delivery.js';
import { EmailDigestDispatcher } from './delivery/email-formatter.js';
import { HtmlDigestPublisher } from './delivery/html-publisher.js';
import type { DeliveryChannelKind, DeliveryStatusReport, WeeklyDigestReport } from './types.js';

export class DigestDeliveryDispatcher {
  private discordDispatcher: DiscordDigestDispatcher;
  private telegramDispatcher: TelegramDigestDispatcher;
  private emailDispatcher: EmailDigestDispatcher;
  private htmlPublisher: HtmlDigestPublisher;

  constructor() {
    this.discordDispatcher = new DiscordDigestDispatcher();
    this.telegramDispatcher = new TelegramDigestDispatcher();
    this.emailDispatcher = new EmailDigestDispatcher();
    this.htmlPublisher = new HtmlDigestPublisher();
  }

  /**
   * Broadcasts the weekly digest across all requested channels and returns the updated report.
   */
  public async dispatchReport(
    report: WeeklyDigestReport,
    channels: DeliveryChannelKind[] = ['PUBLISHED_PAGE', 'DISCORD', 'TELEGRAM', 'EMAIL'],
    options: {
      outputDirectory?: string;
      discordWebhookUrl?: string;
      telegramBotToken?: string;
      telegramChatId?: string;
      recipientEmail?: string;
    } = {},
  ): Promise<WeeklyDigestReport> {
    const dispatchResults: DeliveryStatusReport[] = [];

    for (const channel of channels) {
      switch (channel) {
        case 'PUBLISHED_PAGE': {
          try {
            const publication = this.htmlPublisher.publishReportToHtmlPage(
              report,
              options.outputDirectory || './published-digests',
            );
            dispatchResults.push({
              channel: 'PUBLISHED_PAGE',
              isDispatched: true,
              destinationTarget: publication.filePath,
              dispatchTimestampIso: new Date().toISOString(),
              deliveryMetadata: {
                fileUrl: publication.fileUrl,
                bytes: publication.htmlContent.length,
              },
            });
          } catch (err) {
            dispatchResults.push({
              channel: 'PUBLISHED_PAGE',
              isDispatched: false,
              destinationTarget: options.outputDirectory || './published-digests',
              dispatchTimestampIso: new Date().toISOString(),
              deliveryMetadata: { error: err instanceof Error ? err.message : String(err) },
            });
          }
          break;
        }

        case 'DISCORD': {
          const discordStatus = await this.discordDispatcher.dispatchToDiscord(
            report,
            options.discordWebhookUrl,
          );
          dispatchResults.push(discordStatus);
          break;
        }

        case 'TELEGRAM': {
          const telegramStatus = await this.telegramDispatcher.dispatchToTelegram(
            report,
            options.telegramBotToken,
            options.telegramChatId,
          );
          dispatchResults.push(telegramStatus);
          break;
        }

        case 'EMAIL': {
          const emailStatus = await this.emailDispatcher.dispatchToEmail(
            report,
            options.recipientEmail,
          );
          dispatchResults.push(emailStatus);
          break;
        }
      }
    }

    return {
      ...report,
      deliveryDispatches: [...report.deliveryDispatches, ...dispatchResults],
    };
  }
}
