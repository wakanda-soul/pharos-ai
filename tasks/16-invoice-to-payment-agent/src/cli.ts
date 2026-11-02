#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { InvoiceToPaymentAgent } from './invoice-agent.js';
import { InvoiceAuditFormatter } from './formatter.js';
import {
  SAMPLE_JSON_INVOICE_VALID,
  SAMPLE_PLAINTEXT_INVOICE_VALID,
  SAMPLE_DELIMITED_RECEIPT_VALID,
  SAMPLE_INVOICE_SUM_MISMATCH,
  SAMPLE_INVOICE_MISSING_CURRENCY,
  SAMPLE_INVOICE_MISSING_PAYEE,
} from './sample-invoices.js';

export function createCli(): Command {
  const program = new Command();
  const agent = new InvoiceToPaymentAgent();

  program
    .name('pharos-invoice')
    .description('Pharos Autonomous Multi-Format Invoice-to-Payment Agent')
    .version('1.0.0');

  program
    .command('demo')
    .description('Run comprehensive interactive demonstration across 3 formats and discrepancy flags')
    .action(() => {
      console.log(InvoiceAuditFormatter.formatBanner());
      console.log('\n🚀 Starting Pharos Invoice-to-Payment Agent Walkthrough (Requirements 01-04)...\n');

      console.log('================================================================================');
      console.log('▶ DEMO SCENARIO 1: STRUCTURED JSON E-INVOICE (USDC SETTLEMENT)');
      console.log('================================================================================');
      const r1 = agent.processInvoice(SAMPLE_JSON_INVOICE_VALID);
      console.log(InvoiceAuditFormatter.formatResult(r1));

      console.log('\n================================================================================');
      console.log('▶ DEMO SCENARIO 2: PLAINTEXT COMMERCIAL MEMO (PNS DOMAIN RESOLUTION)');
      console.log('================================================================================');
      const r2 = agent.processInvoice(SAMPLE_PLAINTEXT_INVOICE_VALID);
      console.log(InvoiceAuditFormatter.formatResult(r2));

      console.log('\n================================================================================');
      console.log('▶ DEMO SCENARIO 3: DELIMITED KEY-VALUE RECEIPT (NATIVE PROS)');
      console.log('================================================================================');
      const r3 = agent.processInvoice(SAMPLE_DELIMITED_RECEIPT_VALID);
      console.log(InvoiceAuditFormatter.formatResult(r3));

      console.log('\n================================================================================');
      console.log('▶ DEMO SCENARIO 4: ANOMALY SENTINEL: LINE-ITEMS TOTAL MISMATCH DETECTED');
      console.log('================================================================================');
      const r4 = agent.processInvoice(SAMPLE_INVOICE_SUM_MISMATCH);
      console.log(InvoiceAuditFormatter.formatResult(r4));

      console.log('\n================================================================================');
      console.log('▶ DEMO SCENARIO 5: ANOMALY SENTINEL: MISSING CURRENCY (ZERO GUESSING)');
      console.log('================================================================================');
      const r5 = agent.processInvoice(SAMPLE_INVOICE_MISSING_CURRENCY);
      console.log(InvoiceAuditFormatter.formatResult(r5));

      console.log('\n================================================================================');
      console.log('▶ DEMO SCENARIO 6: ANOMALY SENTINEL: MISSING PAYEE DESTINATION');
      console.log('================================================================================');
      const r6 = agent.processInvoice(SAMPLE_INVOICE_MISSING_PAYEE);
      console.log(InvoiceAuditFormatter.formatResult(r6));

      console.log('\n✓ Demo finished. All requirements (01 to 04) demonstrated successfully.\n');
    });

  program
    .command('parse <input>')
    .description('Parse an invoice from a file path or direct string')
    .action((input: string) => {
      console.log(InvoiceAuditFormatter.formatBanner());
      let content = input;
      if (existsSync(input)) {
        content = readFileSync(input, 'utf-8');
      }
      const outcome = agent.processInvoice(content);
      console.log(InvoiceAuditFormatter.formatResult(outcome));
    });

  return program;
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('pharos-invoice.js')) {
  createCli().parse(process.argv);
}
