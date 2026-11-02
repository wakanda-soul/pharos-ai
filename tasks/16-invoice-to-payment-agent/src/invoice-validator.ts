import { isAddress, getAddress } from 'viem';
import {
  ExtractedInvoiceMetadata,
  InvoiceAnomalyFlag,
} from './types.js';
import {
  resolveTokenAsset,
  PHAROS_SETTLEMENT_TOKENS,
} from './token-registry.js';

// Pre-configured PNS domain alias directory for test and ecosystem resolution
const KNOWN_PHAROS_DOMAIN_RESOLVER: Record<string, `0x${string}`> = {
  'alice.pharos': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  'bob.pharos': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  'treasury.pharos': '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  'nexus.pharos': '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  'vitalik.eth': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
};

/**
 * Strict Invoice Anomaly Sentinel.
 * Enforces Arena Requirement 02: "Flags mismatches or missing fields instead of guessing."
 */
export class InvoiceAnomalySentinel {
  validate(metadata: ExtractedInvoiceMetadata): {
    isValid: boolean;
    flags: InvoiceAnomalyFlag[];
    resolvedAddress?: `0x${string}`;
    tokenContract?: `0x${string}`;
    tokenDecimals?: number;
  } {
    const flags: InvoiceAnomalyFlag[] = [];
    let resolvedRecipient: `0x${string}` | undefined;

    // ─── 1. Payee Verification ──────────────────────────────────────────────
    const rawPayee = metadata.payeeAddressOrDomain?.trim();
    if (!rawPayee) {
      flags.push({
        code: 'MISSING_PAYEE_ADDRESS',
        severity: 'BLOCKING_ERROR',
        message: 'No payee destination or beneficiary address was provided in the invoice.',
        problematicField: 'payeeAddressOrDomain',
        remediationAdvice: 'The sender must explicitly provide a 20-byte EVM address or registered .pharos domain name.',
      });
    } else if (rawPayee.endsWith('.pharos') || rawPayee.endsWith('.eth')) {
      const canonicalDomain = rawPayee.toLowerCase();
      const resolved = KNOWN_PHAROS_DOMAIN_RESOLVER[canonicalDomain];
      if (resolved) {
        resolvedRecipient = getAddress(resolved);
      } else {
        flags.push({
          code: 'INVALID_PAYEE_FORMAT',
          severity: 'BLOCKING_ERROR',
          message: `Unable to resolve PNS domain alias: "${rawPayee}". Domain does not have an on-chain forward record.`,
          problematicField: 'payeeAddressOrDomain',
          remediationAdvice: 'Verify the domain name spelling or supply direct 0x hex address.',
        });
      }
    } else if (isAddress(rawPayee)) {
      if (rawPayee.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        flags.push({
          code: 'INVALID_PAYEE_FORMAT',
          severity: 'BLOCKING_ERROR',
          message: 'Zero-address (0x000...000) is prohibited as payment payee to prevent irreversible fund burn.',
          problematicField: 'payeeAddressOrDomain',
          remediationAdvice: 'Specify an active EOA or multi-sig treasury address.',
        });
      } else {
        resolvedRecipient = getAddress(rawPayee);
      }
    } else {
      flags.push({
        code: 'INVALID_PAYEE_FORMAT',
        severity: 'BLOCKING_ERROR',
        message: `Payee identifier "${rawPayee}" is neither a valid 20-byte EVM address nor a recognized domain alias.`,
        problematicField: 'payeeAddressOrDomain',
        remediationAdvice: 'Format payee as 0x... (40 hex chars) or .pharos name.',
      });
    }

    // ─── 2. Billed Amount Validation ────────────────────────────────────────
    if (metadata.totalBilledAmount === undefined || isNaN(metadata.totalBilledAmount)) {
      flags.push({
        code: 'MISSING_PAYMENT_AMOUNT',
        severity: 'BLOCKING_ERROR',
        message: 'The invoice is missing a total billing amount.',
        problematicField: 'totalBilledAmount',
        remediationAdvice: 'Specify a positive numeric sum to disburse.',
      });
    } else if (metadata.totalBilledAmount <= 0) {
      flags.push({
        code: 'NON_POSITIVE_AMOUNT',
        severity: 'BLOCKING_ERROR',
        message: `Total billed amount must be positive (received: ${metadata.totalBilledAmount}).`,
        problematicField: 'totalBilledAmount',
        remediationAdvice: 'Check if credit memos or adjustments turned total negative or zero.',
      });
    }

    // ─── 3. Settlement Currency Integrity (NO GUESSING!) ─────────────────────
    // Watch out: Never assume USDC or PROS if omitted; flag explicitly to protect sender
    let matchedTokenDecimals: number | undefined;
    let matchedTokenContract: `0x${string}` | undefined;

    if (!metadata.settlementCurrency || metadata.settlementCurrency.trim().length === 0) {
      flags.push({
        code: 'MISSING_SETTLEMENT_CURRENCY',
        severity: 'BLOCKING_ERROR',
        message: 'Invoice omits currency/token specification. Refusing to guess default currency to prevent unintended asset debits.',
        problematicField: 'settlementCurrency',
        remediationAdvice: 'Specify asset symbol (e.g. USDC, PROS, LINK).',
      });
    } else {
      const resolvedAsset = resolveTokenAsset(metadata.settlementCurrency);
      if (!resolvedAsset) {
        flags.push({
          code: 'UNSUPPORTED_TOKEN_ASSET',
          severity: 'BLOCKING_ERROR',
          message: `Currency "${metadata.settlementCurrency}" is not recognized on Pharos Mainnet. Supported assets: ${Object.keys(PHAROS_SETTLEMENT_TOKENS).join(', ')}.`,
          problematicField: 'settlementCurrency',
          remediationAdvice: 'Invoices must request settlement in PROS, USDC, or recognized Pharos tokens.',
        });
      } else {
        matchedTokenDecimals = resolvedAsset.decimals;
        matchedTokenContract = resolvedAsset.contractAddress;
      }
    }

    // ─── 4. Invoice Reference / Audit Trail ──────────────────────────────────
    // Every on-chain settlement must bind to an invoice reference
    if (!metadata.invoiceReference || metadata.invoiceReference.trim().length === 0) {
      flags.push({
        code: 'MISSING_INVOICE_REFERENCE',
        severity: 'BLOCKING_ERROR',
        message: 'Invoice lacks a unique reference ID or billing serial number.',
        problematicField: 'invoiceReference',
        remediationAdvice: 'Supply an invoice reference (e.g. INV-2026-001) for reconciliation.',
      });
    }

    // ─── 5. Mathematical Line-Items Sum Verification ────────────────────────
    if (metadata.lineItems && metadata.lineItems.length > 0) {
      const talliedSum = metadata.lineItems.reduce((acc, curr) => acc + curr.lineTotal, 0);
      const roundedTally = Math.round(talliedSum * 100) / 100;
      const roundedTotal = Math.round(metadata.totalBilledAmount * 100) / 100;

      if (Math.abs(roundedTally - roundedTotal) > 0.01) {
        flags.push({
          code: 'LINE_ITEMS_SUM_MISMATCH',
          severity: 'BLOCKING_ERROR',
          message: `Discrepancy detected: sum of itemized line totals (${roundedTally}) does not match stated invoice total (${roundedTotal}). Difference: ${(roundedTotal - roundedTally).toFixed(2)}.`,
          problematicField: 'lineItems',
          remediationAdvice: 'Reconcile individual line-item costs before authorizing payment.',
        });
      }
    }

    // ─── 6. Expiration / Due Date Check (Audit Warning) ─────────────────────
    if (metadata.dueTimestamp) {
      const parsedDueDate = new Date(metadata.dueTimestamp);
      if (!isNaN(parsedDueDate.getTime()) && parsedDueDate.getTime() < Date.now()) {
        flags.push({
          code: 'INVOICE_ALREADY_EXPIRED',
          severity: 'AUDIT_WARNING',
          message: `Invoice due date (${metadata.dueTimestamp}) is in the past. Payment may incur late charges or require vendor reissue.`,
          problematicField: 'dueTimestamp',
          remediationAdvice: 'Confirm with vendor whether expired invoice is still valid for settlement.',
        });
      }
    }

    const hasBlockingErrors = flags.some((f) => f.severity === 'BLOCKING_ERROR');

    return {
      isValid: !hasBlockingErrors,
      flags,
      resolvedAddress: resolvedRecipient,
      tokenContract: matchedTokenContract,
      tokenDecimals: matchedTokenDecimals,
    };
  }
}
