/**
 * Domain types and schemas for Pharos Wallet Risk Checker.
 * Evaluates pre-transaction security posture, identifies malicious red flags,
 * and formulates plain-language risk appraisals before executing interactions.
 */

import { type Address } from 'viem';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type AccountType =
  | 'EOA'
  | 'SMART_CONTRACT'
  | 'PROBABLE_PROXY'
  | 'UNINITIALIZED_ZERO_NONCE';

export type RiskSignalCategory =
  | 'CONTRACT_AGE'
  | 'CODE_VERIFICATION'
  | 'FLAGGED_ASSOCIATION'
  | 'APPROVAL_ANOMALIES'
  | 'FUNDING_FRESHNESS';

export type SignalSeverity = 'BENIGN' | 'LOW' | 'MEDIUM' | 'CRITICAL';

export interface EvaluatedRiskSignal {
  readonly signalCategory: RiskSignalCategory;
  readonly signalName: string;
  readonly isTriggered: boolean;
  readonly severity: SignalSeverity;
  readonly scoreContribution: number;
  readonly plainLanguageExplanation: string;
  readonly observedEvidence: string;
}

export interface OnChainAccountProfile {
  readonly targetAddress: Address;
  readonly accountType: AccountType;
  readonly firstSeenBlockNumber: bigint;
  readonly firstSeenTimestampIso: string;
  readonly accountAgeHours: number;
  readonly transactionCount: number;
  readonly nativeBalanceEther: string;
  readonly hasBytecode: boolean;
  readonly isSourceCodeVerified: boolean;
  readonly fundingSourceAddress?: Address;
  readonly flaggedInteractionsCount: number;
  readonly highRiskAllowancesCount: number;
}

export interface RiskAssessmentReport {
  readonly assessmentId: string;
  readonly analyzedAddress: Address;
  readonly riskLevel: RiskLevel;
  readonly numericalRiskScore: number; // 0 to 100
  readonly summaryRecommendation: string;
  readonly triggeredFlagsCount: number;
  readonly totalSignalsEvaluated: number;
  readonly evaluatedSignals: readonly EvaluatedRiskSignal[];
  readonly accountProfile: OnChainAccountProfile;
  readonly evaluatedAtIso: string;
}

export interface FlaggedEntityRecord {
  readonly address: Address;
  readonly entityName: string;
  readonly threatCategory: 'PHISHING_DRAINER' | 'EXPLOITER' | 'MIXER_TUMBLER' | 'FAKED_TOKEN_IMPERSONATOR';
  readonly dateIdentifiedIso: string;
  readonly referenceNoticeUrl?: string;
}
