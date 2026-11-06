import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';
import { FeedCurationStatus } from '@/types/feed';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, status, curatorAddress, reason } = body;

    if (!slug || !status) {
      return NextResponse.json({ error: 'Missing slug or status parameter.' }, { status: 400 });
    }

    const validStatuses: FeedCurationStatus[] = ['ACTIVE', 'PENDING_AUDIT', 'SUSPENDED', 'REVOKED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status '${status}'.` }, { status: 400 });
    }

    // Verify curator identity (wakanda-soul)
    const normalizedCurator = (curatorAddress || '').toLowerCase();
    const authorizedCurator = PHAROS_CONSTANTS.curatorAddress.toLowerCase();

    // Allow curator address or admin handle
    if (normalizedCurator && normalizedCurator !== authorizedCurator && curatorAddress !== PHAROS_CONSTANTS.curatorHandle) {
      return NextResponse.json(
        {
          error: `Access Denied: Only designated curator '${PHAROS_CONSTANTS.curatorHandle}' (${PHAROS_CONSTANTS.curatorAddress}) can approve or curate feeds.`,
        },
        { status: 403 }
      );
    }

    const success = feedStore.curateStatus(slug, status, authorizedCurator);
    if (!success) {
      return NextResponse.json({ error: `Feed '${slug}' not found.` }, { status: 404 });
    }

    const updated = feedStore.getFeedBySlug(slug);

    return NextResponse.json({
      message: `Feed '${slug}' status updated to '${status}'.`,
      curator: PHAROS_CONSTANTS.curatorHandle,
      reason: reason || 'Curator audit check completed.',
      feed: updated,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
