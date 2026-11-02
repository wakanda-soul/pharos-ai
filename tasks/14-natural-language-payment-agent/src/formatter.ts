import {
  PreFlightSummary,
  UnsignedPaymentTransaction,
  WalletSigningRequest,
  ValidationResult,
  PaymentAgentPreparationResult,
} from './types.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

export class PaymentAgentFormatter {
  static formatResult(result: PaymentAgentPreparationResult): string {
    const lines: string[] = [];

    lines.push(`${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
    lines.push(`${c.bold}${c.cyan}║             PHAROS NATURAL-LANGUAGE PAYMENT AGENT (HARBOR PATTERN)           ║${c.reset}`);
    lines.push(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}`);
    lines.push('');
    lines.push(`${c.bold}User Plain-Language Prompt:${c.reset} "${c.yellow}${result.intent.rawInput}${c.reset}"`);
    lines.push('');

    // Case 1: Ambiguous Input -> Interactive Clarification Prompts (Requirement 01)
    if (result.status === 'AMBIGUOUS_INPUT') {
      lines.push(`${c.bold}${c.bgYellow} ❓ [AMBIGUOUS INSTRUCTION] FOLLOW-UP CLARIFICATION REQUIRED ${c.reset}`);
      lines.push('');
      lines.push(`${c.bold}The agent analyzed your request and identified missing or ambiguous details:${c.reset}`);
      lines.push('');

      for (const cl of result.intent.clarificationsNeeded) {
        lines.push(`  ${c.bold}${c.magenta}• Missing Field:${c.reset} ${c.bold}${cl.field}${c.reset}`);
        lines.push(`    ${c.bold}Clarification Question:${c.reset} ${c.yellow}${cl.question}${c.reset}`);
        lines.push(`    ${c.gray}Reason: ${cl.reason}${c.reset}`);
        if (cl.suggestedOptions && cl.suggestedOptions.length > 0) {
          lines.push(`    ${c.cyan}Suggested Options:${c.reset} ${cl.suggestedOptions.join(' | ')}`);
        }
        lines.push('');
      }
      lines.push(`${c.gray}Please provide a revised instruction with the missing details to prepare the transaction.${c.reset}`);
      lines.push('───────────────────────────────────────────────────────────────────────────────');
      return lines.join('\n');
    }

    // Case 2: Validation Failed (Requirement 02)
    if (result.status === 'VALIDATION_FAILED' && result.validation) {
      lines.push(`${c.bold}${c.bgRed} ⛔ [VALIDATION FAILED] REQUEST BLOCKED BEFORE SIGNATURE ${c.reset}`);
      lines.push('');
      lines.push(`${c.bold}Pre-flight verification detected errors with this request:${c.reset}`);
      lines.push('');

      for (const err of result.validation.errors) {
        lines.push(`  ${c.red}✗ [${err.code}] ${err.message}${c.reset}`);
      }
      lines.push('');
      lines.push(`${c.bold}Sender Solvency Check:${c.reset}`);
      lines.push(`  • Native PROS Balance:  ${result.validation.senderBalance.nativePros.toFixed(4)} PROS`);
      lines.push(`  • Token Balance:        ${result.validation.senderBalance.tokenAmount.toFixed(2)} ${result.intent.tokenSymbol ?? ''}`);
      lines.push('───────────────────────────────────────────────────────────────────────────────');
      return lines.join('\n');
    }

    // Case 3: Ready For Signature -> Summary & Unsigned Transaction (Requirements 03 & 04)
    if (result.summary && result.unsignedTransaction && result.signingRequest) {
      lines.push(`${c.bold}${c.bgGreen} ✓ [PREPARED FOR SIGNATURE] UNSIGNED TRANSACTION GENERATED ${c.reset}`);
      lines.push('');

      // Pre-Flight Summary (Requirement 03)
      const s = result.summary;
      lines.push(`${c.bold}${c.magenta}─── HUMAN-READABLE PRE-FLIGHT SUMMARY (REQUIREMENT 03) ────────────────────────${c.reset}`);
      lines.push(`${c.bold}Summary ID:${c.reset}          ${c.gray}${s.summaryId}${c.reset}`);
      lines.push(`${c.bold}Timestamp:${c.reset}           ${c.gray}${s.timestamp}${c.reset}`);
      lines.push(`${c.bold}Sender Account:${c.reset}      ${c.cyan}${s.sender}${c.reset}`);
      lines.push(`${c.bold}Recipient Target:${c.reset}    ${c.green}${s.recipient.resolvedAddress}${c.reset}${s.recipient.isDomainName ? ` (${c.yellow}${s.recipient.rawInput}${c.reset})` : ''}`);
      lines.push(`${c.bold}Transfer Asset:${c.reset}      ${c.bold}${c.white}${s.asset.amount} ${s.asset.symbol}${c.reset} (≈ $${s.fiatEstimation.totalUsdValue.toFixed(2)} USD @ $${s.fiatEstimation.assetUsdRate.toFixed(2)}/unit)`);
      lines.push(`${c.bold}Token Contract:${c.reset}      ${c.gray}${s.asset.tokenAddress}${c.reset}`);
      lines.push(`${c.bold}Estimated Gas Fee:${c.reset}   ~${s.networkFee.estimatedFeePros} PROS (~$${s.networkFee.estimatedFeeUsd.toFixed(4)} USD)`);
      lines.push(`${c.bold}Projected Balance:${c.reset}   ${s.balanceProjection.currentBalance.toFixed(2)} → ${c.bold}${s.balanceProjection.postTransferBalance.toFixed(2)} ${s.balanceProjection.currencySymbol}${c.reset}`);
      lines.push('');

      // Unsigned Transaction & Signing Request (Requirement 04)
      const tx = result.unsignedTransaction;
      const req = result.signingRequest;
      lines.push(`${c.bold}${c.cyan}─── UNSIGNED WALLET SIGNING REQUEST (REQUIREMENT 04) ──────────────────────────${c.reset}`);
      lines.push(`${c.yellow}⚠️  ${req.warningNotice}${c.reset}`);
      lines.push('');
      lines.push(`${c.bold}Signing Method:${c.reset}      ${c.bold}${req.method}${c.reset} (${req.signingProtocol})`);
      lines.push(`${c.bold}Chain ID:${c.reset}            ${c.white}${tx.chainId}${c.reset} (Pharos Mainnet)`);
      lines.push(`${c.bold}To Contract/Target:${c.reset}  ${c.blue}${tx.to}${c.reset}`);
      lines.push(`${c.bold}Value:${c.reset}               ${c.white}${tx.value}${c.reset}`);
      lines.push(`${c.bold}Calldata Payload:${c.reset}    ${c.gray}${tx.data.length > 50 ? tx.data.slice(0, 50) + '...' : tx.data}${c.reset}`);
      lines.push(`${c.bold}Gas Limit:${c.reset}           ${c.white}${tx.gas}${c.reset}`);
      lines.push('');
      lines.push(`${c.bold}Foundry Cast Execution Command:${c.reset}`);
      lines.push(`  ${c.cyan}${req.foundryCastCommand}${c.reset}`);
      lines.push('───────────────────────────────────────────────────────────────────────────────');
    }

    return lines.join('\n');
  }
}
