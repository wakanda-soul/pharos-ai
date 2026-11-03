import { PersistentObservationStore } from './observation-store.js';
import {
  ObservationDecisionStatus,
  TemporalObservationRecord,
  TrendDirection,
  TrendEvaluationConfig,
  TrendEvaluationReport,
} from './types.js';

/**
 * TrendWatcherEngine
 * 
 * Stateful SkillEngine with long-term memory that monitors on-chain metrics,
 * persists observations between runs, suppresses single-reading transient noise,
 * and only acts once a multi-observation trend is strictly confirmed.
 */
export class TrendWatcherEngine {
  private readonly observationStore: PersistentObservationStore;
  private readonly evaluationConfig: TrendEvaluationConfig;

  constructor(
    config: TrendEvaluationConfig,
    customStore?: PersistentObservationStore
  ) {
    // Validate Requirement 02: Trend rule needs at least 3 observations to trigger
    if (config.minimumConsecutiveReadings < 3) {
      throw new Error(
        `[TrendWatcherEngine] Configuration invalid: minimumConsecutiveReadings must be at least 3 to prevent single-spike noise false positives. Provided: ${config.minimumConsecutiveReadings}`
      );
    }

    this.evaluationConfig = { ...config };
    this.observationStore = customStore ?? new PersistentObservationStore();
  }

  /**
   * Records a new metric reading, generates a unique deterministic observation ID,
   * and persists it to durable disk storage.
   */
  public recordObservation(
    numericValue: number,
    sourceVenue: string = 'FaroSwap AMM',
    timestampInput: Date | number = new Date(),
    metadata?: Record<string, unknown>
  ): TemporalObservationRecord {
    if (typeof numericValue !== 'number' || isNaN(numericValue)) {
      throw new Error(`[TrendWatcherEngine] Invalid numeric observation: ${numericValue}`);
    }

    const timestampMs =
      typeof timestampInput === 'number'
        ? timestampInput
        : timestampInput.getTime();

    const timestampIso = new Date(timestampMs).toISOString();

    // Deterministic unique ID to prevent double-counting across process restarts
    const sanitizedKey = this.evaluationConfig.metricKey.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const observationId = `obs-${sanitizedKey}-${timestampMs}-${Math.round(numericValue * 1000)}`;

    const newObservationRecord: TemporalObservationRecord = {
      observationId,
      metricKey: this.evaluationConfig.metricKey,
      numericValue,
      timestampIso,
      timestampMs,
      sourceVenue,
      metadata,
    };

    // Ingest into disk ledger (with duplicate suppression)
    this.observationStore.ingestObservation(newObservationRecord);

    return newObservationRecord;
  }

  /**
   * Evaluates the persisted observation history against the configured trend trajectory.
   * Enforces multi-observation confirmation and suppresses single-spike noise.
   */
  public evaluateCurrentTrend(): TrendEvaluationReport {
    const historicalObservations = this.observationStore.queryObservationsForMetric(
      this.evaluationConfig.metricKey
    );

    const evaluationId = `eval-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const evaluatedAtIso = new Date().toISOString();

    // Requirement 01 & 02: Need at least minimumConsecutiveReadings observations total to confirm
    if (historicalObservations.length < 2) {
      return {
        evaluationId,
        metricKey: this.evaluationConfig.metricKey,
        isTrendConfirmed: false,
        status: 'BUFFERING_OBSERVATIONS',
        consecutiveConfirmedCount: historicalObservations.length,
        thresholdRequired: this.evaluationConfig.minimumConsecutiveReadings,
        cumulativePercentageDelta: 0,
        evaluatedObservations: historicalObservations,
        justificationRationale: `Buffering initial observations: ${historicalObservations.length} stored, minimum ${this.evaluationConfig.minimumConsecutiveReadings} required for trend analysis.`,
        evaluatedAtIso,
      };
    }

    // Step A: Calculate step-by-step deltas
    interface StepTransition {
      fromIndex: number;
      toIndex: number;
      deltaAbsolute: number;
      deltaPercentage: number;
      matchesDirection: boolean;
    }

    const transitions: StepTransition[] = [];

    for (let i = 1; i < historicalObservations.length; i++) {
      const prev = historicalObservations[i - 1];
      const curr = historicalObservations[i];
      const deltaAbs = curr.numericValue - prev.numericValue;

      // Safe division: prevent NaN/Infinity if previous baseline was 0
      const deltaPct = prev.numericValue !== 0 ? (deltaAbs / Math.abs(prev.numericValue)) * 100 : 0;

      // Temporal gap expiration check: if gap exceeds maximum allowed, streak expires
      const timeDeltaMs = curr.timestampMs - prev.timestampMs;
      const isWithinTimeWindow =
        !this.evaluationConfig.maximumObservationGapMs ||
        timeDeltaMs <= this.evaluationConfig.maximumObservationGapMs;

      let matches = false;
      if (isWithinTimeWindow) {
        if (this.evaluationConfig.trendDirection === 'DOWNTREND' || this.evaluationConfig.trendDirection === 'OUTFLOW') {
          matches = deltaAbs < 0;
        } else if (this.evaluationConfig.trendDirection === 'UPTREND') {
          matches = deltaAbs > 0;
        }
      }

      transitions.push({
        fromIndex: i - 1,
        toIndex: i,
        deltaAbsolute: deltaAbs,
        deltaPercentage: deltaPct,
        matchesDirection: matches,
      });
    }

    // Step B: Walk backwards from latest transition to count consecutive adhering steps
    let consecutiveMatchingSteps = 0;
    for (let i = transitions.length - 1; i >= 0; i--) {
      if (transitions[i].matchesDirection) {
        consecutiveMatchingSteps++;
      } else {
        break; // Streak broken
      }
    }

    // Number of observation points in the streak = consecutive steps + 1 (unless 0 steps)
    const consecutiveObservationsCount = consecutiveMatchingSteps > 0 ? consecutiveMatchingSteps + 1 : 1;

    // Calculate cumulative delta across the current streak
    let cumulativeDeltaPercent = 0;
    if (consecutiveMatchingSteps > 0) {
      const streakStartIndex = historicalObservations.length - 1 - consecutiveMatchingSteps;
      const streakStartValue = historicalObservations[streakStartIndex].numericValue;
      const latestValue = historicalObservations[historicalObservations.length - 1].numericValue;
      cumulativeDeltaPercent =
        streakStartValue !== 0 ? ((latestValue - streakStartValue) / Math.abs(streakStartValue)) * 100 : 0;
    }

    // Step C: Noise / Single Spike Detection (Requirement 05)
    // Case 1: An isolated spike happened on the previous tick and immediately reversed back to mean
    const latestTransition = transitions[transitions.length - 1];
    const previousTransition = transitions.length >= 2 ? transitions[transitions.length - 2] : undefined;

    const hadErraticPreviousSpike =
      previousTransition &&
      Math.abs(previousTransition.deltaPercentage) >= 5 &&
      !latestTransition.matchesDirection &&
      Math.abs(latestTransition.deltaPercentage) >= 4;

    // Case 2: Currently at a single isolated spike that hasn't been confirmed over time
    const isSingleStepOnly = consecutiveObservationsCount < this.evaluationConfig.minimumConsecutiveReadings;
    const isHighVolatilitySingleTick =
      consecutiveMatchingSteps === 1 && Math.abs(latestTransition.deltaPercentage) >= 5;

    // Step D: Evaluate against Threshold Rules
    const thresholdMet = consecutiveObservationsCount >= this.evaluationConfig.minimumConsecutiveReadings;
    const magnitudeMet = Math.abs(cumulativeDeltaPercent) >= this.evaluationConfig.minimumCumulativeDeltaPercent;

    if (thresholdMet && magnitudeMet) {
      // Find exact observation that crossed the hurdle (Requirement 04)
      const exactTriggeringIndex =
        historicalObservations.length - 1 - (consecutiveObservationsCount - this.evaluationConfig.minimumConsecutiveReadings);
      const triggeringObservation = historicalObservations[exactTriggeringIndex];

      return {
        evaluationId,
        metricKey: this.evaluationConfig.metricKey,
        isTrendConfirmed: true,
        status: 'TREND_CONFIRMED',
        consecutiveConfirmedCount: consecutiveObservationsCount,
        thresholdRequired: this.evaluationConfig.minimumConsecutiveReadings,
        cumulativePercentageDelta: Number(cumulativeDeltaPercent.toFixed(2)),
        triggeringObservation,
        evaluatedObservations: historicalObservations,
        justificationRationale: `Trend confirmed: ${consecutiveObservationsCount} consecutive observations sustained in direction '${this.evaluationConfig.trendDirection}' (${cumulativeDeltaPercent.toFixed(2)}% net change), meeting the threshold of >= ${this.evaluationConfig.minimumConsecutiveReadings}.`,
        evaluatedAtIso,
      };
    }

    // Single spike snapback or single isolated tick rejection (Requirement 05)
    if (hadErraticPreviousSpike) {
      return {
        evaluationId,
        metricKey: this.evaluationConfig.metricKey,
        isTrendConfirmed: false,
        status: 'NOISY_SPIKE_REJECTED',
        consecutiveConfirmedCount: 0,
        thresholdRequired: this.evaluationConfig.minimumConsecutiveReadings,
        cumulativePercentageDelta: 0,
        evaluatedObservations: historicalObservations,
        justificationRationale: `Transient noise rejected: previous spike of ${previousTransition.deltaPercentage.toFixed(2)}% snapped back by ${latestTransition.deltaPercentage.toFixed(2)}% in the subsequent observation. Multi-observation filter held action.`,
        evaluatedAtIso,
      };
    }

    if (isHighVolatilitySingleTick) {
      return {
        evaluationId,
        metricKey: this.evaluationConfig.metricKey,
        isTrendConfirmed: false,
        status: 'NOISY_SPIKE_REJECTED',
        consecutiveConfirmedCount: consecutiveObservationsCount,
        thresholdRequired: this.evaluationConfig.minimumConsecutiveReadings,
        cumulativePercentageDelta: Number(cumulativeDeltaPercent.toFixed(2)),
        evaluatedObservations: historicalObservations,
        justificationRationale: `Transient price spike rejected as noise: single reading moved ${latestTransition.deltaPercentage.toFixed(2)}%, but lacks multi-observation persistence (${consecutiveObservationsCount}/${this.evaluationConfig.minimumConsecutiveReadings} readings). Action suppressed.`,
        evaluatedAtIso,
      };
    }

    if (consecutiveMatchingSteps > 0) {
      return {
        evaluationId,
        metricKey: this.evaluationConfig.metricKey,
        isTrendConfirmed: false,
        status: 'ACCUMULATING_TREND',
        consecutiveConfirmedCount: consecutiveObservationsCount,
        thresholdRequired: this.evaluationConfig.minimumConsecutiveReadings,
        cumulativePercentageDelta: Number(cumulativeDeltaPercent.toFixed(2)),
        evaluatedObservations: historicalObservations,
        justificationRationale: `Accumulating trend: ${consecutiveObservationsCount} consecutive readings detected in direction '${this.evaluationConfig.trendDirection}' (${cumulativeDeltaPercent.toFixed(2)}%), waiting for required threshold of ${this.evaluationConfig.minimumConsecutiveReadings}.`,
        evaluatedAtIso,
      };
    }

    return {
      evaluationId,
      metricKey: this.evaluationConfig.metricKey,
      isTrendConfirmed: false,
      status: 'TREND_INVALIDATED',
      consecutiveConfirmedCount: 0,
      thresholdRequired: this.evaluationConfig.minimumConsecutiveReadings,
      cumulativePercentageDelta: 0,
      evaluatedObservations: historicalObservations,
      justificationRationale: `Trend invalidated: latest observation did not adhere to '${this.evaluationConfig.trendDirection}'. Consecutive counter reset to 0.`,
      evaluatedAtIso,
    };
  }

  /**
   * Returns underlying observation storage instance.
   */
  public getStore(): PersistentObservationStore {
    return this.observationStore;
  }

  /**
   * Returns current evaluation configuration.
   */
  public getConfig(): Readonly<TrendEvaluationConfig> {
    return this.evaluationConfig;
  }
}
