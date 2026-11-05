import { describe, it, expect } from 'vitest';
import { hexToString } from 'viem';
import { InvoiceToPaymentAgent } from '../src/invoice-agent.js';
import {
  SAMPLE_JSON_INVOICE_VALID,
  SAMPLE_PLAINTEXT_INVOICE_VALID,
  SAMPLE_DELIMITED_RECEIPT_VALID,
  SAMPLE_INVOICE_SUM_MISMATCH,
  SAMPLE_INVOICE_MISSING_CURRENCY,
  SAMPLE_INVOICE_MISSING_PAYEE,
  SAMPLE_INVOICE_MISSING_REFERENCE,
} from '../src/sample-invoices.js';

describe('Task 16: Invoice-to-Payment Autonomous Agent', () => {
  const invoiceAgent = new InvoiceToPaymentAgent();

  describe('Requirement 01: Multi-Format Invoice Ingestion & Extraction', () => {
    it('should correctly parse structured JSON e-invoice and extract payee, amount, currency, reference', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_JSON_INVOICE_VALID);

      expect(outcome.parsingResult.success).toBe(true);
      expect(outcome.parsingResult.format).toBe('STRUCTURED_JSON');

      const meta = outcome.parsingResult.extractedMetadata!;
      expect(meta.invoiceReference).toBe('INV-2026-PHAROS-101');
      expect(meta.totalBilledAmount).toBe(450.0);
      expect(meta.settlementCurrency).toBe('USDC');
      expect(meta.payeeAddressOrDomain).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
      expect(meta.lineItems.length).toBe(2);
    });

    it('should accurately parse plaintext commercial billing memo with line items and PNS domain', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_PLAINTEXT_INVOICE_VALID);

      expect(outcome.parsingResult.success).toBe(true);
      expect(outcome.parsingResult.format).toBe('PLAINTEXT_MEMO');

      const meta = outcome.parsingResult.extractedMetadata!;
      expect(meta.invoiceReference).toBe('INV-2026-DEV-884');
      expect(meta.totalBilledAmount).toBe(1250.0);
      expect(meta.settlementCurrency).toBe('USDC');
      expect(meta.payeeAddressOrDomain).toBe('alice.pharos');
      expect(outcome.paymentSummary.resolvedPayee).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    });

    it('should parse delimited key-value receipt format and resolve native PROS currency', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_DELIMITED_RECEIPT_VALID);

      expect(outcome.parsingResult.success).toBe(true);
      expect(outcome.parsingResult.format).toBe('DELIMITED_RECEIPT');

      const meta = outcome.parsingResult.extractedMetadata!;
      expect(meta.invoiceReference).toBe('INV-DEV-9921');
      expect(meta.totalBilledAmount).toBe(15.5);
      expect(meta.settlementCurrency).toBe('PROS');
      expect(meta.payeeAddressOrDomain).toBe('treasury.pharos');
      expect(outcome.paymentSummary.resolvedPayee).toBe('0x90F79bf6EB2c4f870365E785982E1f101E93b906');
    });

    it('should clean currency values formatted with commas like "$1,250.00" without parsing errors', () => {
      const invoiceText = `
Invoice Reference: INV-DEV-COMMA
Payee: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Currency: USDC
Amount Due: $1,250.00
      `;
      const outcome = invoiceAgent.processInvoice(invoiceText);
      expect(outcome.parsingResult.success).toBe(true);
      expect(outcome.parsingResult.extractedMetadata?.totalBilledAmount).toBe(1250.0);
      expect(outcome.paymentSummary.billedAmountFormatted).toBe('1,250.00 USDC');
    });
  });

  describe('Requirement 02: Discrepancy & Missing Field Anomaly Flagging (No Guessing)', () => {
    it('should flag line item total sum mismatch instead of blindly executing', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_INVOICE_SUM_MISMATCH);

      expect(outcome.paymentSummary.verificationStatus).toBe('DISCREPANCY_FLAGGED');
      const mismatchFlag = outcome.paymentSummary.anomalyFlags.find(
        (f) => f.code === 'LINE_ITEMS_SUM_MISMATCH'
      );
      expect(mismatchFlag).toBeDefined();
      expect(mismatchFlag?.severity).toBe('BLOCKING_ERROR');
      expect(mismatchFlag?.message).toContain('Discrepancy detected: sum of itemized line totals (600)');
      // Unsigned transaction MUST NOT be produced when blocking discrepancy is detected
      expect(outcome.paymentSummary.unsignedTransaction).toBeUndefined();
    });

    it('should strictly refuse to guess currency when omitted', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_INVOICE_MISSING_CURRENCY);

      expect(outcome.paymentSummary.verificationStatus).toBe('DISCREPANCY_FLAGGED');
      const currFlag = outcome.paymentSummary.anomalyFlags.find(
        (f) => f.code === 'MISSING_SETTLEMENT_CURRENCY'
      );
      expect(currFlag).toBeDefined();
      expect(currFlag?.message).toContain('Refusing to guess default currency');
      expect(outcome.paymentSummary.unsignedTransaction).toBeUndefined();
    });

    it('should flag missing payee address', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_INVOICE_MISSING_PAYEE);

      expect(outcome.paymentSummary.verificationStatus).toBe('DISCREPANCY_FLAGGED');
      const payeeFlag = outcome.paymentSummary.anomalyFlags.find(
        (f) => f.code === 'MISSING_PAYEE_ADDRESS'
      );
      expect(payeeFlag).toBeDefined();
      expect(payeeFlag?.severity).toBe('BLOCKING_ERROR');
      expect(outcome.paymentSummary.unsignedTransaction).toBeUndefined();
    });

    it('should flag missing invoice reference', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_INVOICE_MISSING_REFERENCE);

      expect(outcome.paymentSummary.verificationStatus).toBe('DISCREPANCY_FLAGGED');
      const refFlag = outcome.paymentSummary.anomalyFlags.find(
        (f) => f.code === 'MISSING_INVOICE_REFERENCE'
      );
      expect(refFlag).toBeDefined();
      expect(refFlag?.severity).toBe('BLOCKING_ERROR');
      expect(outcome.paymentSummary.unsignedTransaction).toBeUndefined();
    });

    it('should flag zero-address payee as invalid', () => {
      const zeroAddrInvoice = JSON.stringify({
        invoiceReference: 'INV-ZERO-001',
        payeeAddress: '0x0000000000000000000000000000000000000000',
        totalAmount: 100,
        currency: 'USDC',
      });
      const outcome = invoiceAgent.processInvoice(zeroAddrInvoice);
      expect(outcome.paymentSummary.verificationStatus).toBe('DISCREPANCY_FLAGGED');
      const zeroFlag = outcome.paymentSummary.anomalyFlags.find((f) => f.code === 'INVALID_PAYEE_FORMAT');
      expect(zeroFlag).toBeDefined();
      expect(zeroFlag?.message).toContain('Zero-address');
    });

    it('should flag non-positive billing amount', () => {
      const negativeInvoice = JSON.stringify({
        invoiceReference: 'INV-NEG-001',
        payeeAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        totalAmount: -50,
        currency: 'USDC',
      });
      const outcome = invoiceAgent.processInvoice(negativeInvoice);
      expect(outcome.paymentSummary.verificationStatus).toBe('DISCREPANCY_FLAGGED');
      const amountFlag = outcome.paymentSummary.anomalyFlags.find((f) => f.code === 'NON_POSITIVE_AMOUNT');
      expect(amountFlag).toBeDefined();
    });
  });

  describe('Requirement 03: Payment Summary & Unsigned Transaction with Invoice Reference', () => {
    it('should generate pre-flight summary and unsigned ERC-20 transaction embedding reference memo in calldata', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_JSON_INVOICE_VALID);

      expect(outcome.paymentSummary.verificationStatus).toBe('VERIFIED_READY_FOR_SIGNATURE');
      expect(outcome.paymentSummary.billedAmountFormatted).toBe('450.00 USDC');
      expect(outcome.paymentSummary.tokenContract).toBe('0xc879c018db60520f4355c26ed1a6d572cdac1815');

      const unsignedTx = outcome.paymentSummary.unsignedTransaction!;
      expect(unsignedTx).toBeDefined();
      expect(unsignedTx.chainId).toBe(1672);
      expect(unsignedTx.to).toBe('0xc879c018db60520f4355c26ed1a6d572cdac1815');
      expect(unsignedTx.valueWei).toBe(0n);

      // Verify invoice reference is embedded in the calldata
      const decodedMemo = hexToString(unsignedTx.invoiceReferenceHexMemo);
      expect(decodedMemo).toBe('INV-2026-PHAROS-101');
      expect(unsignedTx.data.toLowerCase()).toContain(
        unsignedTx.invoiceReferenceHexMemo.slice(2).toLowerCase()
      );

      // Verify Foundry cast command
      expect(unsignedTx.foundryCastCommand).toContain('cast send 0xc879c018db60520f4355c26ed1a6d572cdac1815');
      expect(unsignedTx.foundryCastCommand).toContain('transfer(address,uint256)');

      // Verify EIP-1193 payload
      expect(unsignedTx.eip1193Payload.chainId).toBe('0x688'); // 1672 in hex
      expect(unsignedTx.eip1193Payload.data).toBe(unsignedTx.data);
    });

    it('should generate native PROS transaction with invoice reference in transaction data', () => {
      const outcome = invoiceAgent.processInvoice(SAMPLE_DELIMITED_RECEIPT_VALID);

      expect(outcome.paymentSummary.verificationStatus).toBe('VERIFIED_READY_FOR_SIGNATURE');
      expect(outcome.paymentSummary.tokenContract).toBe('NATIVE_PROS');

      const unsignedTx = outcome.paymentSummary.unsignedTransaction!;
      expect(unsignedTx).toBeDefined();
      expect(unsignedTx.to).toBe('0x90F79bf6EB2c4f870365E785982E1f101E93b906');
      expect(unsignedTx.valueWei).toBe(15500000000000000000n); // 15.5 PROS in wei

      const decodedMemo = hexToString(unsignedTx.invoiceReferenceHexMemo);
      expect(decodedMemo).toBe('INV-DEV-9921');
      expect(unsignedTx.data).toBe(unsignedTx.invoiceReferenceHexMemo);
      expect(unsignedTx.foundryCastCommand).toContain('cast send 0x90F79bf6EB2c4f870365E785982E1f101E93b906');
    });
  });
});
