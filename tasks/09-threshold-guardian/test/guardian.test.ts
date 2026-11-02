import { describe, it, expect } from 'vitest';
import { ThresholdGuardianEngine } from '../src/guardian-engine.js';
import { GuardianChainReader } from '../src/chain-reader.js';
import { GuardianFormatter } from '../src/formatter.js';
import { OnChainTelemetry, ThresholdRule } from '../src/types.js';

describe('Task 09: Threshold Guardian Engine & Decision Trace', () => {
  const chainReader = new GuardianChainReader();

  it('Requirement 01: Evaluates at least 3 independent conditions read from chain', async () => {
    // Read live telemetry directly from Pharos Mainnet
    const telemetry = await chainReader.fetchLiveTelemetry();

    expect(telemetry.chainId).toBe(1672);
    expect(telemetry.blockNumber).toBeGreaterThan(20000000);
    expect(telemetry.oraclePriceUsd).toBeGreaterThan(0);
    expect(telemetry.gasPriceGwei).toBeGreaterThan(0);
    expect(telemetry.liquidityDepthUsd).toBeGreaterThan(1000000);
    expect(telemetry.oracleLagSeconds).toBeGreaterThanOrEqual(0);

    const engine = new ThresholdGuardianEngine();
    const config = engine.getConfig();

    // Verifies at least 3 independent condition rules configured
    expect(config.rules.length).toBeGreaterThanOrEqual(3);

    const evaluated = engine.evaluate(telemetry);
    expect(evaluated.conditions.length).toBeGreaterThanOrEqual(3);

    // Verify independent metrics evaluated
    const evaluatedMetrics = new Set(evaluated.conditions.map((c) => c.metric));
    expect(evaluatedMetrics.has('GAS_PRICE_GWEI')).toBe(true);
    expect(evaluatedMetrics.has('ORACLE_PRICE_USD')).toBe(true);
    expect(evaluatedMetrics.has('LIQUIDITY_DEPTH_USDC')).toBe(true);
    expect(evaluatedMetrics.has('ORACLE_FRESHNESS_SECONDS')).toBe(true);
    expect(evaluatedMetrics.size).toBeGreaterThanOrEqual(3);
  }, 30000);

  it('Requirement 02: Conditions and thresholds are configurable, not hard-coded', () => {
    const defaultEngine = new ThresholdGuardianEngine();
    const defaultGasRule = defaultEngine.getConfig().rules.find((r) => r.id === 'RULE_GAS_THRESHOLD');
    expect(defaultGasRule?.threshold).toBe(2.0);

    // Dynamically reconfigure existing threshold
    defaultEngine.configureRule('RULE_GAS_THRESHOLD', { threshold: 0.1 });
    const updatedGasRule = defaultEngine.getConfig().rules.find((r) => r.id === 'RULE_GAS_THRESHOLD');
    expect(updatedGasRule?.threshold).toBe(0.1);

    // Support initializing engine with custom rules and ANY_MATCH logic
    const customRules: ThresholdRule[] = [
      {
        id: 'CUSTOM_HIGH_PRICE',
        name: 'Bull Market Trigger',
        metric: 'ORACLE_PRICE_USD',
        operator: '>=',
        threshold: 3000,
        unit: 'USD',
        description: 'Trigger when oracle price exceeds $3000',
      },
      {
        id: 'CUSTOM_LOW_GAS',
        name: 'Ultra Low Gas',
        metric: 'GAS_PRICE_GWEI',
        operator: '<=',
        threshold: 0.5,
        unit: 'Gwei',
        description: 'Trigger when gas is below 0.5 Gwei',
      },
    ];

    const customEngine = new ThresholdGuardianEngine({
      logic: 'ANY_MATCH',
      rules: customRules,
    });

    expect(customEngine.getConfig().logic).toBe('ANY_MATCH');
    expect(customEngine.getConfig().rules.length).toBe(2);
    expect(customEngine.getConfig().rules[0].id).toBe('CUSTOM_HIGH_PRICE');
  });

  it('Requirement 03: Logs a clear decision trace each run: each condition value, pass/fail, and final decision', () => {
    const engine = new ThresholdGuardianEngine();
    const telemetry: OnChainTelemetry = {
      network: 'Pharos Mainnet',
      chainId: 1672,
      blockNumber: 21903022,
      blockTimestamp: 1730519000,
      oraclePriceUsd: 2306.77,
      oracleUpdatedAt: 1730518900,
      oracleLagSeconds: 100,
      gasPriceGwei: 1.0,
      liquidityDepthUsd: 11200000,
    };

    const decision = engine.evaluate(telemetry);

    // Validate structured trace fields
    expect(decision.executionId).toBeTruthy();
    expect(decision.timestamp).toBeTruthy();
    expect(decision.verdict).toBe('FIRE_ACTION');
    expect(decision.totalConditions).toBe(4);
    expect(decision.passedCount).toBe(4);
    expect(decision.failedCount).toBe(0);

    for (const c of decision.conditions) {
      expect(c.ruleId).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(typeof c.observedValue).toBe('number');
      expect(typeof c.passed).toBe('boolean');
      expect(c.rationale).toContain('Condition satisfied');
    }

    // Validate formatted output contains matrix, status badges, and verdict
    const formatted = GuardianFormatter.formatReport(decision);
    expect(formatted).toContain('PHAROS SKILLENGINE: THRESHOLD GUARDIAN DECISION TRACE');
    expect(formatted).toContain('MULTI-CONDITION EVALUATION MATRIX');
    expect(formatted).toContain('Gas Price Ceiling');
    expect(formatted).toContain('Oracle Asset Price Minimum');
    expect(formatted).toContain('🟢 PASS');
    expect(formatted).toContain('FIRE_ACTION');
  });

  it('Requirement 04: Demonstrates both outcomes: FIRE_ACTION and HOLD_ACTION', () => {
    const engine = new ThresholdGuardianEngine();

    // Scenario A: Safe on-chain conditions (Should FIRE)
    const safeTelemetry: OnChainTelemetry = {
      network: 'Pharos Mainnet',
      chainId: 1672,
      blockNumber: 21903022,
      blockTimestamp: 1730519000,
      oraclePriceUsd: 2306.77,
      oracleUpdatedAt: 1730518900,
      oracleLagSeconds: 100,
      gasPriceGwei: 1.0,
      liquidityDepthUsd: 11200000,
    };

    const safeDecision = engine.evaluate(safeTelemetry);
    expect(safeDecision.verdict).toBe('FIRE_ACTION');
    expect(safeDecision.allPassed).toBe(true);
    expect(safeDecision.blockingReasons.length).toBe(0);
    expect(safeDecision.preparedAction).toBeDefined();
    expect(safeDecision.preparedAction?.targetContract).toBe('0xba3b00c3b0632b6fa622f990924976725227b68a');

    // Scenario B: Volatility spike & network congestion (Should HOLD)
    const volatileTelemetry: OnChainTelemetry = {
      network: 'Pharos Mainnet',
      chainId: 1672,
      blockNumber: 21903500,
      blockTimestamp: 1730520000,
      oraclePriceUsd: 1850.00, // VIOLATION: Below $2,000 threshold
      oracleUpdatedAt: 1730519900,
      oracleLagSeconds: 100,
      gasPriceGwei: 12.5,     // VIOLATION: Above 2.0 Gwei threshold
      liquidityDepthUsd: 8500000,
    };

    const holdDecision = engine.evaluate(volatileTelemetry);
    expect(holdDecision.verdict).toBe('HOLD_ACTION');
    expect(holdDecision.allPassed).toBe(false);
    expect(holdDecision.passedCount).toBe(2);
    expect(holdDecision.failedCount).toBe(2);
    expect(holdDecision.blockingReasons.length).toBe(2);
    expect(holdDecision.preparedAction).toBeUndefined();

    const holdReport = GuardianFormatter.formatReport(holdDecision);
    expect(holdReport).toContain('HOLD_ACTION');
    expect(holdReport).toContain('🔴 FAIL');
    expect(holdReport).toContain('EXECUTION BLOCKED BY GUARDIAN');
    expect(holdReport).toContain('Violation: Observed 12.5 Gwei failed requirement');
    expect(holdReport).toContain('Violation: Observed 1,850 USD failed requirement');
  });

  it('Supports BETWEEN operator and custom range assertions', () => {
    const rangeEngine = new ThresholdGuardianEngine({
      logic: 'ALL_MATCH',
      rules: [
        {
          id: 'RULE_GAS_RANGE',
          name: 'Gas Price Corridor',
          metric: 'GAS_PRICE_GWEI',
          operator: 'BETWEEN',
          threshold: [0.5, 3.0],
          unit: 'Gwei',
          description: 'Gas must stay inside 0.5 to 3.0 Gwei corridor',
        },
      ],
    });

    const inRange = rangeEngine.evaluate({
      network: 'Pharos Mainnet',
      chainId: 1672,
      blockNumber: 100,
      blockTimestamp: 1000,
      oraclePriceUsd: 2000,
      oracleUpdatedAt: 1000,
      oracleLagSeconds: 0,
      gasPriceGwei: 1.5,
      liquidityDepthUsd: 1000000,
    });
    expect(inRange.verdict).toBe('FIRE_ACTION');

    const outOfRange = rangeEngine.evaluate({
      network: 'Pharos Mainnet',
      chainId: 1672,
      blockNumber: 100,
      blockTimestamp: 1000,
      oraclePriceUsd: 2000,
      oracleUpdatedAt: 1000,
      oracleLagSeconds: 0,
      gasPriceGwei: 4.5,
      liquidityDepthUsd: 1000000,
    });
    expect(outOfRange.verdict).toBe('HOLD_ACTION');
    expect(outOfRange.blockingReasons[0]).toContain('failed requirement');
  });
});
