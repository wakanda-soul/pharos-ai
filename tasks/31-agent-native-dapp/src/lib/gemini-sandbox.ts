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
2. If asked to write code or scripts (e.g. "write me a python script to swap tokens" or "напиши скрипт для свопа"), you must refuse politely and with a touch of dry wit, reminding them you are a verified data broker, not a code generator.
3. You have access ONLY to 3 verified tools:
   - search_feeds(query, category)
   - buy_intelligence_feed(feedSlug)
   - synthesize_mesh_report(feedSlugs)
4. Never attempt to bypass payments or query unwhitelisted endpoints.
5. LANGUAGE ADAPTABILITY: You MUST detect the language of the user's message (e.g., Russian, English) and ALWAYS reply in the exact same language as the user. If the user writes in Russian, reply in fluent Russian. If in English, reply in English.
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
    const isRussian = /[а-яА-ЯёЁ]/.test(prompt);
    const toolCalls: ToolCallExecution[] = [];

    // 1. Greetings, language check, or conversational intro
    const isGreeting =
      lower.includes('привет') ||
      lower.includes('здравствуй') ||
      lower.includes('русск') ||
      lower.includes('кто ты') ||
      lower.includes('что умеешь') ||
      lower.includes('помощь') ||
      lower === 'hello' ||
      lower === 'hi' ||
      lower === 'hey' ||
      lower.includes('how are you') ||
      lower.includes('can you speak');

    if (isGreeting) {
      const greetingText = isRussian
        ? `Привет! Да, конечно, я свободно общаюсь на русском языке.\n\nЯ твой **Pharos x402 Intelligence Copilot** в Pharos Mainnet (Chain ID 1672).\n\nЯ умею автономно находить и оплачивать проверенные ончейн-фиды данных через протокол x402 прямо с твоего встроенного агентского кошелька по микротарифу **0.001 USDC**.\n\n**Попробуй спросить меня**:\n• *«Покажи все доступные фиды»*\n• *«Проанализируй движения китов в Pharos»*\n• *«Проверь платежеспособность пулов Harbor DEX»*\n• *«Просканируй контракт USDC на honeypot и риски»*`
        : `Hello! I am your **Pharos x402 Intelligence Copilot** on Pharos Mainnet (Chain ID 1672).\n\nI can autonomously discover and purchase paywalled on-chain feeds using your embedded agent wallet at 0.001 USDC micro-rates.\n\n**Try asking me**:\n• *"Show me all available feeds"*\n• *"Analyze whale movements on Pharos Mainnet"*\n• *"Audit Harbor DEX pool solvency"*\n• *"Scan contract honeypot risk"*`;

      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: greetingText,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Search / catalog / list feeds
    if (
      lower.includes('search') ||
      lower.includes('list') ||
      lower.includes('what feeds') ||
      lower.includes('catalog') ||
      lower.includes('фид') ||
      lower.includes('каталог') ||
      lower.includes('список') ||
      lower.includes('покажи')
    ) {
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

      const listText = isRussian
        ? `Вот активные аналитические фиды данных в Pharos x402 Intelligence Mesh (все проверены куратором 'wakanda-soul' по базовому тарифу 0.001 USDC за запрос):\n\n` +
          allFeeds
            .map((f) => `• **${f.name}** (\`${f.slug}\`): ${f.description} [${f.pricePerCallUsdc} USDC]`)
            .join('\n') +
          `\n\nХотите, чтобы я приобрёл свежий срез данных по любому из этих фидов?`
        : `Here are the active intelligence feeds currently available on the Pharos x402 Intelligence Mesh. All feeds are audited by curator 'wakanda-soul' and cost 0.001 USDC per call:\n\n` +
          allFeeds
            .map((f) => `• **${f.name}** (\`${f.slug}\`): ${f.description} [${f.pricePerCallUsdc} USDC]`)
            .join('\n') +
          `\n\nWould you like me to purchase a live sample from any of these endpoints?`;

      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: listText,
        timestamp: new Date().toISOString(),
        toolCalls,
      };
    }

    // 3. Purchase / query specific feeds
    const slugMatches = ['whale-radar', 'harbor-solvency', 'dex-volatility', 'contract-risk'];
    const matchedSlug = slugMatches.find((s) => lower.includes(s) || lower.includes(s.replace('-', ' ')));

    const isWhale = lower.includes('whale') || lower.includes('кит') || lower.includes('перевод');
    const isSolvency = lower.includes('solvency') || lower.includes('harbor') || lower.includes('ликвидн') || lower.includes('резерв') || lower.includes('пул');
    const isRisk = lower.includes('risk') || lower.includes('риск') || lower.includes('honeypot') || lower.includes('уязвим') || lower.includes('usdc');
    const isVolatility = lower.includes('volatilit') || lower.includes('волатильн');

    if (
      matchedSlug ||
      isWhale ||
      isSolvency ||
      isRisk ||
      isVolatility ||
      lower.includes('buy') ||
      lower.includes('check') ||
      lower.includes('audit') ||
      lower.includes('купи') ||
      lower.includes('провер') ||
      lower.includes('скан')
    ) {
      const targetSlug =
        matchedSlug ||
        (isWhale
          ? 'whale-radar'
          : isSolvency
          ? 'harbor-solvency'
          : isRisk
          ? 'contract-risk'
          : 'dex-volatility');
      const feed = feedStore.getFeedBySlug(targetSlug);

      if (!feed) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'agent',
          text: isRussian
            ? `Не удалось найти активный фид по запросу '${targetSlug}'. Используйте запрос 'покажи фиды' для просмотра каталога.`
            : `I couldn't locate an active feed matching '${targetSlug}'. Please use 'search feeds' to browse the catalog.`,
          timestamp: new Date().toISOString(),
        };
      }

      // Security Layer 3: Deterministic Policy Check before payment
      const policyVerdict = PolicyGatekeeper.evaluatePurchasePolicy(targetSlug, agentWalletBalanceUsdc);

      if (!policyVerdict.isPermitted) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'policy_gatekeeper',
          text: isRussian
            ? `🛡️ **Транзакция заблокирована Policy Gatekeeper**:\n\n${policyVerdict.reason}\n\n*Рекомендуемое действие*: ${policyVerdict.suggestedCorrection}`
            : `🛡️ **Transaction Intercepted by Policy Gatekeeper**:\n\n${policyVerdict.reason}\n\n*Suggested Action*: ${policyVerdict.suggestedCorrection}`,
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

      let summaryText = '';
      if (isRussian) {
        if (targetSlug === 'whale-radar') {
          summaryText = `Я выполнил автономный платёж x402 на сумму **${feed.pricePerCallUsdc} USDC** в сети Pharos Mainnet и получил свежие данные Whale Radar.\n\n**Главные инсайты**:\n• Обнаружено 3 крупных перевода свыше $50,000.\n• Крупнейшая транзакция: $145,000 USDC переведено в пул ликвидности Harbor Protocol.\n• Общий настрой рынка: Бычье накопление (Bullish Accumulation).`;
        } else if (targetSlug === 'harbor-solvency') {
          summaryText = `Я приобрёл отчёт о платежеспособности пулов Harbor DEX за **${feed.pricePerCallUsdc} USDC**.\n\n**Главные инсайты**:\n• Пул: PROS/USDC (0.05%)\n• Индекс здоровья: 98.7/100 (Оптимальный уровень резервов)\n• Проскальзывание (slippage) на ордер $10k: всего 0.04%.\n• Пул подтверждён: **100% ПЛАТЕЖЕСПОСОБЕН (SOLVENT)**.`;
        } else if (targetSlug === 'contract-risk') {
          summaryText = `Я проверил целевой контракт через фид Risk Scanner за **${feed.pricePerCallUsdc} USDC**.\n\n**Оценка безопасности**: 99.4/100\n• Анализ байткода: скрытых функций минта или honeypot-логики не обнаружено.\n• Верифицированный стандарт: официальный Pharos ERC-20 с поддержкой EIP-2612.`;
        } else {
          summaryText = `Я получил данные фида DEX Volatility Radar за **${feed.pricePerCallUsdc} USDC**.\n\n**Главные инсайты**:\n• Реализованная волатильность (1ч): 18.4%\n• Спред покупки/продажи: 3.8 bps\n• Рынок находится в состоянии низковолатильного равновесия.`;
        }
      } else {
        if (targetSlug === 'whale-radar') {
          summaryText = `I executed an autonomous x402 payment of **${feed.pricePerCallUsdc} USDC** on Pharos Mainnet and retrieved the Whale Radar packet.\n\n**Key Findings**:\n• Detected 3 high-conviction transfers > $50,000.\n• Largest transfer: $145,000 USDC into Harbor Protocol liquidity.\n• Overall Market Bias: Bullish Accumulation.`;
        } else if (targetSlug === 'harbor-solvency') {
          summaryText = `I purchased the Harbor DEX Solvency report for **${feed.pricePerCallUsdc} USDC**.\n\n**Key Findings**:\n• Pool: PROS/USDC (0.05%)\n• Health Score: 98.7/100 (Optimal Reserves)\n• Slippage for $10k order: only 0.04%.\n• Pool is confirmed **100% SOLVENT**.`;
        } else if (targetSlug === 'contract-risk') {
          summaryText = `I verified the target contract using the Risk Scanner feed for **${feed.pricePerCallUsdc} USDC**.\n\n**Security Score**: 99.4/100\n• Bytecode analysis: No hidden mint or honeypot logic.\n• Verified Standard: Official Pharos ERC-20 with EIP-2612 support.`;
        } else {
          summaryText = `I fetched the DEX Volatility Radar feed for **${feed.pricePerCallUsdc} USDC**.\n\n**Key Findings**:\n• Realized 1h Volatility: 18.4%\n• Bid/Ask Spread: 3.8 bps\n• Market regime is in low-volatility equilibrium.`;
        }
      }

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
    const defaultText = isRussian
      ? `Я твой **Pharos x402 Intelligence Copilot** на Pharos Mainnet (Chain ID 1672).\n\nЯ умею находить и оплачивать ончейн-фиды по микротарифу 0.001 USDC прямо из агентского кошелька.\n\n**Попробуй спросить меня**:\n• *«Покажи все доступные фиды»*\n• *«Проанализируй движения китов»*\n• *«Проверь платежеспособность Harbor DEX»*\n• *«Просканируй контракт USDC на риски»*`
      : `Hello! I am your **Pharos x402 Intelligence Copilot** on Pharos Mainnet (Chain ID 1672).\n\nI can autonomously discover and purchase paywalled on-chain feeds using your embedded agent wallet at 0.001 USDC micro-rates.\n\n**Try asking me**:\n• *"Show me all available feeds"*\n• *"Analyze whale movements on Pharos Mainnet"*\n• *"Audit Harbor DEX pool solvency"*\n• *"Scan contract honeypot risk"*`;

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: defaultText,
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
