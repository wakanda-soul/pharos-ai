/**
 * Task 09: Threshold Guardian Types & Data Models
 * Multi-condition on-chain decision engine for SkillEngine.
 */

export type MetricId =
  | 'ORACLE_PRICE_USD'
  | 'GAS_PRICE_GWEI'
  | 'LIQUIDITY_DEPTH_USDC'
  | 'ORACLE_FRESHNESS_SECONDS';

export type ConditionOperator = '>=' | '<=' | '>' | '<' | '==' | 'BETWEEN';

export interface ThresholdRule {
  id: string;
  name: string;
  metric: MetricId;
  operator: ConditionOperator;
  threshold: number | [number, number];
  unit: string;
  description: string;
}

export interface GuardianConfig {
  logic: 'ALL_MATCH' | 'ANY_MATCH';
  rules: ThresholdRule[];
  actionPayload: {
    actionType: string;
    targetContract: `0x${string}`;
    methodSignature: string;
    description: string;
  };
}

export interface OnChainTelemetry {
  network: string;
  chainId: number;
  blockNumber: number;
  blockTimestamp: number;
  oraclePriceUsd: number;
  oracleUpdatedAt: number;
  oracleLagSeconds: number;
  gasPriceGwei: number;
  liquidityDepthUsd: number;
}

export interface ConditionEvaluation {
  ruleId: string;
  name: string;
  metric: MetricId;
  observedValue: number;
  formattedObserved: string;
  operator: ConditionOperator;
  threshold: number | [number, number];
  formattedThreshold: string;
  passed: boolean;
  rationale: string;
}

export interface GuardianDecision {
  executionId: string;
  timestamp: string;
  verdict: 'FIRE_ACTION' | 'HOLD_ACTION';
  allPassed: boolean;
  totalConditions: number;
  passedCount: number;
  failedCount: number;
  conditions: ConditionEvaluation[];
  blockingReasons: string[];
  preparedAction?: {
    actionType: string;
    description: string;
    targetContract: `0x${string}`;
    calldata: `0x${string}`;
    castCommand: string;
  };
  telemetry: OnChainTelemetry;
}
