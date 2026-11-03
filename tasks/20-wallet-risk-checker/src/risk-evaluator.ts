/**
 * Comprehensive Risk Appraisal & Scoring Engine for Pharos Network.
 * Executes multi-signal threat evaluation, weighs severity contributions,
 * determines overall Risk Level (LOW, MEDIUM, HIGH), and compiles plain-language advisories.
 */

import {
  type EvaluatedRiskSignal,
  type OnChainAccountProfile,
  type RiskAssessmentReport,
  type RiskLevel,
} from './types.js';
import {
  evaluateApprovalAnomaliesSignal,
  evaluateCodeVerificationSignal,
  evaluateContractAgeSignal,
  evaluateFlaggedAssociationSignal,
  evaluateFundingFreshnessSignal,
} from './signal-evaluators.js';
import { defaultThreatRegistry, ThreatIntelligenceRegistry } from './flag-catalog.js';

export class WalletRiskEvaluator {
  private readonly threatRegistry: ThreatIntelligenceRegistry;

  constructor(customRegistry?: ThreatIntelligenceRegistry) {
    this.threatRegistry = customRegistry ?? defaultThreatRegistry;
  }

  /**
   * Evaluates an on-chain account profile against all 5 security signals
   * and computes a finalized risk assessment report.
   */
  public evaluateAccount(profile: OnChainAccountProfile): RiskAssessmentReport {
    const evaluatedSignals: EvaluatedRiskSignal[] = [
      evaluateContractAgeSignal(profile),
      evaluateCodeVerificationSignal(profile),
      evaluateFlaggedAssociationSignal(profile, this.threatRegistry),
      evaluateApprovalAnomaliesSignal(profile),
      evaluateFundingFreshnessSignal(profile),
    ];

    let totalScore = 0;
    let hasCritical = false;
    let triggeredCount = 0;

    for (const signal of evaluatedSignals) {
      if (signal.isTriggered) {
        triggeredCount++;
        totalScore += signal.scoreContribution;
        if (signal.severity === 'CRITICAL') {
          hasCritical = true;
        }
      }
    }

    // Clamp score to [0, 100] range
    const numericalRiskScore = Math.min(100, Math.max(0, totalScore));

    // Determine Risk Level:
    // Any CRITICAL flag or score >= 60 results in HIGH risk.
    // Score between 25 and 59 results in MEDIUM risk.
    // Score < 25 results in LOW risk.
    let riskLevel: RiskLevel;
    if (hasCritical || numericalRiskScore >= 60) {
      riskLevel = 'HIGH';
    } else if (numericalRiskScore >= 25) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    const summaryRecommendation = this.formulateSummaryRecommendation(
      riskLevel,
      numericalRiskScore,
      evaluatedSignals.filter((s) => s.isTriggered),
    );

    const report: RiskAssessmentReport = {
      assessmentId: `risk-eval-${profile.targetAddress.slice(0, 8)}-${Date.now()}`,
      analyzedAddress: profile.targetAddress,
      riskLevel,
      numericalRiskScore,
      summaryRecommendation,
      triggeredFlagsCount: triggeredCount,
      totalSignalsEvaluated: evaluatedSignals.length,
      evaluatedSignals,
      accountProfile: profile,
      evaluatedAtIso: new Date().toISOString(),
    };

    return report;
  }

  /**
   * Formulates a clear, non-bureaucratic plain-language guidance verdict.
   */
  private formulateSummaryRecommendation(
    riskLevel: RiskLevel,
    score: number,
    triggeredSignals: readonly EvaluatedRiskSignal[],
  ): string {
    switch (riskLevel) {
      case 'HIGH': {
        const criticalSignal = triggeredSignals.find((s) => s.severity === 'CRITICAL');
        const primaryReason =
          criticalSignal?.signalName ??
          triggeredSignals[0]?.signalName ??
          'Multiple security red flags';
        const contextDetail = criticalSignal?.plainLanguageExplanation
          ? ` [${criticalSignal.plainLanguageExplanation.split('.')[0]}]`
          : '';

        return `DO NOT TRANSACT · HIGH RISK DETECTED (Risk Score: ${score}/100). Primary Red Flag: ${primaryReason}${contextDetail}. Interacting with this address presents an acute danger of asset theft, drainer execution, or unrecoverable smart contract exploit.`;
      }

      case 'MEDIUM': {
        const flagNames = triggeredSignals.map((s) => s.signalName).join(', ');
        return `PROCEED WITH CAUTION · MEDIUM RISK (Risk Score: ${score}/100). Cautionary Flags: ${flagNames}. Verify contract source code, test with nominal test amounts, and revoke unnecessary allowances before broad interaction.`;
      }

      case 'LOW':
      default:
        return `SAFE TO TRANSACT · LOW RISK (Risk Score: ${score}/100). All 5 security signals evaluated clean. Account demonstrates healthy operational history with no blacklist linkage or suspicious approval patterns.`;
    }
  }

  public get threats(): ThreatIntelligenceRegistry {
    return this.threatRegistry;
  }
}
