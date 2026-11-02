import { createHash } from 'node:crypto';
import { InvoiceFormatParser } from './base-parser.js';
import {
  InvoiceParsingResult,
  ExtractedInvoiceMetadata,
  InvoiceAnomalyFlag,
  InvoiceLineItem,
} from '../types.js';

/**
 * Parses unstructured plaintext and Markdown commercial memos.
 * Uses adaptive regex heuristics to pull payment instructions out of natural billing memos.
 */
export class PlaintextMemoInvoiceParser implements InvoiceFormatParser {
  canHandle(rawInvoiceBlob: string): boolean {
    const lowerText = rawInvoiceBlob.toLowerCase();
    return (
      lowerText.includes('invoice') ||
      lowerText.includes('payment request') ||
      lowerText.includes('billed to') ||
      lowerText.includes('total due')
    );
  }

  parse(rawInvoiceBlob: string): InvoiceParsingResult {
    const payloadDigest = createHash('sha256').update(rawInvoiceBlob).digest('hex');
    const anomalies: InvoiceAnomalyFlag[] = [];

    // Reference search: matches "Invoice Reference:", "Invoice ID:", "Ref #:", "Invoice #:"
    const refMatch = rawInvoiceBlob.match(
      /(?:invoice\s*(?:reference|id|number|#)|ref\s*#?)\s*[:=]\s*([^\r\n]+)/i
    );
    let invoiceReference = refMatch ? refMatch[1].trim() : '';
    // Watch out: strip markdown asterisks, backticks, or wrapping quotes from invoice ID
    invoiceReference = invoiceReference.replace(/[*`"']/g, '').trim();

    // Payee search: address (0x...) or PNS domain (.pharos / .eth)
    let payeeAddressOrDomain = '';
    const payeeMatch = rawInvoiceBlob.match(
      /(?:payee|recipient|beneficiary|send\s*to|wallet)\s*[:=]\s*([^\r\n]+)/i
    );
    if (payeeMatch) {
      let candidate = payeeMatch[1].trim().replace(/[*`"']/g, '');
      // Clean trailing parenthetical comments, e.g. "alice.pharos (finance multi-sig)"
      const commentIdx = candidate.indexOf('(');
      if (commentIdx > 0) {
        candidate = candidate.slice(0, commentIdx).trim();
      }
      payeeAddressOrDomain = candidate;
    } else {
      // Direct raw address search if header omitted
      const standaloneAddressMatch = rawInvoiceBlob.match(/0x[a-fA-F0-9]{40}/);
      if (standaloneAddressMatch) {
        payeeAddressOrDomain = standaloneAddressMatch[0];
      }
    }

    // Vendor name search
    const vendorMatch = rawInvoiceBlob.match(/(?:vendor|from|issuer|company)\s*[:=]\s*([^\r\n]+)/i);
    const vendorLegalName = vendorMatch ? vendorMatch[1].trim() : undefined;

    // Amount and currency: matches "Total Due: 1,500.00 USDC" or "Amount: $500"
    let totalBilledAmount = 0;
    let settlementCurrency = '';

    const totalDueMatch = rawInvoiceBlob.match(
      /(?:total\s*(?:due|amount)?|amount\s*due|amount)\s*[:=]\s*(?:([$€£])\s*)?([0-9,]+(?:\.[0-9]+)?)\s*([A-Za-z]+)?/i
    );

    if (totalDueMatch) {
      const currencySymbolPrefix = totalDueMatch[1];
      const rawNumericString = totalDueMatch[2].replace(/,/g, '');
      const currencyTickerSuffix = totalDueMatch[3];

      totalBilledAmount = parseFloat(rawNumericString);

      if (currencyTickerSuffix) {
        settlementCurrency = currencyTickerSuffix.toUpperCase();
      } else if (currencySymbolPrefix === '$') {
        settlementCurrency = 'USDC';
      }
    }

    // Line items parser: scan lines starting with '-' or '*'
    const lineItems: InvoiceLineItem[] = [];
    const itemRegex = /^[\s*-]+(.+?):\s*([0-9.]+)\s*x\s*([0-9.]+)\s*=\s*([0-9.]+)/gim;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(rawInvoiceBlob)) !== null) {
      lineItems.push({
        description: itemMatch[1].trim(),
        quantity: parseFloat(itemMatch[2]),
        unitPrice: parseFloat(itemMatch[3]),
        lineTotal: parseFloat(itemMatch[4]),
      });
    }

    const metadata: ExtractedInvoiceMetadata = {
      invoiceReference,
      vendorLegalName,
      payeeAddressOrDomain,
      settlementCurrency,
      totalBilledAmount: isNaN(totalBilledAmount) ? 0 : totalBilledAmount,
      lineItems,
      formatDetected: 'PLAINTEXT_MEMO',
    };

    return {
      success: true,
      format: 'PLAINTEXT_MEMO',
      extractedMetadata: metadata,
      anomalies,
      rawPayloadDigest: payloadDigest,
    };
  }
}
