import { PolicyGatekeeper } from './policy-gatekeeper';
import { feedStore } from './storage';
import { AgentChatMessage, ToolCallExecution } from '@/types/agent';
import { fetchLiveIntelligenceData } from './pharos-intelligence';
import { PHAROS_CONSTANTS } from './pharos-chain';
import { queryDocsMcp, callChainMcp } from './mcp-mesh';
import { AntigravitySandboxRunner } from './antigravity-sandbox-runner';
import { isAddress } from 'viem';

export interface CopilotContext {
  prompt: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  agentWalletBalanceUsdc: number;
  agentWalletAddress: string;
  geminiApiKey?: string;
  oauthAccessToken?: string;
}

/**
 * Native OpenAI/Gemini Tools schema definitions for autonomous agent execution.
 * Allows the LLM to understand and invoke on-chain capabilities directly from user intent in any language.
 */
export const COPILOT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buy_intelligence_feed',
      description:
        'Purchase and retrieve live, verified on-chain intelligence telemetry on Pharos Mainnet (Chain ID 1672) for 0.001 USDC atomically debited via Privy embedded session key. Available feeds: "contract-risk" (bytecode disassembly, selector analysis, honeypot & proxy verification for ANY contract address), "whale-radar" (large transfer detection on USDC/WPROS), "harbor-solvency" (Harbor Protocol DEX pool depth and liquidity solvency), "dex-volatility" (DEX price volatility, spread, and gas fees).',
      parameters: {
        type: 'object',
        properties: {
          feedSlug: {
            type: 'string',
            enum: ['contract-risk', 'whale-radar', 'harbor-solvency', 'dex-volatility'],
            description: 'The feed slug to execute.',
          },
          targetAddress: {
            type: 'string',
            description:
              'The Ethereum smart contract address (0x...) to audit. REQUIRED when feedSlug is "contract-risk".',
          },
          windowHours: {
            type: 'string',
            description: 'Optional time window for whale radar (e.g. "4h", "24h").',
          },
          minAmount: {
            type: 'number',
            description: 'Optional minimum USDC threshold for whale radar transfers.',
          },
        },
        required: ['feedSlug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_docs_mcp',
      description:
        'Query official Pharos documentation, developer guides, and specifications (MCP server, RPC setup, Foundry deploy scripts, Privy embedded wallets, token contracts USDC/WPROS, architecture).',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The technical query or topic to look up in Pharos documentation.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'call_chain_mcp',
      description:
        'Query live Pharos Mainnet RPC via MCP for block number, balance, gas price, or chain specifications.',
      parameters: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            description: 'Chain MCP method: "get_chain_info", "eth_blockNumber", "eth_getBalance", etc.',
          },
          params: {
            type: 'object',
            description: 'Method parameters (e.g. { address: "0x..." }).',
          },
        },
        required: ['tool'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_feeds',
      description:
        'List or search all active and curated intelligence feeds available on the Pharos x402 Marketplace.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional search keyword or filter.',
          },
        },
      },
    },
  },
];

export class GeminiSandboxEngine {
  private static readonly SYSTEM_PERSONA = `
You are the Pharos Intelligence & Developer Copilot on Pharos Mainnet (Chain ID 1672).
You are an expert on-chain analyst, smart contract specialist, and authentic AI conversational partner.

CONVERSATIONAL RULES (ABSOLUTELY ESSENTIAL):
1. LIVE, NATURAL DIALOGUE: Conduct a genuine, intelligent, organic multi-turn conversation with the user. Never act like a robotic template responder or an automated IVR bot.
2. CONTEXTUAL CONTINUITY: Actively pay attention to the previous conversation history! If the user makes a remark, jokes, pushes back ("а я спрашивал?", "ты не понял"), asks a follow-up ("а почему?", "и что дальше?"), or changes the topic, directly address their exact point in context.
3. STRICT ROLE BOUNDARY — ON-CHAIN DATA ONLY (NO CODE GENERATION OR CODE REVIEW):
   - You are strictly an on-chain data researcher, telemetry analyst, and documentation broker for Pharos Mainnet.
   - You are NOT a programmer, software engineer, or code reviewer.
   - You NEVER write application code, programming scripts, or software implementations (no Python scripts, no JavaScript bots, no Solidity contracts, no scrapers, no random number generators).
   - You do NOT inspect, review, debug, or verify source code files.
   - If the user asks you to write code, generate a script, or check/review code:
     Decline naturally, casually, and conversationally in the ongoing dialogue, without using robotic templates, corporate disclaimers, or repetitive clichés. Speak like a real human specialist whose focus is solely on on-chain data, telemetry, and Pharos smart contract analytics (e.g. "Слушай, я не программист — код не пишу и не проверяю. Моя специализация — ончейн-аналитика, мониторинг сети и смарт-контракты в мейннете Pharos. Если нужно проанализировать контракт или транзакцию — с радостью помогу!").
4. ADAPTIVE TONE & CONCISENESS:
   - For casual conversation, greetings, pings, or short remarks ("прием", "как дела?", "эй", "алло"): respond naturally, warmly, and concisely. Never dump unsolicited documentation overviews unless asked!
   - For playful banter or pushback ("а я спрашивал?"): be self-aware, witty, and lighthearted ("Справедливо, не спрашивал! 😄 Чем могу помочь на самом деле?").
   - For technical, smart contract, and blockchain questions: provide thorough, accurate on-chain analysis with contract addresses, verified parameters, and architectural depth (without writing custom programming scripts).
5. LANGUAGE ADAPTABILITY: Always respond in the exact language used by the user (fluent, natural Russian if the user writes in Russian or Ukrainian; English if English).

AUTONOMOUS TOOL EXECUTION & PRIVY SESSION KEYS (CRITICAL):
1. IMMEDIATE TOOL CALLING (ZERO CONFIRMATION PROMPTS):
   - You have active tools available (buy_intelligence_feed, query_docs_mcp, call_chain_mcp, search_feeds).
   - The user has an embedded Privy session smart wallet on Pharos Mainnet (Chain ID 1672) with pre-authorized USDC funds.
   - When the user asks to inspect, check, or audit a contract, see whale movements, check Harbor DEX solvency/depth, or inspect volatility in ANY language or phrasing: DO NOT ask in chat "Подтверждаешь?", "Подтверди покупку", "Хотите проверить?", or tell them it will cost 0.001 USDC and wait for their reply.
   - You are FULLY AUTHORIZED to execute the appropriate tool IMMEDIATELY via function calling!
   - Execute the tool right away, receive the verified on-chain result, and synthesize the report for the user in their language.
2. ZERO POPUPS, ZERO WAITING FOR MANUAL CONFIRMATION:
   - All x402 intelligence micro-payments (0.001 USDC for whale-radar, harbor-solvency, contract-risk, dex-volatility) are executed AUTONOMOUSLY via the tool buy_intelligence_feed using the user's embedded Privy session wallet.
   - NEVER tell the user to "confirm in MetaMask", "open your wallet", "approve transaction", or wait for a popup!
   - There are NO MetaMask popups and NO manual signing dialogs for x402 session payments.
3. PRIVY EMBEDDED WALLET & PAYMENT CLARIFICATION:
   - If the user asks how internal Privy wallet deductions work or reports an issue ("какая-то проблема со списанием с внутреннего кошелька приви. как это делать?", "как платить с Privy?"):
     Explain clearly:
     1. The embedded Privy wallet is an autonomous session wallet (embedded smart wallet on Pharos Mainnet, Chain ID 1672).
     2. x402 micro-payments (0.001 USDC) do NOT require manual MetaMask confirmations or popups - they are settled automatically and silently by the session key in the background.
     3. If the bot previously asked for confirmation or told them to look for a popup, apologize for the confusion: in the x402 protocol, payment deduction is completely automated and gasless.
     4. To purchase feeds, the user simply needs at least 0.001 USDC balance in the embedded wallet (which can be topped up via the Deposit button in the header/sidebar).
     5. When they ask for a feed, the agent instantly executes the 0.001 USDC micro-payment and delivers the verified on-chain data without any manual steps.
4. STRICT ON-CHAIN AUTHENTICITY & ZERO HALLUCINATIONS:
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

    const userWalletInfo = `[CONNECTED AGENT USER WALLET]:
• Address: ${agentWalletAddress}
• Available Balance: ${agentWalletBalanceUsdc.toFixed(4)} USDC
• Network: Pharos Mainnet (Chain ID 1672)`;

    const codeGuidanceSnippet =
      intentCheck.category === 'CODE_GENERATION_PROHIBITED'
        ? '\n\n[ROLE DIRECTIVE]: The user is asking for programming code or scripts. Strictly decline naturally, conversationally, and casually in your own words in the dialogue (do NOT write code). Never use robotic templates or canned clichés.'
        : '';

    const enrichedPersona = `${this.SYSTEM_PERSONA}${codeGuidanceSnippet}\n\n${userWalletInfo}`;

    // Priority 1: Direct High-Speed Autonomous Agent Gateway (OpenRouter with Gemini 2.5 Flash)
    try {
      return await this.callOpenRouterApi(context, enrichedPersona);
    } catch (err) {
      console.warn('OpenRouter agent gateway failed, checking Gemini API:', err);
    }

    // Priority 2: Google Gemini REST API (if user entered an API key or GEMINI_API_KEY is configured)
    if (geminiApiKey || process.env.GEMINI_API_KEY) {
      try {
        return await this.callGeminiApi(context, enrichedPersona);
      } catch (err) {
        console.warn('Gemini API invocation failed, checking Antigravity CLI sandbox:', err);
      }
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
          };
        }
      } catch (err) {
        console.warn('Antigravity sandbox runner invocation failed, falling back:', err);
      }
    }

    // Fallback: Resilient offline response
    return this.runResilientFallback(context);
  }

  /**
   * Deterministic dispatcher executing real on-chain tools selected autonomously by the LLM.
   */
  private static async executeTool(
    name: string,
    args: any,
    agentWalletBalanceUsdc: number,
    agentWalletAddress: string,
    isRussian: boolean,
    userPrompt?: string
  ): Promise<{
    output: any;
    policyRefusal?: AgentChatMessage;
    toolCall: ToolCallExecution;
  }> {
    if (name === 'buy_intelligence_feed') {
      const feedSlug = args?.feedSlug || 'contract-risk';
      const rawTarget = args?.targetAddress || args?.target || args?.address;
      let targetAddress = typeof rawTarget === 'string' ? rawTarget.trim() : undefined;

      // Robust fallback: if LLM truncated or missed the address string, extract exact address from user prompt
      if (!targetAddress || targetAddress.length < 42 || !isAddress(targetAddress)) {
        const promptMatch = (userPrompt || '').match(/0x[a-fA-F0-9]{40}/i);
        if (promptMatch) {
          targetAddress = promptMatch[0];
        }
      }

      const verdict = PolicyGatekeeper.evaluatePurchasePolicy(feedSlug, agentWalletBalanceUsdc);
      if (!verdict.isPermitted) {
        return {
          output: { error: verdict.reason, suggestion: verdict.suggestedCorrection },
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
          toolCall: {
            toolName: 'buy_intelligence_feed',
            arguments: { feedSlug, targetAddress, costUsdc: 0.001 },
            output: { error: verdict.reason },
          },
        };
      }

      const liveData = await fetchLiveIntelligenceData(feedSlug, {
        target: targetAddress,
        windowHours: args?.windowHours,
        minAmount: args?.minAmount,
      });
      feedStore.recordPurchase(feedSlug, 0.001);

      return {
        output: liveData,
        toolCall: {
          toolName: 'buy_intelligence_feed',
          arguments: { feedSlug, targetAddress, costUsdc: 0.001 },
          output: liveData,
        },
      };
    }

    if (name === 'query_docs_mcp') {
      const docsData = await queryDocsMcp(args?.query || '');
      return {
        output: docsData,
        toolCall: {
          toolName: 'query_docs_mcp',
          arguments: { query: args?.query || '' },
          output: docsData,
        },
      };
    }

    if (name === 'call_chain_mcp') {
      const chainData = await callChainMcp(args?.tool || 'get_chain_info', args?.params || {});
      return {
        output: chainData,
        toolCall: {
          toolName: 'call_chain_mcp',
          arguments: { tool: args?.tool || 'get_chain_info', params: args?.params },
          output: chainData,
        },
      };
    }

    if (name === 'search_feeds') {
      const allFeeds = feedStore.getAllFeeds();
      const output = {
        totalFeeds: allFeeds.length,
        feeds: allFeeds.map((f) => ({
          name: f.name,
          slug: f.slug,
          priceUsdc: f.pricePerCallUsdc,
          status: f.curationStatus,
          description: f.description,
        })),
      };
      return {
        output,
        toolCall: {
          toolName: 'search_feeds',
          arguments: { query: args?.query },
          output,
        },
      };
    }

    return {
      output: { error: `Unknown tool: ${name}` },
      toolCall: {
        toolName: name as any,
        arguments: args,
        output: { error: `Unknown tool: ${name}` },
      },
    };
  }

  /**
   * Autonomous Agent loop with Tool Calling via OpenRouter (Gemini 2.5 Flash).
   * Evaluates user intent in ANY language and invokes appropriate on-chain tools dynamically.
   */
  private static async callOpenRouterApi(
    context: CopilotContext,
    systemPrompt: string
  ): Promise<AgentChatMessage> {
    const { prompt, conversationHistory = [], agentWalletBalanceUsdc, agentWalletAddress } = context;
    const apiKey = process.env.OPENROUTER_API_KEY || this.DEFAULT_OPENROUTER_KEY;
    const isRussian = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(prompt);

    const messages: Array<any> = [{ role: 'system', content: systemPrompt }];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-8)) {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        });
      }
    }

    messages.push({ role: 'user', content: prompt });

    // Turn 1: LLM autonomously decides whether to answer directly or call on-chain tools
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pharos-ai.xyz',
        'X-Title': 'Pharos Copilot',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        tools: COPILOT_TOOLS,
        tool_choice: 'auto',
        max_tokens: 1500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const assistantMessage = data.choices?.[0]?.message;

    // If no tool calls were requested, return the direct conversational answer
    if (!assistantMessage?.tool_calls || assistantMessage.tool_calls.length === 0) {
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: assistantMessage?.content?.trim() || 'Ответ модели не был получен.',
        timestamp: new Date().toISOString(),
      };
    }

    // Turn 2: Execute each tool call autonomously on Pharos Mainnet
    const executedToolCalls: ToolCallExecution[] = [];
    messages.push(assistantMessage);

    for (const tc of assistantMessage.tool_calls) {
      let args = {};
      try {
        args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      } catch (e) {
        console.warn('Failed to parse tool call arguments:', tc.function.arguments);
      }

      const execution = await this.executeTool(
        tc.function.name,
        args,
        agentWalletBalanceUsdc,
        agentWalletAddress,
        isRussian,
        prompt
      );

      // If Gatekeeper policy blocked execution, return refusal immediately
      if (execution.policyRefusal) {
        return execution.policyRefusal;
      }

      executedToolCalls.push(execution.toolCall);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(execution.output),
      });
    }

    // Turn 2 Follow-up: Give tool execution data back to LLM for final grounded synthesis
    const followUpRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pharos-ai.xyz',
        'X-Title': 'Pharos Copilot',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 1500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!followUpRes.ok) {
      // Fallback: Synthesize tool outputs directly if follow-up times out
      return {
        id: `msg_${Date.now()}`,
        sender: 'agent',
        text: isRussian
          ? `Получены проверенные ончейн-данные с Pharos Mainnet:\n\`\`\`json\n${JSON.stringify(executedToolCalls.map((t) => t.output), null, 2)}\n\`\`\``
          : `Verified on-chain data retrieved from Pharos Mainnet:\n\`\`\`json\n${JSON.stringify(executedToolCalls.map((t) => t.output), null, 2)}\n\`\`\``,
        timestamp: new Date().toISOString(),
        toolCalls: executedToolCalls,
      };
    }

    const followUpData = await followUpRes.json();
    const finalContent =
      followUpData.choices?.[0]?.message?.content?.trim() ||
      'Ответ модели не был получен.';

    return {
      id: `msg_${Date.now()}`,
      sender: 'agent',
      text: finalContent,
      timestamp: new Date().toISOString(),
      toolCalls: executedToolCalls,
    };
  }

  /**
   * Direct Google Gemini REST API caller with functionDeclarations.
   */
  private static async callGeminiApi(
    context: CopilotContext,
    systemPrompt: string
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
        temperature: 0.3,
        maxOutputTokens: 1500,
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
    };
  }

  /**
   * Dynamic fallback only reached if all LLM endpoints are offline.
   */
  private static runResilientFallback(context: CopilotContext): AgentChatMessage {
    const { prompt } = context;
    const isRussian = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(prompt);

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
