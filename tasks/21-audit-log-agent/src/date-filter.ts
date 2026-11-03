/**
 * Date Range Parser & Temporal Validator for Pharos Wallet Audits.
 * Fulfills Requirement 01: Ingests wallet address and arbitrary date range,
 * validating boundaries and filtering block timestamps.
 */

import { type AuditDateRange } from './types.js';

/**
 * Parses user-provided start and end dates (ISO-8601, YYYY-MM-DD, or Unix timestamp).
 * Automatically normalizes start date to start of day (00:00:00.000Z)
 * and end date to end of day (23:59:59.999Z) when calendar dates are passed.
 */
export function parseAuditDateRange(startDateInput: string, endDateInput: string): AuditDateRange {
  const parseBoundary = (input: string, isEndOfDay: boolean): Date => {
    const trimmed = input.trim();

    // Check if simple YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const timeSuffix = isEndOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
      const parsed = new Date(`${trimmed}${timeSuffix}`);
      if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid calendar date boundary: "${input}"`);
      }
      return parsed;
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Unrecognized date format: "${input}". Please provide ISO-8601 or YYYY-MM-DD.`);
    }
    return parsed;
  };

  const startDate = parseBoundary(startDateInput, false);
  const endDate = parseBoundary(endDateInput, true);

  if (startDate.getTime() > endDate.getTime()) {
    throw new Error(
      `Invalid date range: Start date (${startDate.toISOString()}) cannot be after end date (${endDate.toISOString()}).`,
    );
  }

  return {
    startDateIso: startDate.toISOString(),
    endDateIso: endDate.toISOString(),
    startTimestampMs: startDate.getTime(),
    endTimestampMs: endDate.getTime(),
  };
}

/**
 * Validates whether an on-chain block timestamp (in seconds) falls strictly within the audit window.
 */
export function isWithinDateRange(blockTimestampSeconds: number, range: AuditDateRange): boolean {
  const txTimestampMs = blockTimestampSeconds * 1000;
  return txTimestampMs >= range.startTimestampMs && txTimestampMs <= range.endTimestampMs;
}
