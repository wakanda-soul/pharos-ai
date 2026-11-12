import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';
import { isAddress } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, publisherAddress, publisherName } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Feed slug is required.' }, { status: 400 });
    }

    if (!publisherAddress || !isAddress(publisherAddress)) {
      return NextResponse.json(
        { error: 'Valid checksummed publisherAddress is required.' },
        { status: 400 }
      );
    }

    const success = feedStore.claimFeedOwnership(slug, publisherAddress, publisherName);

    if (!success) {
      return NextResponse.json({ error: `Feed '${slug}' not found.` }, { status: 404 });
    }

    const updatedFeed = feedStore.getFeedBySlug(slug);

    return NextResponse.json({
      success: true,
      message: `Feed '${updatedFeed?.name}' has been successfully linked to publisher ${publisherAddress}!`,
      feed: updatedFeed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error claiming feed ownership.' },
      { status: 500 }
    );
  }
}
