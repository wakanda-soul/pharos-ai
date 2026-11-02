import { sha256, toHex } from 'viem';

export interface LockValidationResult {
  allowed: boolean;
  reason?: string;
}

export class IdempotencyLockManager {
  private paidHashes: Set<string> = new Set();
  private activeLocks: Set<string> = new Set();
  private failedHashes: Map<string, string> = new Map(); // hash -> failure reason

  /**
   * Generates a deterministic SHA-256 idempotency key for a specific payment installment slot.
   */
  static generateSlotHash(
    scheduleId: string,
    periodIndex: number,
    scheduledDateIso: string,
    recipient: string,
    amount: number
  ): string {
    const raw = `${scheduleId}#${periodIndex}:${scheduledDateIso.slice(0, 10)}:${recipient.toLowerCase()}:${amount.toFixed(6)}`;
    return sha256(toHex(raw));
  }

  /**
   * Evaluates whether a payment installment can be safely processed without double-paying.
   */
  canProcessSlot(idempotencyHash: string): LockValidationResult {
    if (this.paidHashes.has(idempotencyHash)) {
      return {
        allowed: false,
        reason: 'CRITICAL_SECURITY_REJECTION: Slot has already been executed and marked as PAID. Re-execution blocked to prevent duplicate billing.',
      };
    }

    if (this.activeLocks.has(idempotencyHash)) {
      return {
        allowed: false,
        reason: 'CONCURRENCY_LOCK_ACTIVE: Another execution thread is currently processing this installment.',
      };
    }

    return { allowed: true };
  }

  /**
   * Acquires a transient lock for processing.
   */
  acquireLock(idempotencyHash: string): boolean {
    const check = this.canProcessSlot(idempotencyHash);
    if (!check.allowed) return false;
    this.activeLocks.add(idempotencyHash);
    return true;
  }

  /**
   * Releases transient lock (e.g. after a failure or check completion).
   */
  releaseLock(idempotencyHash: string): void {
    this.activeLocks.delete(idempotencyHash);
  }

  /**
   * Immutably marks a slot as PAID upon verified on-chain execution.
   */
  markPaid(idempotencyHash: string): void {
    this.activeLocks.delete(idempotencyHash);
    this.paidHashes.add(idempotencyHash);
  }

  /**
   * Records failure reason for an installment slot without marking it paid.
   */
  recordFailure(idempotencyHash: string, reason: string): void {
    this.activeLocks.delete(idempotencyHash);
    this.failedHashes.set(idempotencyHash, reason);
  }

  isPaid(idempotencyHash: string): boolean {
    return this.paidHashes.has(idempotencyHash);
  }

  isFailed(idempotencyHash: string): boolean {
    return this.failedHashes.has(idempotencyHash);
  }

  clear(): void {
    this.paidHashes.clear();
    this.activeLocks.clear();
    this.failedHashes.clear();
  }
}
