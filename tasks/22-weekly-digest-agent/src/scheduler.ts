/**
 * Autonomous Schedule Engine for the Pharos Weekly Digest Agent (Requirement 01).
 * Manages recurrent reporting intervals (weekly by default, configurable to daily, biweekly, or custom cron).
 * Calculates next execution timestamps and derives contiguous accounting periods for comparative analysis.
 */

import type {
  DigestAccountingPeriod,
  DigestScheduleProfile,
  DigestTargetProfile,
  DeliveryChannelKind,
  ScheduleRecurrenceCadence,
} from './types.js';

export const DEFAULT_WEEKLY_SCHEDULE: DigestScheduleProfile = {
  scheduleIdentifier: 'pharos-default-weekly-digest',
  cadence: 'WEEKLY',
  cronExpression: '0 9 * * 1', // Every Monday at 09:00 UTC
  dayOfWeek: 1, // Monday
  executionHourUtc: 9,
  isEnabled: true,
  targetEntities: [],
  preferredDeliveryChannels: ['TELEGRAM', 'DISCORD', 'PUBLISHED_PAGE'],
};

export class DigestScheduleManager {
  private activeSchedule: DigestScheduleProfile;

  constructor(customScheduleConfiguration?: Partial<DigestScheduleProfile>) {
    this.activeSchedule = {
      ...DEFAULT_WEEKLY_SCHEDULE,
      ...customScheduleConfiguration,
    };
  }

  /**
   * Retrieves the current schedule configuration.
   */
  public getScheduleConfiguration(): DigestScheduleProfile {
    return { ...this.activeSchedule };
  }

  /**
   * Updates schedule parameters dynamically (e.g. changing from weekly to daily, or altering dispatch hour).
   */
  public reconfigureCadence(
    cadence: ScheduleRecurrenceCadence,
    executionHourUtc: number = 9,
    dayOfWeek: number = 1,
  ): DigestScheduleProfile {
    if (executionHourUtc < 0 || executionHourUtc > 23) {
      throw new Error(`Invalid executionHourUtc: ${executionHourUtc}. Must be between 0 and 23.`);
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new Error(`Invalid dayOfWeek: ${dayOfWeek}. 0=Sunday, 1=Monday, ..., 6=Saturday.`);
    }

    let generatedCron = '0 9 * * 1';
    switch (cadence) {
      case 'DAILY':
        generatedCron = `0 ${executionHourUtc} * * *`;
        break;
      case 'WEEKLY':
        generatedCron = `0 ${executionHourUtc} * * ${dayOfWeek}`;
        break;
      case 'BIWEEKLY':
        generatedCron = `0 ${executionHourUtc} 1,15 * *`;
        break;
      case 'HOURLY_TEST':
        generatedCron = '0 * * * *';
        break;
    }

    this.activeSchedule = {
      ...this.activeSchedule,
      cadence,
      cronExpression: generatedCron,
      executionHourUtc,
      dayOfWeek,
    };

    return this.getScheduleConfiguration();
  }

  /**
   * Assigns target entities (wallets or protocols) to receive digests under this schedule.
   */
  public registerTargetEntities(targets: DigestTargetProfile[]): void {
    this.activeSchedule.targetEntities = [...targets];
  }

  /**
   * Configures publication channels (Telegram, Discord, Email, Static HTML Page).
   */
  public configureDeliveryChannels(channels: DeliveryChannelKind[]): void {
    this.activeSchedule.preferredDeliveryChannels = [...channels];
  }

  /**
   * Calculates the next calendar execution date based on configured cadence and reference timestamp.
   */
  public calculateNextScheduledOccurrence(referenceDate: Date = new Date()): Date {
    const nextExecution = new Date(referenceDate.getTime());

    if (this.activeSchedule.cadence === 'DAILY') {
      nextExecution.setUTCHours(this.activeSchedule.executionHourUtc, 0, 0, 0);
      if (nextExecution.getTime() <= referenceDate.getTime()) {
        nextExecution.setUTCDate(nextExecution.getUTCDate() + 1);
      }
      return nextExecution;
    }

    if (this.activeSchedule.cadence === 'HOURLY_TEST') {
      nextExecution.setUTCMinutes(0, 0, 0);
      nextExecution.setUTCHours(nextExecution.getUTCHours() + 1);
      return nextExecution;
    }

    // Default: Weekly cadence
    const targetDay = this.activeSchedule.dayOfWeek; // 1 = Monday
    const currentDay = referenceDate.getUTCDay();
    let daysUntilNext = (targetDay - currentDay + 7) % 7;

    nextExecution.setUTCHours(this.activeSchedule.executionHourUtc, 0, 0, 0);

    // If today is the target day but the hour has already passed, schedule for next week
    if (daysUntilNext === 0 && referenceDate.getTime() >= nextExecution.getTime()) {
      daysUntilNext = 7;
    }

    nextExecution.setUTCDate(referenceDate.getUTCDate() + daysUntilNext);
    return nextExecution;
  }

  /**
   * Derives two contiguous accounting intervals: the current active reporting period (T1)
   * and the baseline comparison period immediately preceding it (T0).
   * For weekly cadence: T1 is the past 7 days, T0 is the 7 days before T1.
   */
  public deriveAccountingPeriods(anchorTimestamp: Date = new Date()): {
    currentPeriod: DigestAccountingPeriod;
    baselinePeriod: DigestAccountingPeriod;
  } {
    const durationDays = this.activeSchedule.cadence === 'DAILY' ? 1 : 7;
    const intervalDurationMs = durationDays * 24 * 60 * 60 * 1000;

    // End of current period is the anchor time (or start of today's window)
    const currentPeriodEndMs = anchorTimestamp.getTime();
    const currentPeriodStartMs = currentPeriodEndMs - intervalDurationMs;

    const baselinePeriodEndMs = currentPeriodStartMs;
    const baselinePeriodStartMs = baselinePeriodEndMs - intervalDurationMs;

    const formatDateLabel = (d: Date) => d.toISOString().slice(0, 10);

    const currentPeriod: DigestAccountingPeriod = {
      periodLabel: `Period ${formatDateLabel(new Date(currentPeriodStartMs))} to ${formatDateLabel(new Date(currentPeriodEndMs))}`,
      startEpochMs: currentPeriodStartMs,
      endEpochMs: currentPeriodEndMs,
      startIso: new Date(currentPeriodStartMs).toISOString(),
      endIso: new Date(currentPeriodEndMs).toISOString(),
    };

    const baselinePeriod: DigestAccountingPeriod = {
      periodLabel: `Baseline ${formatDateLabel(new Date(baselinePeriodStartMs))} to ${formatDateLabel(new Date(baselinePeriodEndMs))}`,
      startEpochMs: baselinePeriodStartMs,
      endEpochMs: baselinePeriodEndMs,
      startIso: new Date(baselinePeriodStartMs).toISOString(),
      endIso: new Date(baselinePeriodEndMs).toISOString(),
    };

    return { currentPeriod, baselinePeriod };
  }

  /**
   * Produces an expressive description of the schedule configuration for human operators.
   */
  public describeScheduleCadence(): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const formattedHour = `${String(this.activeSchedule.executionHourUtc).padStart(2, '0')}:00 UTC`;

    switch (this.activeSchedule.cadence) {
      case 'DAILY':
        return `Daily at ${formattedHour} (Cron: "${this.activeSchedule.cronExpression}")`;
      case 'WEEKLY':
        return `Weekly every ${dayNames[this.activeSchedule.dayOfWeek]} at ${formattedHour} (Cron: "${this.activeSchedule.cronExpression}")`;
      case 'BIWEEKLY':
        return `Biweekly on the 1st and 15th at ${formattedHour} (Cron: "${this.activeSchedule.cronExpression}")`;
      case 'HOURLY_TEST':
        return `Hourly test trigger (Cron: "${this.activeSchedule.cronExpression}")`;
    }
  }
}
