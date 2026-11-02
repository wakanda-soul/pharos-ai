#!/usr/bin/env node

import { Command } from 'commander';
import { X402PaywallServer } from './paywall-server.js';
import { X402BuyerClient } from './x402-client.js';
import { X402TerminalFormatter } from './formatter.js';

export function createCli(): Command {
  const program = new Command();
  const server = new X402PaywallServer();
  const client = new X402BuyerClient(server);

  program
    .name('pharos-x402')
    .description('Pharos Autonomous x402 HTTP-Native Paywalled API Suite')
    .version('1.0.0');

  program
    .command('demo')
    .description('Run comprehensive demonstration of x402 payment negotiation, facilitator settlement & rejection guards')
    .action(async () => {
      console.log(X402TerminalFormatter.formatHeader());
      console.log('\n🚀 Starting Pharos x402 Paywalled API Demonstration (Requirements 01-06)...\n');

      // Scenario 1: Free Health Route
      const log1 = await client.request('/health', 'GET');
      console.log(X402TerminalFormatter.formatLog('SCENARIO 1: FREE HEALTH PROBE (GET /health)', log1));

      // Scenario 2: 0.05 USDC Market Depth Route
      console.log('\n');
      const log2 = await client.request('/api/market-depth', 'GET');
      console.log(X402TerminalFormatter.formatLog('SCENARIO 2: PAID ORDERBOOK DEPTH (0.05 USDC on eip155:688689)', log2));

      // Scenario 3: 0.25 USDC AI Inference Route
      console.log('\n');
      const log3 = await client.request('/api/ai-inference', 'POST', {
        prompt: 'Calculate lending health factor and liquidation buffer for portfolio vault #112',
      });
      console.log(X402TerminalFormatter.formatLog('SCENARIO 3: PAID AI INFERENCE (0.25 USDC on eip155:688689)', log3));

      // Scenario 4: Underpayment Attack Rejection
      console.log('\n');
      const log4 = await client.request('/api/market-depth', 'GET', undefined, {
        overridePriceUsdc: 0.01,
      });
      console.log(X402TerminalFormatter.formatLog('SCENARIO 4: UNDERPAYMENT REJECTION GUARD (0.01 USDC sent for 0.05 USDC endpoint)', log4));

      // Scenario 5: Replay Attack Rejection
      console.log('\n');
      const replayRes = await server.handleRequest({
        path: '/api/market-depth',
        method: 'GET',
        headers: {
          'x-payment': Buffer.from(JSON.stringify(log2.authorizationSigned)).toString('base64'),
        },
      });
      console.log('================================================================================');
      console.log('▶ SCENARIO 5: REPLAY ATTACK REJECTION (Re-submitting already settled nonce)');
      console.log('================================================================================');
      console.log(`Replay Attempt Status: ${replayRes.status} 402 PAYMENT REJECTED`);
      console.log(`Rejection Reason:      ${replayRes.body?.reason}`);

      console.log('\n✓ Pharos x402 demonstration completed successfully.');
    });

  program
    .command('supported')
    .description('Query Facilitator GET /supported configuration')
    .action(async () => {
      console.log(X402TerminalFormatter.formatHeader());
      const supported = server.getFacilitator().getSupported();
      console.log(JSON.stringify(supported, null, 2));
    });

  return program;
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('pharos-x402.js')) {
  createCli().parse(process.argv);
}
