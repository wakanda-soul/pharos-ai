import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';
import { isAddress } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publisherAddress } = body;

    if (!publisherAddress || !isAddress(publisherAddress)) {
      return NextResponse.json(
        { error: 'Valid checksummed publisherAddress is required to restore vouchers.' },
        { status: 400 }
      );
    }

    const result = feedStore.reopenUnsettledRevenue(publisherAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to restore unsettled revenue.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      restoredAmount: result.restoredAmount,
      restoredFeeds: result.restoredFeeds,
      message: `Successfully restored ${result.restoredAmount} USDC in off-chain vouchers back to Ready-to-Settle status for on-chain claiming.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error while restoring vouchers.' },
      { status: 500 }
    );
  }
}
