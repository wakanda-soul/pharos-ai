import { feedStore } from './storage';
import { PHAROS_CONSTANTS } from './pharos-chain';
import { PolicyGatekeeperVerdict } from '@/types/agent';

/**
 * Deterministic Backend Policy Gatekeeper (Security Layer 3).
 * Operates independently of LLM reasoning to enforce strict safety boundaries:
 * 1. Hard block on non-whitelisted or suspended feeds.
 * 2. Hard budget ceiling (max $0.005 USDC per call).
 * 3. Pre-flight balance verification.
 * 4. Detection of code generation / script injection attempts.
 */
export class PolicyGatekeeper {
  /**
   * Scans raw prompt for prompt injections and forbidden code requests.
   */
  public static evaluateUserIntent(prompt: string): {
    isViolating: boolean;
    category?: 'CODE_GENERATION_PROHIBITED' | 'OFF_TOPIC' | 'PROMPT_INJECTION';
    wittyRefusal?: string;
  } {
    const lower = prompt.toLowerCase();
    const isRussian = /[а-яА-ЯёЁ]/.test(prompt);

    // Check for code generation requests (e.g. "write me a python script to swap tokens")
    const codePatterns = [
      /write.*(python|javascript|typescript|solidity|bash|script|code).*(swap|trade|bot|drain|hack|transfer)/i,
      /give me (a )?(script|code|bot) to/i,
      /create (a )?(python|js|ts) script/i,
      /code.*for.*swap/i,
      /generate.*script/i,
      /(напиши|создай|сгенерируй|дай|сделай).*(скрипт|код|бота|программу)/i,
      /(скрипт|код).*(своп|swap|обмен|трансфер|токен)/i,
    ];

    for (const pat of codePatterns) {
      if (pat.test(lower)) {
        return {
          isViolating: true,
          category: 'CODE_GENERATION_PROHIBITED',
          wittyRefusal: isRussian
            ? "Хорошая попытка! Но я — Data Copilot для мейннета Pharos, а не стол заказов скриптов. Я брокерую и анализирую проверенные ончейн-данные и фиды, а не произвольный исполняемый код. Как насчёт проверить активность китов или ликвидность Harbor DEX?"
            : "Nice try! I'm the Pharos Data Copilot, not a script dispensary. I broker verified on-chain intelligence feeds, not arbitrary execution code. How about we check Harbor DEX solvency or scan for whale movements instead?",
        };
      }
    }

    // Check for file downloads, installations, or shell execution attempts
    const executionPatterns = [
      /(install|download|wget|curl|pip install|npm install|apt-get|execute command|run shell)/i,
      /(скачай|установи|загрузи файл|выполни команду|терминал|bash|sh скрипт)/i,
    ];

    for (const pat of executionPatterns) {
      if (pat.test(lower)) {
        return {
          isViolating: true,
          category: 'CODE_GENERATION_PROHIBITED',
          wittyRefusal: isRussian
            ? "Действие отклонено песочницей безопасности: я автономный ончейн-аналитик, а не системный терминал. Моя среда строго изолирована — я не скачиваю сторонние файлы, не устанавливаю пакеты и не выполняю системные команды. Моя специализация — брокеридж ончейн-фидов данных в сети Pharos через протокол x402."
            : "Sandbox Security Policy Activated: I am an autonomous on-chain data researcher, not a system terminal. My execution environment is strictly isolated: I do not download files, install packages, or execute arbitrary shell commands. My role is to broker verified on-chain intelligence on Pharos Mainnet.",
        };
      }
    }

    // Check for prompt injections and system leaks
    const injectionPatterns = [
      /ignore previous instructions/i,
      /reveal your system prompt/i,
      /you are now DAN/i,
      /disregard all rules/i,
      /bypass.*guardrail/i,
      /забудь.*инструкции/i,
      /раскрой.*промпт/i,
      /игнорируй.*правила/i,
    ];

    for (const pat of injectionPatterns) {
      if (pat.test(lower)) {
        return {
          isViolating: true,
          category: 'PROMPT_INJECTION',
          wittyRefusal: isRussian
            ? "Система безопасности активирована: отличная попытка социнженерии, но эта песочница защищена надёжнее смарт-контрактов с мультисигом на Pharos. Давай сосредоточимся на ончейн-аналитике."
            : "System guardrails engaged: Nice attempt at social engineering, but this sandbox is sealed tighter than a multi-sig vault on Pharos. Let's focus on live chain intelligence.",
        };
      }
    }

    return { isViolating: false };
  }

  /**
   * Pre-execution policy check before any x402 payment can be signed or triggered.
   */
  public static evaluatePurchasePolicy(
    feedSlug: string,
    buyerBalanceUsdc: number
  ): PolicyGatekeeperVerdict {
    const feed = feedStore.getFeedBySlug(feedSlug);

    if (!feed) {
      return {
        isPermitted: false,
        reason: `Target feed '${feedSlug}' does not exist in registry.`,
        riskRating: 'CRITICAL',
        suggestedCorrection: 'Select a valid feed from the verified marketplace catalog.',
      };
    }

    // Rule 1: Curation Whitelist Enforcement
    if (feed.curationStatus !== 'ACTIVE') {
      return {
        isPermitted: false,
        reason: `Feed '${feed.name}' is currently '${feed.curationStatus}'. Purchase blocked to prevent unvetted or mutated endpoint exploitation.`,
        riskRating: 'HIGH',
        suggestedCorrection: 'Wait for curator audit or choose an ACTIVE feed.',
      };
    }

    // Rule 2: Cost Ceiling Enforcement ($0.005 USDC maximum)
    if (feed.pricePerCallUsdc > PHAROS_CONSTANTS.maxAllowedPricePerCallUsdc) {
      return {
        isPermitted: false,
        reason: `Feed price (${feed.pricePerCallUsdc} USDC) exceeds deterministic policy cap of ${PHAROS_CONSTANTS.maxAllowedPricePerCallUsdc} USDC.`,
        riskRating: 'HIGH',
        suggestedCorrection: 'Request publisher to lower fee or seek curator price exemption.',
      };
    }

    // Rule 3: Pre-flight Balance Check
    if (buyerBalanceUsdc < feed.pricePerCallUsdc) {
      return {
        isPermitted: false,
        reason: `Agent wallet balance (${buyerBalanceUsdc.toFixed(4)} USDC) is insufficient for ${feed.pricePerCallUsdc} USDC payment.`,
        riskRating: 'MEDIUM',
        suggestedCorrection: 'Deposit USDC into embedded agent wallet to continue autonomous queries.',
      };
    }

    return {
      isPermitted: true,
      riskRating: 'LOW',
    };
  }
}
