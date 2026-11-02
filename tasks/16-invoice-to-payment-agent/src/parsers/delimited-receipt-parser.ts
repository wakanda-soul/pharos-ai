import { createHash } from 'node:crypto';
import { InvoiceFormatParser } from './base-parser.js';
import {
  InvoiceParsingResult,
  ExtractedInvoiceMetadata,
  InvoiceAnomalyFlag,
} from '../types.js';

/**
 * Parses Key-Value / Delimited Receipt payloads (e.g. ERP webhook event bodies, .env format).
 */
export class DelimitedReceiptParser implements InvoiceFormatParser {
  canHandle(rawInvoiceBlob: string): boolean {
    const lines = rawInvoiceBlob.split('\n').map((l) => l.trim()).filter((l) => Boolean(l) && !l.startsWith('#'));
    // Delimited KV receipts use unambiguous KEY=VALUE format (e.g. ERP exports, webhook payloads)
    const kvEqualsLines = lines.filter((l) => /^[A-Z0-9_-]+\s*=\s*.+/i.test(l)).length;
    return kvEqualsLines >= 3;
  }

  parse(rawInvoiceBlob: string): InvoiceParsingResult {
    const payloadDigest = createHash('sha256').update(rawInvoiceBlob).digest('hex');
    const anomalies: InvoiceAnomalyFlag[] = [];
    const kvRecords: Record<string, string> = {};

    const lines = rawInvoiceBlob.split('\n');
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      let delimiterIdx = trimmed.indexOf('=');
      if (delimiterIdx === -1) {
        delimiterIdx = trimmed.indexOf(':');
      }

      if (delimiterIdx > 0) {
        const key = trimmed.slice(0, delimiterIdx).trim().toUpperCase();
        const value = trimmed.slice(delimiterIdx + 1).trim();
        kvRecords[key] = value;
      }
    }

    const invoiceReference = kvRecords['INVOICE_REF'] ||
      kvRecords['REF'] ||
      kvRecords['INVOICE_ID'] ||
      kvRecords['ID'] ||
      '';

    const payeeAddressOrDomain = kvRecords['PAYEE'] ||
      kvRecords['RECIPIENT'] ||
      kvRecords['TO'] ||
      kvRecords['WALLET'] ||
      '';

    const settlementCurrency = kvRecords['CURRENCY'] ||
      kvRecords['TOKEN'] ||
      kvRecords['ASSET'] ||
      '';

    const rawAmount = kvRecords['AMOUNT'] ||
      kvRecords['TOTAL'] ||
      kvRecords['TOTAL_DUE'] ||
      '0';
    const totalBilledAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g, ''));

    const vendorLegalName = kvRecords['VENDOR'] ||
      kvRecords['COMPANY'] ||
      kvRecords['ISSUER'];

    const metadata: ExtractedInvoiceMetadata = {
      invoiceReference,
      vendorLegalName,
      payeeAddressOrDomain,
      settlementCurrency: settlementCurrency.toUpperCase(),
      totalBilledAmount: isNaN(totalBilledAmount) ? 0 : totalBilledAmount,
      lineItems: [],
      formatDetected: 'DELIMITED_RECEIPT',
    };

    return {
      success: true,
      format: 'DELIMITED_RECEIPT',
      extractedMetadata: metadata,
      anomalies,
      rawPayloadDigest: payloadDigest,
    };
  }
}
