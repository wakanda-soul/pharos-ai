/**
 * Task 16: Invoice-to-Payment Agent
 * Types and interfaces for multi-format invoice parsing, anomaly detection,
 * and on-chain payment payload synthesis for Pharos Mainnet.
 */

export type InvoiceFormatType = 'STRUCTURED_JSON' | 'PLAINTEXT_MEMO' | 'DELIMITED_RECEIPT';

export interface InvoiceLineItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
}

export type AnomalySeverity = 'BLOCKING_ERROR' | 'AUDIT_WARNING';

export type InvoiceAnomalyCode =
  | 'MISSING_PAYEE_ADDRESS'
  | 'INVALID_PAYEE_FORMAT'
  | 'MISSING_PAYMENT_AMOUNT'
  | 'NON_POSITIVE_AMOUNT'
  | 'LINE_ITEMS_SUM_MISMATCH'
  | 'MISSING_SETTLEMENT_CURRENCY'
  | 'UNSUPPORTED_TOKEN_ASSET'
  | 'MISSING_INVOICE_REFERENCE'
  | 'INVOICE_ALREADY_EXPIRED'
  | 'DUPLICATE_LINE_ITEMS';

export interface InvoiceAnomalyFlag {
  readonly code: InvoiceAnomalyCode;
  readonly severity: AnomalySeverity;
  readonly message: string;
  readonly problematicField: string;
  readonly remediationAdvice: string;
}

export interface ExtractedInvoiceMetadata {
  readonly invoiceReference: string;
  readonly vendorLegalName?: string;
  readonly payeeAddressOrDomain: string;
  readonly resolvedPayeeAddress?: `0x${string}`;
  readonly settlementCurrency: string;
  readonly tokenContractAddress?: `0x${string}`;
  readonly tokenDecimals?: number;
  readonly totalBilledAmount: number;
  readonly lineItems: readonly InvoiceLineItem[];
  readonly issuedTimestamp?: string;
  readonly dueTimestamp?: string;
  readonly formatDetected: InvoiceFormatType;
  readonly memoNotes?: string;
}

export interface InvoiceParsingResult {
  readonly success: boolean;
  readonly format: InvoiceFormatType;
  readonly extractedMetadata?: ExtractedInvoiceMetadata;
  readonly anomalies: readonly InvoiceAnomalyFlag[];
  readonly rawPayloadDigest: string;
}

export interface PreparedUnsignedTransaction {
  readonly chainId: number;
  readonly to: `0x${string}`;
  readonly data: `0x${string}`;
  readonly valueWei: bigint;
  readonly gasLimitEstimated: bigint;
  readonly invoiceReferenceHexMemo: `0x${string}`;
  readonly foundryCastCommand: string;
  readonly eip1193Payload: {
    readonly from?: `0x${string}`;
    readonly to: `0x${string}`;
    readonly data: `0x${string}`;
    readonly value: `0x${string}`;
    readonly gas?: `0x${string}`;
    readonly chainId: string;
  };
}

export interface InvoicePaymentSummary {
  readonly invoiceReference: string;
  readonly vendorName: string;
  readonly payeeTarget: string;
  readonly resolvedPayee: `0x${string}`;
  readonly billedAmountFormatted: string;
  readonly tokenSymbol: string;
  readonly tokenContract: `0x${string}` | 'NATIVE_PROS';
  readonly estimatedGasFeePros: string;
  readonly estimatedUsdValuation: string;
  readonly verificationStatus: 'VERIFIED_READY_FOR_SIGNATURE' | 'DISCREPANCY_FLAGGED';
  readonly anomalyFlags: readonly InvoiceAnomalyFlag[];
  readonly unsignedTransaction?: PreparedUnsignedTransaction;
}
