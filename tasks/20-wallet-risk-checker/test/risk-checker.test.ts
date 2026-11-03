/**
 * Comprehensive Automated Verification Suite for Pharos Wallet Risk Checker.
 * Validates Requirements 01-04:
 * 01: Evaluates at least 4 security signals (Contract Age, Verified Code, Flagged Associations, Approval Anomalies, Funding Freshness)
 * 02: Outputs discrete Risk Level (LOW, MEDIUM, HIGH) with exact triggering reasons and numerical score
 * 03: Explains each security flag in practical, plain language
 * 04: Demonstrates rigorous appraisal across verified clean, medium-caution, and critical high-risk profiles
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { type Address } from 'viem';
import { WalletRiskEvaluator } from '../src/risk-evaluator.js';
import { OnChainHistoryAnalyzer } from '../src/history-analyzer.js';
import { ThreatIntelligenceRegistry } from '../src/flag-catalog.js';
import { type OnChainAccountProfile } from '../src/types.js';

describe('Task 20: Wallet Risk Checker Specification', () => {
  let evaluator: WalletRiskEvaluator;
  let analyzer: OnChainHistoryAnalyzer;

  beforeEach(() => {
    evaluator = new WalletRiskEvaluator();
    analyzer = new OnChainHistoryAnalyzer();
  });

  describe('Requirement 01: Checks at least 4 distinct risk signals', () => {
    it('evaluates Signal 1 (Contract Age): flags contracts deployed < 24 hours as CRITICAL', () => {
      const freshContractProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x1111000000000000000000000000000000001111' as Address,
        hasBytecode: true,
        accountAgeHours: 4.5, // 4.5 hours old
        isSourceCodeVerified: true,
      });

      const report = evaluator.evaluateAccount(freshContractProfile);
      const ageSignal = report.evaluatedSignals.find((s) => s.signalCategory === 'CONTRACT_AGE');

      expect(ageSignal).toBeDefined();
      expect(ageSignal?.isTriggered).toBe(true);
      expect(ageSignal?.severity).toBe('CRITICAL');
      expect(ageSignal?.plainLanguageExplanation).toContain('less than 24 hours ago');
    });

    it('evaluates Signal 2 (Code Verification): flags unverified opaque contract bytecode as CRITICAL', () => {
      const unverifiedContractProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x2222000000000000000000000000000000002222' as Address,
        hasBytecode: true,
        isSourceCodeVerified: false, // Unverified bytecode
        accountAgeHours: 200, // Established age
      });

      const report = evaluator.evaluateAccount(unverifiedContractProfile);
      const codeSignal = report.evaluatedSignals.find((s) => s.signalCategory === 'CODE_VERIFICATION');

      expect(codeSignal).toBeDefined();
      expect(codeSignal?.isTriggered).toBe(true);
      expect(codeSignal?.severity).toBe('CRITICAL');
      expect(codeSignal?.plainLanguageExplanation).toContain('unverified on PharosScan');
    });

    it('evaluates Signal 3 (Flagged Association): flags direct funding linkage to known drainers/exploiters', () => {
      const taintedWalletProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x3333000000000000000000000000000000003333' as Address,
        hasBytecode: false,
        fundingSourceAddress: '0x9999000000000000000000000000000000006666' as Address, // Pharos Permit2 Drainer
        accountAgeHours: 120,
      });

      const report = evaluator.evaluateAccount(taintedWalletProfile);
      const threatSignal = report.evaluatedSignals.find((s) => s.signalCategory === 'FLAGGED_ASSOCIATION');

      expect(threatSignal).toBeDefined();
      expect(threatSignal?.isTriggered).toBe(true);
      expect(threatSignal?.severity).toBe('CRITICAL');
      expect(threatSignal?.plainLanguageExplanation).toContain('Pharos Permit2 Drainer Syndicate');
    });

    it('evaluates Signal 4 (Approval Anomalies): flags dangerous unlimited token approvals to untrusted spenders', () => {
      const recklessWalletProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x4444000000000000000000000000000000004444' as Address,
        hasBytecode: false,
        highRiskAllowancesCount: 3, // 3 unlimited approvals
        accountAgeHours: 500,
      });

      const report = evaluator.evaluateAccount(recklessWalletProfile);
      const approvalSignal = report.evaluatedSignals.find((s) => s.signalCategory === 'APPROVAL_ANOMALIES');

      expect(approvalSignal).toBeDefined();
      expect(approvalSignal?.isTriggered).toBe(true);
      expect(approvalSignal?.severity).toBe('HIGH');
      expect(approvalSignal?.plainLanguageExplanation).toContain('unlimited (MaxUint256) token spending approvals');
    });

    it('evaluates Signal 5 (Funding Freshness): flags freshly created burner wallets with minimal history', () => {
      const burnerWalletProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x5555000000000000000000000000000000005555' as Address,
        hasBytecode: false,
        accountAgeHours: 2.0, // 2 hours old
        transactionCount: 1, // Only 1 tx
      });

      const report = evaluator.evaluateAccount(burnerWalletProfile);
      const freshnessSignal = report.evaluatedSignals.find((s) => s.signalCategory === 'FUNDING_FRESHNESS');

      expect(freshnessSignal).toBeDefined();
      expect(freshnessSignal?.isTriggered).toBe(true);
      expect(freshnessSignal?.severity).toBe('HIGH');
      expect(freshnessSignal?.plainLanguageExplanation).toContain('created less than 12 hours ago');
    });
  });

  describe('Requirement 02: Outputs risk level (LOW, MEDIUM, HIGH) with specific reasons', () => {
    it('rates an address with severe red flags as HIGH risk with specific failure reasons', () => {
      const maliciousDeployerProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x6666111166661111666611116666111166661111' as Address,
        hasBytecode: true,
        accountAgeHours: 1.5, // Freshly deployed (< 24h)
        isSourceCodeVerified: false, // Unverified
        fundingSourceAddress: '0x8888000000000000000000000000000000007777' as Address, // Harbor exploiter
        transactionCount: 2,
      });

      const report = evaluator.evaluateAccount(maliciousDeployerProfile);

      expect(report.riskLevel).toBe('HIGH');
      expect(report.numericalRiskScore).toBeGreaterThanOrEqual(75);
      expect(report.triggeredFlagsCount).toBeGreaterThanOrEqual(2);
      expect(report.summaryRecommendation).toContain('DO NOT TRANSACT · HIGH RISK DETECTED');

      const triggeredNames = report.evaluatedSignals.filter((s) => s.isTriggered).map((s) => s.signalName);
      expect(triggeredNames).toContain('Freshly Deployed Immature Contract');
      expect(triggeredNames).toContain('Unverified Opaque Bytecode');
      expect(triggeredNames).toContain('Direct Association with Flagged Threat Entity');
    });

    it('rates an address with mild warnings as MEDIUM risk with actionable cautionary advice', () => {
      const cautionaryProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x7777222277772222777722227777222277772222' as Address,
        hasBytecode: false,
        accountAgeHours: 24, // 1 day old
        transactionCount: 4, // Low activity
        highRiskAllowancesCount: 1, // 1 loose approval
      });

      const report = evaluator.evaluateAccount(cautionaryProfile);

      expect(report.riskLevel).toBe('MEDIUM');
      expect(report.numericalRiskScore).toBeGreaterThanOrEqual(25);
      expect(report.numericalRiskScore).toBeLessThan(60);
      expect(report.summaryRecommendation).toContain('PROCEED WITH CAUTION · MEDIUM RISK');
    });

    it('rates a verified, mature address with zero red flags as LOW risk', () => {
      const reputableProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x8888333388883333888833338888333388883333' as Address,
        hasBytecode: true,
        isSourceCodeVerified: true,
        accountAgeHours: 1440, // 60 days old
        transactionCount: 1250,
        flaggedInteractionsCount: 0,
        highRiskAllowancesCount: 0,
      });

      const report = evaluator.evaluateAccount(reputableProfile);

      expect(report.riskLevel).toBe('LOW');
      expect(report.numericalRiskScore).toBe(0);
      expect(report.triggeredFlagsCount).toBe(0);
      expect(report.summaryRecommendation).toContain('SAFE TO TRANSACT · LOW RISK');
    });
  });

  describe('Requirement 03: Explains each flag in plain language', () => {
    it('ensures every triggered signal includes an understandable, jargon-free explanation', () => {
      const riskyProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x9999444499994444999944449999444499994444' as Address,
        hasBytecode: true,
        accountAgeHours: 3.0,
        isSourceCodeVerified: false,
        highRiskAllowancesCount: 2,
      });

      const report = evaluator.evaluateAccount(riskyProfile);
      const triggered = report.evaluatedSignals.filter((s) => s.isTriggered);

      expect(triggered.length).toBeGreaterThan(0);
      for (const signal of triggered) {
        expect(signal.plainLanguageExplanation).toBeTruthy();
        expect(signal.plainLanguageExplanation.length).toBeGreaterThan(30);
        // Practical advice without dry robotic jargon
        expect(signal.observedEvidence).toBeTruthy();
      }
    });
  });

  describe('Requirement 04: Demonstrated on at least 1 clean and 1 risky example', () => {
    it('Demonstrates CLEAN Example: FaroSwap Mainnet Router (low risk, 100% clean posture)', () => {
      const cleanFaroSwapRouter: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x1000000000000000000000000000000000000001' as Address,
        accountType: 'SMART_CONTRACT',
        hasBytecode: true,
        isSourceCodeVerified: true,
        accountAgeHours: 2160, // 90 days active
        transactionCount: 45000,
        nativeBalanceEther: '25.0',
        flaggedInteractionsCount: 0,
        highRiskAllowancesCount: 0,
      });

      const report = evaluator.evaluateAccount(cleanFaroSwapRouter);

      expect(report.riskLevel).toBe('LOW');
      expect(report.numericalRiskScore).toBe(0);
      expect(report.triggeredFlagsCount).toBe(0);
      expect(report.summaryRecommendation).toContain('SAFE TO TRANSACT');
    });

    it('Demonstrates RISKY Example: Malicious Honeypot Deployer (HIGH risk, multiple red flags)', () => {
      const riskyHoneypot: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0xBad0000000000000000000000000000000000bad' as Address,
        accountType: 'SMART_CONTRACT',
        hasBytecode: true,
        isSourceCodeVerified: false, // Hidden source
        accountAgeHours: 1.2, // 1 hour old
        transactionCount: 2,
        fundingSourceAddress: '0x9999000000000000000000000000000000006666' as Address, // Drainer syndicate
        flaggedInteractionsCount: 2,
        highRiskAllowancesCount: 1,
      });

      const report = evaluator.evaluateAccount(riskyHoneypot);

      expect(report.riskLevel).toBe('HIGH');
      expect(report.numericalRiskScore).toBe(100); // Max risk
      expect(report.triggeredFlagsCount).toBeGreaterThanOrEqual(3);
      expect(report.summaryRecommendation).toContain('DO NOT TRANSACT · HIGH RISK DETECTED');
    });
  });

  describe('Edge Cases: Uninitialized accounts and custom threat directory updates', () => {
    it('handles uninitialized zero-nonce accounts without false positive high-risk alarms', () => {
      const freshRecipientProfile: OnChainAccountProfile = analyzer.createStaticProfile({
        targetAddress: '0x0000111122223333444455556666777788889999' as Address,
        accountType: 'UNINITIALIZED_ZERO_NONCE',
        hasBytecode: false,
        accountAgeHours: 0,
        transactionCount: 0,
        nativeBalanceEther: '0.0',
      });

      const report = evaluator.evaluateAccount(freshRecipientProfile);

      // Should be LOW risk (informational only)
      expect(report.riskLevel).toBe('LOW');
      expect(report.numericalRiskScore).toBeLessThan(25);
      const signal = report.evaluatedSignals.find((s) => s.signalCategory === 'FUNDING_FRESHNESS');
      expect(signal?.signalName).toContain('Uninitialized Recipient Address');
      expect(signal?.severity).toBe('LOW');
    });

    it('allows dynamic threat registration to update live risk detection', () => {
      const customThreatRegistry = new ThreatIntelligenceRegistry([]);
      const customEvaluator = new WalletRiskEvaluator(customThreatRegistry);

      const testAddress = '0x1212121212121212121212121212121212121212' as Address;
      const initialProfile = analyzer.createStaticProfile({
        targetAddress: '0x9898989898989898989898989898989898989898' as Address,
        fundingSourceAddress: testAddress,
        accountAgeHours: 500,
        transactionCount: 50,
      });

      // Initially not flagged
      expect(customEvaluator.evaluateAccount(initialProfile).riskLevel).toBe('LOW');

      // Register new threat dynamically
      customThreatRegistry.registerThreat({
        address: testAddress,
        entityName: 'New Flash Loan Hijacker',
        threatCategory: 'EXPLOITER',
        dateIdentifiedIso: '2026-03-20T00:00:00Z',
      });

      // Re-evaluate: Now flagged as HIGH
      const updatedReport = customEvaluator.evaluateAccount(initialProfile);
      expect(updatedReport.riskLevel).toBe('HIGH');
      expect(updatedReport.summaryRecommendation).toContain('New Flash Loan Hijacker');
    });
  });
});
