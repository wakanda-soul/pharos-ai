import {
  InvoiceParsingResult,
  InvoicePaymentSummary,
} from './types.js';

/**
 * Terminal UI formatter for Invoice-to-Payment audit outputs.
 */
export class InvoiceAuditFormatter {
  static formatBanner(): string {
    return [
      '╔══════════════════════════════════════════════════════════════════════════════╗',
      '║              PHAROS AUTONOMOUS INVOICE-TO-PAYMENT AGENT                      ║',
      '║         Multi-Format Extraction • Zero-Guessing Anomaly Sentinel             ║',
      '╚══════════════════════════════════════════════════════════════════════════════╝',
    ].join('\n');
  }

  static formatResult(result: {
    parsingResult: InvoiceParsingResult;
    paymentSummary: InvoicePaymentSummary;
  }): string {
    const { parsingResult, paymentSummary } = result;
    const lines: string[] = [];

    lines.push('────────────────────────────────────────────────────────────────────────────────');
    lines.push(`📄 INVOICE PARSING AUDIT: [${parsingResult.format}]`);
    lines.push('────────────────────────────────────────────────────────────────────────────────');
    lines.push(`Reference ID:     ${paymentSummary.invoiceReference}`);
    lines.push(`Vendor / Issuer:  ${paymentSummary.vendorName}`);
    lines.push(`Payee Input:      ${paymentSummary.payeeTarget}`);
    lines.push(`Resolved Address: ${paymentSummary.resolvedPayee}`);
    lines.push(`Billed Total:     ${paymentSummary.billedAmountFormatted}`);
    lines.push(`Settlement Asset: ${paymentSummary.tokenSymbol} (${paymentSummary.tokenContract})`);
    lines.push(`Est. Gas Cost:    ${paymentSummary.estimatedGasFeePros}`);
    lines.push(`USD Valuation:    ${paymentSummary.estimatedUsdValuation}`);

    // Discrepancy & Anomaly Sentinel Status
    lines.push('');
    if (paymentSummary.verificationStatus === 'VERIFIED_READY_FOR_SIGNATURE') {
      lines.push('🛡️ SENTINEL VERDICT:  ✓ VERIFIED READY FOR SIGNATURE (0 Blocking Anomalies)');
    } else {
      lines.push('🚨 SENTINEL VERDICT:  ✗ DISCREPANCIES DETECTED — EXECUTION BLOCKED');
      lines.push('────────────────────────────────────────────────────────────────────────────────');
      lines.push('ANOMALY FLAGS & REMEDIATION HINTS:');
      for (const flag of paymentSummary.anomalyFlags) {
        const icon = flag.severity === 'BLOCKING_ERROR' ? '❌' : '⚠️';
        lines.push(`  ${icon} [${flag.code}] on field '${flag.problematicField}':`);
        lines.push(`     Issue:  ${flag.message}`);
        lines.push(`     Advice: ${flag.remediationAdvice}`);
      }
    }

    // Unsigned Transaction Payload
    if (paymentSummary.unsignedTransaction) {
      const tx = paymentSummary.unsignedTransaction;
      lines.push('');
      lines.push('────────────────────────────────────────────────────────────────────────────────');
      lines.push('🔐 UNSIGNED ON-CHAIN TRANSACTION PAYLOAD (Requirement 03):');
      lines.push('────────────────────────────────────────────────────────────────────────────────');
      lines.push(`  Network:        Pharos Mainnet (Chain ID 1672)`);
      lines.push(`  To Contract:    ${tx.to}`);
      lines.push(`  Native Value:   ${tx.valueWei.toString()} wei`);
      lines.push(`  Gas Limit:      ${tx.gasLimitEstimated.toString()}`);
      lines.push(`  Ref Hex Memo:   ${tx.invoiceReferenceHexMemo}`);
      lines.push(`  Calldata:       ${tx.data.slice(0, 74)}... (${tx.data.length} chars)`);
      lines.push('');
      lines.push('  Foundry Reproduction Command:');
      lines.push(`  $ ${tx.foundryCastCommand}`);
    }

    return lines.join('\n');
  }
}
