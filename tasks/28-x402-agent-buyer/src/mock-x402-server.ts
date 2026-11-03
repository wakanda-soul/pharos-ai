/**
 * Task 28: x402 Agent Buyer
 * Mock x402 Paywall Server: provides simulated Atlantic Testnet endpoints with
 * 402 challenges, payment verification, transient failure injection, and idempotency tracking.
 */

import {
  PHAROS_ATLANTIC_CHAIN,
  X402PaymentRequirement,
} from './types.js';

export interface MockEndpointDefinition {
  readonly path: string;
  readonly priceUsdc: number;
  readonly currency: string;
  readonly resourceDescription: string;
  readonly payload: Record<string, unknown>;
  readonly shouldFailTransientTimes?: number;
}

export interface MockHttpResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: Record<string, unknown>;
}

export class MockX402Server {
  private readonly endpoints: Map<string, MockEndpointDefinition> = new Map();
  private readonly payToAddress: `0x${string}`;
  private readonly settledPaymentsByToken: Set<string> = new Set();
  private readonly transientFailureCounts: Map<string, number> = new Map();

  constructor(payToAddress: `0x${string}` = '0x1672000000000000000000000000000000000402') {
    this.payToAddress = payToAddress;
    this.registerStandardEndpoints();
  }

  private registerStandardEndpoints(): void {
    // Endpoint 1: Cheap oracle analytics (within cap, within budget)
    this.registerEndpoint({
      path: '/oracle/market-volatility',
      priceUsdc: 0.04,
      currency: 'USDC',
      resourceDescription: 'Pharos Atlantic 30-day implied DEX volatility index & realized variance',
      payload: {
        assetPair: 'PHAROS/USDC',
        iv30d: '42.8%',
        realizedVariance: 0.0384,
        confidenceScore: 0.992,
        recommendedHedgingRatio: 0.15,
      },
    });

    // Endpoint 2: Premium whale flow intelligence (within cap, within budget)
    this.registerEndpoint({
      path: '/intel/whale-flow',
      priceUsdc: 0.06,
      currency: 'USDC',
      resourceDescription: 'Real-time Atlantic whale wallet accumulation and smart-money net flows',
      payload: {
        flowWindow: '24h',
        netWhaleInflowUsdc: '+1,840,000',
        dominantDirection: 'ACCUMULATION',
        activeWhaleCount: 14,
        topRecipientSector: 'Lending & Staking',
      },
    });

    // Endpoint 3: Expensive insolvency audit (price 0.12 USDC -> exceeds 0.10 per-call cap!)
    this.registerEndpoint({
      path: '/risk/insolvency-depth',
      priceUsdc: 0.12,
      currency: 'USDC',
      resourceDescription: 'Deep collateral liquidation ladder and insolvency cascading stress-tests',
      payload: {
        portfolioHealthFactor: 1.48,
        badDebtExposureRatio: '0.0018%',
        nearestLiquidationThresholdPrice: 2140.5,
      },
    });

    // Endpoint 4: High-frequency MEV signal (price 0.25 USDC -> exceeds per-call cap AND total budget)
    this.registerEndpoint({
      path: '/premium/mev-boost-signal',
      priceUsdc: 0.25,
      currency: 'USDC',
      resourceDescription: 'Proprietary sub-second searcher bundles & latency arbitrage telemetry',
      payload: {
        bundleId: '0x99af4e112',
        priorityBidGwei: 45,
        estimatedProfitMarginBps: 28,
      },
    });

    // Endpoint 5: Liquidity depth (price 0.09 USDC -> used in boundary testing)
    this.registerEndpoint({
      path: '/intel/liquidity-depth',
      priceUsdc: 0.09,
      currency: 'USDC',
      resourceDescription: 'Aggregated orderbook and pool liquidity depth across FaroSwap pairs',
      payload: {
        depthUsdc: 8450000,
        slippageAt100kUsdc: '0.04%',
      },
    });

    // Endpoint 6: Flaky network simulation (fails 2 times before succeeding on 3rd retry)
    this.registerEndpoint({
      path: '/oracle/transient-flaky',
      priceUsdc: 0.05,
      currency: 'USDC',
      resourceDescription: 'Resilient oracle feed subject to simulated network drops',
      payload: {
        status: 'RECOVERED_AFTER_RETRY',
        recalculatedIndex: 104.25,
      },
      shouldFailTransientTimes: 2,
    });
  }

  public registerEndpoint(endpoint: MockEndpointDefinition): void {
    this.endpoints.set(endpoint.path, endpoint);
  }

  /**
   * Dispatches a request against the mock server, simulating HTTP 402 negotiation.
   */
  public handleRequest(
    path: string,
    headers: Record<string, string> = {},
    customCurrentEpochSeconds: number = Math.floor(Date.now() / 1000)
  ): MockHttpResponse {
    const endpoint = this.endpoints.get(path);
    if (!endpoint) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: `Endpoint '${path}' not found on server.` },
      };
    }

    // Check payment authorization header
    const authHeader = headers['authorization'] || headers['Authorization'];
    const paymentProofHeader = headers['x-payment-proof'] || headers['X-Payment-Proof'];
    const activePaymentHeader = authHeader || paymentProofHeader;

    if (!activePaymentHeader) {
      // Return HTTP 402 with challenge requirement
      const challenge: X402PaymentRequirement = {
        scheme: 'exact',
        network: PHAROS_ATLANTIC_CHAIN.networkIdentifier,
        price: endpoint.priceUsdc.toFixed(2),
        currency: endpoint.currency,
        tokenAddress: PHAROS_ATLANTIC_CHAIN.testUsdcAddress,
        payTo: this.payToAddress,
        validUntilTimestamp: customCurrentEpochSeconds + 300, // Valid for 5 minutes
        paymentMemoId: `memo_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
        resourceDescription: endpoint.resourceDescription,
      };

      return {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `x402 scheme="exact", price="${challenge.price}", currency="${challenge.currency}"`,
          'X-Payment-Requirement': JSON.stringify(challenge),
        },
        body: {
          error: 'Payment Required',
          message: `Access to ${endpoint.path} requires payment of ${challenge.price} ${challenge.currency}`,
          requirement: challenge,
        },
      };
    }

    // Payment proof provided: verify and settle
    let parsedProof: any;
    try {
      const rawPayload = activePaymentHeader.startsWith('x402 ')
        ? activePaymentHeader.substring(5)
        : activePaymentHeader;
      parsedProof = JSON.parse(rawPayload);
    } catch {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Invalid payment proof formatting. Expected valid JSON.' },
      };
    }

    const { idempotencyKey, transactionHash, pricePaidUsdc } = parsedProof;
    if (!idempotencyKey || !transactionHash) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Payment proof missing required idempotencyKey or transactionHash.' },
      };
    }

    // Transient failure simulation
    if (endpoint.shouldFailTransientTimes && endpoint.shouldFailTransientTimes > 0) {
      const currentFailures = this.transientFailureCounts.get(path) || 0;
      if (currentFailures < endpoint.shouldFailTransientTimes) {
        this.transientFailureCounts.set(path, currentFailures + 1);
        return {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '1' },
          body: {
            error: 'Service Temporarily Unavailable',
            diagnostic: `Simulated transient network drop (${currentFailures + 1}/${endpoint.shouldFailTransientTimes}). Retry request with same idempotency key.`,
          },
        };
      }
    }

    // Register settlement token on server side
    this.settledPaymentsByToken.add(idempotencyKey);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Settlement-Status': 'CONFIRMED',
        'X-Transaction-Hash': transactionHash,
      },
      body: {
        status: 'SUCCESS',
        endpoint: path,
        whatItBought: endpoint.resourceDescription,
        priceSettledUsdc: endpoint.priceUsdc,
        transactionHash,
        explorerUrl: `${PHAROS_ATLANTIC_CHAIN.explorerBaseUrl}/tx/${transactionHash}`,
        data: endpoint.payload,
      },
    };
  }
}
