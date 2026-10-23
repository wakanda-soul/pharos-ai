import {
  ProtocolVenue,
  RoutingPreference,
  RoutingResult,
  RoutingComparisonVenue,
  LockupTenor,
} from './types.js';

export class YieldRouter {
  /**
   * Evaluates all available protocol venues against user constraints,
   * calculates projected annual yield, ranks venues, and provides
   * a comprehensive explanation for the winning recommendation.
   */
  route(venues: ProtocolVenue[], preference: RoutingPreference): RoutingResult {
    if (!venues || venues.length === 0) {
      throw new Error('No protocol venues available for routing');
    }

    const {
      token,
      amountUsd,
      maxLockupTenor = '6m',
      minSafetyScore = 0,
      preferredProtocol,
    } = preference;

    const comparisons: RoutingComparisonVenue[] = [];
    const eligibleVenues: Array<{
      venue: ProtocolVenue;
      projectedAnnualYield: number;
      score: number;
    }> = [];

    for (const venue of venues) {
      // 1. Asset matching check
      const tokenMatch = venue.underlyingToken.toUpperCase() === token.toUpperCase();
      if (!tokenMatch) {
        comparisons.push({
          venueId: venue.id,
          protocolName: venue.protocolName,
          vaultName: venue.vaultName,
          apyPercent: venue.apyPercent,
          tvlUsd: venue.tvlUsd,
          lockupTenor: venue.lockupTenor,
          safetyScore: venue.safetyScore,
          projectedAnnualYieldUsd: 0,
          eligible: false,
          disqualificationReason: `Asset mismatch: venue accepts ${venue.underlyingToken}, user provided ${token}`,
        });
        continue;
      }

      // 2. Minimum deposit check
      if (amountUsd < venue.minDepositUsd) {
        comparisons.push({
          venueId: venue.id,
          protocolName: venue.protocolName,
          vaultName: venue.vaultName,
          apyPercent: venue.apyPercent,
          tvlUsd: venue.tvlUsd,
          lockupTenor: venue.lockupTenor,
          safetyScore: venue.safetyScore,
          projectedAnnualYieldUsd: (amountUsd * venue.apyPercent) / 100,
          eligible: false,
          disqualificationReason: `Amount $${amountUsd} is below minimum requirement of $${venue.minDepositUsd}`,
        });
        continue;
      }

      // 3. Lockup tenor compatibility check
      const tenorOrder: Record<LockupTenor, number> = {
        liquid: 0,
        '1d': 1,
        '3m': 2,
        '6m': 3,
      };

      const maxTenorRank = tenorOrder[maxLockupTenor] ?? 3;
      const venueTenorRank = tenorOrder[venue.lockupTenor] ?? 0;

      if (venueTenorRank > maxTenorRank) {
        comparisons.push({
          venueId: venue.id,
          protocolName: venue.protocolName,
          vaultName: venue.vaultName,
          apyPercent: venue.apyPercent,
          tvlUsd: venue.tvlUsd,
          lockupTenor: venue.lockupTenor,
          safetyScore: venue.safetyScore,
          projectedAnnualYieldUsd: (amountUsd * venue.apyPercent) / 100,
          eligible: false,
          disqualificationReason: `Lockup tenor '${venue.lockupTenor}' exceeds maximum permitted '${maxLockupTenor}'`,
        });
        continue;
      }

      // 4. Safety score check
      if (venue.safetyScore < minSafetyScore) {
        comparisons.push({
          venueId: venue.id,
          protocolName: venue.protocolName,
          vaultName: venue.vaultName,
          apyPercent: venue.apyPercent,
          tvlUsd: venue.tvlUsd,
          lockupTenor: venue.lockupTenor,
          safetyScore: venue.safetyScore,
          projectedAnnualYieldUsd: (amountUsd * venue.apyPercent) / 100,
          eligible: false,
          disqualificationReason: `Safety score ${venue.safetyScore} is below minimum threshold ${minSafetyScore}`,
        });
        continue;
      }

      // 5. Liquidity depth check (deposit must not exceed 25% of pool TVL)
      if (amountUsd > venue.tvlUsd * 0.25) {
        comparisons.push({
          venueId: venue.id,
          protocolName: venue.protocolName,
          vaultName: venue.vaultName,
          apyPercent: venue.apyPercent,
          tvlUsd: venue.tvlUsd,
          lockupTenor: venue.lockupTenor,
          safetyScore: venue.safetyScore,
          projectedAnnualYieldUsd: (amountUsd * venue.apyPercent) / 100,
          eligible: false,
          disqualificationReason: `Deposit amount exceeds 25% of pool TVL ($${venue.tvlUsd.toLocaleString()}) causing slippage/capacity risk`,
        });
        continue;
      }

      // Eligible venue!
      const projectedAnnualYield = (amountUsd * venue.apyPercent) / 100;

      // Scoring formula:
      // Weight APY primarily, bonus for safety score, bonus for preferred protocol
      let score = venue.apyPercent * 10;
      score += (venue.safetyScore - 80) * 0.5;
      if (preferredProtocol && venue.protocolId === preferredProtocol) {
        score += 15;
      }

      eligibleVenues.push({ venue, projectedAnnualYield, score });

      comparisons.push({
        venueId: venue.id,
        protocolName: venue.protocolName,
        vaultName: venue.vaultName,
        apyPercent: venue.apyPercent,
        tvlUsd: venue.tvlUsd,
        lockupTenor: venue.lockupTenor,
        safetyScore: venue.safetyScore,
        projectedAnnualYieldUsd: projectedAnnualYield,
        eligible: true,
      });
    }

    if (eligibleVenues.length === 0) {
      throw new Error(
        `No eligible venues found matching criteria: token=${token}, amount=$${amountUsd}, maxTenor=${maxLockupTenor}, minSafety=${minSafetyScore}`
      );
    }

    // Sort eligible venues by highest score descending
    eligibleVenues.sort((a, b) => b.score - a.score);

    const winner = eligibleVenues[0].venue;
    const winnerYield = eligibleVenues[0].projectedAnnualYield;

    // Generate plain-English explanation and tradeoffs
    const explanation = this.buildExplanation(
      winner,
      winnerYield,
      amountUsd,
      maxLockupTenor,
      eligibleVenues.map((e) => e.venue)
    );

    return {
      bestVenue: winner,
      inputToken: token.toUpperCase(),
      depositAmountUsd: amountUsd,
      projectedYieldUsd: winnerYield,
      explanation,
      consideredVenues: comparisons,
    };
  }

  private buildExplanation(
    bestVenue: ProtocolVenue,
    winnerYield: number,
    amountUsd: number,
    maxLockupTenor: LockupTenor,
    allEligible: ProtocolVenue[]
  ): {
    primaryReason: string;
    tradeoffs: string[];
    comparisonNotes: string;
  } {
    let primaryReason = '';
    const tradeoffs: string[] = [];

    if (bestVenue.lockupTenor === 'liquid') {
      primaryReason = `Selected ${bestVenue.vaultName} on ${bestVenue.protocolName} as the optimal liquid venue, delivering ${bestVenue.apyPercent}% APY with immediate 24/7 liquidity and no capital lockup penalty.`;
    } else {
      primaryReason = `Selected ${bestVenue.vaultName} on ${bestVenue.protocolName} as the highest-yielding venue (${bestVenue.apyPercent}% APY), earning an estimated +$${winnerYield.toFixed(2)} USD per year on your $${amountUsd.toLocaleString()} deposit.`;
    }

    // Tradeoffs
    if (bestVenue.lockupTenor !== 'liquid') {
      tradeoffs.push(
        `Requires capital lockup of ${bestVenue.lockupTenor.toUpperCase()} until maturity. If you require instant withdrawals, consider Morpho Blue Lending (8.50% APY, liquid).`
      );
    } else {
      const higherLocked = allEligible.find((v) => v.apyPercent > bestVenue.apyPercent);
      if (higherLocked) {
        tradeoffs.push(
          `Prioritized instant liquidity over higher fixed yield (${higherLocked.vaultName} offers ${higherLocked.apyPercent}% APY but locks funds for ${higherLocked.lockupTenor}).`
        );
      }
    }

    if (bestVenue.protocolId === 'faroswap') {
      tradeoffs.push(
        'AMM LP yield is driven by trading volume fees and may experience impermanent loss if WPROS/USDC price diverges significantly.'
      );
    } else if (bestVenue.protocolId === 'harbor') {
      tradeoffs.push(
        'RWA yields are supported by audited off-chain institutional receivables and credit agreements.'
      );
    } else if (bestVenue.protocolId === 'morpho') {
      tradeoffs.push(
        'Lending rate is variable and fluctuates based on Pharos borrow/supply market utilization.'
      );
    }

    // Comparison notes
    const competitors = allEligible.filter((v) => v.id !== bestVenue.id);
    let comparisonNotes = '';
    if (competitors.length > 0) {
      const runnerUp = competitors[0];
      const diffYield = Math.abs(winnerYield - (amountUsd * runnerUp.apyPercent) / 100);
      comparisonNotes = `Compared against ${competitors.length} other eligible venue(s). Closest alternative: ${runnerUp.vaultName} (${runnerUp.apyPercent}% APY, Δ$${diffYield.toFixed(2)}/yr). Selected venue has $${(bestVenue.tvlUsd / 1e6).toFixed(1)}M TVL depth with safety score of ${bestVenue.safetyScore}/100.`;
    } else {
      comparisonNotes = `Selected venue is the sole eligible option meeting all requested risk and tenor criteria (TVL: $${(bestVenue.tvlUsd / 1e6).toFixed(1)}M).`;
    }

    return {
      primaryReason,
      tradeoffs,
      comparisonNotes,
    };
  }
}
