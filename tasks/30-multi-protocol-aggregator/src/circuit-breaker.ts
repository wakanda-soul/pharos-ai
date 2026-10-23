import { CircuitState, ProtocolHealthStatus, ProtocolId } from './types.js';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // consecutive failures before tripping to OPEN (default 3)
  recoveryTimeMs?: number; // time in OPEN state before trying HALF_OPEN (default 30_000 ms)
}

export class CircuitBreaker {
  private states = new Map<ProtocolId, CircuitState>();
  private failureCounts = new Map<ProtocolId, number>();
  private lastFailureTimes = new Map<ProtocolId, number>();
  private lastSuccessTimes = new Map<ProtocolId, number>();
  private latencyHistory = new Map<ProtocolId, number[]>();
  private simulatedDown = new Set<ProtocolId>();

  readonly failureThreshold: number;
  readonly recoveryTimeMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryTimeMs = options.recoveryTimeMs ?? 30000;
  }

  /**
   * For testing & demonstration: simulate an outage of a specific protocol
   */
  simulateFailure(protocolId: ProtocolId, down: boolean = true): void {
    if (down) {
      this.simulatedDown.add(protocolId);
      this.states.set(protocolId, 'OPEN');
      this.failureCounts.set(protocolId, this.failureThreshold);
      this.lastFailureTimes.set(protocolId, Date.now());
    } else {
      this.simulatedDown.delete(protocolId);
      this.states.set(protocolId, 'CLOSED');
      this.failureCounts.set(protocolId, 0);
    }
  }

  /**
   * Checks if calls to the protocol are permitted.
   */
  isCallPermitted(protocolId: ProtocolId): boolean {
    if (this.simulatedDown.has(protocolId)) {
      return false;
    }

    const state = this.states.get(protocolId) || 'CLOSED';

    if (state === 'CLOSED') {
      return true;
    }

    if (state === 'OPEN') {
      const lastFail = this.lastFailureTimes.get(protocolId) || 0;
      if (Date.now() - lastFail > this.recoveryTimeMs) {
        // Cooldown period elapsed, allow one trial probe in HALF_OPEN
        this.states.set(protocolId, 'HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN allows single probe
    return true;
  }

  /**
   * Executes a protocol action with circuit breaker protection.
   */
  async execute<T>(
    protocolId: ProtocolId,
    action: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<{ result: T | null; error?: string; fromFallback?: boolean }> {
    if (!this.isCallPermitted(protocolId)) {
      if (fallback) {
        try {
          const fbResult = await fallback();
          return { result: fbResult, fromFallback: true, error: `Circuit breaker OPEN for ${protocolId}; served via fallback` };
        } catch {
          // Fallback also failed
        }
      }
      return {
        result: null,
        error: `Circuit for protocol '${protocolId}' is OPEN (isolated due to previous failures)`,
      };
    }

    const startTime = Date.now();
    try {
      if (this.simulatedDown.has(protocolId)) {
        throw new Error(`Simulated outage for protocol ${protocolId}`);
      }
      const result = await action();
      const elapsed = Date.now() - startTime;
      this.recordSuccess(protocolId, elapsed);
      return { result };
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      this.recordFailure(protocolId, elapsed);

      if (fallback) {
        try {
          const fbResult = await fallback();
          return {
            result: fbResult,
            fromFallback: true,
            error: `Primary failed (${err.message}); served via safe fallback`,
          };
        } catch {
          // ignore
        }
      }

      return {
        result: null,
        error: err?.message || String(err),
      };
    }
  }

  recordSuccess(protocolId: ProtocolId, latencyMs: number): void {
    this.failureCounts.set(protocolId, 0);
    this.states.set(protocolId, 'CLOSED');
    this.lastSuccessTimes.set(protocolId, Date.now());
    this.appendLatency(protocolId, latencyMs);
  }

  recordFailure(protocolId: ProtocolId, latencyMs: number): void {
    const current = (this.failureCounts.get(protocolId) || 0) + 1;
    this.failureCounts.set(protocolId, current);
    this.lastFailureTimes.set(protocolId, Date.now());
    this.appendLatency(protocolId, latencyMs);

    if (current >= this.failureThreshold) {
      this.states.set(protocolId, 'OPEN');
    }
  }

  private appendLatency(protocolId: ProtocolId, latencyMs: number): void {
    const history = this.latencyHistory.get(protocolId) || [];
    history.push(latencyMs);
    if (history.length > 20) history.shift();
    this.latencyHistory.set(protocolId, history);
  }

  getHealth(protocolId: ProtocolId, protocolName: string): ProtocolHealthStatus {
    const state = this.states.get(protocolId) || 'CLOSED';
    const failures = this.failureCounts.get(protocolId) || 0;
    const history = this.latencyHistory.get(protocolId) || [];
    const avgLatency = history.length > 0
      ? Math.round(history.reduce((a, b) => a + b, 0) / history.length)
      : 0;

    return {
      protocolId,
      protocolName,
      state,
      failureCount: failures,
      lastFailureTime: this.lastFailureTimes.get(protocolId),
      lastSuccessTime: this.lastSuccessTimes.get(protocolId),
      averageLatencyMs: avgLatency,
      isAvailable: state === 'CLOSED' || state === 'HALF_OPEN',
    };
  }
}
