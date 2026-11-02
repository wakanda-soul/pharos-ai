import { describe, it, expect, beforeEach } from 'vitest';
import { NaturalLanguagePaymentAgent } from '../src/payment-synthesizer.js';
import {
  SCENARIO_VALID_NATIVE_TRANSFER,
  SCENARIO_VALID_TOKEN_TRANSFER,
  SCENARIO_AMBIGUOUS_MISSING_RECIPIENT,
  SCENARIO_AMBIGUOUS_MISSING_AMOUNT,
  SCENARIO_INSUFFICIENT_BALANCE,
  SCENARIO_INVALID_RECIPIENT,
} from '../src/scenarios.js';

describe('Task 14: Natural-Language Payment Agent', () => {
  let agent: NaturalLanguagePaymentAgent;
  const testSender = '0x6119871b4eb66db137dcfad59655853ea6fe58ce';

  beforeEach(() => {
    agent = new NaturalLanguagePaymentAgent();
  });

  // =========================================================================
  // Requirement 01: Free Text Parsing & Ambiguity Clarifications
  // =========================================================================
  describe('Requirement 01: Natural Language Parsing & Ambiguity Handling', () => {
    it('should correctly parse amount, token and recipient from diverse free-text instructions', () => {
      const parser = agent.getParser();

      // Case A: Standard phrasing
      const resA = parser.parse('send 100 USDC to 0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');
      expect(resA.isComplete).toBe(true);
      expect(resA.amount).toBe(100);
      expect(resA.tokenSymbol).toBe('USDC');
      expect(resA.resolvedRecipient?.toLowerCase()).toBe('0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');

      // Case B: Colloquial phrasing with PNS domain
      const resB = parser.parse('please wire 0.05 PROS to alice.pharos');
      expect(resB.isComplete).toBe(true);
      expect(resB.amount).toBe(0.05);
      expect(resB.tokenSymbol).toBe('PROS');
      expect(resB.resolvedRecipient?.toLowerCase()).toBe('0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');

      // Case C: Currency symbol prefix ($50 to bob)
      const resC = parser.parse('transfer $50 to bob.pharos');
      expect(resC.isComplete).toBe(true);
      expect(resC.amount).toBe(50);
      expect(resC.tokenSymbol).toBe('USDC');
      expect(resC.resolvedRecipient).toBe('0x5346452296d910a373b5ee0e6df27863cb6ad689');
    });

    it('should ask targeted follow-up questions when recipient is missing', async () => {
      const result = await agent.preparePayment(SCENARIO_AMBIGUOUS_MISSING_RECIPIENT.instruction);

      expect(result.status).toBe('AMBIGUOUS_INPUT');
      expect(result.intent.isComplete).toBe(false);
      expect(result.intent.clarificationsNeeded.length).toBeGreaterThan(0);

      const recipientClarification = result.intent.clarificationsNeeded.find(
        (c) => c.field === 'RECIPIENT'
      );
      expect(recipientClarification).toBeDefined();
      expect(recipientClarification?.question).toContain('Who should receive this payment');
      expect(recipientClarification?.suggestedOptions?.length).toBeGreaterThan(0);
    });

    it('should ask targeted follow-up questions when amount is missing', async () => {
      const result = await agent.preparePayment(SCENARIO_AMBIGUOUS_MISSING_AMOUNT.instruction);

      expect(result.status).toBe('AMBIGUOUS_INPUT');
      expect(result.intent.isComplete).toBe(false);

      const amountClarification = result.intent.clarificationsNeeded.find(
        (c) => c.field === 'AMOUNT'
      );
      expect(amountClarification).toBeDefined();
      expect(amountClarification?.question).toContain('amount');
    });

    it('should ask targeted follow-up questions when token is missing', async () => {
      const result = await agent.preparePayment('send 100 to alice.pharos');

      expect(result.status).toBe('AMBIGUOUS_INPUT');
      const tokenClarification = result.intent.clarificationsNeeded.find(
        (c) => c.field === 'TOKEN'
      );
      expect(tokenClarification).toBeDefined();
      expect(tokenClarification?.question).toContain('token');
      expect(tokenClarification?.suggestedOptions).toContain('USDC (Native USD Coin)');
    });
  });

  // =========================================================================
  // Requirement 02: Validation of Recipient Format, Token Contract, and Balance
  // =========================================================================
  describe('Requirement 02: Multi-Vector On-Chain Validation', () => {
    it('should reject malformed recipient address formats', async () => {
      const result = await agent.preparePayment(SCENARIO_INVALID_RECIPIENT.instruction);

      expect(result.status).toBe('VALIDATION_FAILED');
      expect(result.validation?.isValid).toBe(false);
      const err = result.validation?.errors.find((e) => e.code.includes('RECIPIENT'));
      expect(err).toBeDefined();
    });

    it('should reject transfers exceeding sender available balance', async () => {
      const result = await agent.preparePayment(
        SCENARIO_INSUFFICIENT_BALANCE.instruction,
        testSender,
        SCENARIO_INSUFFICIENT_BALANCE.mockBalances
      );

      expect(result.status).toBe('VALIDATION_FAILED');
      expect(result.validation?.isValid).toBe(false);
      expect(result.validation?.hasSufficientBalance).toBe(false);
      const balanceErr = result.validation?.errors.find(
        (e) => e.code === 'INSUFFICIENT_TOKEN_BALANCE'
      );
      expect(balanceErr).toBeDefined();
      expect(balanceErr?.message).toContain('Insufficient USDC balance');
    });

    it('should validate token contract presence on Pharos Mainnet for ERC-20 transfers', async () => {
      const result = await agent.preparePayment(
        SCENARIO_VALID_TOKEN_TRANSFER.instruction,
        testSender,
        SCENARIO_VALID_TOKEN_TRANSFER.mockBalances
      );

      expect(result.validation?.isValid).toBe(true);
      expect(result.validation?.token?.address).toBe('0xc879c018db60520f4355c26ed1a6d572cdac1815');
    });
  });

  // =========================================================================
  // Requirement 03: Human-Readable Pre-Flight Summary
  // =========================================================================
  describe('Requirement 03: Pre-Flight Financial & Technical Summary', () => {
    it('should generate a detailed human-readable summary before producing the unsigned transaction', async () => {
      const result = await agent.preparePayment(
        SCENARIO_VALID_NATIVE_TRANSFER.instruction,
        testSender
      );

      expect(result.status).toBe('READY_FOR_SIGNATURE');
      expect(result.summary).toBeDefined();

      const summary = result.summary!;
      expect(summary.summaryId).toMatch(/^sum-/);
      expect(summary.sender).toBe(testSender);
      expect(summary.recipient.rawInput).toBe('alice.pharos');
      expect(summary.recipient.resolvedAddress).toBe('0xa0c048d1afb32de4e4b8756a55e22fde5c74e932');
      expect(summary.asset.symbol).toBe('PROS');
      expect(summary.asset.amount).toBe(0.05);

      // Fiat estimation via Chainlink
      expect(summary.fiatEstimation.oraclePriceUsd).toBeGreaterThan(1000);
      expect(summary.fiatEstimation.totalUsdValue).toBeGreaterThan(0);

      // Network fee & balance projection
      expect(summary.networkFee.estimatedGasLimit).toBe(21000n);
      expect(parseFloat(summary.networkFee.estimatedFeePros)).toBeGreaterThan(0);
      expect(summary.balanceProjection.currentBalance).toBeGreaterThan(0);
      expect(summary.balanceProjection.postTransferBalance).toBeLessThan(
        summary.balanceProjection.currentBalance
      );
    });
  });

  // =========================================================================
  // Requirement 04: Never Signs or Sends. Emits Unsigned Tx / Signing Request
  // =========================================================================
  describe('Requirement 04: Non-Custodial Invariant & Unsigned Payload Generation', () => {
    it('should output strictly an unsigned transaction and wallet signing request with zero private key handling', async () => {
      const result = await agent.preparePayment(
        SCENARIO_VALID_TOKEN_TRANSFER.instruction,
        testSender,
        SCENARIO_VALID_TOKEN_TRANSFER.mockBalances
      );

      expect(result.status).toBe('READY_FOR_SIGNATURE');
      expect(result.unsignedTransaction).toBeDefined();
      expect(result.signingRequest).toBeDefined();

      const unsigned = result.unsignedTransaction!;
      expect(unsigned.chainId).toBe(1672); // Pharos Mainnet
      expect(unsigned.from).toBe(testSender);
      expect(unsigned.to).toBe('0xc879c018db60520f4355c26ed1a6d572cdac1815'); // USDC Contract
      expect(unsigned.data).toMatch(/^0xa9059cbb/); // ERC-20 transfer selector
      expect(unsigned.value).toBe('0x0');
      expect(unsigned.gas).toBeDefined();

      // Ensure no signature or private key leaks
      expect((unsigned as any).signature).toBeUndefined();
      expect((unsigned as any).v).toBeUndefined();
      expect((unsigned as any).r).toBeUndefined();
      expect((unsigned as any).s).toBeUndefined();

      // Wallet signing request
      const req = result.signingRequest!;
      expect(req.method).toBe('eth_sendTransaction');
      expect(req.signingProtocol).toBe('EIP-1193');
      expect(req.warningNotice).toContain('NON-CUSTODIAL AGENT INVARIANT');
      expect(req.foundryCastCommand).toContain('cast send');
      expect(req.foundryCastCommand).toContain('0xc879c018db60520f4355c26ed1a6d572cdac1815');
    });
  });
});
