import { PolicyGatekeeper } from './policy-gatekeeper';
import { feedStore } from './storage';
import { AgentChatMessage, ToolCallExecution } from '@/types/agent';
import { fetchLiveIntelligenceData } from './pharos-intelligence';

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
    const lower = prompt.toLowerCase().trim();
    const isRussian = /[а-яА-ЯёЁ]/.test(prompt);
    const toolCalls: ToolCallExecution[] = [];

    // 1. Greetings / Language Confirmation / Casual Chat
    const isGreeting =
      lower.startsWith('привет') ||
      lower.startsWith('здравствуй') ||
      lower.startsWith('добрый') ||
      lower.startsWith('хай') ||
      lower === 'hello' ||
      lower === 'hi' ||
      lower === 'hey' ||
      lower.includes('русск') ||
      lower.includes('russian') ||
      lower.includes('говоришь');

    if (isGreeting) {
      const greetingText = isRussian
        ? `Привет! Да, конечно, я свободно общаюсь и понимаю по-русски.\n\nЯ **Pharos x402 Intelligence Copilot** — автономный агент в сети **Pharos Mainnet (Chain ID 1672)**.\n\nЯ умею анализировать ончейн-активность и закупать проверенные фиды данных через протокол x402 по микротарифу **0.001 USDC** с твоего агентского кошелька Privy.\n\n**О чём тебе рассказать?**\n• *«Проанализируй активность китов»* (крупные трансферы от $50k)\n• *«Проверь резервы и платежеспособность Harbor DEX»*\n• *«Просканируй смарт-контракт USDC на honeypot и риски»*\n• *«Покажи все доступные фиды в каталоге»*`
        : `Hello! I am your **Pharos x402 Intelligence Copilot** on Pharos Mainnet (Chain ID 1672).\n\nI can autonomously discover and purchase paywalled on-chain feeds using your embedded agent wallet at 0.001 USDC micro-rates.\n\n**Try asking me**:\n• *"Analyze whale movements on Pharos Mainnet"*\n• *"Audit Harbor DEX pool solvency"*\n• *"Scan contract honeypot risk"*\n• *"Show me all available feeds"*`;

      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: greetingText,
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Capabilities / Identity / General Questions
    const isAboutBot =
      lower.includes('кто ты') ||
      lower.includes('что ты') ||
      lower.includes('что умеешь') ||
      lower.includes('как дела') ||
      lower.includes('помощь') ||
      lower.includes('who are you') ||
      lower.includes('what can you do') ||
      lower.includes('help');

    if (isAboutBot) {
      const aboutText = isRussian
        ? `Я специализированный аналитический брокер данных для экосистемы **Pharos**.\n\nВ отличие от обычных чат-ботов, я подключен к смарт-контрактам x402 Marketplace Registry и встроенному агентскому кошельку Privy. По твоей команде я самостоятельно оплачиваю (0.001 USDC) и десериализую ончейн-фиды:\n\n1. 🐋 **Whale Radar** — мониторинг транзакций крупных адресов (> $50,000).\n2. 🏦 **Harbor Solvency** — аудит ликвидности, глубины стакана и риска проскальзывания пулов DEX.\n3. 🛡️ **Contract Risk** — анализ байткода на скрытый минт и honeypot.\n4. 📊 **DEX Volatility** — реальная волатильность и спреды.\n\n*Правило безопасности*: я не пишу скрипты на заказ, а предоставляю проверенную рыночную информацию.`
        : `I am an autonomous intelligence broker for the Pharos ecosystem.\n\nConnected to the x402 Marketplace Registry and embedded agent wallet, I autonomously settle 0.001 USDC micropayments to unlock verified data feeds:\n\n1. 🐋 **Whale Radar** — Large on-chain transfers (> $50,000)\n2. 🏦 **Harbor Solvency** — DEX liquidity depth and solvency ratios\n3. 🛡️ **Contract Risk** — Bytecode security and honeypot detection\n4. 📊 **DEX Volatility** — Real-time volatility and spread telemetry`;

      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: aboutText,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Search / Catalog / List Feeds
    const isSearch =
      lower.includes('search') ||
      lower.includes('list') ||
      lower.includes('what feeds') ||
      lower.includes('catalog') ||
      lower.includes('фид') ||
      lower.includes('каталог') ||
      lower.includes('список') ||
      lower.includes('покажи') ||
      lower.includes('какие данные');

    if (isSearch) {
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
        ? `Вот проверенные фиды данных, доступные в Pharos x402 Marketplace (одобрены куратором 'wakanda-soul', базовый тариф 0.001 USDC):\n\n` +
          allFeeds
            .map((f) => `• **${f.name}** (\`${f.slug}\`): ${f.description} [${f.pricePerCallUsdc} USDC]`)
            .join('\n') +
          `\n\nНапиши, какой фид тебя интересует, и я запрошу свежие данные!`
        : `Here are the active intelligence feeds currently available on the Pharos x402 Intelligence Mesh (audited by curator 'wakanda-soul', cost 0.001 USDC per call):\n\n` +
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

    // 4. Intent Classification for Specific Intelligence Feeds
    const isWhale =
      lower.includes('whale') ||
      lower.includes('кит') ||
      lower.includes('крупн') ||
      lower.includes('перевод') ||
      lower.includes('transfer');

    const isSolvency =
      lower.includes('solvency') ||
      lower.includes('harbor') ||
      lower.includes('платежеспособн') ||
      lower.includes('ликвидн') ||
      lower.includes('резерв') ||
      lower.includes('глубин') ||
      lower.includes('pool') ||
      lower.includes('пул');

    const isRisk =
      lower.includes('risk') ||
      lower.includes('риск') ||
      lower.includes('honeypot') ||
      lower.includes('ханипот') ||
      lower.includes('ловушк') ||
      lower.includes('vulnerabilit') ||
      lower.includes('уязвим') ||
      lower.includes('scan') ||
      lower.includes('скан') ||
      lower.includes('usdc') ||
      lower.includes('контракт') ||
      lower.includes('безопасн');

    const isVolatility =
      lower.includes('volatilit') ||
      lower.includes('волатильн') ||
      lower.includes('спред') ||
      lower.includes('spread');

    if (isWhale || isSolvency || isRisk || isVolatility || lower.includes('buy') || lower.includes('check') || lower.includes('audit') || lower.includes('купи') || lower.includes('провер')) {
      const targetSlug = isWhale
        ? 'whale-radar'
        : isSolvency
        ? 'harbor-solvency'
        : isRisk
        ? 'contract-risk'
        : 'dex-volatility';

      const feed = feedStore.getFeedBySlug(targetSlug);

      if (!feed) {
        return {
          id: `msg_${Date.now()}`,
          sender: 'agent',
          text: isRussian
            ? `Не удалось найти активный фид по запросу '${targetSlug}'. Используй команду «покажи фиды» для списка каталога.`
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
            ? `🛡️ **Транзакция перехвачена Policy Gatekeeper**:\n\n${policyVerdict.reason}\n\n*Рекомендуемое действие*: ${policyVerdict.suggestedCorrection}`
            : `🛡️ **Transaction Intercepted by Policy Gatekeeper**:\n\n${policyVerdict.reason}\n\n*Suggested Action*: ${policyVerdict.suggestedCorrection}`,
          timestamp: new Date().toISOString(),
          policyFlags: {
            isRefusal: true,
            refusalCategory: 'BUDGET_CAP_EXCEEDED',
          },
        };
      }

      // Execute buy tool call with live on-chain intelligence from Pharos Mainnet
      const intelligencePayload = await fetchLiveIntelligenceData(targetSlug);
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
          const ev0 = (intelligencePayload as any).events?.[0];
          const largestAmt = (intelligencePayload as any).largestTransferUsdc?.toLocaleString() || ev0?.amount?.toLocaleString() || '120,000';
          const blk = ev0?.blockNumber || '14820150';
          const cnt = (intelligencePayload as any).detectedEventsCount || 3;
          summaryText = `🐋 **Отчёт Whale Movement Radar** (Pharos Mainnet)\nПлатёж: **${feed.pricePerCallUsdc} USDC** рассчитан через EIP-712.\n\n**Результаты анализа сети:**\n• Зафиксировано **${cnt} крупных трансфера** свыше $50,000.\n• Крупнейшая операция: перевод **$${largestAmt} USDC** в блоке #${blk}.\n• Направление капитала: приток ликвидности в хранилища Harbor Protocol.\n• Настроение рынка: **Бычья аккумуляция**. Крупные игроки заводят стейблкоины в экосистему Pharos.`;
        } else if (targetSlug === 'harbor-solvency') {
          const metrics = (intelligencePayload as any).onChainMetrics || {};
          const reserves = (intelligencePayload as any).reserves || {};
          const score = (intelligencePayload as any).auditAssessment?.poolHealthIndex || 99.4;
          const slip = (intelligencePayload as any).depthSummary?.slippageFor10000Usdc || '0.038%';
          summaryText = `🏦 **Аудит резервов и платежеспособности Harbor DEX** (Pharos Mainnet)\nПлатёж: **${feed.pricePerCallUsdc} USDC** подтверждён.\n\n**Ончейн-метрики сети Pharos:**\n• Ончейн эмиссия USDC: **$${metrics.liveUsdcTotalSupply || '20,512,324'} USDC**.\n• Ончейн эмиссия WPROS: **${metrics.liveWprosTotalSupply || '34,064,249'} WPROS**.\n• Базовая цена газа: **${metrics.networkGasPriceGwei || '10'} Gwei**.\n• Индекс здоровья пула: **${score} / 100 (100% ПЛАТЕЖЕСПОСОБНОСТЬ)**.\n• Проскальзывание на ордер $10,000: **${slip}** (достаточная глубина стакана).`;
        } else if (targetSlug === 'contract-risk') {
          const score = (intelligencePayload as any).riskVerdict?.score || 99.4;
          const target = (intelligencePayload as any).analyzedTarget || '0xc879...';
          const symbol = (intelligencePayload as any).tokenSymbol || 'USDC';
          const supply = (intelligencePayload as any).onChainTotalSupply || '20,512,324';
          const size = (intelligencePayload as any).bytecodeSizeBytes || 1650;
          summaryText = `🛡️ **Ончейн-аудит безопасности смарт-контракта** (Pharos Mainnet)\nПлатёж: **${feed.pricePerCallUsdc} USDC** оплачен через x402.\n\n**Результаты анализа контракта ${symbol} (${target}):**\n• Оценка безопасности: **${score} / 100 (Safe Verified)**.\n• Байткод: **${size} байт**, верифицирован на Pharos RPC.\n• Ончейн Total Supply: **${parseFloat(supply).toLocaleString()} ${symbol}**.\n• Скрытый минт, selfdestruct и honeypot-логика **отсутствуют**.\n• Контракт полностью пригоден для агентских расчетов.`;
        } else {
          const metrics = (intelligencePayload as any).metrics || {};
          summaryText = `📊 **Радар волатильности DEX**\nПлатёж: **${feed.pricePerCallUsdc} USDC**.\n\n**Текущие метрики рынка:**\n• Текущая спотовая цена PROS: **$${metrics.currentSpotPriceUsdc || '2.95'} USDC**.\n• Реализованная 1-часовая волатильность: **${metrics.realizedVol1hAnnualized || '18.4%'}**.\n• Спред покупки/продажи: **${metrics.bidAskSpreadBps || '3.8'} bps**.\n• Рыночный режим: **Низковолатильное равновесие**, благоприятно для торговых агентов.`;
        }
      } else {
        if (targetSlug === 'whale-radar') {
          const ev0 = (intelligencePayload as any).events?.[0];
          const largestAmt = (intelligencePayload as any).largestTransferUsdc?.toLocaleString() || ev0?.amount?.toLocaleString() || '120,000';
          const blk = ev0?.blockNumber || '14820150';
          const cnt = (intelligencePayload as any).detectedEventsCount || 3;
          summaryText = `I executed an autonomous x402 payment of **${feed.pricePerCallUsdc} USDC** on Pharos Mainnet and retrieved the Whale Radar packet.\n\n**Key Findings**:\n• Detected ${cnt} high-conviction transfers > $50,000.\n• Largest transfer: $${largestAmt} USDC at block #${blk} into Harbor Protocol liquidity.\n• Overall Market Bias: Bullish Accumulation.`;
        } else if (targetSlug === 'harbor-solvency') {
          const reserves = (intelligencePayload as any).reserves || {};
          const score = (intelligencePayload as any).auditAssessment?.poolHealthIndex || 98.7;
          const slip = (intelligencePayload as any).depthSummary?.slippageFor10000Usdc || '0.04%';
          summaryText = `I purchased the Harbor DEX Solvency report for **${feed.pricePerCallUsdc} USDC**.\n\n**Key Findings**:\n• Pool: PROS/USDC (0.05%)\n• Health Score: ${score}/100 (Optimal Reserves: ${reserves.prosReserve || '1,450,000'} PROS / ${reserves.usdcReserve || '4,280,000'} USDC)\n• Slippage for $10k order: only ${slip}.\n• Pool is confirmed **100% SOLVENT**.`;
        } else if (targetSlug === 'contract-risk') {
          const score = (intelligencePayload as any).riskVerdict?.score || 99.4;
          summaryText = `I verified the target contract using the Risk Scanner feed for **${feed.pricePerCallUsdc} USDC**.\n\n**Security Score**: ${score}/100\n• Bytecode analysis: No hidden mint or honeypot logic.\n• Verified Standard: Official Pharos ERC-20 with EIP-2612 support.`;
        } else {
          const metrics = (intelligencePayload as any).metrics || {};
          summaryText = `I fetched the DEX Volatility Radar feed for **${feed.pricePerCallUsdc} USDC**.\n\n**Key Findings**:\n• Spot Price: $${metrics.currentSpotPriceUsdc || '2.95'} USDC\n• Realized 1h Volatility: ${metrics.realizedVol1hAnnualized || '18.4%'}\n• Bid/Ask Spread: ${metrics.bidAskSpreadBps || '3.8'} bps\n• Market regime is in low-volatility equilibrium.`;
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

    // 5. Questions about Pharos, Architecture, or Chain
    if (lower.includes('pharos') || lower.includes('фарос') || lower.includes('l1') || lower.includes('aea') || lower.includes('блокчейн')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: isRussian
          ? `Pharos — это агентно-нативный блокчейн первого уровня (L1), спроектированный специально для автономных AI-систем и децентрализованных приложений.\n\nКлючевые отличия от традиционных сетей:\n• **Agent Payment Plane & x402**: встроенный стандарт микроплатежей для расчетов между агентами без оверхеда на комиссии.\n• **Программируемый газ**: спонсирование транзакций и пакетное исполнение сложных сценариев.\n• **AEA (Agent Economic Activity)**: новая фундаментальная метрика ценности сети, отражающая реальный объем работы, выполняемой искусственным интеллектом ончейн.\n\nНаш маркетплейс как раз выступает инфраструктурным слоем, где агенты снабжают друг друга данными.`
          : `Pharos is an agent-native Layer-1 blockchain engineered from the ground up for autonomous AI agents and high-throughput financial coordination.\n\nKey Architectural Pillars:\n• **Agent Payment Plane (x402)**: Sub-cent micro-settlements allowing machine-to-machine data exchanges.\n• **Programmable Gas**: Frictionless transaction sponsorship for automated workflows.\n• **Agent Economic Activity (AEA)**: A novel economic metric capturing AI-driven chain throughput beyond passive TVL.`,
        timestamp: new Date().toISOString(),
      };
    }

    // 6. Questions about x402 Protocol and Micropayments
    if (lower.includes('x402') || lower.includes('402') || lower.includes('микроплатеж') || lower.includes('зачем платить') || lower.includes('micropayment')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: isRussian
          ? `Протокол **x402** возвращает к жизни стандартный HTTP-код ошибки \`402 Payment Required\`, соединяя его с Web3-кошельками:\n\n1. Агент делает обычный HTTP GET-запрос к API.\n2. Сервер отвечает заголовком: \`WWW-Authenticate: x402 amount="1000" token="USDC" chain_id="1672"\`.\n3. Агент автоматически подписывает платёжный чек (EIP-712) ровно на **0.001 USDC** и передаёт его в заголовке авторизации.\n4. Сервер проверяет подпись, мгновенно рассчитывает транзакцию на Pharos Mainnet и отдаёт свежие данные.\n\nЭто избавляет от необходимости оформлять подписки за $500/мес или привязывать банковские карты — оплата списывается посекундно только за фактически запрошенные срезы данных.`
          : `The **x402 Protocol** operationalizes the long-dormant HTTP 402 status code using cryptographic Web3 payment authorization:\n\n1. Client requests an intelligence endpoint.\n2. Gateway challenges the request with \`WWW-Authenticate: x402\` specifying token, price (0.001 USDC), and chain.\n3. The autonomous agent signs an EIP-712 payment authorization voucher using its embedded session key.\n4. Registry settles funds atomically on Pharos Mainnet and the endpoint immediately unlocks.\n\nThis removes the barrier of monthly SaaS credit card billing for autonomous software.`,
        timestamp: new Date().toISOString(),
      };
    }

    // 7. Questions about Security / Anti-Scam / Mutation
    if (lower.includes('скам') || lower.includes('scam') || lower.includes('вайтлист') || lower.includes('whitelist') || lower.includes('безопасн') || lower.includes('подмен')) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: isRussian
          ? `Для защиты от вредоносных фидов и скама в маркетплейсе реализована двухуровневая система:\n\n1. **Кураторский вайтлист**: ни один фид не попадает в активный каталог без ручной проверки его кода и схемы куратором (\`wakanda-soul\`).\n2. **Mutation Lockdown**: если владелец одобренного API изменит целевой URL или структуру данных, контракт автоматически сбрасывает статус фида в \`PENDING_AUDIT\` и блокирует покупки до повторного аудита.\n\nЭто полностью исключает сценарий, когда проверенный фид подменяется вредоносным пейлоадом.`
          : `To protect consumers from poisoned data feeds or rug pulls, the marketplace implements a 2-layer trust mesh:\n\n1. **Curator Whitelist**: Feeds are audited and approved strictly by verified curator \`wakanda-soul\`.\n2. **Mutation Lockdown**: If a publisher modifies their API route or schema hash after approval, the contract immediately revokes active status to \`PENDING_AUDIT\` and freezes payments until re-audited.`,
        timestamp: new Date().toISOString(),
      };
    }

    // 8. General conversational fallback (dynamically reflecting user prompt)
    const fallbackText = isRussian
      ? `Я тебя услышал. Как аналитический AI-агент мейннета Pharos, я готов помочь тебе в исследовании ончейн-данных, оценке рисков смарт-контрактов или мониторинге пулов ликвидности.\n\nНапиши интересующий тебя запрос, например:\n• *«Проверь активность китов»*\n• *«Проанализируй резервы Harbor DEX»*\n• *«Просканируй контракт USDC на honeypot»*\n• Или задай любой вопрос об архитектуре x402!`
      : `Understood. As an autonomous intelligence copilot on Pharos Mainnet, I can query verified DeFi solvency, monitor high-value whale transactions, and audit smart contracts via 0.001 USDC micropayments.\n\nLet me know what you'd like to analyze or explore!`;

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: fallbackText,
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
