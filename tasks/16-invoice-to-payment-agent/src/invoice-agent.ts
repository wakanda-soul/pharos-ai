import {
  InvoiceParsingResult,
  InvoicePaymentSummary,
} from './types.js';
import { InvoiceFormatParser } from './parsers/base-parser.js';
import { StructuredJsonInvoiceParser } from './parsers/json-invoice-parser.js';
import { PlaintextMemoInvoiceParser } from './parsers/plaintext-memo-parser.js';
import { DelimitedReceiptParser } from './parsers/delimited-receipt-parser.js';
import { InvoiceAnomalySentinel } from './invoice-validator.js';
import { InvoicePaymentSynthesizer } from './payment-synthesizer.js';

/**
 * Pharos Invoice-to-Payment Autonomous Agent.
 * Orchestrates multi-format invoice ingestion, discrepancy verification,
 * and calibrated on-chain transaction generation.
 */
export class InvoiceToPaymentAgent {
  private readonly registeredParsers: readonly InvoiceFormatParser[];
  private readonly anomalySentinel: InvoiceAnomalySentinel;
  private readonly paymentSynthesizer: InvoicePaymentSynthesizer;

  constructor(
    customParsers?: readonly InvoiceFormatParser[],
    customSentinel?: InvoiceAnomalySentinel,
    customSynthesizer?: InvoicePaymentSynthesizer
  ) {
    this.registeredParsers = customParsers ?? [
      new StructuredJsonInvoiceParser(),
      new PlaintextMemoInvoiceParser(),
      new DelimitedReceiptParser(),
    ];
    this.anomalySentinel = customSentinel ?? new InvoiceAnomalySentinel();
    this.paymentSynthesizer = customSynthesizer ?? new InvoicePaymentSynthesizer();
  }

  /**
   * Evaluates an invoice blob across all registered parser strategies.
   */
  parseInvoice(rawInvoiceBlob: string): InvoiceParsingResult {
    // Select appropriate parser strategy based on format signature
    for (const parserStrategy of this.registeredParsers) {
      if (parserStrategy.canHandle(rawInvoiceBlob)) {
        return parserStrategy.parse(rawInvoiceBlob);
      }
    }

    // Default to plaintext memo heuristic if no strict structured match was met
    const fallbackParser = this.registeredParsers[1];
    return fallbackParser.parse(rawInvoiceBlob);
  }

  /**
   * Main pipeline: Ingests raw invoice string, validates fields, and synthesizes transaction.
   */
  processInvoice(rawInvoiceBlob: string): {
    parsingResult: InvoiceParsingResult;
    paymentSummary: InvoicePaymentSummary;
  } {
    const parsingResult = this.parseInvoice(rawInvoiceBlob);

    if (!parsingResult.extractedMetadata) {
      const summary: InvoicePaymentSummary = {
        invoiceReference: 'N/A',
        vendorName: 'N/A',
        payeeTarget: 'N/A',
        resolvedPayee: '0x0000000000000000000000000000000000000000',
        billedAmountFormatted: '0.00',
        tokenSymbol: 'N/A',
        tokenContract: 'N/A' as any,
        estimatedGasFeePros: '0 PROS',
        estimatedUsdValuation: '$0.00',
        verificationStatus: 'DISCREPANCY_FLAGGED',
        anomalyFlags: parsingResult.anomalies,
      };
      return { parsingResult, paymentSummary: summary };
    }

    // Pass through anomaly sentinel
    const validationVerdict = this.anomalySentinel.validate(parsingResult.extractedMetadata);
    const combinedAnomalies = [...parsingResult.anomalies, ...validationVerdict.flags];

    // Synthesize transaction payload
    const resolvedPayee = validationVerdict.resolvedAddress ?? '0x0000000000000000000000000000000000000000';
    const paymentSummary = this.paymentSynthesizer.synthesize(
      parsingResult.extractedMetadata,
      resolvedPayee,
      validationVerdict.tokenContract,
      validationVerdict.tokenDecimals ?? 6,
      combinedAnomalies
    );

    return {
      parsingResult,
      paymentSummary,
    };
  }
}
