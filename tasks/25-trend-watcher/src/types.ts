/**
 * Pharos Trend Watcher - Domain Schemas and Interfaces
 * 
 * Provides types for persistent temporal observation ledgers, multi-observation
 * trend criteria, noise filtering, and trigger evaluation states.
 */

export type TrendDirection = 'DOWNTREND' | 'UPTREND' | 'OUTFLOW';

export type ObservationDecisionStatus =
  | 'BUFFERING_OBSERVATIONS'    // Haven't reached minimum sample window count yet
  | 'NOISY_SPIKE_REJECTED'      // Single erratic tick that snapped back, rejected as noise
  | 'ACCUMULATING_TREND'        // Direction holds, but hasn't met the consecutive threshold
  | 'TREND_CONFIRMED'           // Multi-observation trend criteria strictly satisfied
  | 'TREND_INVALIDATED';        // Counter-trend reading broke the consecutive sequence

export interface TemporalObservationRecord {
  /** Deterministic observation ID (e.g. obs-pros-usdc-1762174800000-1485) */
  readonly observationId: string;
  /** Monitored asset or metric identifier (e.g. PROS/USDC, HARBOR_TVL, BASE_FEE) */
  readonly metricKey: string;
  /** Numeric value at time of observation (e.g. spot price, USD TVL, Gwei) */
  readonly numericValue: number;
  /** ISO 8601 timestamp string representing when reading occurred */
  readonly timestampIso: string;
  /** Milliseconds epoch timestamp for precise chronological sorting */
  readonly timestampMs: number;
  /** Origin venue or oracle protocol (e.g. FaroSwap AMM, Chainlink, Harbor) */
  readonly sourceVenue: string;
  /** Optional contextual metadata (block number, pool depth, tx hash) */
  readonly metadata?: Record<string, unknown>;
}

export interface TrendEvaluationConfig {
  /** Target metric key to track and evaluate */
  readonly metricKey: string;
  /** Minimum consecutive readings required to confirm trend (strictly >= 3) */
  readonly minimumConsecutiveReadings: number;
  /** Desired trend trajectory to detect */
  readonly trendDirection: TrendDirection;
  /** Minimum cumulative percentage delta required across the window (e.g. 1.5%) */
  readonly minimumCumulativeDeltaPercent: number;
  /** Maximum allowed gap in milliseconds between readings before sequence expires (optional) */
  readonly maximumObservationGapMs?: number;
}

export interface SingleObservationDelta {
  readonly currentObservation: TemporalObservationRecord;
  readonly previousObservation?: TemporalObservationRecord;
  readonly absoluteDelta: number;
  readonly percentageDelta: number;
  readonly adheresToDirection: boolean;
}

export interface TrendEvaluationReport {
  /** Unique audit evaluation identifier */
  readonly evaluationId: string;
  /** Target metric evaluated */
  readonly metricKey: string;
  /** Whether the multi-observation trend condition was met */
  readonly isTrendConfirmed: boolean;
  /** Final operational status */
  readonly status: ObservationDecisionStatus;
  /** Number of consecutive readings adhering to the trend direction */
  readonly consecutiveConfirmedCount: number;
  /** Configured threshold of consecutive readings required */
  readonly thresholdRequired: number;
  /** Total cumulative percentage change across the confirmed trend sequence */
  readonly cumulativePercentageDelta: number;
  /** Exact observation record that triggered the confirmation (if confirmed) */
  readonly triggeringObservation?: TemporalObservationRecord;
  /** Full list of chronological observations analyzed in this window */
  readonly evaluatedObservations: TemporalObservationRecord[];
  /** Plain-language explanation for why the decision was made */
  readonly justificationRationale: string;
  /** Timestamp when evaluation occurred */
  readonly evaluatedAtIso: string;
}

export interface PersistentLedgerSnapshot {
  readonly version: number;
  readonly metricKey: string;
  readonly lastPersistedAt: string;
  readonly totalObservationsIngested: number;
  readonly observations: TemporalObservationRecord[];
}
