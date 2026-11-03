#!/usr/bin/env node

/**
 * Command-Line Interface for Pharos Wallet Risk Checker.
 * Executes on-chain pre-transaction risk assessments, scans accounts across 5 signals,
 * and outputs structured risk scorecards with plain-language recommendations.
 */

import { Command } from 'commander';
import { WalletRiskEvaluator } from './risk-evaluator.js';
import { OnChainHistoryAnalyzer } from './history-analyzer.js';
import { formatRiskAssessmentCard } from './formatter.js';
import { RISK_DEMO_SCENARIOS } from './scenarios.js';
import { KNOWN_FLAGGED_THREAT_ENTITIES } from './flag-catalog.js';

const program = new Command();

program
  .name('pharos-risk')
  .description('Autonomous Pre-Transaction Security & Wallet Risk Checker for Pharos Network')
  .version('1.0.0');

program
  .command('demo')
  .description('Run interactive multi-scenario risk analysis comparing clean, cautionary, and high-risk accounts')
  .action(async () => {
    console.log('\n\x1b[1m\x1b[36m===============================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  🛡️  PHAROS WALLET RISK CHECKER · PRE-TRANSACTION SECURITY AUDIT DEMO\x1b[0m');
    console.log('\x1b[1m\x1b[36m===============================================================================\x1b[0m\n');

    console.log('\x1b[1m\x1b[33mActive Risk Signal Sentinels:\x1b[0m');
    console.log('  1. \x1b[1mContract Age & Maturity\x1b[0m: Flags deployment < 24 hours (CRITICAL) or < 7 days (MEDIUM)');
    console.log('  2. \x1b[1mCode Transparency\x1b[0m:       Flags unverified opaque EVM bytecodes (CRITICAL)');
    console.log('  3. \x1b[1mThreat Linkage\x1b[0m:          Detects direct funding/interaction with known drainers (CRITICAL)');
    console.log('  4. \x1b[1mApproval Anomalies\x1b[0m:      Flags dangerous unlimited token approvals to untrusted spenders (HIGH)');
    console.log('  5. \x1b[1mFunding Freshness\x1b[0m:       Identifies fresh disposable burner wallets (< 12 hours old, <= 2 txs)\n');

    const evaluator = new WalletRiskEvaluator();

    let scenarioIndex = 0;
    for (const scenario of RISK_DEMO_SCENARIOS) {
      scenarioIndex++;
      console.log(`\x1b[1m\x1b[34m━━━ [Scenario ${scenarioIndex}/${RISK_DEMO_SCENARIOS.length}] ${scenario.title} ━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
      console.log(`\x1b[2m${scenario.description}\x1b[0m\n`);

      const report = evaluator.evaluateAccount(scenario.profile);
      console.log(formatRiskAssessmentCard(report));
      console.log('');
      // Smooth streaming delay
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log('\x1b[1m\x1b[32m✔ Pre-transaction risk assessment demonstration completed successfully.\x1b[0m\n');
  });

program
  .command('check <address>')
  .description('Inspect an on-chain address or smart contract on Pharos Mainnet for security risks')
  .option('-r, --rpc <url>', 'Custom Pharos RPC URL', 'https://rpc.pharos.xyz')
  .option('-v, --verified', 'Flag if contract source code is confirmed verified on explorer', false)
  .action(async (address: string, options: { rpc: string; verified: boolean }) => {
    console.log(`\n\x1b[1m\x1b[36mAuditing Address Security Posture on Pharos Mainnet:\x1b[0m \x1b[33m${address}\x1b[0m\n`);

    const analyzer = new OnChainHistoryAnalyzer(options.rpc);
    const evaluator = new WalletRiskEvaluator();

    try {
      const profile = await analyzer.inspectAddress(address, {
        isVerifiedSourceFallback: options.verified,
      });

      const report = evaluator.evaluateAccount(profile);
      console.log(formatRiskAssessmentCard(report));
    } catch (err) {
      console.error('\x1b[31mError auditing address:\x1b[0m', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('threats')
  .description('Display verified threat intelligence directory of flagged illicit entities')
  .action(() => {
    console.log('\n\x1b[1m\x1b[31m━━━ Pharos Threat Intelligence Directory (Flagged Blacklist) ━━━━━━━━━━━━━━━\x1b[0m\n');
    KNOWN_FLAGGED_THREAT_ENTITIES.forEach((threat, idx) => {
      console.log(`  ${idx + 1}. \x1b[1m${threat.entityName}\x1b[0m`);
      console.log(`     Address:  \x1b[2m${threat.address}\x1b[0m`);
      console.log(`     Category: \x1b[31m${threat.threatCategory}\x1b[0m`);
      console.log(`     Flagged:  \x1b[33m${threat.dateIdentifiedIso}\x1b[0m`);
      if (threat.referenceNoticeUrl) {
        console.log(`     Notice:   \x1b[34m${threat.referenceNoticeUrl}\x1b[0m`);
      }
      console.log('');
    });
  });

program.parse(process.argv);
