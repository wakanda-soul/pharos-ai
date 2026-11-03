/**
 * Task 28: x402 Agent Buyer
 * Test Suite: rigorous verification of multi-endpoint purchases, budget caps,
 * audit logging, idempotent retry deduplication, and dual demo scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  X402AgentBuyer,
  MockX402Server,
  SpendBudgetPolicy,
  roundToMicroUnits,
} from '../src/index.js';

describe('Task 28: x402 Agent Buyer', () => {
  let mockServer: MockX402Server;
  let standardPolicy: SpendBudgetPolicy;

  beforeEach(() => {
    mockServer = new MockX402Server();
    standardPolicy = {
      totalSpendBudgetUsdc: 0.20, // $0.20 total spend ceiling
      maxPerCallLimitUsdc: 0.10, // $0.10 per-call cap
      currency: 'USDC',
      maxSafeRetries: 3,
      retryBackoffMs: 10,
    };
  });

  describe('Criterion 01: Multi-Endpoint Consumption', () => {
    it('successfully calls and purchases from at least 2 distinct x402 endpoints', async () => {
      const buyer = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      });

      // Endpoint 1: Market volatility oracle ($0.04 USDC)
      const res1 = await buyer.purchaseResource<any>({
        endpointUrl: '/oracle/market-volatility',
        intendedPurpose: 'Query 30-day implied volatility for hedging calculation',
        idempotencyKey: 'idemp_test_oracle_vol_001',
      });

      expect(res1.isSuccess).toBe(true);
      expect(res1.httpStatusCode).toBe(200);
      expect(res1.paymentReceipt).toBeDefined();
      expect(res1.paymentReceipt?.chargedPriceUsdc).toBe(0.04);
      expect(res1.payload?.data?.assetPair).toBe('PHAROS/USDC');
      expect(res1.payload?.data?.iv30d).toBe('42.8%');

      // Endpoint 2: Whale flow intelligence ($0.06 USDC)
      const res2 = await buyer.purchaseResource<any>({
        endpointUrl: '/intel/whale-flow',
        intendedPurpose: 'Analyze large wallet accumulation trends',
        idempotencyKey: 'idemp_test_whale_flow_002',
      });

      expect(res2.isSuccess).toBe(true);
      expect(res2.httpStatusCode).toBe(200);
      expect(res2.paymentReceipt).toBeDefined();
      expect(res2.paymentReceipt?.chargedPriceUsdc).toBe(0.06);
      expect(res2.payload?.data?.flowWindow).toBe('24h');
      expect(res2.payload?.data?.dominantDirection).toBe('ACCUMULATION');

      // Verify that 2 distinct endpoints were settled
      expect(buyer.getJournal().getSettledTransactionCount()).toBe(2);
      expect(buyer.getJournal().getRunningTotalSpendUsdc()).toBe(0.10);
      expect(buyer.getJournal().getRemainingBudgetUsdc()).toBe(0.10);
    });
  });

  describe('Criterion 02: Budget & Price Cap Enforcement', () => {
    it('refuses call when endpoint price exceeds per-call price cap', async () => {
      const buyer = new X402AgentBuyer({
        policy: standardPolicy, // maxPerCallLimitUsdc = 0.10
        mockServer,
      });

      // /risk/insolvency-depth costs $0.12 USDC, exceeding $0.10 cap
      const res = await buyer.purchaseResource<any>({
        endpointUrl: '/risk/insolvency-depth',
        intendedPurpose: 'Audit collateral insolvency risks',
        idempotencyKey: 'idemp_test_expensive_call_003',
      });

      expect(res.isSuccess).toBe(false);
      expect(res.httpStatusCode).toBe(402);
      expect(res.failureReason).toContain('exceeds per-call safety ceiling');

      // Verify zero funds debited
      expect(buyer.getJournal().getRunningTotalSpendUsdc()).toBe(0);
      expect(buyer.getJournal().getRemainingBudgetUsdc()).toBe(0.20);

      // Verify rejection was recorded in journal with explanation
      const records = buyer.getJournal().getJournalSnapshot();
      expect(records.length).toBe(1);
      expect(records[0].disposition).toBe('REJECTED_PRICE_CAP');
      expect(records[0].chargedPriceUsdc).toBe(0);
    });

    it('refuses call when purchase would breach cumulative total budget ceiling', async () => {
      const tightBudgetPolicy: SpendBudgetPolicy = {
        totalSpendBudgetUsdc: 0.08, // Total budget $0.08
        maxPerCallLimitUsdc: 0.10,
        currency: 'USDC',
        maxSafeRetries: 2,
        retryBackoffMs: 5,
      };

      const buyer = new X402AgentBuyer({
        policy: tightBudgetPolicy,
        mockServer,
      });

      // Call 1: $0.06 USDC -> Approved ($0.06 / $0.08 spent, $0.02 remaining)
      const res1 = await buyer.purchaseResource<any>({
        endpointUrl: '/intel/whale-flow',
        intendedPurpose: 'Whale tracking',
        idempotencyKey: 'idemp_test_step1_004',
      });
      expect(res1.isSuccess).toBe(true);
      expect(buyer.getJournal().getRunningTotalSpendUsdc()).toBe(0.06);

      // Call 2: $0.04 USDC -> Would total $0.10 > $0.08 -> Halted!
      const res2 = await buyer.purchaseResource<any>({
        endpointUrl: '/oracle/market-volatility',
        intendedPurpose: 'Volatility tracking',
        idempotencyKey: 'idemp_test_step2_breach_005',
      });

      expect(res2.isSuccess).toBe(false);
      expect(res2.failureReason).toContain('would breach total spend ceiling');
      expect(buyer.getJournal().getRunningTotalSpendUsdc()).toBe(0.06); // Still exactly $0.06
      expect(buyer.getJournal().getRemainingBudgetUsdc()).toBe(0.02);

      const records = buyer.getJournal().getJournalSnapshot();
      expect(records.length).toBe(2);
      expect(records[1].disposition).toBe('HALTED_BUDGET_EXHAUSTED');
    });
  });

  describe('Criterion 03: Itemized Audit Journal & Running Total', () => {
    it('logs every payment with price, what it bought, tx hash, and running total spend', async () => {
      const buyer = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      });

      await buyer.purchaseResource<any>({
        endpointUrl: '/oracle/market-volatility',
        intendedPurpose: 'Market Volatility Feed',
        idempotencyKey: 'idemp_audit_001',
      });

      await buyer.purchaseResource<any>({
        endpointUrl: '/intel/whale-flow',
        intendedPurpose: 'Smart Money Inflow',
        idempotencyKey: 'idemp_audit_002',
      });

      const journal = buyer.getJournal().getJournalSnapshot();
      expect(journal.length).toBe(2);

      // Verify Entry 1
      expect(journal[0].sequenceIndex).toBe(1);
      expect(journal[0].chargedPriceUsdc).toBe(0.04);
      expect(journal[0].whatItBought).toContain('30-day implied DEX volatility index');
      expect(journal[0].transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(journal[0].runningTotalSpendUsdc).toBe(0.04);
      expect(journal[0].remainingBudgetUsdc).toBe(0.16);
      expect(journal[0].disposition).toBe('SETTLED');

      // Verify Entry 2
      expect(journal[1].sequenceIndex).toBe(2);
      expect(journal[1].chargedPriceUsdc).toBe(0.06);
      expect(journal[1].whatItBought).toContain('Atlantic whale wallet accumulation');
      expect(journal[1].transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(journal[1].runningTotalSpendUsdc).toBe(0.10);
      expect(journal[1].remainingBudgetUsdc).toBe(0.10);
      expect(journal[1].disposition).toBe('SETTLED');
    });
  });

  describe('Criterion 04: Idempotency & Safe Retries', () => {
    it('safely recovers from transient 5xx server drops without extra debits', async () => {
      const buyer = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      });

      // /oracle/transient-flaky fails twice with HTTP 503, then succeeds on 3rd attempt
      const res = await buyer.purchaseResource<any>({
        endpointUrl: '/oracle/transient-flaky',
        intendedPurpose: 'Query resilient oracle feed',
        idempotencyKey: 'idemp_flaky_retry_001',
      });

      expect(res.isSuccess).toBe(true);
      expect(res.retryCount).toBe(2); // Retried twice
      expect(res.paymentReceipt?.chargedPriceUsdc).toBe(0.05);

      // Crucial: Despite 2 retries, money is ONLY debited once!
      expect(buyer.getJournal().getRunningTotalSpendUsdc()).toBe(0.05);
      expect(buyer.getJournal().getSettledTransactionCount()).toBe(1);
    });

    it('deduplicates replayed requests with same idempotency key and prevents double payment', async () => {
      const buyer = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      });

      const fixedKey = 'idemp_static_replay_token_099';

      // First call
      const firstRes = await buyer.purchaseResource<any>({
        endpointUrl: '/oracle/market-volatility',
        intendedPurpose: 'First invocation',
        idempotencyKey: fixedKey,
      });
      expect(firstRes.isSuccess).toBe(true);
      expect(firstRes.isReplayDeduplicated).toBe(false);
      expect(buyer.getJournal().getRunningTotalSpendUsdc()).toBe(0.04);

      // Replay identical call with exact same idempotency token
      const secondRes = await buyer.purchaseResource<any>({
        endpointUrl: '/oracle/market-volatility',
        intendedPurpose: 'Accidental duplicate invocation',
        idempotencyKey: fixedKey,
      });

      expect(secondRes.isSuccess).toBe(true);
      expect(secondRes.isReplayDeduplicated).toBe(true); // Flagged as deduplicated
      expect(secondRes.paymentReceipt?.transactionHash).toBe(firstRes.paymentReceipt?.transactionHash);

      // Verify zero additional debits occurred
      expect(buyer.getJournal().getRunningTotalSpendUsdc()).toBe(0.04);
      expect(buyer.getJournal().getSettledTransactionCount()).toBe(1);
    });
  });

  describe('Criterion 05: Dual Demo Task Execution', () => {
    it('Demo Scenario A: Agent successfully completes job within budget', async () => {
      // Job: "Conduct Multi-Asset Volatility and Whale Flow Intelligence Synthesis"
      // Budget: $0.20 USDC, Cap: $0.10 USDC
      const agent = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      });

      const step1 = await agent.purchaseResource<any>({
        endpointUrl: '/oracle/market-volatility',
        intendedPurpose: 'Market Volatility Telemetry',
        idempotencyKey: 'demo_a_step1',
      });
      expect(step1.isSuccess).toBe(true);

      const step2 = await agent.purchaseResource<any>({
        endpointUrl: '/intel/whale-flow',
        intendedPurpose: 'Whale Movement Telemetry',
        idempotencyKey: 'demo_a_step2',
      });
      expect(step2.isSuccess).toBe(true);

      // Synthesize final intelligence report
      const report = {
        status: 'JOB_COMPLETED_WITHIN_BUDGET',
        volatility: step1.payload?.data?.iv30d,
        whaleFlow: step2.payload?.data?.dominantDirection,
        totalSpentUsdc: agent.getJournal().getRunningTotalSpendUsdc(),
        unspentSurplusUsdc: agent.getJournal().getRemainingBudgetUsdc(),
      };

      expect(report.status).toBe('JOB_COMPLETED_WITHIN_BUDGET');
      expect(report.totalSpentUsdc).toBe(0.10);
      expect(report.unspentSurplusUsdc).toBe(0.10);
      expect(report.volatility).toBe('42.8%');
      expect(report.whaleFlow).toBe('ACCUMULATION');
    });

    it('Demo Scenario B: Agent gracefully halts because it hits budget ceiling', async () => {
      // Scenario: Agent has $0.15 USDC budget.
      // Call 1: $0.06 (whale flow) -> $0.06 spent, $0.09 left.
      // Call 2: $0.04 (volatility) -> $0.10 spent, $0.05 left.
      // Call 3: $0.09 (liquidity depth) -> would cost $0.19 > $0.15 ceiling -> HALTS!
      const ceilingBudgetPolicy: SpendBudgetPolicy = {
        totalSpendBudgetUsdc: 0.15,
        maxPerCallLimitUsdc: 0.10,
        currency: 'USDC',
        maxSafeRetries: 2,
        retryBackoffMs: 5,
      };

      const agent = new X402AgentBuyer({
        policy: ceilingBudgetPolicy,
        mockServer,
      });

      // Call 1
      const res1 = await agent.purchaseResource<any>({
        endpointUrl: '/intel/whale-flow',
        intendedPurpose: 'Step 1: Whale flow analysis',
        idempotencyKey: 'demo_b_step1',
      });
      expect(res1.isSuccess).toBe(true);

      // Call 2
      const res2 = await agent.purchaseResource<any>({
        endpointUrl: '/oracle/market-volatility',
        intendedPurpose: 'Step 2: Volatility feed',
        idempotencyKey: 'demo_b_step2',
      });
      expect(res2.isSuccess).toBe(true);
      expect(agent.getJournal().getRunningTotalSpendUsdc()).toBe(0.10);

      // Call 3: Requires 0.09 USDC, but remaining budget is only 0.05 USDC!
      const res3 = await agent.purchaseResource<any>({
        endpointUrl: '/intel/liquidity-depth',
        intendedPurpose: 'Step 3: Depth analysis',
        idempotencyKey: 'demo_b_step3',
      });

      expect(res3.isSuccess).toBe(false);
      expect(res3.failureReason).toContain('would breach total spend ceiling');
      expect(res3.failureReason).toContain('Agent halting');

      // Verify journal recorded HALTED_BUDGET_EXHAUSTED
      const journal = agent.getJournal().getJournalSnapshot();
      expect(journal.length).toBe(3);
      expect(journal[2].disposition).toBe('HALTED_BUDGET_EXHAUSTED');
      expect(journal[2].runningTotalSpendUsdc).toBe(0.10); // Strictly untouched
      expect(journal[2].remainingBudgetUsdc).toBe(0.05);

      // Final job status verifies intentional halting
      const haltStatus = {
        jobTerminated: true,
        haltReason: 'BUDGET_CEILING_EXHAUSTED',
        settledSteps: 2,
        totalDisbursedUsdc: agent.getJournal().getRunningTotalSpendUsdc(),
        preservedCapitalUsdc: agent.getJournal().getRemainingBudgetUsdc(),
      };

      expect(haltStatus.jobTerminated).toBe(true);
      expect(haltStatus.totalDisbursedUsdc).toBe(0.10);
      expect(haltStatus.preservedCapitalUsdc).toBe(0.05);
    });
  });

  describe('Edge Case Guards', () => {
    it('rejects currency mismatch when endpoint demands non-USDC token', () => {
      const sentinel = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      }).getSentinel();

      const verdict = sentinel.evaluatePreFlight(
        {
          scheme: 'exact',
          network: 'eip155:688689',
          price: '0.05',
          currency: 'DOGE',
          tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          payTo: '0x1672000000000000000000000000000000000402',
          validUntilTimestamp: Math.floor(Date.now() / 1000) + 120,
          paymentMemoId: 'memo_doge',
          resourceDescription: 'Doge payment',
        },
        0
      );

      expect(verdict.isApproved).toBe(false);
      expect(verdict.rejectionReason).toBe('UNSUPPORTED_CURRENCY_TOKEN');
    });

    it('rejects expired challenge timelock', () => {
      const sentinel = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      }).getSentinel();

      const now = Math.floor(Date.now() / 1000);
      const verdict = sentinel.evaluatePreFlight(
        {
          scheme: 'exact',
          network: 'eip155:688689',
          price: '0.05',
          currency: 'USDC',
          tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          payTo: '0x1672000000000000000000000000000000000402',
          validUntilTimestamp: now - 30, // 30s in the past
          paymentMemoId: 'memo_stale',
          resourceDescription: 'Stale challenge',
        },
        0,
        now
      );

      expect(verdict.isApproved).toBe(false);
      expect(verdict.rejectionReason).toBe('CHALLENGE_TIMELOCK_EXPIRED');
    });

    it('disallows payment to zero address recipient', () => {
      const sentinel = new X402AgentBuyer({
        policy: standardPolicy,
        mockServer,
      }).getSentinel();

      const verdict = sentinel.evaluatePreFlight(
        {
          scheme: 'exact',
          network: 'eip155:688689',
          price: '0.05',
          currency: 'USDC',
          tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          payTo: '0x0000000000000000000000000000000000000000',
          validUntilTimestamp: Math.floor(Date.now() / 1000) + 120,
          paymentMemoId: 'memo_burn',
          resourceDescription: 'Zero recipient',
        },
        0
      );

      expect(verdict.isApproved).toBe(false);
      expect(verdict.rejectionReason).toBe('RECIPIENT_ZERO_ADDRESS_FORBIDDEN');
    });

    it('prevents concurrent double-execution with in-flight idempotency token collision', async () => {
      let delayResolve: () => void;
      const delayPromise = new Promise<void>((r) => {
        delayResolve = r;
      });

      const delayedTransport = async (url: string) => {
        await delayPromise;
        return {
          status: 200,
          headers: {},
          bodyText: JSON.stringify({ data: 'delayed' }),
        };
      };

      const buyer = new X402AgentBuyer({
        policy: standardPolicy,
        customFetchTransport: delayedTransport,
      });

      const call1 = buyer.purchaseResource({
        endpointUrl: 'https://api.example.com/stream',
        intendedPurpose: 'Concurrent Call 1',
        idempotencyKey: 'same_in_flight_token_001',
      });

      const call2 = buyer.purchaseResource({
        endpointUrl: 'https://api.example.com/stream',
        intendedPurpose: 'Concurrent Call 2',
        idempotencyKey: 'same_in_flight_token_001',
      });

      // call2 should immediately fail with 409 Conflict due to active lock
      const res2 = await call2;
      expect(res2.isSuccess).toBe(false);
      expect(res2.httpStatusCode).toBe(409);
      expect(res2.failureReason).toContain('already in-flight');

      delayResolve!();
      const res1 = await call1;
      expect(res1.isSuccess).toBe(true);
    });
  });
});
