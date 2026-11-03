import { describe, it, expect, beforeEach } from 'vitest';
import { DigestScheduleManager } from '../src/scheduler.js';
import { MetricsComparator } from '../src/metrics-comparator.js';
import { EventCurator } from '../src/event-curator.js';
import { DigestGenerator } from '../src/digest-generator.js';
import { HtmlDigestPublisher } from '../src/delivery/html-publisher.js';
import { DiscordDigestDispatcher } from '../src/delivery/discord-delivery.js';
import { TelegramDigestDispatcher } from '../src/delivery/telegram-delivery.js';
import { EmailDigestDispatcher } from '../src/delivery/email-formatter.js';
import { DigestDeliveryDispatcher } from '../src/dispatcher.js';
import type {
  DigestAccountingPeriod,
  DigestTargetProfile,
  RawHistoricalActivityRecord,
  WeeklyDigestReport,
} from '../src/types.js';

describe('Task 22: Weekly Digest Agent Specification', () => {
  const TREASURY_WALLET = '0x71c80000000000000000000000000000000071C8';
  const FAROSWAP_ROUTER = '0x1000000000000000000000000000000000000001';

  const walletTargetProfile: DigestTargetProfile = {
    targetIdentifier: TREASURY_WALLET,
    targetLabel: 'Pharos Corporate Liquidity Treasury',
    targetKind: 'WALLET',
    operationalContext: 'Primary multi-asset corporate reserve account',
  };

  const protocolTargetProfile: DigestTargetProfile = {
    targetIdentifier: FAROSWAP_ROUTER,
    targetLabel: 'FaroSwap AMM Router v1',
    targetKind: 'PROTOCOL',
    operationalContext: 'Core automated market maker liquidity gateway',
  };

  const sampleCurrentPeriod: DigestAccountingPeriod = {
    periodLabel: 'Week 08 (Feb 16 - Feb 22, 2026)',
    startEpochMs: 1771200000000,
    endEpochMs: 1771804800000,
    startIso: '2026-02-16T00:00:00.000Z',
    endIso: '2026-02-22T23:59:59.000Z',
  };

  const sampleBaselinePeriod: DigestAccountingPeriod = {
    periodLabel: 'Week 07 (Feb 09 - Feb 15, 2026)',
    startEpochMs: 1770595200000,
    endEpochMs: 1771199999000,
    startIso: '2026-02-09T00:00:00.000Z',
    endIso: '2026-02-15T23:59:59.000Z',
  };

  const sampleCurrentLogs: RawHistoricalActivityRecord[] = [
    {
      transactionHash: '0x1111000000000000000000000000000000000000000000000000000000000001',
      blockHeight: 1520100,
      timestampEpochMs: 1771300000000,
      senderAddress: '0x6000000000000000000000000000000000000001',
      recipientAddress: TREASURY_WALLET,
      nominalAssetAmount: '150000',
      assetSymbol: 'USDC',
      usdValuation: 150000,
      gasFeePros: 0.0001,
      plainDescription: 'Inbound treasury capitalization from Binance Omnibus',
      isSuccessful: true,
      counterpartyLabel: 'Binance Custody Hot Wallet 4',
    },
    {
      transactionHash: '0x1111000000000000000000000000000000000000000000000000000000000002',
      blockHeight: 1520250,
      timestampEpochMs: 1771400000000,
      senderAddress: TREASURY_WALLET,
      recipientAddress: '0x2000000000000000000000000000000000000002',
      nominalAssetAmount: '50000',
      assetSymbol: 'USDC',
      usdValuation: 50000,
      gasFeePros: 0.0002,
      actionMethodSelector: 'supplyCollateral',
      plainDescription: 'Liquidity supply collateral to Harbor Lending Pool',
      isSuccessful: true,
      counterpartyLabel: 'Harbor Lending Pool',
    },
    {
      transactionHash: '0x1111000000000000000000000000000000000000000000000000000000000003',
      blockHeight: 1520400,
      timestampEpochMs: 1771500000000,
      senderAddress: TREASURY_WALLET,
      recipientAddress: FAROSWAP_ROUTER,
      nominalAssetAmount: '20000',
      assetSymbol: 'USDC',
      usdValuation: 20000,
      gasFeePros: 0.0003,
      actionMethodSelector: 'swapExactTokensForTokens',
      plainDescription: 'FaroSwap DEX Arbitrage swap USDC for PROS',
      isSuccessful: true,
      counterpartyLabel: 'FaroSwap Router v1',
    },
    {
      transactionHash: '0x1111000000000000000000000000000000000000000000000000000000000004',
      blockHeight: 1520600,
      timestampEpochMs: 1771600000000,
      senderAddress: TREASURY_WALLET,
      recipientAddress: '0x3000000000000000000000000000000000000001',
      nominalAssetAmount: '10000',
      assetSymbol: 'PROS',
      usdValuation: 15000,
      gasFeePros: 0.0004,
      plainDescription: 'Failed execution call to Morpho Blue Market',
      isSuccessful: false,
      counterpartyLabel: 'Morpho Blue Market',
    },
  ];

  const sampleBaselineLogs: RawHistoricalActivityRecord[] = [
    {
      transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000099',
      blockHeight: 1515000,
      timestampEpochMs: 1770700000000,
      senderAddress: '0x6000000000000000000000000000000000000001',
      recipientAddress: TREASURY_WALLET,
      nominalAssetAmount: '100000',
      assetSymbol: 'USDC',
      usdValuation: 100000,
      gasFeePros: 0.0001,
      plainDescription: 'Baseline inbound transfer from Binance',
      isSuccessful: true,
    },
    {
      transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000098',
      blockHeight: 1515500,
      timestampEpochMs: 1770800000000,
      senderAddress: TREASURY_WALLET,
      recipientAddress: '0x9999000011112222333344445555666677778888',
      nominalAssetAmount: '20000',
      assetSymbol: 'USDC',
      usdValuation: 20000,
      gasFeePros: 0.0001,
      plainDescription: 'Baseline operational expense disbursement',
      isSuccessful: true,
    },
  ];

  describe('Requirement 01: Runs on a schedule (weekly by default, configurable)', () => {
    it('initializes with weekly schedule by default (every Monday at 09:00 UTC)', () => {
      const scheduleManager = new DigestScheduleManager();
      const config = scheduleManager.getScheduleConfiguration();

      expect(config.cadence).toBe('WEEKLY');
      expect(config.cronExpression).toBe('0 9 * * 1');
      expect(config.dayOfWeek).toBe(1); // Monday
      expect(config.executionHourUtc).toBe(9);
      expect(config.isEnabled).toBe(true);
      expect(scheduleManager.describeScheduleCadence()).toContain('Weekly every Monday at 09:00 UTC');
    });

    it('allows reconfiguring schedule cadence to daily or biweekly with custom execution hour', () => {
      const scheduleManager = new DigestScheduleManager();

      scheduleManager.reconfigureCadence('DAILY', 14);
      let config = scheduleManager.getScheduleConfiguration();
      expect(config.cadence).toBe('DAILY');
      expect(config.cronExpression).toBe('0 14 * * *');
      expect(config.executionHourUtc).toBe(14);
      expect(scheduleManager.describeScheduleCadence()).toContain('Daily at 14:00 UTC');

      scheduleManager.reconfigureCadence('WEEKLY', 8, 5); // Friday at 08:00 UTC
      config = scheduleManager.getScheduleConfiguration();
      expect(config.cadence).toBe('WEEKLY');
      expect(config.cronExpression).toBe('0 8 * * 5');
      expect(config.dayOfWeek).toBe(5);
      expect(scheduleManager.describeScheduleCadence()).toContain('Weekly every Friday at 08:00 UTC');
    });

    it('calculates the next calendar occurrence date accurately', () => {
      const scheduleManager = new DigestScheduleManager();
      // Reference date: Wednesday Feb 18, 2026, 12:00 UTC
      const reference = new Date(Date.UTC(2026, 1, 18, 12, 0, 0));
      const nextOccurrence = scheduleManager.calculateNextScheduledOccurrence(reference);

      // Next Monday is Feb 23, 2026, at 09:00 UTC
      expect(nextOccurrence.getUTCDay()).toBe(1); // Monday
      expect(nextOccurrence.getUTCHours()).toBe(9);
      expect(nextOccurrence.getUTCDate()).toBe(23);
      expect(nextOccurrence.getTime()).toBeGreaterThan(reference.getTime());
    });

    it('derives contiguous weekly accounting periods for current vs baseline comparison', () => {
      const scheduleManager = new DigestScheduleManager();
      const anchor = new Date(Date.UTC(2026, 1, 23, 9, 0, 0));
      const { currentPeriod, baselinePeriod } = scheduleManager.deriveAccountingPeriods(anchor);

      expect(currentPeriod.endEpochMs).toBe(anchor.getTime());
      expect(currentPeriod.startEpochMs).toBe(baselinePeriod.endEpochMs);
      // Each weekly interval is exactly 7 days (604,800,000 ms)
      expect(currentPeriod.endEpochMs - currentPeriod.startEpochMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(baselinePeriod.endEpochMs - baselinePeriod.startEpochMs).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Requirement 02: Covers key metrics with a comparison to the previous period', () => {
    it('computes aggregated financial totals and period-over-period delta rates', () => {
      const comparator = new MetricsComparator();
      const metrics = comparator.comparePeriods(sampleCurrentLogs, sampleBaselineLogs, TREASURY_WALLET);

      // Current turnover: 150k + 50k + 20k + 15k = 235k
      // Baseline turnover: 100k + 20k = 120k
      expect(metrics.totalTurnoverUsd.currentPeriodQuantity).toBe(235000);
      expect(metrics.totalTurnoverUsd.baselinePeriodQuantity).toBe(120000);
      expect(metrics.totalTurnoverUsd.absoluteDifference).toBe(115000);
      expect(metrics.totalTurnoverUsd.percentageChangeRate).toBe(95.8);
      expect(metrics.totalTurnoverUsd.trendDirection).toBe('SURGE');

      // Transaction count: 4 vs 2 (+100%)
      expect(metrics.transactionCount.currentPeriodQuantity).toBe(4);
      expect(metrics.transactionCount.baselinePeriodQuantity).toBe(2);
      expect(metrics.transactionCount.percentageChangeRate).toBe(100.0);
      expect(metrics.transactionCount.trendDirection).toBe('SURGE');

      // Inbound vs Outbound capital
      expect(metrics.inboundCapitalUsd.currentPeriodQuantity).toBe(150000);
      expect(metrics.outboundCapitalUsd.currentPeriodQuantity).toBe(85000); // 50k + 20k + 15k
      expect(metrics.netCashflowDeltaUsd.currentPeriodQuantity).toBe(65000); // 150k - 85k
    });

    it('gracefully handles zero baseline volume without NaN or Infinity errors', () => {
      const comparator = new MetricsComparator();
      const emptyBaseline: RawHistoricalActivityRecord[] = [];
      const metrics = comparator.comparePeriods(sampleCurrentLogs, emptyBaseline, TREASURY_WALLET);

      expect(metrics.totalTurnoverUsd.baselinePeriodQuantity).toBe(0);
      expect(Number.isFinite(metrics.totalTurnoverUsd.percentageChangeRate)).toBe(true);
      expect(metrics.totalTurnoverUsd.percentageChangeRate).toBe(100.0);
      expect(metrics.totalTurnoverUsd.trendDirection).toBe('SURGE');
    });
  });

  describe('Requirement 03: Highlights the top 3 notable events of the period', () => {
    it('selects strictly the top 3 notable events ordered by significance score', () => {
      const curator = new EventCurator();
      const top3 = curator.curateTopThreeNotableEvents(sampleCurrentLogs, 'Pharos Treasury');

      expect(top3.length).toBe(3);
      expect(top3[0].rank).toBe(1);
      expect(top3[1].rank).toBe(2);
      expect(top3[2].rank).toBe(3);

      // The failed transaction (SECURITY_INCIDENT) receives highest priority score (+120 + 150 = 270)
      expect(top3[0].category).toBe('SECURITY_INCIDENT');
      expect(top3[0].headline).toContain('EVM Execution Revert');

      // Top events must have valid PharosScan explorer links
      for (const ev of top3) {
        expect(ev.pharosscanExplorerUrl).toMatch(/^https:\/\/pharosscan\.xyz\/tx\/0x[0-9a-fA-F]{64}$/);
        expect(ev.impactAnalysis.length).toBeGreaterThan(15);
      }
    });

    it('synthesizes informative placeholder highlights when period has fewer than 3 events', () => {
      const curator = new EventCurator();
      const singleRecord = [sampleCurrentLogs[0]];
      const top3 = curator.curateTopThreeNotableEvents(singleRecord, 'Pharos Treasury');

      expect(top3.length).toBe(3);
      expect(top3[0].rank).toBe(1);
      expect(top3[0].category).toBe('LARGE_TRANSFER');
      expect(top3[1].rank).toBe(2);
      expect(top3[2].rank).toBe(3);
      expect(top3[1].pharosscanExplorerUrl).toContain('https://pharosscan.xyz/tx/');
    });
  });

  describe('Requirement 04: Delivers to a real channel or as a published page', () => {
    let report: WeeklyDigestReport;

    beforeEach(() => {
      const generator = new DigestGenerator();
      const allLogs = [...sampleCurrentLogs, ...sampleBaselineLogs];
      report = generator.generateWeeklyDigest(
        walletTargetProfile,
        sampleCurrentPeriod,
        sampleBaselinePeriod,
        allLogs,
      );
    });

    it('publishes a standalone dark-mode HTML executive page to disk', () => {
      const publisher = new HtmlDigestPublisher();
      const publication = publisher.publishReportToHtmlPage(report, './published-digests');

      expect(publication.filePath).toContain('.html');
      expect(publication.fileUrl.startsWith('file://')).toBe(true);
      expect(publication.htmlContent).toContain('Weekly Activity Digest: Pharos Corporate Liquidity Treasury');
      expect(publication.htmlContent).toContain('Pharos Mainnet');
      expect(publication.htmlContent).toContain('https://pharosscan.xyz/tx/');
      expect(publication.htmlContent).toContain('trend-badge');
    });

    it('formats a rich Discord Embed payload with color coding and field length guards', () => {
      const discordDispatcher = new DiscordDigestDispatcher();
      const payload = discordDispatcher.formatDiscordEmbed(report);

      expect(payload.embeds.length).toBe(1);
      const embed = payload.embeds[0];
      expect(embed.title).toContain('Pharos Weekly Digest');
      expect(embed.color).toBe(0x10b981); // Emerald green because turnover surged
      expect(embed.fields.length).toBeGreaterThanOrEqual(4);

      // Verify character length constraints
      for (const field of embed.fields) {
        expect(field.value.length).toBeLessThanOrEqual(1024);
      }
    });

    it('formats a clean Telegram message with HTML markup and explorer links', () => {
      const telegramDispatcher = new TelegramDigestDispatcher();
      const message = telegramDispatcher.formatTelegramMessage(report);

      expect(message).toContain('<b>PHAROS WEEKLY ACTIVITY DIGEST</b>');
      expect(message).toContain('<b>Target:</b> Pharos Corporate Liquidity Treasury');
      expect(message).toContain('<b>Top 3 Notable Events:</b>');
      expect(message).toContain('https://pharosscan.xyz/tx/');
    });

    it('formats an executive email HTML body with comparison table', () => {
      const emailDispatcher = new EmailDigestDispatcher();
      const payload = emailDispatcher.formatEmailPayload(report);

      expect(payload.subject).toContain('[Weekly Digest] Pharos Corporate Liquidity Treasury');
      expect(payload.htmlBody).toContain('<table');
      expect(payload.htmlBody).toContain('Turnover Volume');
      expect(payload.htmlBody).toContain('Top 3 Notable Events');
    });

    it('broadcasts digest across multiple channels via DigestDeliveryDispatcher', async () => {
      const dispatcher = new DigestDeliveryDispatcher();
      const dispatchedReport = await dispatcher.dispatchReport(
        report,
        ['PUBLISHED_PAGE', 'DISCORD', 'TELEGRAM', 'EMAIL'],
      );

      expect(dispatchedReport.deliveryDispatches.length).toBe(4);
      const channelTypes = dispatchedReport.deliveryDispatches.map((d) => d.channel);
      expect(channelTypes).toContain('PUBLISHED_PAGE');
      expect(channelTypes).toContain('DISCORD');
      expect(channelTypes).toContain('TELEGRAM');
      expect(channelTypes).toContain('EMAIL');
    });
  });

  describe('Target Adaptability: Protocol Mode (FaroSwap AMM)', () => {
    it('generates a specialized protocol digest for an automated market maker', () => {
      const generator = new DigestGenerator();
      const protocolLogs: RawHistoricalActivityRecord[] = [
        {
          transactionHash: '0x2222000000000000000000000000000000000000000000000000000000000001',
          blockHeight: 1530000,
          timestampEpochMs: 1771300000000,
          senderAddress: '0x9999000011112222333344445555666677778888',
          recipientAddress: FAROSWAP_ROUTER,
          nominalAssetAmount: '350000',
          assetSymbol: 'USDC',
          usdValuation: 350000,
          gasFeePros: 0.0005,
          plainDescription: 'Large liquidity pool deposit on FaroSwap USDC/PROS pool',
          isSuccessful: true,
          counterpartyLabel: 'Harbor Protocol Treasury',
        },
      ];

      const report = generator.generateWeeklyDigest(
        protocolTargetProfile,
        sampleCurrentPeriod,
        sampleBaselinePeriod,
        protocolLogs,
      );

      expect(report.targetProfile.targetKind).toBe('PROTOCOL');
      expect(report.targetProfile.targetLabel).toBe('FaroSwap AMM Router v1');
      expect(report.metricsComparison.totalTurnoverUsd.currentPeriodQuantity).toBe(350000);
      expect(report.topNotableEvents.length).toBe(3);
      expect(report.recommendationsAndActionItems.some((r) => r.includes('pool utilization'))).toBe(true);
    });
  });
});
