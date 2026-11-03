/**
 * Task 29: Doc-Grounded Builder Agent
 * Zero-Guessing Sentinel: evaluates semantic bounds of inquiries to prevent
 * false-positive keyword hijacking, hallucination of non-existent protocols,
 * and improvisation on unsupported external chains.
 */

export const UNSUPPORTED_FOREIGN_TERMS: readonly string[] = [
  'solana',
  'wormhole',
  'ordinals',
  'bitcoin layer',
  'lightning network',
  'uniswap v4 hook',
  'monad',
  'cardano',
  'sui',
  'aptos',
  'ripple xrp',
];

export interface SemanticDocCoverageEvaluation {
  readonly isAllowed: boolean;
  readonly detectedUnsupportedTerms: readonly string[];
  readonly diagnosticExplanation?: string;
}

export class ZeroGuessingSentinel {
  /**
   * Evaluates if a query asks for technologies or concepts known to be absent
   * from Pharos Developer Documentation.
   */
  public evaluateQueryGroundedness(userQuery: string): SemanticDocCoverageEvaluation {
    if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
      return {
        isAllowed: false,
        detectedUnsupportedTerms: [],
        diagnosticExplanation: 'Query is empty. Please provide a descriptive "how do I do X on Pharos" question.',
      };
    }

    const normalized = userQuery.toLowerCase();
    const matchedUnsupported: string[] = [];

    for (const term of UNSUPPORTED_FOREIGN_TERMS) {
      if (normalized.includes(term)) {
        matchedUnsupported.push(term);
      }
    }

    if (matchedUnsupported.length > 0) {
      return {
        isAllowed: false,
        detectedUnsupportedTerms: matchedUnsupported,
        diagnosticExplanation:
          `Documentation Gap Detected: The query references unsupported external technology (` +
          `${matchedUnsupported.map((t) => `"${t}"`).join(', ')}). ` +
          `Pharos Developer Documentation focuses strictly on EVM contracts, Pharos SkillEngine, ` +
          `Chain MCP, and native ecosystem protocols. Per Zero-Guessing rules, the agent refuses to extrapolate.`,
      };
    }

    return {
      isAllowed: true,
      detectedUnsupportedTerms: [],
    };
  }
}
