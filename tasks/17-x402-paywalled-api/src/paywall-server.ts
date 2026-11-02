import {
  ATLANTIC_TESTNET,
  PaywalledRouteConfig,
  X402PaymentRequirement,
  X402PaymentResponsePayload,
  Eip712PaymentAuthorization,
} from './types.js';
import { X402FacilitatorEngine } from './facilitator.js';

export const SERVER_PAY_TO_ADDRESS: `0x${string}` = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

export const REGISTERED_ROUTES: Record<string, PaywalledRouteConfig> = {
  'GET /health': {
    path: '/health',
    method: 'GET',
    isPaid: false,
    description: 'Free public health check and Atlantic Testnet status probe',
  },
  'GET /api/market-depth': {
    path: '/api/market-depth',
    method: 'GET',
    isPaid: true,
    priceUsdc: 0.05,
    description: 'High-frequency orderbook depth for PROS/USDC liquidity pool',
  },
  'POST /api/ai-inference': {
    path: '/api/ai-inference',
    method: 'POST',
    isPaid: true,
    priceUsdc: 0.25,
    description: 'Autonomous DeFi risk analysis & trading signal synthesis',
  },
};

export interface HttpRequest {
  readonly path: string;
  readonly method: 'GET' | 'POST';
  readonly headers: Record<string, string | undefined>;
  readonly body?: any;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: any;
}

/**
 * x402 Monitored Paywall Server.
 * Enforces Requirements 01, 02, 04, and 05.
 */
export class X402PaywallServer {
  private readonly facilitator: X402FacilitatorEngine;
  private readonly payToAddress: `0x${string}`;

  constructor(
    customFacilitator?: X402FacilitatorEngine,
    receivingAddress?: `0x${string}`
  ) {
    this.facilitator = customFacilitator ?? new X402FacilitatorEngine();
    this.payToAddress = receivingAddress ?? SERVER_PAY_TO_ADDRESS;
  }

  getFacilitator(): X402FacilitatorEngine {
    return this.facilitator;
  }

  /**
   * Main HTTP request dispatcher simulating web server routing.
   */
  async handleRequest(req: HttpRequest): Promise<HttpResponse> {
    const routeKey = `${req.method.toUpperCase()} ${req.path}`;

    // ─── 1. Facilitator Protocol Endpoints (Requirement 03) ───────────────────
    if (req.path === '/facilitator/supported' && req.method === 'GET') {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: this.facilitator.getSupported(),
      };
    }

    if (req.path === '/facilitator/verify' && req.method === 'POST') {
      const verifyRes = await this.facilitator.verify(req.body);
      return {
        status: verifyRes.isValid ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
        body: verifyRes,
      };
    }

    if (req.path === '/facilitator/settle' && req.method === 'POST') {
      const settleRes = await this.facilitator.settle(req.body);
      return {
        status: settleRes.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
        body: settleRes,
      };
    }

    // ─── 2. Route Existence Check ───────────────────────────────────────────
    const routeConfig = REGISTERED_ROUTES[routeKey];
    if (!routeConfig) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: `Route "${routeKey}" not found.` },
      };
    }

    // ─── 3. Free Route (Requirement 02) ─────────────────────────────────────
    if (!routeConfig.isPaid) {
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          status: 'healthy',
          network: ATLANTIC_TESTNET.networkIdentifier,
          networkName: ATLANTIC_TESTNET.networkName,
          timestamp: new Date().toISOString(),
          uptimeSeconds: process.uptime(),
        },
      };
    }

    // ─── 4. Paid Route Evaluation (Requirements 01, 02, 04, 05) ──────────────
    const requirement: X402PaymentRequirement = {
      scheme: 'exact',
      network: ATLANTIC_TESTNET.networkIdentifier,
      price: (routeConfig.priceUsdc ?? 0.05).toFixed(2),
      currency: 'USDC',
      tokenAddress: ATLANTIC_TESTNET.testUsdcAddress,
      payTo: this.payToAddress,
      validUntilTimestamp: Math.floor(Date.now() / 1000) + 300, // 5 min TTL
      paymentMemoId: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    // Extract X-PAYMENT or Authorization Header
    const rawPaymentHeader = req.headers['x-payment'] ||
      req.headers['X-Payment'] ||
      req.headers['authorization'];

    // If client provided no payment header -> Respond 402 with PAYMENT-REQUIRED header
    if (!rawPaymentHeader) {
      const requirementJson = JSON.stringify(requirement);
      return {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'PAYMENT-REQUIRED': Buffer.from(requirementJson).toString('base64'),
          'X-Payment-Required-Network': ATLANTIC_TESTNET.networkIdentifier,
          'X-Payment-Required-Price': `${requirement.price} USDC`,
        },
        body: {
          statusCode: 402,
          error: 'Payment Required',
          message: `This endpoint costs ${requirement.price} USDC on ${ATLANTIC_TESTNET.networkIdentifier}.`,
          paymentRequirement: requirement,
        },
      };
    }

    // Parse Authorization Payload from Header
    let parsedAuthorization: Eip712PaymentAuthorization;
    try {
      let rawJsonString = rawPaymentHeader;
      if (rawPaymentHeader.startsWith('Bearer ')) {
        rawJsonString = rawPaymentHeader.slice(7);
      }
      // If base64 encoded
      if (!rawJsonString.trim().startsWith('{')) {
        rawJsonString = Buffer.from(rawJsonString, 'base64').toString('utf-8');
      }
      parsedAuthorization = JSON.parse(rawJsonString);
    } catch {
      return {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
        body: {
          statusCode: 402,
          error: 'Malformed Payment Header',
          message: 'Unable to decode X-Payment header into valid Eip712PaymentAuthorization.',
        },
      };
    }

    // Settle through Facilitator
    const settlementResult = await this.facilitator.settle({
      requirement,
      authorization: parsedAuthorization,
    });

    // Requirement 05: Reject bad or underpaid payment with another 402
    if (!settlementResult.success) {
      return {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Rejected-Reason': settlementResult.errorMessage || 'Invalid payment',
        },
        body: {
          statusCode: 402,
          error: 'Payment Settlement Rejected',
          reason: settlementResult.errorMessage,
          paymentRequirement: requirement,
        },
      };
    }

    // Requirement 04: Return HTTP 200 with PAYMENT-RESPONSE header containing tx hash & explorer link
    const paymentResponsePayload: X402PaymentResponsePayload = {
      status: 'SETTLED',
      network: ATLANTIC_TESTNET.networkIdentifier,
      transactionHash: settlementResult.transactionHash!,
      explorerUrl: settlementResult.explorerUrl!,
      amountSettled: `${requirement.price} USDC`,
      tokenSymbol: 'USDC',
      payer: parsedAuthorization.clientPayerAddress,
    };

    const paymentResponseBase64 = Buffer.from(JSON.stringify(paymentResponsePayload)).toString('base64');

    // Execute route payload
    let routeData: any;
    if (req.path === '/api/market-depth') {
      routeData = {
        pair: 'PROS/USDC',
        network: ATLANTIC_TESTNET.networkIdentifier,
        bestBid: '2.45 USDC',
        bestAsk: '2.47 USDC',
        depthBids: [
          { price: 2.45, size: 15400 },
          { price: 2.44, size: 28900 },
          { price: 2.43, size: 54100 },
        ],
        depthAsks: [
          { price: 2.47, size: 12200 },
          { price: 2.48, size: 31000 },
          { price: 2.49, size: 68500 },
        ],
        timestamp: new Date().toISOString(),
      };
    } else if (req.path === '/api/ai-inference') {
      const userPrompt = req.body?.prompt || 'Evaluate portfolio collateralization';
      routeData = {
        task: 'AI Credit Risk Analysis',
        prompt: userPrompt,
        riskScore: 'A (Low Liquidation Probability)',
        recommendedAction: 'HOLD_COLLATERAL',
        confidence: 0.964,
        inferenceLatencyMs: 142,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'PAYMENT-RESPONSE': paymentResponseBase64,
        'X-Payment-Tx-Hash': settlementResult.transactionHash!,
        'X-Payment-Explorer': settlementResult.explorerUrl!,
      },
      body: {
        data: routeData,
        settlement: paymentResponsePayload,
      },
    };
  }
}
