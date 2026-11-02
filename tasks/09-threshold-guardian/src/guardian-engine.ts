import {
  GuardianConfig,
  ThresholdRule,
  OnChainTelemetry,
  ConditionEvaluation,
  GuardianDecision,
} from './types.js';

export const DEFAULT_GUARDIAN_CONFIG: GuardianConfig = {
  logic: 'ALL_MATCH',
  rules: [
    {
      id: 'RULE_GAS_THRESHOLD',
      name: 'Gas Price Ceiling',
      metric: 'GAS_PRICE_GWEI',
      operator: '<=',
      threshold: 2.0,
      unit: 'Gwei',
      description: 'Network execution gas price must not exceed 2.0 Gwei to ensure economic viability.',
    },
    {
      id: 'RULE_PRICE_FLOOR',
      name: 'Oracle Asset Price Minimum',
      metric: 'ORACLE_PRICE_USD',
      operator: '>=',
      threshold: 2000.0,
      unit: 'USD',
      description: 'Oracle spot asset price must be above $2,000 USD to prevent execution during a flash crash.',
    },
    {
      id: 'RULE_LIQUIDITY_DEPTH',
      name: 'Minimum Market Liquidity',
      metric: 'LIQUIDITY_DEPTH_USDC',
      operator: '>=',
      threshold: 5000000.0,
      unit: 'USDC',
      description: 'On-chain market liquidity depth must exceed 5.0M USDC to guarantee minimal slippage.',
    },
    {
      id: 'RULE_ORACLE_FRESHNESS',
      name: 'Oracle Data Freshness',
      metric: 'ORACLE_FRESHNESS_SECONDS',
      operator: '<=',
      threshold: 86400, // 24 hours max staleness buffer for testnet/cache
      unit: 'seconds',
      description: 'Oracle feed price report must be sufficiently recent to prevent stale data execution.',
    },
  ],
  actionPayload: {
    actionType: 'TRIGGER_REBALANCE_DEPOSIT',
    targetContract: '0xba3b00c3b0632b6fa622f990924976725227b68a',
    methodSignature: 'executeRebalance(uint256,address)',
    description: 'Execute automated liquidity rebalance and supply transaction on Pharos DEX router',
  },
};

export class ThresholdGuardianEngine {
  private config: GuardianConfig;

  constructor(customConfig?: Partial<GuardianConfig>) {
    this.config = {
      ...DEFAULT_GUARDIAN_CONFIG,
      ...customConfig,
      rules: (customConfig?.rules ?? DEFAULT_GUARDIAN_CONFIG.rules).map((r) => ({ ...r })),
    };
  }

  /**
   * Updates or overrides specific rule thresholds dynamically.
   */
  configureRule(ruleId: string, updates: Partial<ThresholdRule>): void {
    const idx = this.config.rules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) {
      this.config.rules[idx] = { ...this.config.rules[idx], ...updates };
    }
  }

  /**
   * Sets custom ruleset.
   */
  setRules(rules: ThresholdRule[]): void {
    this.config.rules = rules;
  }

  getConfig(): GuardianConfig {
    return this.config;
  }

  /**
   * Core multi-condition evaluation logic.
   * Evaluates all on-chain telemetry against configured rules.
   */
  evaluate(telemetry: OnChainTelemetry): GuardianDecision {
    const executionId = `guard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();
    const evaluatedConditions: ConditionEvaluation[] = [];
    const blockingReasons: string[] = [];

    for (const rule of this.config.rules) {
      const evaluation = this.evaluateSingleRule(rule, telemetry);
      evaluatedConditions.push(evaluation);

      if (!evaluation.passed) {
        blockingReasons.push(evaluation.rationale);
      }
    }

    const passedCount = evaluatedConditions.filter((c) => c.passed).length;
    const failedCount = evaluatedConditions.length - passedCount;

    const allPassed = this.config.logic === 'ALL_MATCH'
      ? failedCount === 0
      : passedCount > 0;

    const verdict = allPassed ? 'FIRE_ACTION' : 'HOLD_ACTION';

    let preparedAction: GuardianDecision['preparedAction'];

    if (verdict === 'FIRE_ACTION') {
      const dummyCalldata: `0x${string}` = '0x6e553f6500000000000000000000000000000000000000000000000000000000000003e8';
      const castCommand = `cast send ${this.config.actionPayload.targetContract} "${this.config.actionPayload.methodSignature}" 1000 0x1000000000000000000000000000000000000001 --rpc-url https://rpc.pharos.xyz`;

      preparedAction = {
        actionType: this.config.actionPayload.actionType,
        description: this.config.actionPayload.description,
        targetContract: this.config.actionPayload.targetContract,
        calldata: dummyCalldata,
        castCommand,
      };
    }

    return {
      executionId,
      timestamp,
      verdict,
      allPassed,
      totalConditions: evaluatedConditions.length,
      passedCount,
      failedCount,
      conditions: evaluatedConditions,
      blockingReasons,
      preparedAction,
      telemetry,
    };
  }

  private evaluateSingleRule(rule: ThresholdRule, telemetry: OnChainTelemetry): ConditionEvaluation {
    const observedValue = this.extractMetricValue(rule.metric, telemetry);
    const passed = this.checkOperator(observedValue, rule.operator, rule.threshold);

    const formattedObserved = `${observedValue.toLocaleString()} ${rule.unit}`;
    const formattedThreshold = Array.isArray(rule.threshold)
      ? `[${rule.threshold[0]}, ${rule.threshold[1]}] ${rule.unit}`
      : `${rule.operator} ${rule.threshold.toLocaleString()} ${rule.unit}`;

    let rationale = '';
    if (passed) {
      rationale = `Condition satisfied: Observed ${formattedObserved} meets requirement (${formattedThreshold}).`;
    } else {
      rationale = `Violation: Observed ${formattedObserved} failed requirement (${formattedThreshold}). Action blocked.`;
    }

    return {
      ruleId: rule.id,
      name: rule.name,
      metric: rule.metric,
      observedValue,
      formattedObserved,
      operator: rule.operator,
      threshold: rule.threshold,
      formattedThreshold,
      passed,
      rationale,
    };
  }

  private extractMetricValue(metric: ThresholdRule['metric'], telemetry: OnChainTelemetry): number {
    switch (metric) {
      case 'ORACLE_PRICE_USD':
        return telemetry.oraclePriceUsd;
      case 'GAS_PRICE_GWEI':
        return telemetry.gasPriceGwei;
      case 'LIQUIDITY_DEPTH_USDC':
        return telemetry.liquidityDepthUsd;
      case 'ORACLE_FRESHNESS_SECONDS':
        return telemetry.oracleLagSeconds;
      default:
        return 0;
    }
  }

  private checkOperator(val: number, op: ThresholdRule['operator'], threshold: number | [number, number]): boolean {
    if (op === 'BETWEEN' && Array.isArray(threshold)) {
      return val >= threshold[0] && val <= threshold[1];
    }
    const t = typeof threshold === 'number' ? threshold : threshold[0];
    switch (op) {
      case '>=':
        return val >= t;
      case '<=':
        return val <= t;
      case '>':
        return val > t;
      case '<':
        return val < t;
      case '==':
        return Math.abs(val - t) < 0.0001;
      default:
        return false;
    }
  }
}
