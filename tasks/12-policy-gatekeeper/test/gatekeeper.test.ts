import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PolicyGatekeeperEngine } from '../src/gatekeeper-engine.js';
import { AuditLogger } from '../src/audit-logger.js';
import { DEFAULT_POLICY } from '../src/default-policy.js';
import {
  SCENARIO_ALLOWED_TRANSACTION,
  SCENARIO_DENY_SPEND_LIMIT,
  SCENARIO_DENY_ALLOWLIST,
  SCENARIO_DENY_TIME_WINDOW,
} from '../src/scenarios.js';
import { ActionProposal } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_LOG_PATH = path.resolve(__dirname, 'test-audit.log.jsonl');

describe('Task 12: Policy Gatekeeper - Zero-Trust Execution Sentinel', () => {
  let logger: AuditLogger;
  let engine: PolicyGatekeeperEngine;

  beforeEach(() => {
    logger = new AuditLogger(TEST_LOG_PATH);
    logger.clear();
    engine = new PolicyGatekeeperEngine(undefined, logger);
  });

  afterEach(() => {
    logger.clear();
  });

  // =========================================================================
  // Requirement 01: Policy File/Config with at least 3 Rule Types
  // =========================================================================
  describe('Requirement 01: Policy Configuration & Rule Definitions', () => {
    it('should define a comprehensive policy configuration with at least 3 distinct rule types', () => {
      const config = engine.getConfig();

      expect(config.policyId).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.rules).toBeDefined();

      // Rule Type 1: Spend Limits
      expect(config.rules.spendLimits).toBeDefined();
      expect(config.rules.spendLimits.maxPerTxNativePros).toBeGreaterThan(0);
      expect(config.rules.spendLimits.maxPerTxTokenUsdc).toBeGreaterThan(0);
      expect(config.rules.spendLimits.maxGlobalPerTxUsd).toBeGreaterThan(0);

      // Rule Type 2: Allowlist & Security Boundaries
      expect(config.rules.allowlist).toBeDefined();
      expect(config.rules.allowlist.allowedContracts.length).toBeGreaterThan(0);
      expect(config.rules.allowlist.allowedFunctionSelectors.length).toBeGreaterThan(0);
      expect(config.rules.allowlist.blockedAddresses.length).toBeGreaterThan(0);

      // Rule Type 3: Operational Time Window
      expect(config.rules.timeWindow).toBeDefined();
      expect(config.rules.timeWindow.allowedUtcHours.start).toBeDefined();
      expect(config.rules.timeWindow.allowedUtcHours.end).toBeDefined();
      expect(config.rules.timeWindow.allowedDaysOfWeek.length).toBeGreaterThan(0);
    });

    it('should allow custom overrides for policy thresholds', () => {
      const custom = new PolicyGatekeeperEngine({
        rules: {
          spendLimits: {
            ...DEFAULT_POLICY.rules.spendLimits,
            maxPerTxNativePros: 25.0,
          },
          allowlist: DEFAULT_POLICY.rules.allowlist,
          timeWindow: DEFAULT_POLICY.rules.timeWindow,
        },
      });

      expect(custom.getConfig().rules.spendLimits.maxPerTxNativePros).toBe(25.0);
    });
  });

  // =========================================================================
  // Requirement 02: Deterministic ALLOW/DENY with Specific Deciding Rule
  // =========================================================================
  describe('Requirement 02: Deterministic Decision with Specific Deciding Rule', () => {
    it('should return ALLOW with RULE_POLICY_CLEARANCE when all rules pass', async () => {
      const decision = await engine.evaluate(SCENARIO_ALLOWED_TRANSACTION);

      expect(decision.verdict).toBe('ALLOW');
      expect(decision.decidingRuleId).toBe('RULE_POLICY_CLEARANCE');
      expect(decision.decidingRuleType).toBe('GLOBAL_POLICY');
      expect(decision.decidingRuleName).toBe('All Policy Gates Passed');
      expect(decision.rationale).toContain('complies with all spend limits');
      expect(decision.evaluations.every((e) => e.passed)).toBe(true);
    });

    it('should identify the exact deciding rule ID and type for every denied proposal', async () => {
      const spendDecision = await engine.evaluate(SCENARIO_DENY_SPEND_LIMIT);
      expect(spendDecision.verdict).toBe('DENY');
      expect(spendDecision.decidingRuleId).toBe('RULE_SPEND_LIMIT_USDC');
      expect(spendDecision.decidingRuleType).toBe('SPEND_LIMIT');

      const allowlistDecision = await engine.evaluate(SCENARIO_DENY_ALLOWLIST);
      expect(allowlistDecision.verdict).toBe('DENY');
      expect(allowlistDecision.decidingRuleId).toBe('RULE_ALLOWLIST_BLOCKED_ADDRESS');
      expect(allowlistDecision.decidingRuleType).toBe('ALLOWLIST');

      const timeDecision = await engine.evaluate(SCENARIO_DENY_TIME_WINDOW);
      expect(timeDecision.verdict).toBe('DENY');
      expect(timeDecision.decidingRuleId).toBe('RULE_TIME_WINDOW_OPERATIONAL_HOURS');
      expect(timeDecision.decidingRuleType).toBe('TIME_WINDOW');
    });
  });

  // =========================================================================
  // Requirement 03: Denied Actions Never Executed + At Least One Deny per Rule Type
  // =========================================================================
  describe('Requirement 03: Safe Neutralization & Multi-Rule Denials', () => {
    it('should issue authorization ticket and cast command ONLY when action is allowed', async () => {
      const allowDecision = await engine.evaluate(SCENARIO_ALLOWED_TRANSACTION);
      expect(allowDecision.authorizationTicket).toBeDefined();
      expect(allowDecision.authorizationTicket?.ticketHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(allowDecision.authorizationTicket?.castCommand).toContain('cast send');
      expect(allowDecision.authorizationTicket?.castCommand).toContain('0xc879c018db60520f4355c26ed1a6d572cdac1815');
    });

    it('should NEVER issue authorization ticket or cast command when action is denied', async () => {
      const deniedProposals = [
        SCENARIO_DENY_SPEND_LIMIT,
        SCENARIO_DENY_ALLOWLIST,
        SCENARIO_DENY_TIME_WINDOW,
      ];

      for (const proposal of deniedProposals) {
        const decision = await engine.evaluate(proposal);
        expect(decision.verdict).toBe('DENY');
        // Critical Zero-Trust invariant: Denied actions are never executed / no tickets issued
        expect(decision.authorizationTicket).toBeUndefined();
      }
    });

    it('should demonstrate at least one deny for Spend Limit rule type (Rule 1)', async () => {
      // 1A: Native PROS ceiling exceeded
      const nativeExceeded: ActionProposal = {
        actionId: 'test-native-limit',
        agentId: 'test-agent',
        actionType: 'NATIVE_TRANSFER',
        targetContract: '0xcA11bde05977b3631167028862bE2a173976CA11',
        functionSelector: 'aggregate3((address,bool,bytes)[])',
        nativeValuePros: 15.0, // Exceeds 10.0 limit
        timestamp: '2026-11-02T12:00:00Z',
      };
      const decNative = await engine.evaluate(nativeExceeded);
      expect(decNative.verdict).toBe('DENY');
      expect(decNative.decidingRuleType).toBe('SPEND_LIMIT');
      expect(decNative.decidingRuleId).toBe('RULE_SPEND_LIMIT_NATIVE');

      // 1B: Token USDC ceiling exceeded
      const decToken = await engine.evaluate(SCENARIO_DENY_SPEND_LIMIT);
      expect(decToken.verdict).toBe('DENY');
      expect(decToken.decidingRuleType).toBe('SPEND_LIMIT');
      expect(decToken.decidingRuleId).toBe('RULE_SPEND_LIMIT_USDC');

      // 1C: Global USD ceiling exceeded (native PROS within native cap, but aggregate USD value exceeds $2,500)
      const globalUsdExceeded: ActionProposal = {
        actionId: 'test-global-usd-limit',
        agentId: 'test-agent',
        actionType: 'HIGH_VALUE_SWAP',
        targetContract: '0xcA11bde05977b3631167028862bE2a173976CA11',
        functionSelector: 'aggregate3((address,bool,bytes)[])',
        nativeValuePros: 2.0, // 2 PROS @ ~$2,300 = $4,600 USD (exceeds $2,500 USD ceiling)
        tokenValueUsdc: 100.0,
        timestamp: '2026-11-02T12:00:00Z',
      };
      const decGlobal = await engine.evaluate(globalUsdExceeded);
      expect(decGlobal.verdict).toBe('DENY');
      expect(decGlobal.decidingRuleType).toBe('SPEND_LIMIT');
      expect(decGlobal.decidingRuleId).toBe('RULE_SPEND_LIMIT_GLOBAL_USD');
    });

    it('should demonstrate at least one deny for Allowlist rule type (Rule 2)', async () => {
      // 2A: Blocked blacklisted address
      const decBlocked = await engine.evaluate(SCENARIO_DENY_ALLOWLIST);
      expect(decBlocked.verdict).toBe('DENY');
      expect(decBlocked.decidingRuleType).toBe('ALLOWLIST');
      expect(decBlocked.decidingRuleId).toBe('RULE_ALLOWLIST_BLOCKED_ADDRESS');

      // 2B: Unregistered contract address
      const unregContract: ActionProposal = {
        actionId: 'test-unreg-contract',
        agentId: 'test-agent',
        actionType: 'ARBITRARY_CALL',
        targetContract: '0x1234567890123456789012345678901234567890',
        functionSelector: 'transfer(address,uint256)',
        timestamp: '2026-11-02T12:00:00Z',
      };
      const decUnreg = await engine.evaluate(unregContract);
      expect(decUnreg.verdict).toBe('DENY');
      expect(decUnreg.decidingRuleType).toBe('ALLOWLIST');
      expect(decUnreg.decidingRuleId).toBe('RULE_ALLOWLIST_CONTRACT');

      // 2C: Unauthorized recipient address
      const unauthRecipient: ActionProposal = {
        actionId: 'test-unauth-recipient',
        agentId: 'test-agent',
        actionType: 'ERC20_TRANSFER',
        targetContract: '0xc879c018db60520f4355c26ed1a6d572cdac1815', // Allowed USDC token
        recipientAddress: '0x9999999999999999999999999999999999999999', // Unknown / untrusted recipient
        functionSelector: 'transfer(address,uint256)',
        tokenValueUsdc: 25.0,
        timestamp: '2026-11-02T12:00:00Z',
      };
      const decRecipient = await engine.evaluate(unauthRecipient);
      expect(decRecipient.verdict).toBe('DENY');
      expect(decRecipient.decidingRuleType).toBe('ALLOWLIST');
      expect(decRecipient.decidingRuleId).toBe('RULE_ALLOWLIST_RECIPIENT');

      // 2D: Unapproved function selector
      const unauthFunc: ActionProposal = {
        actionId: 'test-unauth-func',
        agentId: 'test-agent',
        actionType: 'MALICIOUS_DRAIN',
        targetContract: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
        functionSelector: 'selfDestructOrDrain()',
        timestamp: '2026-11-02T12:00:00Z',
      };
      const decFunc = await engine.evaluate(unauthFunc);
      expect(decFunc.verdict).toBe('DENY');
      expect(decFunc.decidingRuleType).toBe('ALLOWLIST');
      expect(decFunc.decidingRuleId).toBe('RULE_ALLOWLIST_FUNCTION_SELECTOR');
    });

    it('should demonstrate at least one deny for Time Window rule type (Rule 3)', async () => {
      // 3A: Off-hours hour of day (03:00 UTC)
      const decOffHours = await engine.evaluate(SCENARIO_DENY_TIME_WINDOW);
      expect(decOffHours.verdict).toBe('DENY');
      expect(decOffHours.decidingRuleType).toBe('TIME_WINDOW');
      expect(decOffHours.decidingRuleId).toBe('RULE_TIME_WINDOW_OPERATIONAL_HOURS');

      // 3B: Weekend prohibited day (Sunday = day 0)
      const weekendProposal: ActionProposal = {
        actionId: 'test-weekend',
        agentId: 'test-agent',
        actionType: 'WEEKEND_CALL',
        targetContract: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
        functionSelector: 'transfer(address,uint256)',
        tokenValueUsdc: 10,
        timestamp: '2026-11-01T14:00:00Z', // 2026-11-01 is Sunday
      };
      const decWeekend = await engine.evaluate(weekendProposal);
      expect(decWeekend.verdict).toBe('DENY');
      expect(decWeekend.decidingRuleType).toBe('TIME_WINDOW');
      expect(decWeekend.decidingRuleId).toBe('RULE_TIME_WINDOW_DAY_OF_WEEK');

      // 3C: Scheduled protocol maintenance blackout window (Monday within working hours, but under blackout freeze)
      const blackoutProposal: ActionProposal = {
        actionId: 'test-blackout',
        agentId: 'test-agent',
        actionType: 'UPGRADE_WINDOW_TX',
        targetContract: '0xc879c018db60520f4355c26ed1a6d572cdac1815',
        functionSelector: 'transfer(address,uint256)',
        tokenValueUsdc: 10,
        timestamp: '2026-11-16T15:00:00Z', // During Nov 16 14:00-18:00 UTC blackout
      };
      const decBlackout = await engine.evaluate(blackoutProposal);
      expect(decBlackout.verdict).toBe('DENY');
      expect(decBlackout.decidingRuleType).toBe('TIME_WINDOW');
      expect(decBlackout.decidingRuleId).toBe('RULE_TIME_WINDOW_BLACKOUT');
    });

    it('should correctly normalize mixed-case addresses during allowlist verification', async () => {
      // Mixed-case version of allowed Multicall3 contract
      const mixedCaseTarget = '0xCA11BDE05977B3631167028862BE2A173976CA11' as `0x${string}`;
      const mixedCaseProposal: ActionProposal = {
        actionId: 'test-casing',
        agentId: 'test-agent',
        actionType: 'MULTICALL_READ',
        targetContract: mixedCaseTarget,
        functionSelector: 'aggregate3((address,bool,bytes)[])',
        nativeValuePros: 0,
        timestamp: '2026-11-02T12:00:00Z',
      };

      const decision = await engine.evaluate(mixedCaseProposal);
      expect(decision.verdict).toBe('ALLOW');
      expect(decision.decidingRuleId).toBe('RULE_POLICY_CLEARANCE');
    });
  });

  // =========================================================================
  // Requirement 04: Persistent Audit Log of All Decisions
  // =========================================================================
  describe('Requirement 04: Audit Trail Integrity', () => {
    it('should record every evaluation into append-only persistent audit log', async () => {
      expect(logger.readAll()).toHaveLength(0);

      await engine.evaluate(SCENARIO_ALLOWED_TRANSACTION);
      await engine.evaluate(SCENARIO_DENY_SPEND_LIMIT);
      await engine.evaluate(SCENARIO_DENY_ALLOWLIST);
      await engine.evaluate(SCENARIO_DENY_TIME_WINDOW);

      const entries = logger.readAll();
      expect(entries).toHaveLength(4);

      // Verify structure of audit log entries
      for (const entry of entries) {
        expect(entry.decisionId).toBeDefined();
        expect(entry.timestamp).toBeDefined();
        expect(entry.agentId).toBeDefined();
        expect(entry.verdict).toMatch(/ALLOW|DENY/);
        expect(entry.decidingRuleId).toBeDefined();
        expect(entry.decidingRuleType).toBeDefined();
        expect(entry.rationale).toBeDefined();
      }

      // Verify filtered queries
      const allowed = logger.getByVerdict('ALLOW');
      const denied = logger.getByVerdict('DENY');
      expect(allowed).toHaveLength(1);
      expect(denied).toHaveLength(3);

      // Verify authorization ticket in allow entry
      expect(allowed[0].ticketHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(denied[0].ticketHash).toBeUndefined();
    });

    it('should persist JSONL file on disk readable across engine restarts', async () => {
      await engine.evaluate(SCENARIO_ALLOWED_TRANSACTION);
      expect(fs.existsSync(TEST_LOG_PATH)).toBe(true);

      // Re-instantiate logger from disk
      const newLoggerInstance = new AuditLogger(TEST_LOG_PATH);
      const entries = newLoggerInstance.readAll();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].actionType).toBe('USDC_TREASURY_TRANSFER');
    });
  });
});
