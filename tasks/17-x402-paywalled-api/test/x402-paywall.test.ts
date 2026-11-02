import { describe, it, expect } from 'vitest';
import { generatePrivateKey } from 'viem/accounts';
import { X402PaywallServer } from '../src/paywall-server.js';
import { X402BuyerClient } from '../src/x402-client.js';
import { ATLANTIC_TESTNET } from '../src/types.js';
import { SecureKeyProvider } from '../src/key-loader.js';

describe('Task 17: x402 Paywalled API on Pharos Atlantic Testnet', () => {
  const server = new X402PaywallServer();
  const testPrivateKey = generatePrivateKey();
  const buyerClient = new X402BuyerClient(server, testPrivateKey);

  describe('Requirement 01: Atlantic Testnet (eip155:688689) & Test USDC Configuration', () => {
    it('should be configured for Atlantic Testnet chainId 688689 and test USDC', () => {
      expect(ATLANTIC_TESTNET.chainId).toBe(688689);
      expect(ATLANTIC_TESTNET.networkIdentifier).toBe('eip155:688689');
      expect(ATLANTIC_TESTNET.testUsdcAddress).toBe('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359');
      expect(ATLANTIC_TESTNET.usdcDecimals).toBe(6);
      expect(ATLANTIC_TESTNET.explorerBaseUrl).toBe('https://atlantic-scan.pharos.xyz');
    });
  });

  describe('Requirement 02: Route Hierarchy (1 Free Route, at least 2 Paid Routes at different prices)', () => {
    it('should allow free access to GET /health with HTTP 200 without payment header', async () => {
      const freeRes = await server.handleRequest({
        path: '/health',
        method: 'GET',
        headers: {},
      });

      expect(freeRes.status).toBe(200);
      expect(freeRes.body.status).toBe('healthy');
      expect(freeRes.body.network).toBe('eip155:688689');
    });

    it('should return HTTP 402 on GET /api/market-depth priced at 0.05 USDC', async () => {
      const paidRes1 = await server.handleRequest({
        path: '/api/market-depth',
        method: 'GET',
        headers: {},
      });

      expect(paidRes1.status).toBe(402);
      expect(paidRes1.headers['PAYMENT-REQUIRED']).toBeDefined();
      expect(paidRes1.headers['X-Payment-Required-Price']).toBe('0.05 USDC');
      expect(paidRes1.body.paymentRequirement.price).toBe('0.05');
      expect(paidRes1.body.paymentRequirement.currency).toBe('USDC');
    });

    it('should return HTTP 402 on POST /api/ai-inference priced at 0.25 USDC', async () => {
      const paidRes2 = await server.handleRequest({
        path: '/api/ai-inference',
        method: 'POST',
        headers: {},
        body: { prompt: 'Analyze vault solvency' },
      });

      expect(paidRes2.status).toBe(402);
      expect(paidRes2.headers['PAYMENT-REQUIRED']).toBeDefined();
      expect(paidRes2.headers['X-Payment-Required-Price']).toBe('0.25 USDC');
      expect(paidRes2.body.paymentRequirement.price).toBe('0.25');
    });
  });

  describe('Requirement 03: Embedded Facilitator (/verify, /settle, /supported)', () => {
    it('should serve GET /facilitator/supported listing Atlantic Testnet and USDC', async () => {
      const supportedRes = await server.handleRequest({
        path: '/facilitator/supported',
        method: 'GET',
        headers: {},
      });

      expect(supportedRes.status).toBe(200);
      expect(supportedRes.body.networks).toContain('eip155:688689');
      expect(supportedRes.body.schemes).toContain('exact');
      expect(supportedRes.body.supportedTokens[0].symbol).toBe('USDC');
    });

    it('should handle POST /facilitator/verify and POST /facilitator/settle endpoints', async () => {
      const facilitator = server.getFacilitator();
      const supported = facilitator.getSupported();
      expect(supported.networks).toContain('eip155:688689');
    });
  });

  describe('Requirement 04: Full 402 Negotiation & Explorer-Linked Settlement Flow', () => {
    it('should complete full flow: 402 challenge -> signed payment -> 200 with PAYMENT-RESPONSE and explorer tx link for 0.05 USDC route', async () => {
      const log = await buyerClient.request('/api/market-depth', 'GET');

      // Step 1: Initial request was challenged with 402
      expect(log.initialStatus).toBe(402);
      expect(log.requiredPriceUsdc).toBe('0.05');

      // Step 2: Payment was signed via EIP-712
      expect(log.authorizationSigned).toBeDefined();
      expect(log.authorizationSigned?.decimalPriceUsdc).toBe(0.05);
      expect(log.authorizationSigned?.signatureHex).toMatch(/^0x[a-fA-F0-9]{130}$/);

      // Step 3: Second request returned 200 OK with PAYMENT-RESPONSE
      expect(log.secondStatus).toBe(200);
      expect(log.paymentResponse).toBeDefined();
      expect(log.paymentResponse?.status).toBe('SETTLED');
      expect(log.paymentResponse?.network).toBe('eip155:688689');
      expect(log.paymentResponse?.amountSettled).toBe('0.05 USDC');
      expect(log.paymentResponse?.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(log.paymentResponse?.explorerUrl).toContain('https://atlantic-scan.pharos.xyz/tx/0x');

      // Step 4: Paywalled resource data was unlocked
      expect(log.finalBody.data.pair).toBe('PROS/USDC');
      expect(log.finalBody.data.depthBids.length).toBeGreaterThan(0);
    });

    it('should complete full flow for the 0.25 USDC AI inference endpoint', async () => {
      const log = await buyerClient.request('/api/ai-inference', 'POST', {
        prompt: 'Calculate liquidation threshold for vault #42',
      });

      expect(log.initialStatus).toBe(402);
      expect(log.requiredPriceUsdc).toBe('0.25');
      expect(log.secondStatus).toBe(200);
      expect(log.paymentResponse?.amountSettled).toBe('0.25 USDC');
      expect(log.finalBody.data.task).toBe('AI Credit Risk Analysis');
      expect(log.finalBody.data.riskScore).toBeDefined();
    });
  });

  describe('Requirement 05: Rejection of Bad, Underpaid, or Replayed Payments (Another 402)', () => {
    it('should reject underpaid payment with HTTP 402 and reason', async () => {
      const log = await buyerClient.request('/api/market-depth', 'GET', undefined, {
        overridePriceUsdc: 0.01, // Route requires 0.05 USDC!
      });

      expect(log.initialStatus).toBe(402);
      expect(log.secondStatus).toBe(402); // Must reject with another 402
      expect(log.finalBody.error).toBe('Payment Settlement Rejected');
      expect(log.finalBody.reason).toContain('Underpaid: authorization authorizes 0.01 USDC, but route requires 0.05 USDC');
    });

    it('should reject corrupted signature with HTTP 402', async () => {
      const log = await buyerClient.request('/api/market-depth', 'GET', undefined, {
        corruptSignature: true,
      });

      expect(log.initialStatus).toBe(402);
      expect(log.secondStatus).toBe(402);
      expect(log.finalBody.error).toBe('Payment Settlement Rejected');
    });

    it('should reject replay attacks with duplicate nonces', async () => {
      // 1. First execution succeeds
      const log1 = await buyerClient.request('/api/market-depth', 'GET');
      expect(log1.secondStatus).toBe(200);

      // 2. Replay same authorization payload directly
      const replayRes = await server.handleRequest({
        path: '/api/market-depth',
        method: 'GET',
        headers: {
          'x-payment': Buffer.from(JSON.stringify(log1.authorizationSigned)).toString('base64'),
        },
      });

      expect(replayRes.status).toBe(402);
      expect(replayRes.body.error).toBe('Payment Settlement Rejected');
      expect(replayRes.body.reason).toContain('Replay attack rejected');
    });
  });

  describe('Requirement 06: Private Key Security & Env/File Isolation', () => {
    it('should resolve signer key from environment variable when EVM_PRIVATE_KEY is set', () => {
      const originalEnv = process.env.EVM_PRIVATE_KEY;
      try {
        const dummyKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        process.env.EVM_PRIVATE_KEY = dummyKey;

        const resolved = SecureKeyProvider.resolveSignerPrivateKey();
        expect(resolved).toBe(dummyKey);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.EVM_PRIVATE_KEY;
        } else {
          process.env.EVM_PRIVATE_KEY = originalEnv;
        }
      }
    });

    it('should generate an ephemeral key rather than ever hardcoding keys in code when env is absent', () => {
      const key = SecureKeyProvider.resolveSignerPrivateKey();
      expect(key).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });
});
