import { createHash } from 'node:crypto';
import {
  InvoiceFormatParser,
} from './base-parser.js';
import {
  InvoiceParsingResult,
  ExtractedInvoiceMetadata,
  InvoiceAnomalyFlag,
  InvoiceLineItem,
} from '../types.js';

/**
 * Ingests structured JSON billing payloads (e.g. ERP exports, Peppol-like envelopes).
 */
export class StructuredJsonInvoiceParser implements InvoiceFormatParser {
  canHandle(rawInvoiceBlob: string): boolean {
    const trimmedPayload = rawInvoiceBlob.trim();
    return (trimmedPayload.startsWith('{') && trimmedPayload.endsWith('}')) ||
           (trimmedPayload.startsWith('[') && trimmedPayload.endsWith(']'));
  }

  parse(rawInvoiceBlob: string): InvoiceParsingResult {
    const payloadDigest = createHash('sha256').update(rawInvoiceBlob).digest('hex');
    const anomalies: InvoiceAnomalyFlag[] = [];

    let parsedDocument: Record<string, any>;
    try {
      parsedDocument = JSON.parse(rawInvoiceBlob);
    } catch (parseSyntaxError) {
      return {
        success: false,
        format: 'STRUCTURED_JSON',
        anomalies: [
          {
            code: 'INVALID_PAYEE_FORMAT',
            severity: 'BLOCKING_ERROR',
            message: `JSON syntax error: ${(parseSyntaxError as Error).message}`,
            problematicField: 'rawInvoiceBlob',
            remediationAdvice: 'Ensure the payload conforms to valid RFC-8259 JSON grammar.',
          },
        ],
        rawPayloadDigest: payloadDigest,
      };
    }

    // Extract reference: support various enterprise naming conventions
    const invoiceReference = parsedDocument.invoiceReference ||
      parsedDocument.reference ||
      parsedDocument.invoiceId ||
      parsedDocument.invoiceNumber ||
      parsedDocument.id ||
      '';

    // Extract payee address or name domain (.pharos / .eth)
    const payeeRecipient = parsedDocument.payeeAddress ||
      parsedDocument.recipient ||
      parsedDocument.payee ||
      parsedDocument.beneficiary ||
      parsedDocument.to ||
      '';

    // Extract currency or token asset
    const rawCurrencyTicker = parsedDocument.currency ||
      parsedDocument.token ||
      parsedDocument.asset ||
      parsedDocument.settlementAsset ||
      '';

    // Extract total amount
    let billedAmountNumeric = 0;
    if (typeof parsedDocument.totalAmount === 'number') {
      billedAmountNumeric = parsedDocument.totalAmount;
    } else if (typeof parsedDocument.amount === 'number') {
      billedAmountNumeric = parsedDocument.amount;
    } else if (typeof parsedDocument.total === 'number') {
      billedAmountNumeric = parsedDocument.total;
    } else if (typeof parsedDocument.totalAmount === 'string') {
      // Clean possible commas or currency signs like "$1,250.00"
      billedAmountNumeric = parseFloat(parsedDocument.totalAmount.replace(/[^0-9.-]+/g, ''));
    } else if (typeof parsedDocument.amount === 'string') {
      billedAmountNumeric = parseFloat(parsedDocument.amount.replace(/[^0-9.-]+/g, ''));
    }

    // Extract line items if provided in document
    const extractedLineItems: InvoiceLineItem[] = [];
    if (Array.isArray(parsedDocument.lineItems) || Array.isArray(parsedDocument.items)) {
      const rawItemList = parsedDocument.lineItems || parsedDocument.items;
      for (const itemBlob of rawItemList) {
        const itemDesc = itemBlob.description || itemBlob.name || 'Unnamed Line Item';
        const itemQty = Number(itemBlob.quantity || itemBlob.qty || 1);
        const itemUnitPrice = Number(itemBlob.unitPrice || itemBlob.price || 0);
        const itemLineTotal = Number(itemBlob.lineTotal || itemBlob.total || (itemQty * itemUnitPrice));
        extractedLineItems.push({
          description: itemDesc,
          quantity: itemQty,
          unitPrice: itemUnitPrice,
          lineTotal: itemLineTotal,
        });
      }
    }

    const metadata: ExtractedInvoiceMetadata = {
      invoiceReference: String(invoiceReference).trim(),
      vendorLegalName: parsedDocument.vendorName || parsedDocument.vendor || parsedDocument.issuer,
      payeeAddressOrDomain: String(payeeRecipient).trim(),
      settlementCurrency: String(rawCurrencyTicker).trim().toUpperCase(),
      totalBilledAmount: isNaN(billedAmountNumeric) ? 0 : billedAmountNumeric,
      lineItems: extractedLineItems,
      issuedTimestamp: parsedDocument.issueDate || parsedDocument.createdAt,
      dueTimestamp: parsedDocument.dueDate || parsedDocument.paymentDue,
      formatDetected: 'STRUCTURED_JSON',
      memoNotes: parsedDocument.memo || parsedDocument.notes,
    };

    return {
      success: true,
      format: 'STRUCTURED_JSON',
      extractedMetadata: metadata,
      anomalies,
      rawPayloadDigest: payloadDigest,
    };
  }
}
