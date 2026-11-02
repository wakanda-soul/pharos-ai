/**
 * Task 12: Policy Gatekeeper Types & Data Models
 * Enterprise Zero-Trust Action Policy Sentinel for SkillEngine.
 */

export interface SpendLimitsRule {
  id: string;
  name: string;
  maxPerTxNativePros: number;
  maxPerTxTokenUsdc: number;
  maxGlobalPerTxUsd: number;
  rollingDailyBudgetUsd: number;
  description: string;
}

export interface AllowlistRule {
  id: string;
  name: string;
  allowedContracts: `0x${string}`[];
  allowedRecipients: `0x${string}`[];
  allowedFunctionSelectors: string[];
  blockedAddresses: `0x${string}`[];
  description: string;
}

export interface TimeWindowRule {
  id: string;
  name: string;
  allowedUtcHours: { start: number; end: number }; // e.g. 8 to 22 UTC
  allowedDaysOfWeek: number[]; // 0 = Sun, 1 = Mon ... 6 = Sat
  cooldownPeriodSeconds: number;
  blackoutWindows?: Array<{ start: string; end: string; reason: string }>;
  description: string;
}

export interface PolicyConfig {
  policyId: string;
  name: string;
  version: string;
  description: string;
  rules: {
    spendLimits: SpendLimitsRule;
    allowlist: AllowlistRule;
    timeWindow: TimeWindowRule;
  };
}

export interface ActionProposal {
  actionId: string;
  agentId: string;
  actionType: string;
  targetContract: `0x${string}`;
  recipientAddress?: `0x${string}`;
  functionSelector: string;
  calldata?: `0x${string}`;
  nativeValuePros?: number;
  tokenValueUsdc?: number;
  timestamp?: string; // ISO 8601 string; if omitted, current time is used
  description?: string;
}

export type GatekeeperVerdict = 'ALLOW' | 'DENY';
export type DecidingRuleType = 'SPEND_LIMIT' | 'ALLOWLIST' | 'TIME_WINDOW' | 'GLOBAL_POLICY';

export interface RuleCheckEvaluation {
  ruleType: DecidingRuleType;
  ruleId: string;
  passed: boolean;
  message: string;
}

export interface AuthorizationTicket {
  ticketHash: string;
  issuedAt: string;
  expiresAt: string;
  authorizedTarget: `0x${string}`;
  castCommand: string;
}

export interface GatekeeperDecision {
  decisionId: string;
  timestamp: string;
  proposal: ActionProposal;
  verdict: GatekeeperVerdict;
  decidingRuleId: string;
  decidingRuleType: DecidingRuleType;
  decidingRuleName: string;
  rationale: string;
  evaluations: RuleCheckEvaluation[];
  authorizationTicket?: AuthorizationTicket;
  telemetry: {
    network: string;
    chainId: number;
    oraclePriceUsd: number;
    computedUsdValue: number;
  };
}

export interface AuditLogEntry {
  decisionId: string;
  timestamp: string;
  agentId: string;
  actionType: string;
  targetContract: `0x${string}`;
  verdict: GatekeeperVerdict;
  decidingRuleId: string;
  decidingRuleType: DecidingRuleType;
  rationale: string;
  ticketHash?: string;
}
