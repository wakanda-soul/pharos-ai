import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';

export async function GET() {
  const feeds = feedStore.getAllFeeds();
  return NextResponse.json({ feeds });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, newPriceUsdc, newEndpointPath, newSchemaHash } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug in request.' }, { status: 400 });
    }

    // Handle endpoint mutation (triggers anti-scam auto-revocation)
    if (newEndpointPath || newSchemaHash) {
      const result = feedStore.mutateFeedDefinition(
        slug,
        newEndpointPath || '',
        newSchemaHash || ''
      );
      if (!result.success) {
        return NextResponse.json({ error: 'Feed not found for mutation.' }, { status: 404 });
      }
      return NextResponse.json({
        message: 'Endpoint definition updated. Feed has been automatically placed into PENDING_AUDIT status for curator re-verification.',
        slug,
        curationStatus: result.status,
      });
    }

    // Handle price update (Publisher privilege)
    if (typeof newPriceUsdc === 'number') {
      const ok = feedStore.updatePrice(slug, newPriceUsdc);
      if (!ok) {
        return NextResponse.json(
          { error: 'Failed to update price. Price must be >= 0.0001 USDC.' },
          { status: 400 }
        );
      }
      const updated = feedStore.getFeedBySlug(slug);
      return NextResponse.json({
        message: 'Feed price updated successfully.',
        feed: updated,
      });
    }

    return NextResponse.json({ error: 'No valid update fields provided.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
