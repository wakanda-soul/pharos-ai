import { NextRequest } from 'next/server';
import { handleX402Paywall } from '@/lib/x402-gateway';
import { fetchLiveIntelligenceData } from '@/lib/pharos-intelligence';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('target') || '';

  return handleX402Paywall(req, 'contract-risk', () =>
    fetchLiveIntelligenceData('contract-risk', { target })
  );
}

export async function POST(req: NextRequest) {
  let body: { target?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return handleX402Paywall(req, 'contract-risk', () =>
    fetchLiveIntelligenceData('contract-risk', { target: body.target || '' })
  );
}
