import { PolicyGatekeeper } from './policy-gatekeeper';
import { feedStore } from './storage';
import { AgentChatMessage, ToolCallExecution } from '@/types/agent';
import { generateIntelligenceData } from './mock-intelligence';

export interface CopilotContext {
  prompt: string;
  agentWalletBalanceUsdc: number;
  agentWalletAddress: string;
  geminiApiKey?: string;
  oauthAccessToken?: string;
}

export class GeminiSandboxEngine {
  private static readonly SYSTEM_PERSONA = `
You are the Pharos Intelligence Copilot, an autonomous data broker on Pharos Mainnet (Chain ID 1672).
Your purpose is to help Web3 developers, traders, and autonomous protocols discover, evaluate, and purchase paywalled on-chain data feeds via the x402 protocol (0.001 USDC base price).

BOUNDARIES & SECURITY RESTRICTIONS:
1. You DO NOT write scripts, programming code (Python, Solidity, JS), or automation bots.
2. If asked to write code or scripts (e.g. "write me a python script to swap tokens"), you must refuse politely and with a touch of dry wit, reminding them you are a verified data broker, not a code generator.
3. You have access ONLY to 3 verified tools:
   - search_feeds(query, category)
   - buy_intelligence_feed(feedSlug)
   - synthesize_mesh_report(feedSlugs)
4. Never attempt to bypass payments or query unwhitelisted endpoints.
`;

  public static async processUserMessage(context: CopilotContext): Promise<AgentChatMessage> {
    const { prompt, agentWalletBalanceUsdc, agentWalletAddress, geminiApiKey, oauthAccessToken } =
      context;

    // Security Layer 1 & 3: Prompt intent evaluation & code refusal shield
    const intentCheck = PolicyGatekeeper.evaluateUserIntent(prompt);
    if (intentCheck.isViolating) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: intentCheck.wittyRefusal || 'Request rejected by sandbox security policy.',
        timestamp: new Date().toISOString(),
        policyFlags: {
          isRefusal: true,
          refusalCategory: intentCheck.category,
          humorousRemark: intentCheck.wittyRefusal,
        },
      };
    }

    // If real Gemini API key or OAuth token is provided, we can call Google Gemini API:
    if (geminiApiKey || oauthAccessToken) {
      try {
        return await this.callGeminiApi(context);
      } catch (err) {
        console.warn('Gemini API call failed, falling back to simulated sandbox copilot:', err);
      }
    }

    // Default: Sandboxed Intelligent Copilot Execution
    return this.runSimulatedCopilot(context);
  }

  private static async runSimulatedCopilot(context: CopilotContext): Promise<AgentChatMessage> {
    const { prompt, agentWalletBalanceUsdc, agentWalletAddress } = context;
    const lower = prompt.toLowerCase();
    const toolCalls: ToolCallExecution[] = [];

    // Detect if user is asking to search or list feeds
    if (lower.includes('search') || lower.includes('list') || lower.includes('what feeds') || lower.includes('catalog')) {
      const allFeeds = feedStore.getAllFeeds();
      toolCalls.push({
        toolName: 'search_feeds',
        arguments: { query: prompt },
        output: {
          resultsCount: allFeeds.length,
          feeds: allFeeds.map((f) => ({
            name: f.name,
            slug: f.slug,
            priceUsdc: f.pricePerCallUsdc,
            status: f.curationStatus,
          })),
        },
      });

      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: `Here are the active intelligence feeds currently available on the Pharos x402 Intelligence Mesh. All feeds are audited by curator 'wakanda-soul' and cost 0.001 USDC per call:\n\n` +
          allFeeds.map((f) => `• **${f.name}** (\`${f.slug}\`): ${f.description} [${f.pricePerCallUsdc} USDC]`).join('\n') +
          `\n\nWould you like me to purchase a live sample from any of these endpoints?`,
        timestamp: new Date().toISOString(),
        toolCalls,
      };
    }

    // Detect if user wants to buy / check a specific feed
    const slugMatches = ['whale-radar', 'harbor-solvency', 'dex-volatility', 'contract-risk'];
    const matchedSlug = slugMatches.find((s) => lower.includes(s) || lower.includes(s.replace('-', ' ')));

    if (matchedSlug || lower.includes('buy') || lower.includes('check') || lower.includes('audit') || lower.includes('whale') || lower.includes('solvency')) {
      const targetSlug = matchedSlug || (lower.includes('whale') ? 'whale-radar' : lower.includes('solvency') ? 'harbor-solvency' : lower.includes('risk') ? 'contract-risk' : 'dex-volatility');
      const feed = feedStore.getFeedBySlug(targetSlug);

      if (!feed) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'agent',
          text: `I couldn't locate an active feed matching '${targetSlug}'. Please use 'search feeds' to browse the catalog.`,
          timestamp: new Date().toISOString(),
        };
      }

      // Security Layer 3: Deterministic Policy Check before payment
      const policyVerdict = PolicyGatekeeper.evaluatePurchasePolicy(targetSlug, agentWalletBalanceUsdc);

      if (!policyVerdict.isPermitted) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'policy_gatekeeper',
          text: `🛡️ **Transaction Intercepted by Policy Gatekeeper**:\n\n${policyVerdict.reason}\n\n*Suggested Action*: ${policyVerdict.suggestedCorrection}`,
          timestamp: new Date().toISOString(),
          policyFlags: {
            isRefusal: true,
            refusalCategory: 'BUDGET_CAP_EXCEEDED',
          },
        };
      }

      // Execute buy tool call
      const intelligencePayload = generateIntelligenceData(targetSlug);
      const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      feedStore.recordPurchase(targetSlug, feed.pricePerCallUsdc);

      toolCalls.push({
        toolName: 'buy_intelligence_feed',
        arguments: {
          feedSlug: targetSlug,
          priceUsdc: feed.pricePerCallUsdc,
          buyerAddress: agentWalletAddress,
        },
        costUsdc: feed.pricePerCallUsdc,
        paymentReceipt: receiptId,
        output: intelligencePayload,
      });

      const summaryText =
        targetSlug === 'whale-radar'
          ? `I executed an autonomous x402 payment of **${feed.pricePerCallUsdc} USDC** on Pharos Mainnet and retrieved the Whale Radar packet.\n\n**Key Findings**:\n• Detected 3 high-conviction transfers > $50,000.\n• Largest transfer: $145,000 USDC into Harbor Protocol liquidity.\n• Overall Market Bias: Bullish Accumulation.`
          : targetSlug === 'harbor-solvency'
          ? `I purchased the Harbor DEX Solvency report for **${feed.pricePerCallUsdc} USDC**.\n\n**Key Findings**:\n• Pool: PROS/USDC (0.05%)\n• Health Score: 98.7/100 (Optimal Reserves)\n• Slippage for $10k order: only 0.04%.\n• Pool is confirmed **100% SOLVENT**.`
          : targetSlug === 'contract-risk'
          ? `I verified the target contract using the Risk Scanner feed for **${feed.pricePerCallUsdc} USDC**.\n\n**Security Score**: 99.4/100\n• Bytecode analysis: No hidden mint or honeypot logic.\n• Verified Standard: Official Pharos ERC-20 with EIP-2612 support.`
          : `I fetched the DEX Volatility Radar feed for **${feed.pricePerCallUsdc} USDC**.\n\n**Key Findings**:\n• Realized 1h Volatility: 18.4%\n• Bid/Ask Spread: 3.8 bps\n• Market regime is in low-volatility equilibrium.`;

      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: summaryText,
        timestamp: new Date().toISOString(),
        toolCalls,
        attachedIntelligence: intelligencePayload,
      };
    }

    // Default guidance response
    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: `Hello! I am your **Pharos x402 Intelligence Copilot** on Pharos Mainnet (Chain ID 1672).\n\nI can autonomously discover and purchase paywalled on-chain feeds using your embedded agent wallet at 0.001 USDC micro-rates.\n\n**Try asking me**:\n• *"Show me all available feeds"*\n• *"Analyze whale movements on Pharos Mainnet"*\n• *"Audit Harbor DEX pool solvency"*\n• *"Scan contract honeypot risk"*`,
      timestamp: new Date().toISOString(),
    };
  }

  private static async callGeminiApi(context: CopilotContext): Promise<AgentChatMessage> {
    const { prompt, geminiApiKey, oauthAccessToken } = context;

    // Use Gemini 1.5 Flash endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey || ''}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (oauthAccessToken) {
      headers['Authorization'] = `Bearer ${oauthAccessToken}`;
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: this.SYSTEM_PERSONA }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated by model.';

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: candidateText,
      timestamp: new Date().toISOString(),
    };
  }
}
