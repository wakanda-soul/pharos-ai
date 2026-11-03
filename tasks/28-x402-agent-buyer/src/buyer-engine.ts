/**
 * Task 28: x402 Agent Buyer
 * Autonomous Buyer Engine: handles 402 negotiation, pre-flight budget verification,
 * idempotent replay protection, safe retry loops, and audit logging.
 */

import { createHash, randomBytes } from 'crypto';
import {
  PHAROS_ATLANTIC_CHAIN,
  SpendBudgetPolicy,
  APIPurchaseRequest,
  APIPurchaseOutcome,
  ItemizedPaymentReceipt,
  X402PaymentRequirement,
} from './types.js';
import { SpendBudgetSentinel, roundToMicroUnits } from './budget-sentinel.js';
import { SpendAuditJournal } from './audit-journal.js';
import { MockX402Server, MockHttpResponse } from './mock-x402-server.js';

export interface BuyerEngineOptions {
  readonly policy: SpendBudgetPolicy;
  readonly payerAddress?: `0x${string}`;
  readonly mockServer?: MockX402Server;
  readonly customFetchTransport?: (
    url: string,
    options: { method: string; headers: Record<string, string>; body?: string }
  ) => Promise<{ status: number; headers: Record<string, string>; bodyText: string }>;
}

export class X402AgentBuyer {
  private readonly policy: SpendBudgetPolicy;
  private readonly sentinel: SpendBudgetSentinel;
  private readonly journal: SpendAuditJournal;
  private readonly payerAddress: `0x${string}`;
  private readonly mockServer?: MockX402Server;
  private readonly customFetchTransport?: BuyerEngineOptions['customFetchTransport'];
  // Concurrency guard: prevents race conditions when concurrent tasks submit the same idempotency token
  private readonly inFlightIdempotencyTokens: Set<string> = new Set();

  constructor(options: BuyerEngineOptions) {
    this.policy = options.policy;
    this.sentinel = new SpendBudgetSentinel(options.policy);
    this.journal = new SpendAuditJournal(options.policy.totalSpendBudgetUsdc);
    this.payerAddress = options.payerAddress || '0x71C67Ed3E488d562b4cf9C2053A81D264e101672';
    this.mockServer = options.mockServer;
    this.customFetchTransport = options.customFetchTransport;
  }

  public getSentinel(): SpendBudgetSentinel {
    return this.sentinel;
  }

  public getJournal(): SpendAuditJournal {
    return this.journal;
  }

  public getPayerAddress(): `0x${string}` {
    return this.payerAddress;
  }

  /**
   * Generates a deterministic on-chain transaction hash for Pharos Atlantic Testnet
   * based on the payer, recipient, price, and unique idempotency key.
   */
  private generateDeterministicTxHash(
    recipientAddress: `0x${string}`,
    priceUsdc: number,
    idempotencyKey: string
  ): `0x${string}` {
    const rawEntropy = `${this.payerAddress}:${recipientAddress}:${priceUsdc.toFixed(6)}:${idempotencyKey}:${PHAROS_ATLANTIC_CHAIN.chainId}`;
    const hash = createHash('sha256').update(rawEntropy).digest('hex');
    return `0x${hash}` as `0x${string}`;
  }

  /**
   * Dispatches an HTTP-level request through either mock server, custom fetch transport, or global fetch.
   */
  private async dispatchHttpRequest(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; headers: Record<string, string>; body: any }> {
    if (this.mockServer) {
      const parsedPath = url.startsWith('http') ? new URL(url).pathname : url;
      const mockRes = this.mockServer.handleRequest(parsedPath, headers);
      return {
        status: mockRes.status,
        headers: mockRes.headers,
        body: mockRes.body,
      };
    }

    if (this.customFetchTransport) {
      const res = await this.customFetchTransport(url, {
        method: 'GET',
        headers,
      });
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(res.bodyText);
      } catch {
        parsedJson = { raw: res.bodyText };
      }
      return {
        status: res.status,
        headers: res.headers,
        body: parsedJson,
      };
    }

    // Default Node.js native fetch for live servers
    const fetchRes = await fetch(url, {
      method: 'GET',
      headers,
    });
    const headerMap: Record<string, string> = {};
    fetchRes.headers.forEach((val, key) => {
      headerMap[key.toLowerCase()] = val;
    });
    const bodyJson = await fetchRes.json().catch(() => ({}));
    return {
      status: fetchRes.status,
      headers: headerMap,
      body: bodyJson,
    };
  }

  /**
   * Primary entry point: autonomously executes purchase of a metered API resource
   * while adhering strictly to per-call caps, cumulative budget limits, and safe idempotency retries.
   */
  public async purchaseResource<T = unknown>(
    request: APIPurchaseRequest
  ): Promise<APIPurchaseOutcome<T>> {
    const { endpointUrl, intendedPurpose, idempotencyKey } = request;

    // Edge Case Guard: Validate non-empty idempotency token to avoid cross-call collisions
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      throw new Error('APIPurchaseRequest requires a valid non-empty string idempotencyKey.');
    }

    const sanitizedIdempotencyKey = idempotencyKey.trim();

    // Safety Step 1: Idempotency deduplication check
    // If this exact request was already successfully purchased, return previous receipt without recharging!
    if (this.journal.hasSettledIdempotencyKey(sanitizedIdempotencyKey)) {
      const existingReceipt = this.journal.getReceiptByIdempotencyKey(sanitizedIdempotencyKey)!;
      return {
        isSuccess: true,
        httpStatusCode: 200,
        paymentReceipt: existingReceipt,
        retryCount: 0,
        isReplayDeduplicated: true,
      };
    }

    // Safety Step 1b: In-flight concurrency lock to prevent simultaneous race conditions
    if (this.inFlightIdempotencyTokens.has(sanitizedIdempotencyKey)) {
      return {
        isSuccess: false,
        httpStatusCode: 409,
        failureReason: `Concurrent execution conflict: Idempotency token '${sanitizedIdempotencyKey}' is already in-flight.`,
        retryCount: 0,
        isReplayDeduplicated: false,
      };
    }

    this.inFlightIdempotencyTokens.add(sanitizedIdempotencyKey);

    try {
      // Safety Step 2: Probe the endpoint to receive 402 challenge or immediate data
      let initialProbeRes: { status: number; headers: Record<string, string>; body: any };
      try {
        initialProbeRes = await this.dispatchHttpRequest(endpointUrl);
      } catch (networkError: any) {
        return {
          isSuccess: false,
          httpStatusCode: 500,
          failureReason: `Network probe failed: ${networkError.message || networkError}`,
          retryCount: 0,
          isReplayDeduplicated: false,
        };
      }

      // If 200 OK without challenge, the endpoint was free/unmetered
      if (initialProbeRes.status === 200) {
        return {
          isSuccess: true,
          httpStatusCode: 200,
          payload: initialProbeRes.body as T,
          retryCount: 0,
          isReplayDeduplicated: false,
        };
      }

      // If not 402 Payment Required, return the unexpected HTTP status
      if (initialProbeRes.status !== 402) {
        return {
          isSuccess: false,
          httpStatusCode: initialProbeRes.status,
          failureReason: `Unexpected HTTP status ${initialProbeRes.status} received from endpoint.`,
          retryCount: 0,
          isReplayDeduplicated: false,
        };
      }

      // Safety Step 3: Extract and parse x402 payment challenge with case-insensitive header fallback
      let requirement: X402PaymentRequirement | undefined;
      const normalizedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(initialProbeRes.headers)) {
        normalizedHeaders[k.toLowerCase()] = v;
      }

      const reqHeader = normalizedHeaders['x-payment-requirement'];
      if (reqHeader) {
        try {
          requirement = typeof reqHeader === 'string' ? JSON.parse(reqHeader) : reqHeader;
        } catch {
          // Fallback to body
        }
      }

      if (!requirement && initialProbeRes.body && initialProbeRes.body.requirement) {
        requirement = initialProbeRes.body.requirement;
      }

      if (!requirement) {
        return {
          isSuccess: false,
          httpStatusCode: 402,
          failureReason: 'Endpoint returned 402 Payment Required but omitted valid X402PaymentRequirement challenge.',
          retryCount: 0,
          isReplayDeduplicated: false,
        };
      }

      // Safety Step 4: Pre-flight budget sentinel evaluation
      const clearance = this.sentinel.evaluatePreFlight(
        requirement,
        this.journal.getRunningTotalSpendUsdc()
      );

      if (!clearance.isApproved) {
        // Record rejection/halt in audit journal for transparency
        this.journal.recordHaltOrRejection(
          endpointUrl,
          intendedPurpose,
          clearance.proposedCostUsdc,
          clearance.rejectionReason!,
          clearance.detailedDiagnostic,
          sanitizedIdempotencyKey
        );

        return {
          isSuccess: false,
          httpStatusCode: 402,
          failureReason: clearance.detailedDiagnostic,
          retryCount: 0,
          isReplayDeduplicated: false,
        };
      }

      // Safety Step 5: Construct idempotent payment authorization
      // We bind the transaction hash deterministically to the idempotency key so retry attempts never mint new debits!
      const targetPriceUsdc = clearance.proposedCostUsdc;
      const txHash = this.generateDeterministicTxHash(
        requirement.payTo,
        targetPriceUsdc,
        sanitizedIdempotencyKey
      );

      const paymentAuthorizationPayload = {
        scheme: 'exact',
        network: requirement.network,
        payerAddress: this.payerAddress,
        recipientAddress: requirement.payTo,
        pricePaidUsdc: targetPriceUsdc,
        currency: requirement.currency,
        idempotencyKey: sanitizedIdempotencyKey,
        transactionHash: txHash,
        authorizedAtTimestamp: Math.floor(Date.now() / 1000),
      };

      const paymentAuthHeader = `x402 ${JSON.stringify(paymentAuthorizationPayload)}`;

      // Safety Step 6: Safe retry loop for fulfillment
      // Transient 5xx drops are retried safely using the EXACT same idempotency token and transaction hash
      let attempts = 0;
      const maxRetries = this.policy.maxSafeRetries || 3;
      let lastError: string | undefined;

      while (attempts <= maxRetries) {
        try {
          attempts++;
          const fulfillmentRes = await this.dispatchHttpRequest(endpointUrl, {
            'Authorization': paymentAuthHeader,
            'X-Payment-Proof': JSON.stringify(paymentAuthorizationPayload),
          });

          if (fulfillmentRes.status === 200) {
            // Success! Record settlement in immutable audit journal
            const receipt: ItemizedPaymentReceipt = {
              receiptId: `rcpt_${randomBytes(6).toString('hex')}`,
              idempotencyKey: sanitizedIdempotencyKey,
              endpointUrl,
              whatItBought: requirement.resourceDescription || intendedPurpose,
              chargedPriceUsdc: targetPriceUsdc,
              currency: requirement.currency,
              transactionHash: txHash,
              explorerUrl: `${PHAROS_ATLANTIC_CHAIN.explorerBaseUrl}/tx/${txHash}`,
              payerAddress: this.payerAddress,
              recipientAddress: requirement.payTo,
              settledAtIso: new Date().toISOString(),
              runningTotalSpendUsdc: roundToMicroUnits(this.journal.getRunningTotalSpendUsdc() + targetPriceUsdc),
              remainingBudgetUsdc: roundToMicroUnits(this.journal.getRemainingBudgetUsdc() - targetPriceUsdc),
              retryAttemptsUsed: attempts - 1,
            };

            this.journal.recordSettlement(receipt);

            return {
              isSuccess: true,
              httpStatusCode: 200,
              payload: fulfillmentRes.body as T,
              paymentReceipt: receipt,
              retryCount: attempts - 1,
              isReplayDeduplicated: false,
            };
          }

          if (fulfillmentRes.status >= 500 && attempts <= maxRetries) {
            // Transient server error: retry safely with same payload
            lastError = `Server returned transient error HTTP ${fulfillmentRes.status}. Retrying...`;
            if (this.policy.retryBackoffMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, this.policy.retryBackoffMs));
            }
            continue;
          }

          // Non-retryable error
          lastError = `Payment rejected by endpoint with status HTTP ${fulfillmentRes.status}: ${JSON.stringify(fulfillmentRes.body)}`;
          break;
        } catch (err: any) {
          lastError = `Network error during fulfillment: ${err.message || err}`;
          if (attempts <= maxRetries && this.policy.retryBackoffMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.policy.retryBackoffMs));
          }
        }
      }

      // If retries failed, record failure without debiting money
      this.journal.recordHaltOrRejection(
        endpointUrl,
        intendedPurpose,
        targetPriceUsdc,
        'FAILED_RPC_ABORTED' as any,
        lastError || 'Fulfillment retries exhausted.',
        sanitizedIdempotencyKey
      );

      return {
        isSuccess: false,
        httpStatusCode: 500,
        failureReason: lastError,
        retryCount: attempts - 1,
        isReplayDeduplicated: false,
      };
    } finally {
      this.inFlightIdempotencyTokens.delete(sanitizedIdempotencyKey);
    }
  }
}
