import { ParsedPaymentIntent, AmbiguityClarification, TokenInfo } from './types.js';
import { PharosNameResolver } from './name-resolver.js';
import { PharosTokenRegistry } from './token-registry.js';

export class NaturalLanguagePaymentParser {
  private nameResolver: PharosNameResolver;
  private tokenRegistry: PharosTokenRegistry;

  constructor(nameResolver?: PharosNameResolver, tokenRegistry?: PharosTokenRegistry) {
    this.nameResolver = nameResolver ?? new PharosNameResolver();
    this.tokenRegistry = tokenRegistry ?? new PharosTokenRegistry();
  }

  /**
   * Parses free-text payment intent, identifying amount, token, recipient,
   * and generating structured follow-up clarification questions when ambiguous (Requirement 01).
   */
  parse(rawText: string): ParsedPaymentIntent {
    const input = rawText.trim();
    const clarifications: AmbiguityClarification[] = [];

    let amount: number | undefined;
    let tokenSymbol: string | undefined;
    let token: TokenInfo | undefined;
    let recipientInput: string | undefined;
    let resolvedRecipient: `0x${string}` | undefined;

    // 1. Extract Amount
    // Matches patterns like "$100", "100.5", "1,000", "0.05"
    const dollarPrefixMatch = input.match(/\$(\s*)(\d+(?:[.,]\d+)?)/i);
    if (dollarPrefixMatch) {
      amount = parseFloat(dollarPrefixMatch[2].replace(',', ''));
      tokenSymbol = 'USDC'; // $ implies USD/USDC
      token = this.tokenRegistry.resolveToken('USDC');
    }

    if (amount === undefined) {
      // Look for freestanding numbers
      const numberMatch = input.match(/(?:\b|^)(\d+(?:[.,]\d+)?)\s*([a-zA-Z$]+)?/i);
      if (numberMatch) {
        amount = parseFloat(numberMatch[1].replace(',', ''));
        if (numberMatch[2] && !tokenSymbol) {
          const matchedToken = this.tokenRegistry.resolveToken(numberMatch[2]);
          if (matchedToken) {
            token = matchedToken;
            tokenSymbol = matchedToken.symbol;
          }
        }
      }
    }

    // 2. Extract Token (if not determined by $ prefix)
    if (!tokenSymbol) {
      const words = input.split(/[\s,]+/);
      for (const word of words) {
        const cleaned = word.replace(/[^a-zA-Z$]/g, '');
        if (cleaned) {
          const resolved = this.tokenRegistry.resolveToken(cleaned);
          if (resolved) {
            token = resolved;
            tokenSymbol = resolved.symbol;
            break;
          }
        }
      }
    }

    // 3. Extract Recipient
    // Matches "to <target>" or "unto <target>" or looks for 0x / domain words
    const toMatch = input.match(/\bto\s+([^\s,;]+)/i);
    if (toMatch) {
      recipientInput = toMatch[1].trim();
    } else {
      // Search for standalone 0x address or .pharos / .eth domain in text
      const words = input.split(/[\s,]+/);
      for (const w of words) {
        if (w.startsWith('0x') && w.length >= 20) {
          recipientInput = w;
          break;
        } else if (w.toLowerCase().endsWith('.pharos') || w.toLowerCase().endsWith('.eth')) {
          recipientInput = w;
          break;
        }
      }
    }

    // Resolve Recipient if found
    if (recipientInput) {
      const res = this.nameResolver.resolve(recipientInput);
      if (res.isValid && res.address) {
        resolvedRecipient = res.address;
      }
    }

    // =========================================================================
    // Ambiguity Detection & Follow-Up Questions (Requirement 01)
    // =========================================================================

    // Check Amount Ambiguity
    if (amount === undefined || isNaN(amount) || amount <= 0) {
      clarifications.push({
        field: 'AMOUNT',
        question: 'What numerical amount would you like to transfer?',
        suggestedOptions: ['10', '50', '100', '1000'],
        reason: 'Missing or non-positive transfer quantity in natural language command.',
      });
    }

    // Check Token Ambiguity
    if (!token) {
      clarifications.push({
        field: 'TOKEN',
        question: 'Which token or currency should be sent?',
        suggestedOptions: ['PROS (Native Coin)', 'USDC (Native USD Coin)', 'LINK (Chainlink)'],
        reason: 'Asset currency was not specified or was unrecognized.',
      });
    }

    // Check Recipient Ambiguity (missing recipient)
    if (!recipientInput) {
      clarifications.push({
        field: 'RECIPIENT',
        question: 'Who should receive this payment? Please provide a destination address or .pharos domain.',
        suggestedOptions: ['alice.pharos', 'treasury.pharos', '0x... [Your Custom Address]'],
        reason: 'Destination recipient was omitted from instruction.',
      });
    }

    const isComplete = clarifications.length === 0;

    return {
      rawInput: rawText,
      isComplete,
      amount,
      tokenSymbol,
      token,
      recipientInput,
      resolvedRecipient,
      clarificationsNeeded: clarifications,
    };
  }
}
