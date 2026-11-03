/**
 * Task 28: x402 Agent Buyer
 * Audit Journal: immutable chronological ledger of all agent API purchases,
 * price disbursements, on-chain transaction hashes, running totals, and budget halts.
 */

import {
  ItemizedPaymentReceipt,
  SpendAuditJournalRecord,
  BudgetRejectionReason,
  JournalEntryDisposition,
} from './types.js';
import { roundToMicroUnits } from './budget-sentinel.js';

export class SpendAuditJournal {
  private readonly entries: SpendAuditJournalRecord[] = [];
  private readonly receiptsByIdempotencyKey: Map<string, ItemizedPaymentReceipt> = new Map();
  private readonly receiptsByTxHash: Map<string, ItemizedPaymentReceipt> = new Map();
  private runningTotalSpendUsdc: number = 0;
  private readonly totalBudgetCapUsdc: number;

  constructor(totalBudgetCapUsdc: number) {
    this.totalBudgetCapUsdc = roundToMicroUnits(totalBudgetCapUsdc);
  }

  /**
   * Current cumulative USDC debited across all successful settled transactions.
   */
  public getRunningTotalSpendUsdc(): number {
    return roundToMicroUnits(this.runningTotalSpendUsdc);
  }

  /**
   * Remaining spend capacity before hitting the hard budget ceiling.
   */
  public getRemainingBudgetUsdc(): number {
    return roundToMicroUnits(Math.max(0, this.totalBudgetCapUsdc - this.runningTotalSpendUsdc));
  }

  /**
   * Checks whether a purchase with the given idempotency token has already been settled.
   */
  public hasSettledIdempotencyKey(idempotencyKey: string): boolean {
    return this.receiptsByIdempotencyKey.has(idempotencyKey);
  }

  /**
   * Checks whether a transaction hash has already been credited to the ledger.
   */
  public hasSettledTransactionHash(txHash: string): boolean {
    return this.receiptsByTxHash.has(txHash.toLowerCase());
  }

  /**
   * Retrieves a settled receipt by idempotency key.
   */
  public getReceiptByIdempotencyKey(idempotencyKey: string): ItemizedPaymentReceipt | undefined {
    return this.receiptsByIdempotencyKey.get(idempotencyKey);
  }

  /**
   * Records a successfully settled payment into the immutable journal.
   * Updates the running spend tally and computes remaining budget.
   */
  public recordSettlement(receipt: ItemizedPaymentReceipt): SpendAuditJournalRecord {
    // Edge case check: never debit the same payment twice even if caller attempts duplicate entry
    if (this.receiptsByIdempotencyKey.has(receipt.idempotencyKey)) {
      const existing = this.receiptsByIdempotencyKey.get(receipt.idempotencyKey)!;
      return {
        sequenceIndex: this.entries.length + 1,
        timestampIso: new Date().toISOString(),
        endpointUrl: receipt.endpointUrl,
        whatItBought: receipt.whatItBought,
        chargedPriceUsdc: 0, // Deduplicated: no additional debit
        runningTotalSpendUsdc: this.getRunningTotalSpendUsdc(),
        remainingBudgetUsdc: this.getRemainingBudgetUsdc(),
        disposition: 'DEDUPLICATED_REPLAY_SKIPPED',
        transactionHash: existing.transactionHash,
        idempotencyKey: receipt.idempotencyKey,
        diagnosticNote: `Idempotent replay detected. Preserved previous transaction hash ${existing.transactionHash}. Zero additional debit applied.`,
      };
    }

    if (this.receiptsByTxHash.has(receipt.transactionHash.toLowerCase())) {
      throw new Error(
        `Critical ledger conflict: Transaction hash ${receipt.transactionHash} already exists in audit journal!`
      );
    }

    // Advance running tally
    this.runningTotalSpendUsdc = roundToMicroUnits(this.runningTotalSpendUsdc + receipt.chargedPriceUsdc);
    const newRemainingBudget = this.getRemainingBudgetUsdc();

    const record: SpendAuditJournalRecord = {
      sequenceIndex: this.entries.length + 1,
      timestampIso: receipt.settledAtIso,
      endpointUrl: receipt.endpointUrl,
      whatItBought: receipt.whatItBought,
      chargedPriceUsdc: receipt.chargedPriceUsdc,
      runningTotalSpendUsdc: this.getRunningTotalSpendUsdc(),
      remainingBudgetUsdc: newRemainingBudget,
      disposition: 'SETTLED',
      transactionHash: receipt.transactionHash,
      idempotencyKey: receipt.idempotencyKey,
      diagnosticNote: `Settled on Pharos Atlantic Testnet. Price $${receipt.chargedPriceUsdc.toFixed(4)} USDC. Total spend now $${this.getRunningTotalSpendUsdc().toFixed(4)} USDC.`,
    };

    this.entries.push(record);
    this.receiptsByIdempotencyKey.set(receipt.idempotencyKey, receipt);
    this.receiptsByTxHash.set(receipt.transactionHash.toLowerCase(), receipt);

    return record;
  }

  /**
   * Records a rejected or halted call in the journal for compliance visibility.
   */
  public recordHaltOrRejection(
    endpointUrl: string,
    whatItBought: string,
    priceUsdc: number,
    rejectionReason: BudgetRejectionReason,
    diagnosticNote: string,
    idempotencyKey: string
  ): SpendAuditJournalRecord {
    let disposition: JournalEntryDisposition = 'REJECTED_PRICE_CAP';
    if (rejectionReason === 'BUDGET_CEILING_EXHAUSTED') {
      disposition = 'HALTED_BUDGET_EXHAUSTED';
    } else if (rejectionReason === 'PER_CALL_PRICE_CAP_EXCEEDED') {
      disposition = 'REJECTED_PRICE_CAP';
    } else {
      disposition = 'FAILED_RPC_ABORTED';
    }

    const record: SpendAuditJournalRecord = {
      sequenceIndex: this.entries.length + 1,
      timestampIso: new Date().toISOString(),
      endpointUrl,
      whatItBought,
      chargedPriceUsdc: 0, // No funds debited on refusal
      runningTotalSpendUsdc: this.getRunningTotalSpendUsdc(),
      remainingBudgetUsdc: this.getRemainingBudgetUsdc(),
      disposition,
      idempotencyKey,
      diagnosticNote,
    };

    this.entries.push(record);
    return record;
  }

  /**
   * Returns an unmodifiable snapshot of the entire journal history.
   */
  public getJournalSnapshot(): readonly SpendAuditJournalRecord[] {
    return Object.freeze([...this.entries]);
  }

  /**
   * Returns count of settled transactions.
   */
  public getSettledTransactionCount(): number {
    return this.receiptsByIdempotencyKey.size;
  }
}
