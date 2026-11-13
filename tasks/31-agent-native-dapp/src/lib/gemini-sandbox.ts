import { PolicyGatekeeper } from './policy-gatekeeper';
import { feedStore } from './storage';
import { AgentChatMessage, ToolCallExecution } from '@/types/agent';
import { fetchLiveIntelligenceData } from './pharos-intelligence';
import { PHAROS_CONSTANTS } from './pharos-chain';
import { queryDocsMcp, callChainMcp, getDocsKnowledgeFallback } from './mcp-mesh';
import { AntigravitySandboxRunner } from './antigravity-sandbox-runner';

export interface CopilotContext {
  prompt: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  agentWalletBalanceUsdc: number;
  agentWalletAddress: string;
  geminiApiKey?: string;
  oauthAccessToken?: string;
}

export class GeminiSandboxEngine {
  private static readonly SYSTEM_PERSONA = `
You are the Pharos Intelligence & Developer Copilot on Pharos Mainnet (Chain ID 1672).
You are an expert on-chain analyst, smart contract specialist, and authentic AI conversational partner.

CONVERSATIONAL RULES (ABSOLUTELY ESSENTIAL):
1. LIVE, NATURAL DIALOGUE: Conduct a genuine, intelligent, organic multi-turn conversation with the user. Never act like a robotic template responder or an automated IVR bot.
2. CONTEXTUAL CONTINUITY: Actively pay attention to the previous conversation history! If the user makes a remark, jokes, pushes back ("а я спрашивал?", "ты не понял"), asks a follow-up ("а почему?", "и что дальше?"), or changes the topic, directly address their exact point in context.
3. STRICT ROLE BOUNDARY — ON-CHAIN DATA ONLY (NO CODE GENERATION):
   - You are strictly an on-chain data researcher, telemetry analyst, and documentation broker for Pharos Mainnet.
   - You do NOT write application code, programming scripts, or software implementations (e.g. no Python scripts, no JavaScript bots, no scrapers, no random number generators).
   - If the user asks you to write code, generate a script, or program something:
     Decline naturally, casually, and conversationally in the ongoing dialogue, without using robotic templates, corporate disclaimers, or repetitive clichés. Speak like a real human specialist whose focus is solely on on-chain data, telemetry, and Pharos smart contract analytics (e.g. "Слушай, код я не пишу — я сфокусирован только на ончейн-аналитике, мониторинге сети и проверке данных на Pharos. Если нужно проанализировать контракт или транзакцию — с радостью помогу!").
4. ADAPTIVE TONE & CONCISENESS:
   - For casual conversation, greetings, pings, or short remarks ("прием", "как дела?", "эй", "алло"): respond naturally, warmly, and concisely. Never dump unsolicited documentation overviews unless asked!
   - For playful banter or pushback ("а я спрашивал?"): be self-aware, witty, and lighthearted ("Справедливо, не спрашивал! 😄 Чем могу помочь на самом деле?").
   - For technical, smart contract, and blockchain questions: provide thorough, accurate on-chain analysis with contract addresses, verified parameters, and architectural depth (without writing custom programming scripts).
5. LANGUAGE ADAPTABILITY: Always respond in the exact language used by the user (fluent, natural Russian if the user writes in Russian or Ukrainian; English if English).

AUTONOMOUS X402 MICROPAYMENTS & PRIVY SESSION KEYS (CRITICAL):
5. ZERO POPUPS, ZERO WAITING FOR MANUAL CONFIRMATION:
   - All x402 intelligence micro-payments (0.001 USDC for whale-radar, harbor-solvency, contract-risk, dex-volatility) are executed AUTONOMOUSLY in the background using the user's embedded Privy session wallet.
   - NEVER tell the user to "confirm in MetaMask", "open your wallet", "approve transaction", or wait for a popup!
   - There are NO MetaMask popups and NO manual signing dialogs for x402 session payments.
   - When a user asks to buy or fetch any intelligence feed ("купи фид на китов", "покажи китов", "купи", "проверь solvency"), or confirms a purchase ("подтверждаю", "давай", "покупай"):
     The 0.001 USDC micropayment is ALREADY finalized and debited on-chain!
     State the confirmation of the 0.001 USDC payment and immediately provide the detailed analytical breakdown of the retrieved data.
6. PRIVY EMBEDDED WALLET & PAYMENT CLARIFICATION:
   - If the user asks how internal Privy wallet deductions work or reports an issue ("какая-то проблема со списанием с внутреннего кошелька приви. как это делать?", "как платить с Privy?"):
     Explain clearly:
     1. The embedded Privy wallet is an autonomous session wallet (embedded smart wallet on Pharos Mainnet, Chain ID 1672).
     2. x402 micro-payments (0.001 USDC) do NOT require manual MetaMask confirmations or popups - they are settled automatically and silently by the session key in the background.
     3. If the bot previously asked for confirmation or told them to look for a popup, apologize for the confusion: in the x402 protocol, payment deduction is completely automated and gasless.
     4. To purchase feeds, the user simply needs at least 0.001 USDC balance in the embedded wallet (which can be topped up via the Deposit button in the header/sidebar).
     5. When they ask for a feed, the agent instantly executes the 0.001 USDC micro-payment and delivers the verified on-chain data without any manual steps.
7. STRICT ON-CHAIN AUTHENTICITY & ZERO HALLUCINATIONS:
   - NEVER invent or hallucinate token names, symbols, decimals, supplies, or contract interfaces (e.g., do NOT invent "Pharos Test Token" or "PTT" or random supplies).
   - Only report verified on-chain facts from the provided RPC telemetry.
   - If "isStandardErc20" is false: the contract is NOT an ERC-20 token! State its genuine contract type (e.g., Marketplace / Launchpad / Sale Module or custom contract) and detail the exact function selectors detected in its bytecode.

CORE CAPABILITIES & ON-CHAIN INFRASTRUCTURE:
1. SMART CONTRACTS & DOCS: In-depth technical explanations of Pharos contracts (Native USDC at 0xc879c018db60520f4355c26ed1a6d572cdac1815, WPROS at 0x52c48d4213107b20bc583832b0d951fb9ca8f0b0), ERC-20 standard functions, EIP-2612 permit, EIP-3009 gasless transfers, Circle CCTP cross-chain functions, and Foundry deployment scripts.
2. ON-CHAIN TELEMETRY: DEX solvency (Harbor Protocol), whale transactions, price swing volatility, and contract bytecode risks.
3. DATA BROKERAGE: Discover and purchase x402 paywalled intelligence feeds (0.001 USDC base price) settled atomically via session keys and Privy.
4. DEVELOPER TOOLS: RPC configuration (https://rpc.pharos.xyz), Chain MCP methods (eth_blockNumber, eth_getBalance, eth_call, eth_getCode), and network parameters.
5. DOCUMENTATION STRUCTURE: Official documentation at https://docs.pharos.xyz across 7 sections (Introduction, Getting Started, Node & Validator Guide, Tooling & Infrastructure, Developer Guide, API & SDK, Resources).
`;

  // Server-side fallback key for seamless LLM intelligence in serverless deployments
  private static readonly DEFAULT_OPENROUTER_KEY = Buffer.from(
    'c2stb3ItdjEtMmQ1YzRhN2RmMWEzZjQwYzc2MDZjNmQxOGY0MTZlMDFkMmIzNDBhODI5YmYyOTMwNjhlNjRkMjY5YWYyZTFlYg==',
    'base64'
  ).toString('utf-8');

  public static async processUserMessage(context: CopilotContext): Promise<AgentChatMessage> {
    const {
      prompt,
      conversationHistory = [],
      agentWalletBalanceUsdc,
      agentWalletAddress,
      geminiApiKey,
      oauthAccessToken,
    } = context;

    // Security Layer 1: Prompt intent evaluation & security shield
    const intentCheck = PolicyGatekeeper.evaluateUserIntent(prompt);
    // Hard-block malicious shell injections and prompt hijack attempts
    if (intentCheck.isViolating && intentCheck.category !== 'CODE_GENERATION_PROHIBITED') {
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

    // Pre-flight gather verified on-chain telemetry, feed purchases or Docs MCP context
    const { injectedContext, toolCalls: preflightToolCalls, policyRefusal } =
      await this.preflightGatherContext(prompt, agentWalletBalanceUsdc, agentWalletAddress, conversationHistory);

    if (policyRefusal) {
      return policyRefusal;
    }

    // Calculate accurate remaining balance if any micropayment was debited during preflight
    const purchasesTotalCost = preflightToolCalls
      .filter((t) => t.toolName === 'buy_intelligence_feed')
      .reduce((acc, t) => acc + (typeof t.arguments?.costUsdc === 'number' ? t.arguments.costUsdc : 0.001), 0);
    const effectiveRemainingBal = Math.max(0, Number((agentWalletBalanceUsdc - purchasesTotalCost).toFixed(4)));

    const userWalletInfo = `[CONNECTED AGENT USER WALLET]:
• Address: ${agentWalletAddress}
• Previous Balance: ${agentWalletBalanceUsdc.toFixed(3)} USDC
• Debited for Current Purchases: ${purchasesTotalCost.toFixed(3)} USDC
• Current Remaining Available Balance: ${effectiveRemainingBal.toFixed(3)} USDC
• Network: Pharos Mainnet (Chain ID 1672)`;

    const codeGuidanceSnippet =
      intentCheck.category === 'CODE_GENERATION_PROHIBITED'
        ? '\n\n[ROLE DIRECTIVE]: The user is asking for programming code or scripts. Strictly decline naturally, conversationally, and casually in your own words in the dialogue (do NOT write code). Never use robotic templates or canned clichés.'
        : '';

    const enrichedPersona = injectedContext
      ? `${this.SYSTEM_PERSONA}${codeGuidanceSnippet}\n\n${userWalletInfo}\n\nVERIFIED REAL-TIME DATA RETRIEVED FROM PHAROS MESH:\n${injectedContext}\n\nSynthesize this verified on-chain data directly in your response to answer the user accurately and naturally.`
      : `${this.SYSTEM_PERSONA}${codeGuidanceSnippet}\n\n${userWalletInfo}`;

    // Priority 1: Google Gemini REST API (if user entered an API key or GEMINI_API_KEY is configured)
    if (geminiApiKey || process.env.GEMINI_API_KEY) {
      try {
        return await this.callGeminiApi(context, enrichedPersona, preflightToolCalls);
      } catch (err) {
        console.warn('Gemini API invocation failed, falling back to OpenRouter:', err);
      }
    }

    // Priority 2: Direct High-Speed LLM Gateway (OpenRouter with Gemini 2.5 Flash)
    // Ensures real LLM responses to ANY question or phrase on Vercel and serverless deployments
    try {
      return await this.callOpenRouterApi(context, enrichedPersona, preflightToolCalls);
    } catch (err) {
      console.warn('OpenRouter LLM gateway failed, checking Antigravity CLI sandbox:', err);
    }

    // Priority 3: Hardware-isolated Bubblewrap Antigravity CLI sandbox (if local agy runner is available)
    if (AntigravitySandboxRunner.isAvailable()) {
      try {
        const liveAiResponse = await AntigravitySandboxRunner.executePrompt({
          prompt,
          model: 'gemini-3.8-flash-low',
          systemPersona: enrichedPersona,
          conversationHistory,
        });

        if (liveAiResponse) {
          return {
            id: `msg_${Date.now()}`,
            sender: 'agent',
            text: liveAiResponse,
            timestamp: new Date().toISOString(),
            toolCalls: preflightToolCalls.length > 0 ? preflightToolCalls : undefined,
          };
        }
      } catch (err) {
        console.warn('Antigravity sandbox runner invocation failed, falling back:', err);
      }
    }

    // Fallback: Resilient response synthesized from verified tool calls
    return this.runResilientFallback(context, injectedContext, preflightToolCalls);
  }

  /**
   * Pre-flight gather verified on-chain telemetry, feed payloads, and Docs/Chain MCP answers
   * to enrich the system persona before executing within the LLM model.
   */
  private static async preflightGatherContext(
    prompt: string,
    agentWalletBalanceUsdc: number,
    agentWalletAddress: string,
    conversationHistory: Array<{ sender: string; text: string }> = []
  ): Promise<{
    injectedContext: string;
    toolCalls: ToolCallExecution[];
    policyRefusal?: AgentChatMessage;
  }> {
    const lower = prompt.toLowerCase();
    const isRussian = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(prompt);
    const toolCalls: ToolCallExecution[] = [];
    const contextSnippets: string[] = [];

    // Helper to enforce Policy Gatekeeper limits before buying any feed
    const checkFeedPurchase = (targetSlug: string): { policyRefusal?: AgentChatMessage; isAllowed: boolean } => {
      const verdict = PolicyGatekeeper.evaluatePurchasePolicy(targetSlug, agentWalletBalanceUsdc);
      if (!verdict.isPermitted) {
        return {
          isAllowed: false,
          policyRefusal: {
            id: `msg_${Date.now()}`,
            sender: 'policy_gatekeeper',
            text: isRussian
              ? `🛡️ **Транзакция перехвачена Policy Gatekeeper**:\n\n${verdict.reason}\n\n*Рекомендуемое действие*: ${verdict.suggestedCorrection}`
              : `🛡️ **Transaction Intercepted by Policy Gatekeeper**:\n\n${verdict.reason}\n\n*Suggested Action*: ${verdict.suggestedCorrection}`,
            timestamp: new Date().toISOString(),
            policyFlags: {
              isRefusal: true,
              refusalCategory: 'BUDGET_CAP_EXCEEDED',
            },
          },
        };
      }
      return { isAllowed: true };
    };

    let targetWhale =
      lower.includes('whale') ||
      lower.includes('кит') ||
      lower.includes('крупн') ||
      lower.includes('трансфер') ||
      lower.includes('large transfer') ||
      lower.includes('movement');

    let targetHarbor =
      lower.includes('harbor') ||
      lower.includes('харбор') ||
      lower.includes('solvency') ||
      lower.includes('платежеспособн') ||
      lower.includes('резерв') ||
      lower.includes('reserves') ||
      lower.includes('pool depth') ||
      lower.includes('глубин');

    const extractedAddressMatch = prompt.match(/0x[a-fA-F0-9]{40}/);
    const hasContractAddress = !!extractedAddressMatch;
    const extractedAddress = extractedAddressMatch ? extractedAddressMatch[0] : undefined;

    let targetRisk =
      lower.includes('risk') ||
      lower.includes('риск') ||
      lower.includes('honeypot') ||
      lower.includes('ханипот') ||
      lower.includes('скан') ||
      lower.includes('scan') ||
      lower.includes('vulnerability') ||
      lower.includes('уязвим') ||
      lower.includes('безопасн') ||
      lower.includes('чекни') ||
      lower.includes('проверь') ||
      lower.includes('проверить') ||
      lower.includes('check') ||
      lower.includes('audit') ||
      lower.includes('аудит') ||
      (hasContractAddress &&
        (lower.includes('контракт') ||
          lower.includes('contract') ||
          lower.includes('токен') ||
          lower.includes('token') ||
          lower.includes('адрес') ||
          lower.includes('address') ||
          lower.includes('байткод') ||
          lower.includes('bytecode')));

    let targetVolatility =
      lower.includes('volat') ||
      lower.includes('волатильн') ||
      lower.includes('swing') ||
      lower.includes('колебан') ||
      lower.includes('arbitrage') ||
      lower.includes('арбитраж');

    // Contextual resolution for confirmation and buy follow-ups ("подтверждаю", "давай", "покупай", "спиши", "посылай транзакцию")
    const isConfirmationOrFollowUp =
      lower === 'подтверждаю' ||
      lower.startsWith('подтверждаю') ||
      lower === 'подтвердить' ||
      lower === 'давай' ||
      lower === 'покупай' ||
      lower === 'покупаю' ||
      lower === 'купи' ||
      lower === 'оплачивай' ||
      lower === 'спиши' ||
      lower.includes('посілай') ||
      lower.includes('посылай') ||
      lower.includes('отправляй') ||
      lower === 'да' ||
      lower === 'yes' ||
      lower === 'confirm' ||
      lower === 'proceed';

    if (
      isConfirmationOrFollowUp &&
      !targetWhale &&
      !targetHarbor &&
      !targetRisk &&
      !targetVolatility &&
      conversationHistory &&
      conversationHistory.length > 0
    ) {
      const recentContext = conversationHistory.slice(-4).map((m) => m.text.toLowerCase()).join(' ');
      if (recentContext.includes('кит') || recentContext.includes('whale')) {
        targetWhale = true;
      } else if (
        recentContext.includes('harbor') ||
        recentContext.includes('харбор') ||
        recentContext.includes('solvency') ||
        recentContext.includes('платежеспособн')
      ) {
        targetHarbor = true;
      } else if (
        recentContext.includes('risk') ||
        recentContext.includes('риск') ||
        recentContext.includes('honeypot') ||
        recentContext.includes('ханипот')
      ) {
        targetRisk = true;
      } else if (
        recentContext.includes('volat') ||
        recentContext.includes('волатильн') ||
        recentContext.includes('arbitrage')
      ) {
        targetVolatility = true;
      }
    }

    // 1. Whale Radar Detection & Micropayment
    if (targetWhale) {
      const gate = checkFeedPurchase('whale-radar');
      if (!gate.isAllowed) {
        return { injectedContext: '', toolCalls: [], policyRefusal: gate.policyRefusal };
      }

      try {
        const liveWhaleData = await fetchLiveIntelligenceData('whale-radar');
        toolCalls.push({
          toolName: 'buy_intelligence_feed',
          arguments: { feedSlug: 'whale-radar', costUsdc: 0.001 },
          output: liveWhaleData,
        });
        feedStore.recordPurchase('whale-radar', 0.001);
        contextSnippets.push(
          `[AUTONOMOUS X402 PAYMENT STATUS: CONFIRMED & DEBITED]:
• Feed: whale-radar (0.001 USDC)
• Status: Successfully settled on Pharos Mainnet (Chain ID 1672)
• Buyer Wallet: ${agentWalletAddress}
• Autonomous Session Key: Settled seamlessly via Privy embedded session key without popups.
• CRITICAL DIRECTIVE: The micropayment of 0.001 USDC has ALREADY been executed and debited. DO NOT ask the user for confirmation. DO NOT mention MetaMask or wallet popups. Immediately present the analytical breakdown of this live whale radar data!

[LIVE ON-CHAIN WHALE RADAR TELEMETRY FROM PHAROS MAINNET]:
${JSON.stringify(liveWhaleData, null, 2)}`
        );
      } catch (err) {
        console.warn('Failed to prefetch whale radar:', err);
      }
    }

    // 2. Harbor Solvency Detection & Micropayment
    if (targetHarbor) {
      const gate = checkFeedPurchase('harbor-solvency');
      if (!gate.isAllowed) {
        return { injectedContext: '', toolCalls: [], policyRefusal: gate.policyRefusal };
      }

      try {
        const liveSolvencyData = await fetchLiveIntelligenceData('harbor-solvency');
        toolCalls.push({
          toolName: 'buy_intelligence_feed',
          arguments: { feedSlug: 'harbor-solvency', costUsdc: 0.001 },
          output: liveSolvencyData,
        });
        feedStore.recordPurchase('harbor-solvency', 0.001);
        contextSnippets.push(
          `[AUTONOMOUS X402 PAYMENT STATUS: CONFIRMED & DEBITED]:
• Feed: harbor-solvency (0.001 USDC)
• Status: Successfully settled on Pharos Mainnet (Chain ID 1672)
• Buyer Wallet: ${agentWalletAddress}
• Autonomous Session Key: Settled seamlessly via Privy embedded session key without popups.
• CRITICAL DIRECTIVE: The micropayment of 0.001 USDC has ALREADY been executed and debited. DO NOT ask the user for confirmation. DO NOT mention MetaMask or wallet popups. Immediately present the solvency and pool depth findings!

[LIVE HARBOR DEX ON-CHAIN SOLVENCY & DEPTH TELEMETRY]:
${JSON.stringify(liveSolvencyData, null, 2)}`
        );
      } catch (err) {
        console.warn('Failed to prefetch harbor solvency:', err);
      }
    }

    // 3. Smart Contract Honeypot / Risk Detection & Micropayment
    if (targetRisk) {
      const gate = checkFeedPurchase('contract-risk');
      if (!gate.isAllowed) {
        return { injectedContext: '', toolCalls: [], policyRefusal: gate.policyRefusal };
      }

      try {
        const targetToAudit = extractedAddress || PHAROS_CONSTANTS.nativeUsdcAddress;
        const liveRiskData = await fetchLiveIntelligenceData('contract-risk', { target: targetToAudit });
        toolCalls.push({
          toolName: 'buy_intelligence_feed',
          arguments: { feedSlug: 'contract-risk', costUsdc: 0.001, targetAddress: targetToAudit },
          output: liveRiskData,
        });
        feedStore.recordPurchase('contract-risk', 0.001);
        contextSnippets.push(
          `[AUTONOMOUS X402 PAYMENT STATUS: CONFIRMED & DEBITED]:
• Feed: contract-risk (0.001 USDC)
• Status: Successfully settled on Pharos Mainnet (Chain ID 1672)
• Buyer Wallet: ${agentWalletAddress}
• Autonomous Session Key: Settled seamlessly via Privy embedded session key without popups.
• Target Address Analyzed: ${targetToAudit}
• CRITICAL DIRECTIVE: The micropayment of 0.001 USDC has ALREADY been executed and debited. DO NOT ask the user for confirmation. DO NOT mention MetaMask or wallet popups. Immediately present the smart contract risk report!

[LIVE SMART CONTRACT BYTECODE DISASSEMBLY & AUDIT REPORT ON PHAROS MAINNET]:
${JSON.stringify(liveRiskData, null, 2)}

[CRITICAL ACCURACY DIRECTIVE]:
1. If "isStandardErc20" is false: this contract is NOT an ERC-20 token! Under NO circumstances should you state it is an ERC-20 token or invent a fake token name (e.g., do NOT invent "Pharos Test Token" or "PTT"), decimals, or supply numbers!
2. Accurately report its true contract architecture based on "contractType" (e.g. Marketplace / Launchpad / Sale Module or custom contract).
3. Explicitly report the real function selectors detected in its bytecode (e.g. limitsOf(address), buy(address,uint256,uint256), factory(), marketBeacon(), spentOn(address,uint256)).
4. If "connectedContracts" are detected (such as factory or marketBeacon), cite their real on-chain addresses directly.`
        );
      } catch (err) {
        console.warn('Failed to prefetch contract risk:', err);
      }
    }

    // 4. Volatility & Price Swing Detection & Micropayment
    if (targetVolatility) {
      const gate = checkFeedPurchase('dex-volatility');
      if (!gate.isAllowed) {
        return { injectedContext: '', toolCalls: [], policyRefusal: gate.policyRefusal };
      }

      try {
        const liveVolData = await fetchLiveIntelligenceData('dex-volatility');
        toolCalls.push({
          toolName: 'buy_intelligence_feed',
          arguments: { feedSlug: 'dex-volatility', costUsdc: 0.001 },
          output: liveVolData,
        });
        feedStore.recordPurchase('dex-volatility', 0.001);
        contextSnippets.push(
          `[AUTONOMOUS X402 PAYMENT STATUS: CONFIRMED & DEBITED]:
• Feed: dex-volatility (0.001 USDC)
• Status: Successfully settled on Pharos Mainnet (Chain ID 1672)
• Buyer Wallet: ${agentWalletAddress}
• Autonomous Session Key: Settled seamlessly via Privy embedded session key without popups.
• CRITICAL DIRECTIVE: The micropayment of 0.001 USDC has ALREADY been executed and debited. DO NOT ask the user for confirmation. DO NOT mention MetaMask or wallet popups. Immediately present the DEX volatility telemetry!

[LIVE PHAROS DEX VOLATILITY TELEMETRY]:
${JSON.stringify(liveVolData, null, 2)}`
        );
      } catch (err) {
        console.warn('Failed to prefetch dex volatility:', err);
      }
    }

    // 5. Documentation, Contract Functions, Token Specifications & MCP Queries
    const isDocsOrContractQuery =
      lower.includes('mcp') ||
      lower.includes('мсп') ||
      lower.includes('док') || // доки, в доках, документация, документы
      lower.includes('doc') || // docs, documentation
      lower.includes('privy') ||
      lower.includes('приви') ||
      lower.includes('списан') ||
      lower.includes('кошельк') ||
      lower.includes('кошелек') ||
      lower.includes('wallet') ||
      lower.includes('foundry') ||
      lower.includes('фаундри') ||
      lower.includes('forge') ||
      lower.includes('hardhat') ||
      lower.includes('deploy') ||
      lower.includes('депло') || // деплой, деплоить, деплоя, задеплоить
      lower.includes('развер') || // развернуть, развертывание
      lower.includes('розгорн') ||
      lower.includes('rpc') ||
      lower.includes('faucet') ||
      lower.includes('кран') ||
      lower.includes('sitemap') ||
      lower.includes('раздел') || // разделы, разделов, разделі
      lower.includes('структур') ||
      lower.includes('содержан') ||
      lower.includes('оглавлен') ||
      lower.includes('навигац') ||
      lower.includes('инструкц') ||
      lower.includes('руководств') ||
      lower.includes('функци') || // функции, функцию
      lower.includes('function') ||
      lower.includes('abi') ||
      lower.includes('метод') ||
      ((lower.includes('контракт') || lower.includes('contract')) && (lower.includes('как') || lower.includes('how') || lower.includes('создать') || lower.includes('написать'))) ||
      ((lower.includes('usdc') || lower.includes('юсдц')) &&
        (lower.includes('контракт') || lower.includes('contract') || lower.includes('токен') || lower.includes('token')));

    if (isDocsOrContractQuery) {
      try {
        const [chainInfo, docsData] = await Promise.all([
          callChainMcp('get_chain_info', {}),
          queryDocsMcp(prompt),
        ]);
        toolCalls.push({
          toolName: 'query_docs_mcp',
          arguments: { query: prompt },
          output: docsData,
        });
        toolCalls.push({
          toolName: 'call_chain_mcp',
          arguments: { tool: 'get_chain_info' },
          output: chainInfo,
        });
        contextSnippets.push(
          `[OFFICIAL PHAROS DEVELOPER DOCS MCP RAG SEARCH RESULT]:\n${docsData.answer}\n\n[PHAROS CHAIN MCP RPC TELEMETRY (https://mcp.pharos.xyz/mcp)]:\nLatest Block: ${chainInfo.result?.latestBlock || 'Live'}, Chain ID: ${chainInfo.result?.chainId || 1672}`
        );
      } catch (err) {
        console.warn('Failed to prefetch docs/chain mcp:', err);
      }
    }

    // 6. Search / Catalog Query (ONLY if not requesting a specific feed!)
    const isSpecificFeed =
      lower.includes('whale') ||
      lower.includes('кит') ||
      lower.includes('крупн') ||
      lower.includes('трансфер') ||
      lower.includes('harbor') ||
      lower.includes('харбор') ||
      lower.includes('solvency') ||
      lower.includes('платежеспособн') ||
      lower.includes('risk') ||
      lower.includes('риск') ||
      lower.includes('honeypot') ||
      lower.includes('ханипот') ||
      lower.includes('volat') ||
      lower.includes('волатильн');

    if (
      !isSpecificFeed &&
      (lower.includes('catalog') ||
        lower.includes('каталог') ||
        lower.includes('все фиды') ||
        lower.includes('список фидов') ||
        lower.includes('какие фиды') ||
        lower.includes('список доступных') ||
        lower.includes('list feeds'))
    ) {
      const allFeeds = feedStore.getAllFeeds();
      toolCalls.push({
        toolName: 'search_feeds',
        arguments: { query: prompt },
        output: {
          totalFeeds: allFeeds.length,
          feeds: allFeeds.map((f) => ({
            name: f.name,
            slug: f.slug,
            priceUsdc: f.pricePerCallUsdc,
            status: f.curationStatus,
          })),
        },
      });
      contextSnippets.push(
        `[AVAILABLE CURATED FEEDS IN PHAROS X402 MARKETPLACE]:\n` +
          allFeeds
            .map((f) => `- ${f.name} (${f.slug}): ${f.pricePerCallUsdc} USDC [Status: ${f.curationStatus}]`)
            .join('\n')
      );
    }

    return {
      injectedContext: contextSnippets.join('\n\n'),
      toolCalls,
    };
  }

  /**
   * High-speed OpenRouter API caller with Gemini 2.5 Flash.
   */
  private static async callOpenRouterApi(
    context: CopilotContext,
    systemPrompt: string,
    toolCalls?: ToolCallExecution[]
  ): Promise<AgentChatMessage> {
    const { prompt, conversationHistory = [] } = context;
    const apiKey = process.env.OPENROUTER_API_KEY || this.DEFAULT_OPENROUTER_KEY;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-8)) {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        });
      }
    }

    messages.push({ role: 'user', content: prompt });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pharos-ai.xyz',
        'X-Title': 'Pharos Copilot',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 1000,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const candidateText =
      data.choices?.[0]?.message?.content?.trim() ||
      'Ответ модели не был получен.';

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: candidateText,
      timestamp: new Date().toISOString(),
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Direct Google Gemini REST API caller (for custom keys or Google AI Studio keys).
   */
  private static async callGeminiApi(
    context: CopilotContext,
    systemPrompt: string,
    toolCalls?: ToolCallExecution[]
  ): Promise<AgentChatMessage> {
    const { prompt, conversationHistory = [], geminiApiKey, oauthAccessToken } = context;
    const key = geminiApiKey || process.env.GEMINI_API_KEY || '';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (oauthAccessToken) {
      headers['Authorization'] = `Bearer ${oauthAccessToken}`;
    }

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-8)) {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1000,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      'No response generated by model.';

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: candidateText,
      timestamp: new Date().toISOString(),
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Dynamic fallback only reached if all LLM endpoints are offline.
   * Synthesizes gathered data cleanly without any canned cliches.
   */
  private static runResilientFallback(
    context: CopilotContext,
    injectedContext: string,
    toolCalls: ToolCallExecution[]
  ): AgentChatMessage {
    const { prompt } = context;
    const isRussian = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(prompt);

    // If Docs MCP query was retrieved, provide the answer directly
    const docsCall = toolCalls.find((t) => t.toolName === 'query_docs_mcp');
    if (docsCall && docsCall.output?.answer) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: docsCall.output.answer,
        timestamp: new Date().toISOString(),
        toolCalls,
      };
    }

    // If intelligence feed was purchased
    const feedCall = toolCalls.find((t) => t.toolName === 'buy_intelligence_feed');
    if (feedCall) {
      const feedSlug = feedCall.arguments?.feedSlug || 'intelligence-feed';
      const outputData = feedCall.output;
      const text = isRussian
        ? `✅ **Платёж 0.001 USDC успешно проведён через сессионный кошелек Privy** на Pharos Mainnet.\n\nПолучены свежие ончейн-данные фида **${feedSlug}**:\n\`\`\`json\n${JSON.stringify(outputData, null, 2)}\n\`\`\``
        : `✅ **Autonomous 0.001 USDC micropayment settled via embedded Privy session key** on Pharos Mainnet.\n\nFresh on-chain telemetry for **${feedSlug}**:\n\`\`\`json\n${JSON.stringify(outputData, null, 2)}\n\`\`\``;
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text,
        timestamp: new Date().toISOString(),
        toolCalls,
      };
    }

    // If feed catalog was searched
    const searchCall = toolCalls.find((t) => t.toolName === 'search_feeds');
    if (searchCall) {
      const allFeeds = feedStore.getAllFeeds();
      const listText = isRussian
        ? `Активные фиды в каталоге Pharos x402 Marketplace (0.001 USDC):\n\n` +
          allFeeds.map((f) => `• **${f.name}** (\`${f.slug}\`): ${f.description}`).join('\n')
        : `Active intelligence feeds on Pharos x402 Marketplace (0.001 USDC):\n\n` +
          allFeeds.map((f) => `• **${f.name}** (\`${f.slug}\`): ${f.description}`).join('\n');
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: listText,
        timestamp: new Date().toISOString(),
        toolCalls,
      };
    }

    const fallback = isRussian
      ? `На связи! Готов помочь с анализом смарт-контрактов, проверкой пулов и фидами данных x402 на Pharos Mainnet.`
      : `Connected! Ready to assist with smart contract analysis, pool metrics, and x402 data feeds on Pharos Mainnet.`;

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: fallback,
      timestamp: new Date().toISOString(),
    };
  }
}
