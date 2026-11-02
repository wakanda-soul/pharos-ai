import {
  privateKeyToAccount,
} from 'viem/accounts';
import {
  parseUnits,
} from 'viem';
import { randomBytes } from 'node:crypto';
import {
  ATLANTIC_TESTNET,
  Eip712PaymentAuthorization,
  X402PaymentRequirement,
  X402PaymentResponsePayload,
} from './types.js';
import {
  X402_EIP712_DOMAIN,
  X402_PAYMENT_TYPES,
} from './facilitator.js';
import {
  HttpRequest,
  HttpResponse,
  X402PaywallServer,
} from './paywall-server.js';
import { SecureKeyProvider } from './key-loader.js';

export interface X402ClientExecutionLog {
  readonly initialStatus: number;
  readonly requiredPriceUsdc?: string;
  readonly authorizationSigned?: Eip712PaymentAuthorization;
  readonly secondStatus: number;
  readonly paymentResponse?: X402PaymentResponsePayload;
  readonly finalBody: any;
}

/**
 * Autonomous x402 Buyer Client.
 * Automatically handles HTTP 402 negotiation, EIP-712 authorization signing,
 * and request replay with settlement verification.
 */
export class X402BuyerClient {
  private readonly account: ReturnType<typeof privateKeyToAccount>;
  private readonly server: X402PaywallServer;

  constructor(
    customServer: X402PaywallServer,
    customPrivateKey?: `0x${string}`
  ) {
    this.server = customServer;
    // Securely retrieve private key per Requirement 06
    const keyToUse = customPrivateKey ?? SecureKeyProvider.resolveSignerPrivateKey();
    this.account = privateKeyToAccount(keyToUse);
  }

  getPayerAddress(): `0x${string}` {
    return this.account.address;
  }

  /**
   * Dispatches an HTTP request with automatic 402 challenge-response negotiation.
   */
  async request(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    options?: {
      overridePriceUsdc?: number; // Used to simulate underpayment attacks (Req 05)
      corruptSignature?: boolean; // Used to simulate bad signature attacks (Req 05)
    }
  ): Promise<X402ClientExecutionLog> {
    // ─── Step 1: Initial Request (Expected 200 for free, 402 for paid) ────────
    const initialReq: HttpRequest = {
      path,
      method,
      headers: {},
      body,
    };
    const initialRes: HttpResponse = await this.server.handleRequest(initialReq);

    // If endpoint is free (e.g. /health), return immediately
    if (initialRes.status === 200) {
      return {
        initialStatus: 200,
        secondStatus: 200,
        finalBody: initialRes.body,
      };
    }

    // ─── Step 2: Extract 402 Payment Requirements ─────────────────────────────
    let requirement: X402PaymentRequirement;
    const reqHeader = initialRes.headers['PAYMENT-REQUIRED'];
    if (reqHeader) {
      requirement = JSON.parse(Buffer.from(reqHeader, 'base64').toString('utf-8'));
    } else if (initialRes.body?.paymentRequirement) {
      requirement = initialRes.body.paymentRequirement;
    } else {
      throw new Error(`Unexpected status ${initialRes.status} without PAYMENT-REQUIRED header.`);
    }

    // ─── Step 3: Authorize & Sign EIP-712 Payment ─────────────────────────────
    const priceToPay = options?.overridePriceUsdc !== undefined
      ? options.overridePriceUsdc
      : parseFloat(requirement.price);

    const unitsToAuthorize = parseUnits(priceToPay.toString(), ATLANTIC_TESTNET.usdcDecimals);
    const nonce = `nonce-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const validUntil = requirement.validUntilTimestamp;

    // Sign Typed Data with Payer Account
    let signatureHex = await this.account.signTypedData({
      domain: X402_EIP712_DOMAIN,
      types: X402_PAYMENT_TYPES,
      primaryType: 'PaymentAuthorization',
      message: {
        clientPayerAddress: this.account.address,
        payToRecipient: requirement.payTo,
        tokenAddress: requirement.tokenAddress,
        authorizedAmountUnits: unitsToAuthorize,
        nonce,
        validUntilTimestamp: BigInt(validUntil),
      },
    });

    if (options?.corruptSignature) {
      // Intentionally invert bytes to simulate invalid signature attack
      signatureHex = ('0x' + '00'.repeat(65)) as `0x${string}`;
    }

    const authorizationPayload: Eip712PaymentAuthorization = {
      clientPayerAddress: this.account.address,
      payToRecipient: requirement.payTo,
      tokenAddress: requirement.tokenAddress,
      authorizedAmountUnits: unitsToAuthorize.toString(),
      decimalPriceUsdc: priceToPay,
      nonce,
      validUntilTimestamp: validUntil,
      signatureHex,
    };

    // ─── Step 4: Re-Submit Request with X-Payment Header ─────────────────────
    const paymentHeaderBase64 = Buffer.from(JSON.stringify(authorizationPayload)).toString('base64');
    const secondReq: HttpRequest = {
      path,
      method,
      headers: {
        'x-payment': paymentHeaderBase64,
      },
      body,
    };

    const secondRes: HttpResponse = await this.server.handleRequest(secondReq);

    // Extract PAYMENT-RESPONSE header if settlement succeeded
    let paymentResponse: X402PaymentResponsePayload | undefined;
    const responseHeader = secondRes.headers['PAYMENT-RESPONSE'];
    if (responseHeader) {
      paymentResponse = JSON.parse(Buffer.from(responseHeader, 'base64').toString('utf-8'));
    }

    return {
      initialStatus: initialRes.status,
      requiredPriceUsdc: requirement.price,
      authorizationSigned: authorizationPayload,
      secondStatus: secondRes.status,
      paymentResponse,
      finalBody: secondRes.body,
    };
  }
}
