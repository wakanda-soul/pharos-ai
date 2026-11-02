import { OptimizationStrategy, GasMarketStats } from './types.js';

export class ReservationCurveCalculator {
  /**
   * Computes the dynamic reservation price (maximum acceptable gas price) at time `now`.
   * If current gas price <= reservation price, the transaction should trigger immediately!
   *
   * @param createdAt Time transaction was enqueued (ms)
   * @param deadline Time by which transaction MUST be submitted (ms)
   * @param now Current evaluation timestamp (ms)
   * @param stats Current gas market statistical distribution
   * @param strategy Configuration options (target percentile, decay exponent, etc.)
   */
  static calculateReservationPrice(
    createdAt: number,
    deadline: number,
    now: number,
    stats: GasMarketStats,
    strategy: OptimizationStrategy
  ): number {
    const safetyMarginMs = strategy.safetyMarginMs ?? 2000;
    const effectiveDeadline = deadline - safetyMarginMs;

    // SLA Rule: If within or past safety margin, reservation price becomes infinite (force submit)
    if (now >= effectiveDeadline) {
      return Number.POSITIVE_INFINITY;
    }

    if (now <= createdAt) {
      return this.getInitialFavorableTarget(stats, strategy);
    }

    const totalWindowMs = Math.max(1, effectiveDeadline - createdAt);
    const elapsedMs = Math.min(totalWindowMs, Math.max(0, now - createdAt));
    const progress = elapsedMs / totalWindowMs; // 0.0 to 1.0

    const initialFavorable = this.getInitialFavorableTarget(stats, strategy);
    const maxCeiling = strategy.maxAcceptableGwei ?? Math.max(stats.p90Gwei, stats.currentGwei * 1.5);
    const gamma = strategy.decayExponent ?? 2.0; // Quadratic decay: conservative early, escalates near end

    // Non-linear reservation price escalation curve
    const dynamicThreshold = initialFavorable + (maxCeiling - initialFavorable) * Math.pow(progress, gamma);

    return parseFloat(dynamicThreshold.toFixed(3));
  }

  private static getInitialFavorableTarget(
    stats: GasMarketStats,
    strategy: OptimizationStrategy
  ): number {
    if (strategy.type === 'FIXED_THRESHOLD' && strategy.fixedThresholdGwei !== undefined) {
      return strategy.fixedThresholdGwei;
    }

    if (strategy.type === 'PERCENTILE_TARGET' && strategy.targetPercentile !== undefined) {
      // Use target percentile (e.g. 20th percentile)
      const p = strategy.targetPercentile;
      if (p <= 10) return stats.p10Gwei || stats.minGwei;
      if (p <= 25) return stats.p25Gwei || stats.minGwei;
      if (p <= 50) return stats.medianGwei || stats.avgGwei;
      return stats.p75Gwei;
    }

    // Default DYNAMIC_DECAY: aim for lower quartile (p25) or 15% discount below current price
    if (stats.p25Gwei > 0) {
      return Math.min(stats.p25Gwei, stats.currentGwei * 0.85);
    }
    return stats.currentGwei * 0.85;
  }
}
