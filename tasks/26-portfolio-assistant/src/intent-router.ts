import { QueryIntentType } from './types.js';

export interface ParsedIntentResult {
  readonly intent: QueryIntentType;
  readonly confidenceScore: number;
  readonly targetTokenSymbol?: string;
  readonly unsupportedProtocolName?: string;
  readonly queryKeywordsMatched: string[];
}

/**
 * List of foreign/unsupported protocols not native to Pharos Mainnet.
 * Used to enforce Requirement 04 (Zero Guessing Sentinel).
 */
const UNSUPPORTED_PROTOCOLS: Record<string, string> = {
  aave: 'Aave',
  compound: 'Compound',
  uniswap: 'Uniswap',
  curve: 'Curve Finance',
  maker: 'MakerDAO',
  sushiswap: 'SushiSwap',
  sushi: 'SushiSwap',
  balancer: 'Balancer',
  yearn: 'Yearn Finance',
  lido: 'Lido',
  eigenlayer: 'EigenLayer',
  ethena: 'Ethena',
  spark: 'Spark Protocol',
  pancakeswap: 'PancakeSwap',
};

/**
 * PortfolioIntentRouter
 * 
 * Classifies natural-language queries into 5 canonical financial intent categories,
 * extracts asset parameters, and isolates unsupported protocol inquiries.
 */
export class PortfolioIntentRouter {
  /**
   * Evaluates free-text query and routes to the appropriate intent category.
   */
  public parseQuery(queryText: string): ParsedIntentResult {
    const normalizedText = queryText.toLowerCase().trim();

    // Sentinel Check 1: Unsupported protocol detection (Requirement 04)
    for (const [key, formalName] of Object.entries(UNSUPPORTED_PROTOCOLS)) {
      const protocolRegex = new RegExp(`\\b${key}\\b`, 'i');
      if (protocolRegex.test(normalizedText)) {
        return {
          intent: 'UNKNOWN_OR_UNSUPPORTED',
          confidenceScore: 0.99,
          unsupportedProtocolName: formalName,
          queryKeywordsMatched: [key],
        };
      }
    }

    // Intent 1: Yield and Earnings
    const yieldKeywords = ['earning', 'earnings', 'yield', 'apy', 'annual return', 'returns', 'interest', 'passive income', 'how much do i make'];
    const matchedYield = yieldKeywords.filter((kw) => normalizedText.includes(kw));
    if (matchedYield.length > 0) {
      return {
        intent: 'YIELD_AND_EARNINGS',
        confidenceScore: 0.95,
        queryKeywordsMatched: matchedYield,
      };
    }

    // Intent 2: Asset Location & Distribution
    const locationKeywords = ['where is my', 'where are my', 'which pools', 'which vaults', 'location of my', 'where did i put', 'where is', 'find my'];
    const matchedLocation = locationKeywords.filter((kw) => normalizedText.includes(kw));
    if (matchedLocation.length > 0 || (normalizedText.includes('where') && (normalizedText.includes('usdc') || normalizedText.includes('pros') || normalizedText.includes('usdt')))) {
      const extractedToken = this.extractTokenMention(normalizedText);
      return {
        intent: 'ASSET_LOCATION',
        confidenceScore: 0.92,
        targetTokenSymbol: extractedToken ?? 'USDC',
        queryKeywordsMatched: matchedLocation,
      };
    }

    // Intent 3: Biggest / Largest Allocation
    const biggestKeywords = ['biggest', 'largest', 'highest', 'top position', 'most of my money', 'heaviest', 'main allocation', 'main position'];
    const matchedBiggest = biggestKeywords.filter((kw) => normalizedText.includes(kw));
    if (matchedBiggest.length > 0) {
      return {
        intent: 'BIGGEST_POSITION',
        confidenceScore: 0.94,
        queryKeywordsMatched: matchedBiggest,
      };
    }

    // Intent 4: Debt, Loans & Liabilities
    const debtKeywords = ['debt', 'loan', 'borrow', 'borrowed', 'liabilities', 'owing', 'health factor', 'collateral ratio', 'liquidation risk', 'owe'];
    const matchedDebt = debtKeywords.filter((kw) => normalizedText.includes(kw));
    if (matchedDebt.length > 0) {
      return {
        intent: 'DEBT_AND_LIABILITIES',
        confidenceScore: 0.93,
        queryKeywordsMatched: matchedDebt,
      };
    }

    // Intent 5: Net Worth & General Balance Overview
    const overviewKeywords = ['net worth', 'total balance', 'portfolio summary', 'portfolio overview', 'total value', 'all balances', 'how much do i have', 'summary', 'breakdown', 'portfolio'];
    const matchedOverview = overviewKeywords.filter((kw) => normalizedText.includes(kw));
    if (matchedOverview.length > 0) {
      return {
        intent: 'NET_WORTH_OVERVIEW',
        confidenceScore: 0.90,
        queryKeywordsMatched: matchedOverview,
      };
    }

    // Fallback: If query mentions a specific token (e.g. "my USDC"), treat as Asset Location
    const isolatedToken = this.extractTokenMention(normalizedText);
    if (isolatedToken) {
      return {
        intent: 'ASSET_LOCATION',
        confidenceScore: 0.75,
        targetTokenSymbol: isolatedToken,
        queryKeywordsMatched: [isolatedToken],
      };
    }

    return {
      intent: 'UNKNOWN_OR_UNSUPPORTED',
      confidenceScore: 0.20,
      queryKeywordsMatched: [],
    };
  }

  /**
   * Extracts known token symbols from user prompt.
   */
  private extractTokenMention(text: string): string | undefined {
    if (/\busdc\b/i.test(text)) return 'USDC';
    if (/\bpros\b/i.test(text) || /\bwpros\b/i.test(text)) return 'PROS';
    if (/\busdt\b/i.test(text)) return 'USDT';
    if (/\beth\b/i.test(text)) return 'ETH';
    return undefined;
  }
}
