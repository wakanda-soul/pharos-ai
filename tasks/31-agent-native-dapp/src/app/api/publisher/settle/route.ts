import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';
import { isAddress } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publisherAddress, slug, onChainTxHash } = body;

    if (!publisherAddress || !isAddress(publisherAddress)) {
      return NextResponse.json(
        { error: 'Valid checksummed publisherAddress is required to execute settlement.' },
        { status: 400 }
      );
    }

    const result = feedStore.settleFeedRevenue(publisherAddress, slug, onChainTxHash);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to settle publisher revenue.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      settlementReceipt: {
        receiptId: result.receiptId,
        settledAmountUsdc: result.settledAmount,
        destinationWallet: publisherAddress,
        network: 'Pharos Mainnet (Chain ID 1672)',
        settlementTxHash: result.onChainTxHash,
        settledFeeds: result.settledFeeds,
        settlementStandard: 'x402 Batch Promissory Vouchers (EIP-712)',
        timestamp: result.timestamp,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error during publisher settlement execution.' },
      { status: 500 }
    );
  }
}
