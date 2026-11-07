import { NextRequest } from 'next/server';
import { handleX402Paywall } from '@/lib/x402-gateway';
import { fetchLiveIntelligenceData } from '@/lib/pharos-intelligence';

export async function GET(req: NextRequest) {
  return handleX402Paywall(req, 'harbor-solvency', () =>
    fetchLiveIntelligenceData('harbor-solvency')
  );
}

export async function POST(req: NextRequest) {
  return handleX402Paywall(req, 'harbor-solvency', () =>
    fetchLiveIntelligenceData('harbor-solvency')
  );
}
