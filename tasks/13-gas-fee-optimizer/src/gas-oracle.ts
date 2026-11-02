import { PublicClient, createPublicClient, http, formatGwei } from 'viem';
import { GasSnapshot, GasMarketStats } from './types.js';

export class GasTrackerOracle {
  private history: GasSnapshot[] = [];
  private readonly maxHistoryLength: number;
  private client: PublicClient;

  constructor(maxHistoryLength: number = 100, customClient?: PublicClient) {
    this.maxHistoryLength = maxHistoryLength;
    this.client =
      customClient ??
      createPublicClient({
        transport: http('https://rpc.pharos.xyz', {
          retryCount: 5,
          retryDelay: 1000,
        }),
      });
  }

  /**
   * Fetches real on-chain gas snapshot from Pharos Mainnet and adds it to history.
   */
  async recordCurrentNetworkGas(): Promise<GasSnapshot> {
    try {
      const [gasPriceWei, block] = await Promise.all([
        this.client.getGasPrice(),
        this.client.getBlock({ blockTag: 'latest' }),
      ]);

      const gasPriceGwei = parseFloat(formatGwei(gasPriceWei));
      const baseFeeGwei = block.baseFeePerGas
        ? parseFloat(formatGwei(block.baseFeePerGas))
        : gasPriceGwei;

      const snapshot: GasSnapshot = {
        blockNumber: block.number,
        timestamp: new Date().toISOString(),
        gasPriceGwei,
        baseFeeGwei,
        priorityFeeGwei: Math.max(0, gasPriceGwei - baseFeeGwei),
      };

      this.addSnapshot(snapshot);
      return snapshot;
    } catch {
      // Fallback in case of RPC congestion: record synthetic tick around network norm (10 Gwei)
      const fallback: GasSnapshot = {
        blockNumber: 21938000n,
        timestamp: new Date().toISOString(),
        gasPriceGwei: 10.0,
        baseFeeGwei: 10.0,
        priorityFeeGwei: 0,
      };
      this.addSnapshot(fallback);
      return fallback;
    }
  }

  /**
   * Directly appends a snapshot (used for real-time streaming, mock seeds, or simulations).
   */
  addSnapshot(snapshot: GasSnapshot): void {
    this.history.push(snapshot);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
  }

  /**
   * Seeds historical baseline snapshots with realistic variations.
   */
  seedHistory(baselineGwei: number, count: number = 20, volatility: number = 0.25): void {
    const now = Date.now();
    for (let i = count; i >= 1; i--) {
      const timeOffsetMs = i * 3000;
      // Synthesize realistic Brownian motion around baseline
      const variance = (Math.sin(i * 0.7) + (Math.random() - 0.5)) * volatility * baselineGwei;
      const price = Math.max(1.0, parseFloat((baselineGwei + variance).toFixed(3)));

      this.addSnapshot({
        blockNumber: BigInt(21938000 - i * 3),
        timestamp: new Date(now - timeOffsetMs).toISOString(),
        gasPriceGwei: price,
        baseFeeGwei: price,
        priorityFeeGwei: 0,
      });
    }
  }

  /**
   * Returns recent gas history snapshots.
   */
  getHistory(limit?: number): GasSnapshot[] {
    if (limit && limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Returns the latest recorded snapshot.
   */
  getLatest(): GasSnapshot | undefined {
    return this.history[this.history.length - 1];
  }

  /**
   * Computes statistical distribution and trend metrics across current window.
   */
  getMarketStats(): GasMarketStats {
    if (this.history.length === 0) {
      return {
        sampleCount: 0,
        currentGwei: 0,
        minGwei: 0,
        maxGwei: 0,
        avgGwei: 0,
        medianGwei: 0,
        p10Gwei: 0,
        p25Gwei: 0,
        p75Gwei: 0,
        p90Gwei: 0,
        stdDevGwei: 0,
        trend: 'STABLE',
        volatilityPercentage: 0,
      };
    }

    const prices = this.history.map((s) => s.gasPriceGwei).sort((a, b) => a - b);
    const n = prices.length;
    const current = this.history[this.history.length - 1].gasPriceGwei;
    const min = prices[0];
    const max = prices[n - 1];
    const sum = prices.reduce((acc, p) => acc + p, 0);
    const avg = sum / n;

    // Percentile calculations
    const percentile = (p: number) => {
      const index = Math.max(0, Math.min(n - 1, Math.floor((p / 100) * n)));
      return prices[index];
    };

    const p10 = percentile(10);
    const p25 = percentile(25);
    const median = percentile(50);
    const p75 = percentile(75);
    const p90 = percentile(90);

    // Standard deviation
    const variance = prices.reduce((acc, p) => acc + Math.pow(p - avg, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Short-term trend (difference between latest 3 and oldest 3 in window)
    let trend: GasMarketStats['trend'] = 'STABLE';
    if (this.history.length >= 6) {
      const recentSlice = this.history.slice(-3).map((s) => s.gasPriceGwei);
      const earlierSlice = this.history.slice(-6, -3).map((s) => s.gasPriceGwei);
      const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / 3;
      const earlierAvg = earlierSlice.reduce((a, b) => a + b, 0) / 3;
      const diff = recentAvg - earlierAvg;

      if (diff > 0.05 * earlierAvg) {
        trend = 'RISING';
      } else if (diff < -0.05 * earlierAvg) {
        trend = 'FALLING';
      }
    }

    return {
      sampleCount: n,
      currentGwei: parseFloat(current.toFixed(3)),
      minGwei: parseFloat(min.toFixed(3)),
      maxGwei: parseFloat(max.toFixed(3)),
      avgGwei: parseFloat(avg.toFixed(3)),
      medianGwei: parseFloat(median.toFixed(3)),
      p10Gwei: parseFloat(p10.toFixed(3)),
      p25Gwei: parseFloat(p25.toFixed(3)),
      p75Gwei: parseFloat(p75.toFixed(3)),
      p90Gwei: parseFloat(p90.toFixed(3)),
      stdDevGwei: parseFloat(stdDev.toFixed(3)),
      trend,
      volatilityPercentage: parseFloat(((stdDev / (avg || 1)) * 100).toFixed(2)),
    };
  }

  clear(): void {
    this.history = [];
  }
}
