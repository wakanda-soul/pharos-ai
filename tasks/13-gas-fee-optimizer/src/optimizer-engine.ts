import {
  PublicClient,
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  formatEther,
  parseGwei,
} from 'viem';
import {
  QueuedTransaction,
  ExecutionPostMortem,
  ExecutionTrigger,
  OptimizationStrategy,
  GasSnapshot,
} from './types.js';
import { GasTrackerOracle } from './gas-oracle.js';
import { ReservationCurveCalculator } from './reservation-curve.js';

const ORACLE_ADDRESS: `0x${string}` = '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8';
const ORACLE_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

export class GasFeeOptimizerEngine {
  private oracle: GasTrackerOracle;
  private client: PublicClient;

  constructor(oracle?: GasTrackerOracle, client?: PublicClient) {
    this.oracle = oracle ?? new GasTrackerOracle();
    this.client =
      client ??
      createPublicClient({
        transport: http('https://rpc.pharos.xyz', {
          retryCount: 5,
          retryDelay: 1000,
        }),
      });
  }

  /**
   * Accepts a transaction with a deadline and holds it until gas is favorable or the deadline is reached.
   * Runs in simulated tick mode when ticks are provided, or polls live network if running autonomously.
   */
  async processTransaction(
    tx: QueuedTransaction,
    customTicks?: Array<{ timestampMs: number; gasPriceGwei: number }>
  ): Promise<ExecutionPostMortem> {
    const trajectory: ExecutionPostMortem['priceTrajectory'] = [];
    let trigger: ExecutionTrigger | null = null;
    let executionTimestampMs = tx.createdAt;
    let executedGasPrice = tx.requestGasPriceGwei;

    const oraclePriceUsd = await this.fetchOraclePriceUsd();

    // If ticks provided (simulation / test / benchmark)
    if (customTicks && customTicks.length > 0) {
      for (const tick of customTicks) {
        // Record into history
        this.oracle.addSnapshot({
          blockNumber: 21938000n,
          timestamp: new Date(tick.timestampMs).toISOString(),
          gasPriceGwei: tick.gasPriceGwei,
        });

        const stats = this.oracle.getMarketStats();
        const reservationPrice = ReservationCurveCalculator.calculateReservationPrice(
          tx.createdAt,
          tx.deadline,
          tick.timestampMs,
          stats,
          tx.strategy
        );

        const isDeadlineReached = tick.timestampMs >= tx.deadline - (tx.strategy.safetyMarginMs ?? 2000);
        const isFavorable = tick.gasPriceGwei <= reservationPrice;

        if (isDeadlineReached) {
          trigger = 'DEADLINE_FORCED';
          executionTimestampMs = tick.timestampMs;
          executedGasPrice = tick.gasPriceGwei;
          trajectory.push({
            timestamp: new Date(tick.timestampMs).toISOString(),
            gasPriceGwei: tick.gasPriceGwei,
            reservationTargetGwei: reservationPrice,
            isExecutionPoint: true,
          });
          break;
        } else if (isFavorable) {
          trigger = 'OPPORTUNISTIC_DIP';
          executionTimestampMs = tick.timestampMs;
          executedGasPrice = tick.gasPriceGwei;
          trajectory.push({
            timestamp: new Date(tick.timestampMs).toISOString(),
            gasPriceGwei: tick.gasPriceGwei,
            reservationTargetGwei: reservationPrice,
            isExecutionPoint: true,
          });
          break;
        } else {
          // Still waiting
          trajectory.push({
            timestamp: new Date(tick.timestampMs).toISOString(),
            gasPriceGwei: tick.gasPriceGwei,
            reservationTargetGwei: reservationPrice,
            isExecutionPoint: false,
          });
        }
      }

      // If loop exhausted without trigger, force deadline submission
      if (!trigger) {
        trigger = 'DEADLINE_FORCED';
        executionTimestampMs = tx.deadline;
        const latest = this.oracle.getLatest();
        executedGasPrice = latest ? latest.gasPriceGwei : tx.requestGasPriceGwei;
      }
    } else {
      // Live evaluation: evaluate current block gas
      const snapshot = await this.oracle.recordCurrentNetworkGas();
      const stats = this.oracle.getMarketStats();
      const now = Date.now();
      const reservationPrice = ReservationCurveCalculator.calculateReservationPrice(
        tx.createdAt,
        tx.deadline,
        now,
        stats,
        tx.strategy
      );

      const isDeadlineReached = now >= tx.deadline - (tx.strategy.safetyMarginMs ?? 2000);
      const isFavorable = snapshot.gasPriceGwei <= reservationPrice;

      if (isDeadlineReached) {
        trigger = 'DEADLINE_FORCED';
      } else if (isFavorable) {
        trigger = 'OPPORTUNISTIC_DIP';
      } else {
        trigger = 'IMMEDIATE_MATCH';
      }

      executionTimestampMs = now;
      executedGasPrice = snapshot.gasPriceGwei;
      trajectory.push({
        timestamp: new Date(now).toISOString(),
        gasPriceGwei: snapshot.gasPriceGwei,
        reservationTargetGwei: reservationPrice,
        isExecutionPoint: true,
      });
    }

    // =========================================================================
    // Financial Cost Calculation (Requirement 03)
    // =========================================================================
    const gasUnits = tx.gasLimit;
    const requestCostWei = gasUnits * parseGwei(tx.requestGasPriceGwei.toString());
    const actualCostWei = gasUnits * parseGwei(executedGasPrice.toString());

    const costAtRequestPros = formatEther(requestCostWei);
    const actualCostPaidPros = formatEther(actualCostWei);

    const gasSavedGwei = parseFloat((tx.requestGasPriceGwei - executedGasPrice).toFixed(3));
    const gasSavedPercentage =
      tx.requestGasPriceGwei > 0
        ? parseFloat((((tx.requestGasPriceGwei - executedGasPrice) / tx.requestGasPriceGwei) * 100).toFixed(2))
        : 0;

    const prosSavedWei = requestCostWei - actualCostWei;
    const prosSaved = formatEther(prosSavedWei);
    const usdSaved = parseFloat(prosSaved) * oraclePriceUsd;

    const waitingMs = Math.max(0, executionTimestampMs - tx.createdAt);
    const remainingMs = Math.max(0, tx.deadline - executionTimestampMs);

    // Build Foundry Cast command for execution
    const castParts = [
      'cast send',
      tx.to,
      `--from ${tx.from}`,
      `--gas-price ${parseGwei(executedGasPrice.toString()).toString()}`,
      `--gas-limit ${tx.gasLimit.toString()}`,
      `--value ${tx.value.toString()}`,
      `--rpc-url https://rpc.pharos.xyz`,
    ];
    if (tx.data && tx.data !== '0x') {
      castParts.push(`--data "${tx.data}"`);
    }

    return {
      txId: tx.txId,
      trigger,
      status: 'SUBMITTED',
      requestTimestamp: new Date(tx.createdAt).toISOString(),
      executionTimestamp: new Date(executionTimestampMs).toISOString(),
      durationWaitingMs: waitingMs,
      deadlineMs: tx.deadline,
      timeRemainingAtExecutionMs: remainingMs,
      requestGasPriceGwei: tx.requestGasPriceGwei,
      executedGasPriceGwei: executedGasPrice,
      gasUnitsUsed: tx.gasLimit,
      costAtRequestPros,
      actualCostPaidPros,
      gasSavedGwei,
      gasSavedPercentage,
      prosSaved,
      usdSaved,
      oraclePriceUsd,
      castCommand: castParts.join(' '),
      priceTrajectory: trajectory,
    };
  }

  getOracle(): GasTrackerOracle {
    return this.oracle;
  }

  private async fetchOraclePriceUsd(): Promise<number> {
    try {
      const data = await this.client.readContract({
        address: ORACLE_ADDRESS,
        abi: ORACLE_ABI,
        functionName: 'latestRoundData',
      });
      const [, answerRaw] = data as [bigint, bigint, bigint, bigint, bigint];
      return parseFloat(formatUnits(answerRaw, 18));
    } catch {
      return 2283.43; // Standard fallback
    }
  }
}
