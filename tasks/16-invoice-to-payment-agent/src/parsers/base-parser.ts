import { InvoiceParsingResult } from '../types.js';

/**
 * Contract for all invoice format parsing strategies.
 * Strategy pattern enables adding XML, PDF text, or UBL formats without altering core workflow.
 */
export interface InvoiceFormatParser {
  canHandle(rawInvoiceBlob: string): boolean;
  parse(rawInvoiceBlob: string): InvoiceParsingResult;
}
