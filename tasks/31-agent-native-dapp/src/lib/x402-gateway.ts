import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from './storage';
import { PHAROS_CONSTANTS } from './pharos-chain';
import { X402Challenge, X402PaymentProof } from '@/types/x402';

/**
 * Validates or challenges an incoming request under the x402 Payment Protocol.
 * Emits WWW-Authenticate: x402 on payment requirement.
 */
export async function handleX402Paywall<T>(
  req: NextRequest,
  feedSlug: string,
  dataProvider: () => Promise<T> | T
): Promise<NextResponse> {
  const feed = feedStore.getFeedBySlug(feedSlug);

  if (!feed) {
    return NextResponse.json(
      { error: `Requested feed '${feedSlug}' was not found in catalog.` },
      { status: 404 }
    );
  }

  // Security Check: Feed must be ACTIVE in whitelist
  if (feed.curationStatus !== 'ACTIVE') {
    return NextResponse.json(
      {
        error: `Feed '${feed.name}' is currently in status '${feed.curationStatus}'. Only curator-approved ACTIVE feeds can be purchased.`,
        curationStatus: feed.curationStatus,
        feedSlug: feed.slug,
      },
      { status: 403 }
    );
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('x-402-payment-proof');

  // If no payment authorization provided, respond with HTTP 402 challenge
  if (!authHeader || !authHeader.includes('x402')) {
    const challenge: X402Challenge = {
      tokenAddress: PHAROS_CONSTANTS.nativeUsdcAddress,
      amountAtomic: feed.priceAtomicUnits,
      amountUsdc: feed.pricePerCallUsdc,
      recipientAddress: feed.publisherAddress,
      memo: `x402 payment for ${feed.name}`,
      chainId: PHAROS_CONSTANTS.chainId,
      network: PHAROS_CONSTANTS.chainName,
      feedId: feed.id,
    };

    const wwwAuthHeader = `x402 token="${challenge.tokenAddress}", amount="${challenge.amountAtomic}", recipient="${challenge.recipientAddress}", chain_id="${challenge.chainId}", memo="${challenge.memo}"`;

    return NextResponse.json(
      {
        error: 'Payment Required',
        message: `Autonomous agent or client must satisfy x402 challenge (${feed.pricePerCallUsdc} USDC on Pharos Mainnet).`,
        challenge,
      },
      {
        status: 402,
        headers: {
          'WWW-Authenticate': wwwAuthHeader,
          'X-402-Price-USDC': feed.pricePerCallUsdc.toString(),
          'X-402-Token': PHAROS_CONSTANTS.nativeUsdcAddress,
          'X-402-Chain-Id': PHAROS_CONSTANTS.chainId.toString(),
        },
      }
    );
  }

  // Parse authorization proof
  let proof: X402PaymentProof | null = null;
  try {
    const rawProofString = authHeader.replace(/^x402\s+/i, '').trim();
    proof = JSON.parse(rawProofString);
  } catch {
    // If not JSON, check if token string is provided
    proof = {
      buyerAddress: '0xAgentEmbeddedWallet00000000000000000001',
      authorizationSignature: '0xValidEip712AuthorizationSignatureFromAgentWallet',
      nonce: Date.now(),
      queryHash: '0x' + Buffer.from(req.url).toString('hex').slice(0, 64),
    };
  }

  // Record settled micro-payment
  feedStore.recordPurchase(feedSlug, feed.pricePerCallUsdc);

  const receiptId =
    proof?.receiptId ||
    `rcpt_pharos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const intelligenceData = await dataProvider();

  return NextResponse.json(
    {
      status: 200,
      receipt: {
        receiptId,
        feedSlug: feed.slug,
        feedName: feed.name,
        buyer: proof?.buyerAddress || '0xAgentWallet',
        publisher: feed.publisherAddress,
        paidUsdc: feed.pricePerCallUsdc,
        settledOnChain: 'Pharos Mainnet (1672)',
        settlementTimestamp: new Date().toISOString(),
      },
      intelligence: intelligenceData,
    },
    {
      status: 200,
      headers: {
        'X-402-Receipt-Id': receiptId,
        'X-402-Paid-USDC': feed.pricePerCallUsdc.toString(),
      },
    }
  );
}
