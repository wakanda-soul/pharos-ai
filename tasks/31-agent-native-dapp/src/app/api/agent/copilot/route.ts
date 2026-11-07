import { NextRequest, NextResponse } from 'next/server';
import { GeminiSandboxEngine } from '@/lib/gemini-sandbox';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      agentWalletAddress = '0xAgentEmbeddedWallet00000000000000000001',
      agentWalletBalanceUsdc = 0.5,
      geminiApiKey,
      oauthAccessToken,
    } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt in request body.' }, { status: 400 });
    }

    const message = await GeminiSandboxEngine.processUserMessage({
      prompt,
      agentWalletAddress,
      agentWalletBalanceUsdc,
      geminiApiKey: geminiApiKey || process.env.GEMINI_API_KEY,
      oauthAccessToken,
    });

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
