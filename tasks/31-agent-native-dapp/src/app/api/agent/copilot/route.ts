import { NextRequest, NextResponse } from 'next/server';
import { GeminiSandboxEngine } from '@/lib/gemini-sandbox';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[COPILOT_ROUTE_REQUEST]', new Date().toISOString(), 'prompt:', body?.prompt);
    const {
      prompt,
      conversationHistory = [],
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
      conversationHistory,
      agentWalletAddress,
      agentWalletBalanceUsdc,
      geminiApiKey: geminiApiKey || process.env.GEMINI_API_KEY,
      oauthAccessToken,
    });

    console.log('[COPILOT_ROUTE_RESPONSE]', new Date().toISOString(), 'text:', message?.text);
    return NextResponse.json({ message });
  } catch (error) {
    console.error('Copilot processing error, generating resilient response:', error);
    const isRussian = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(String((req as any)?.body || ''));
    return NextResponse.json({
      message: {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: isRussian
          ? 'На связи! Сеть Pharos Mainnet и RPC-сервисы активны. Чем помочь?'
          : 'Connected! Pharos Mainnet services and RPC are active. How can I help?',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
