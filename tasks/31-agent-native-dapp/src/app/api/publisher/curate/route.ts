import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';
import { FeedCurationStatus } from '@/types/feed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Verify curator identity (wakanda-soul or designated curator address)
    const normalizedCurator = (curatorAddress || '').toLowerCase();
    const authorizedCurator = PHAROS_CONSTANTS.curatorAddress.toLowerCase();
    const authorizedPrivyWallet = '0xf80622473df9c6babcf2d382458b7c75b74918b4';
    const authorizedUserWallet = '0x11d12c00308c92beb5937fc9315cfa9b5a3c8b1e';

    if (
      !normalizedCurator ||
      (normalizedCurator !== authorizedCurator &&
        normalizedCurator !== authorizedPrivyWallet &&
        normalizedCurator !== authorizedUserWallet &&
        curatorAddress !== PHAROS_CONSTANTS.curatorHandle)
    ) {
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
