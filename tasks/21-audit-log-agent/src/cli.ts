#!/usr/bin/env node

/**
 * Command-Line Interface for Pharos Wallet Audit-Log Agent.
 * Generates plain-language compliance and accounting reports for wallets over arbitrary date ranges,
 * with multi-format export capabilities (Terminal, Markdown, CSV).
 */

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { type Address, getAddress } from 'viem';
import { WalletAuditEngine } from './audit-aggregator.js';
import { parseAuditDateRange } from './date-filter.js';
import { KNOWN_PHAROS_ENTITIES } from './directory.js';
import { formatAuditReportTerminal } from './formatter.js';
import { exportAuditReportToMarkdown } from './exporters/markdown-exporter.js';
import { exportAuditReportToCsv } from './exporters/csv-exporter.js';
import { BENCHMARK_AUDIT_TRANSACTIONS, DEMO_AUDITED_WALLET } from './scenarios.js';

const program = new Command();

program
  .name('pharos-audit')
  .description('Autonomous Wallet Audit-Log & Accounting Agent for Pharos Network (Chain ID 1672)')
  .version('1.0.0');

program
  .command('demo')
  .description('Run interactive accounting audit demo on sample treasury wallet (Feb 2026) and export Markdown/CSV')
  .option('-o, --out-dir <dir>', 'Directory to save exported Markdown and CSV reports', './audit-output')
  .action(async (options: { outDir: string }) => {
    console.log('\n\x1b[1m\x1b[36m===============================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  📋 PHAROS WALLET AUDIT-LOG AGENT · COMPLIANCE & ACCOUNTING DEMO\x1b[0m');
    console.log('\x1b[1m\x1b[36m===============================================================================\x1b[0m\n');

    const engine = new WalletAuditEngine();
    const dateRange = parseAuditDateRange('2026-02-01', '2026-02-28');

    console.log('\x1b[1m\x1b[33mAudit Parameters:\x1b[0m');
    console.log(`  • Target Wallet:     \x1b[1m\x1b[32m${DEMO_AUDITED_WALLET}\x1b[0m`);
    console.log(`  • Accounting Period: \x1b[34m2026-02-01\x1b[0m to \x1b[34m2026-02-28\x1b[0m (UTC)`);
    console.log(`  • Total Raw History: ${BENCHMARK_AUDIT_TRANSACTIONS.length} transactions submitted\n`);

    const report = engine.generateAuditReport(
      DEMO_AUDITED_WALLET,
      BENCHMARK_AUDIT_TRANSACTIONS,
      dateRange,
    );

    // 1. Display rich terminal scorecard
    console.log(formatAuditReportTerminal(report));

    // 2. Export reports to disk (Requirement 04)
    const targetDir = path.resolve(process.cwd(), options.outDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const mdFilename = `audit-${DEMO_AUDITED_WALLET.slice(0, 8)}-2026-02.md`;
    const csvFilename = `audit-${DEMO_AUDITED_WALLET.slice(0, 8)}-2026-02.csv`;

    const mdPath = path.join(targetDir, mdFilename);
    const csvPath = path.join(targetDir, csvFilename);

    fs.writeFileSync(mdPath, exportAuditReportToMarkdown(report), 'utf-8');
    fs.writeFileSync(csvPath, exportAuditReportToCsv(report), 'utf-8');

    console.log('\n\x1b[1m\x1b[32m✔ Export Artifacts Successfully Generated (Requirement 04):\x1b[0m');
    console.log(`  • Markdown Report: \x1b[36m${mdPath}\x1b[0m`);
    console.log(`  • CSV Ledger:      \x1b[36m${csvPath}\x1b[0m\n`);
  });

program
  .command('report <address>')
  .description('Generate an audit report for a specific wallet address over a custom date range')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD or ISO-8601)', '2026-02-01')
  .option('-e, --end <date>', 'End date (YYYY-MM-DD or ISO-8601)', '2026-02-28')
  .option('-f, --format <format>', 'Export format: terminal, md, csv, or all', 'all')
  .option('-o, --out-dir <dir>', 'Directory to save files', '.')
  .action(async (address: string, options: { start: string; end: string; format: string; outDir: string }) => {
    try {
      const checksummed = getAddress(address);
      const dateRange = parseAuditDateRange(options.start, options.end);
      const engine = new WalletAuditEngine();

      const report = engine.generateAuditReport(
        checksummed,
        BENCHMARK_AUDIT_TRANSACTIONS,
        dateRange,
      );

      if (options.format === 'terminal' || options.format === 'all') {
        console.log(formatAuditReportTerminal(report));
      }

      if (options.format === 'md' || options.format === 'all') {
        const mdPath = path.resolve(options.outDir, `audit-${checksummed.slice(0, 8)}.md`);
        fs.writeFileSync(mdPath, exportAuditReportToMarkdown(report), 'utf-8');
        console.log(`\n\x1b[32m✔ Exported Markdown report to:\x1b[0m ${mdPath}`);
      }

      if (options.format === 'csv' || options.format === 'all') {
        const csvPath = path.resolve(options.outDir, `audit-${checksummed.slice(0, 8)}.csv`);
        fs.writeFileSync(csvPath, exportAuditReportToCsv(report), 'utf-8');
        console.log(`\x1b[32m✔ Exported CSV ledger to:\x1b[0m ${csvPath}`);
      }
    } catch (err) {
      console.error('\x1b[31mError generating audit report:\x1b[0m', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('directory')
  .description('Display verified protocols, bridges, and infrastructure entities on Pharos Network')
  .action(() => {
    console.log('\n\x1b[1m\x1b[36m===============================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  🏛️  PHAROS VERIFIED ENTITY & COUNTERPARTY DIRECTORY (Chain ID 1672)\x1b[0m');
    console.log('\x1b[1m\x1b[36m===============================================================================\x1b[0m\n');
    console.log('Address                                    Entity Name                          Role');
    console.log('────────────────────────────────────────── ──────────────────────────────────── ──────────────────────────────');
    for (const [address, meta] of Object.entries(KNOWN_PHAROS_ENTITIES)) {
      console.log(`${address.padEnd(42)} ${meta.label.padEnd(36)} \x1b[33m${meta.role}\x1b[0m`);
    }
    console.log('\n');
  });

program.parse(process.argv);
