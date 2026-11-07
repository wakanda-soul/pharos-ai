import { NextRequest } from 'next/server';
import { handleX402Paywall } from '@/lib/x402-gateway';
import { fetchLiveIntelligenceData } from '@/lib/pharos-intelligence';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const queryParams: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    queryParams[key] = val;
  });

  return handleX402Paywall(req, 'whale-radar', () =>
    fetchLiveIntelligenceData('whale-radar', queryParams)
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return handleX402Paywall(req, 'whale-radar', () =>
    fetchLiveIntelligenceData('whale-radar', body)
  );
}
