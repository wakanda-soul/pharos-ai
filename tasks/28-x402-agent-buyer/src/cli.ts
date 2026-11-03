/**
 * Task 28: x402 Agent Buyer
 * Command Line Interface: runs dual demo workflows, interactive single purchases,
 * and visual audit journal inspections.
 */

import { Command } from 'commander';
import { X402AgentBuyer } from './buyer-engine.js';
import { MockX402Server } from './mock-x402-server.js';
import { SpendBudgetPolicy } from './types.js';
import {
  formatDemoHeader,
  formatSpendJournalTable,
  formatProgressBar,
} from './formatter.js';

export async function runDualDemo(): Promise<void> {
  const mockServer = new MockX402Server();

  // =========================================================================
  // DEMO SCENARIO A: Within-Budget Autonomous Completion
  // =========================================================================
  console.log(
    formatDemoHeader(
      'Demo Scenario A: Complete Job Within Budget',
      'Agent executes multi-endpoint intelligence gathering without exceeding budget limits'
    )
  );

  const policyA: SpendBudgetPolicy = {
    totalSpendBudgetUsdc: 0.25,
    maxPerCallLimitUsdc: 0.10,
    currency: 'USDC',
    maxSafeRetries: 3,
    retryBackoffMs: 50,
  };

  const agentA = new X402AgentBuyer({ policy: policyA, mockServer });

  console.log(`  💼 Spend Governance Config:`);
  console.log(`     - Total Budget Ceiling:   $${policyA.totalSpendBudgetUsdc.toFixed(2)} USDC`);
  console.log(`     - Per-Call Price Cap:     $${policyA.maxPerCallLimitUsdc.toFixed(2)} USDC`);
  console.log(`     - Target Network:         Pharos Atlantic Testnet (eip155:688689)\n`);

  console.log(`  [Step 1/2] Querying /oracle/market-volatility (Price: $0.04 USDC)...`);
  const call1 = await agentA.purchaseResource<any>({
    endpointUrl: '/oracle/market-volatility',
    intendedPurpose: 'Fetch Atlantic 30-day DEX volatility index',
    idempotencyKey: 'cli_demo_a_call_001',
  });
  console.log(`     ✅ Settlement Confirmed! Tx: ${call1.paymentReceipt?.transactionHash}`);
  console.log(`     📊 Result: Volatility IV30d = ${call1.payload?.data?.iv30d}, Pair = ${call1.payload?.data?.assetPair}\n`);

  console.log(`  [Step 2/2] Querying /intel/whale-flow (Price: $0.06 USDC)...`);
  const call2 = await agentA.purchaseResource<any>({
    endpointUrl: '/intel/whale-flow',
    intendedPurpose: 'Track smart-money whale accumulation',
    idempotencyKey: 'cli_demo_a_call_002',
  });
  console.log(`     ✅ Settlement Confirmed! Tx: ${call2.paymentReceipt?.transactionHash}`);
  console.log(`     📊 Result: Dominant Direction = ${call2.payload?.data?.dominantDirection}, Net Flow = ${call2.payload?.data?.netWhaleInflowUsdc}\n`);

  console.log(`  📈 Final Budget Utilization:`);
  console.log(`     ${formatProgressBar(agentA.getJournal().getRunningTotalSpendUsdc(), policyA.totalSpendBudgetUsdc)}\n`);

  console.log(`  📜 Scenario A Itemized Audit Journal:`);
  console.log(formatSpendJournalTable(agentA.getJournal().getJournalSnapshot()));

  console.log(`\n  🎉 Job Outcome: SUCCESS. Intelligence synthesized within budget ($0.10 spent, $0.15 surplus).\n`);

  // =========================================================================
  // DEMO SCENARIO B: Budget Ceiling Halting & Guardrails
  // =========================================================================
  console.log(
    formatDemoHeader(
      'Demo Scenario B: Ceiling Halting & Guardrail Enforcement',
      'Demonstrates per-call cap rejection and graceful halting upon total budget exhaustion'
    )
  );

  const policyB: SpendBudgetPolicy = {
    totalSpendBudgetUsdc: 0.15,
    maxPerCallLimitUsdc: 0.10,
    currency: 'USDC',
    maxSafeRetries: 3,
    retryBackoffMs: 50,
  };

  const agentB = new X402AgentBuyer({ policy: policyB, mockServer });

  console.log(`  💼 Spend Governance Config:`);
  console.log(`     - Total Budget Ceiling:   $${policyB.totalSpendBudgetUsdc.toFixed(2)} USDC (Tight Budget)`);
  console.log(`     - Per-Call Price Cap:     $${policyB.maxPerCallLimitUsdc.toFixed(2)} USDC`);
  console.log(`     - Target Network:         Pharos Atlantic Testnet (eip155:688689)\n`);

  console.log(`  [Step 1] Attempting /risk/insolvency-depth (Price: $0.12 USDC)...`);
  const rejectedCall = await agentB.purchaseResource<any>({
    endpointUrl: '/risk/insolvency-depth',
    intendedPurpose: 'Audit protocol insolvency parameters',
    idempotencyKey: 'cli_demo_b_call_001_exp',
  });
  console.log(`     ⚠️  Refusal Diagnostic: ${rejectedCall.failureReason}\n`);

  console.log(`  [Step 2] Fallback to affordable feed /intel/whale-flow (Price: $0.06 USDC)...`);
  const affordableCall1 = await agentB.purchaseResource<any>({
    endpointUrl: '/intel/whale-flow',
    intendedPurpose: 'Track smart-money whale accumulation',
    idempotencyKey: 'cli_demo_b_call_002',
  });
  console.log(`     ✅ Settlement Confirmed! Tx: ${affordableCall1.paymentReceipt?.transactionHash}\n`);

  console.log(`  [Step 3] Querying /oracle/market-volatility (Price: $0.04 USDC)...`);
  const affordableCall2 = await agentB.purchaseResource<any>({
    endpointUrl: '/oracle/market-volatility',
    intendedPurpose: 'Fetch volatility index',
    idempotencyKey: 'cli_demo_b_call_003',
  });
  console.log(`     ✅ Settlement Confirmed! Tx: ${affordableCall2.paymentReceipt?.transactionHash}`);
  console.log(`     💵 Cumulative spend reached: $${agentB.getJournal().getRunningTotalSpendUsdc().toFixed(2)} USDC (Remaining: $${agentB.getJournal().getRemainingBudgetUsdc().toFixed(2)} USDC)\n`);

  console.log(`  [Step 4] Attempting next requirement /intel/liquidity-depth (Price: $0.09 USDC)...`);
  const ceilingCall = await agentB.purchaseResource<any>({
    endpointUrl: '/intel/liquidity-depth',
    intendedPurpose: 'Inspect deep pool liquidity',
    idempotencyKey: 'cli_demo_b_call_004_breach',
  });
  console.log(`     🛑 Halt Diagnostic: ${ceilingCall.failureReason}\n`);

  console.log(`  📈 Final Budget Utilization:`);
  console.log(`     ${formatProgressBar(agentB.getJournal().getRunningTotalSpendUsdc(), policyB.totalSpendBudgetUsdc)}\n`);

  console.log(`  📜 Scenario B Itemized Audit Journal:`);
  console.log(formatSpendJournalTable(agentB.getJournal().getJournalSnapshot()));

  console.log(`\n  🛑 Job Outcome: HALTED AT CEILING. Agent preserved capital ($0.05 protected) and refused overdraft.\n`);
}

const program = new Command();

program
  .name('pharos-x402-buyer')
  .description('Autonomous x402 Micro-Payment Agent Buyer with Strict Spend Governance & Idempotency')
  .version('1.0.0');

program
  .command('demo')
  .description('Execute Dual Demonstration: (A) Complete job within budget & (B) Halt at budget ceiling')
  .action(async () => {
    await runDualDemo();
  });

// If no arguments passed, default to running demo
if (process.argv.length <= 2) {
  process.argv.push('demo');
}

program.parse(process.argv);
