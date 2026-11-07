import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';

export async function GET() {
  const feeds = feedStore.getAllFeeds();
  return NextResponse.json({ feeds });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, slug, description, category, publisherAddress, pricePerCallUsdc, endpointPath } = body;

    if (!name || !slug || !endpointPath || !publisherAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, endpointPath, publisherAddress.' },
        { status: 400 }
      );
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = feedStore.getFeedBySlug(cleanSlug);
    if (existing) {
      return NextResponse.json({ error: `Feed with slug '${cleanSlug}' already exists.` }, { status: 409 });
    }

    const price = typeof pricePerCallUsdc === 'number' && pricePerCallUsdc >= 0.0001 ? pricePerCallUsdc : 0.001;

    const newFeed = {
      id: `feed_${Date.now()}`,
      name,
      slug: cleanSlug,
      description: description || 'Custom publisher intelligence endpoint.',
      category: category || 'CUSTOM',
      publisherAddress,
      publisherName: 'Independent Data Provider',
      pricePerCallUsdc: price,
      priceAtomicUnits: Math.round(price * 1_000_000).toString(),
      endpointPath,
      schemaHash: `sha256-${Date.now().toString(16)}`,
      curationStatus: 'PENDING_AUDIT' as const,
      totalCalls: 0,
      grossRevenueUsdc: 0.0,
      sampleQuery: '?format=json',
      sampleResponse: { status: 'healthy', network: 'Pharos Mainnet' },
      lastUpdated: new Date().toISOString(),
    };

    feedStore.registerFeed(newFeed);

    return NextResponse.json({
      message: 'Feed registered successfully and submitted for curator audit.',
      feed: newFeed,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
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
