import { TemporalObservationRecord, TrendEvaluationReport } from './types.js';

/**
 * Renders an ASCII scorecard for a TrendWatcher evaluation report.
 */
export function renderTrendEvaluationScorecard(report: TrendEvaluationReport): string {
  const horizontalBar = '─'.repeat(77);
  const statusBadge = formatStatusBadge(report.status);

  const lines: string[] = [];
  lines.push(`┌${horizontalBar}┐`);
  lines.push(`│ 📈 PHAROS TREND WATCHER · EVALUATION AUDIT CARD                              │`);
  lines.push(`│ Evaluation ID: ${report.evaluationId.padEnd(60)}│`);
  lines.push(`│ Monitored Metric: ${report.metricKey.padEnd(57)}│`);
  lines.push(`│ Operational Status: ${statusBadge.padEnd(69)}│`);
  lines.push(`├${horizontalBar}┤`);
  lines.push(`│ 📊 Trajectory & Confirmation Window (Requirement 02):                       │`);
  lines.push(
    `│   • Consecutive Confirmations: ${report.consecutiveConfirmedCount.toString().padEnd(2)} / ${report.thresholdRequired} required readings${''.padEnd(24)}│`
  );
  lines.push(
    `│   • Cumulative Delta:          ${(report.cumulativePercentageDelta >= 0 ? '+' : '') + report.cumulativePercentageDelta.toFixed(2)}% net change across window${''.padEnd(21)}│`
  );
  lines.push(
    `│   • Trend Confirmed Action:    ${report.isTrendConfirmed ? '✔ TRIGGERED (ALERT / HEDGE)' : '✖ NO ACTION (HOLD)'}${''.padEnd(26)}│`
  );

  if (report.triggeringObservation) {
    lines.push(`├${horizontalBar}┤`);
    lines.push(`│ ⭐ Exact Trigger Observation (Requirement 04):                               │`);
    lines.push(
      `│   • Triggering ID:     ${report.triggeringObservation.observationId.padEnd(52)}│`
    );
    lines.push(
      `│   • Trigger Value:     ${report.triggeringObservation.numericValue.toFixed(4).padEnd(52)}│`
    );
    lines.push(
      `│   • Trigger Timestamp: ${report.triggeringObservation.timestampIso.padEnd(52)}│`
    );
    lines.push(
      `│   • Source Venue:      ${report.triggeringObservation.sourceVenue.padEnd(52)}│`
    );
  }

  lines.push(`├${horizontalBar}┤`);
  lines.push(`│ 📋 Plain-Language Rationale (Requirement 05 - Spike Rejection):             │`);
  const wrappedRationale = wrapText(report.justificationRationale, 73);
  for (const rLine of wrappedRationale) {
    lines.push(`│   ${rLine.padEnd(74)}│`);
  }

  lines.push(`└${horizontalBar}┘`);
  return lines.join('\n');
}

/**
 * Renders an ASCII chronological timeline of observations highlighting the trigger moment.
 */
export function renderObservationsTimeline(
  observations: TemporalObservationRecord[],
  triggeringObservationId?: string
): string {
  if (observations.length === 0) {
    return '  [Empty Observation Ledger]';
  }

  const lines: string[] = [];
  lines.push('Step  Timestamp (UTC)  Numeric Value   Step Δ%    Cumul Δ%   Venue          Indicator');
  lines.push('────  ───────────────  ──────────────  ─────────  ─────────  ─────────────  ────────────────────');

  let baselineValue = observations[0].numericValue;

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    const prev = i > 0 ? observations[i - 1] : undefined;

    const stepDeltaPct = prev && prev.numericValue !== 0
      ? ((obs.numericValue - prev.numericValue) / Math.abs(prev.numericValue)) * 100
      : 0;

    const cumulDeltaPct = baselineValue !== 0
      ? ((obs.numericValue - baselineValue) / Math.abs(baselineValue)) * 100
      : 0;

    const timeStr = obs.timestampIso.substring(11, 19);
    const valStr = obs.numericValue.toFixed(4).padEnd(14);
    const stepDeltaStr = i === 0 ? '  baseline' : `${stepDeltaPct >= 0 ? '+' : ''}${stepDeltaPct.toFixed(2)}%`.padStart(9);
    const cumulDeltaStr = `${cumulDeltaPct >= 0 ? '+' : ''}${cumulDeltaPct.toFixed(2)}%`.padStart(9);
    const venueStr = obs.sourceVenue.padEnd(13).substring(0, 13);

    let indicator = '               ';
    if (obs.observationId === triggeringObservationId) {
      indicator = '⭐ TRIGGER MOMENT';
    } else if (i === 0) {
      indicator = '⚪ Initial baseline';
    } else if (stepDeltaPct < 0) {
      indicator = '🔻 Downward tick';
    } else if (stepDeltaPct > 0) {
      indicator = '🔺 Upward tick';
    } else {
      indicator = '⏸ Flat reading';
    }

    const stepNumStr = `#${(i + 1).toString().padEnd(3)}`;
    lines.push(`${stepNumStr} ${timeStr.padEnd(15)} ${valStr} ${stepDeltaStr}  ${cumulDeltaStr}  ${venueStr}  ${indicator}`);
  }

  return lines.join('\n');
}

function formatStatusBadge(status: string): string {
  switch (status) {
    case 'TREND_CONFIRMED':
      return '🟢 TREND_CONFIRMED (TRIGGER ACTION)';
    case 'NOISY_SPIKE_REJECTED':
      return '🟡 NOISY_SPIKE_REJECTED (SUPPRESSED)';
    case 'ACCUMULATING_TREND':
      return '🔵 ACCUMULATING_TREND (BUFFERING)';
    case 'BUFFERING_OBSERVATIONS':
      return '⚪ BUFFERING_OBSERVATIONS';
    case 'TREND_INVALIDATED':
      return '🔴 TREND_INVALIDATED (COUNTER-TREND)';
    default:
      return status;
  }
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > maxWidth) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}
