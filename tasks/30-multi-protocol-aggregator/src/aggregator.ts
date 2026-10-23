import { ProtocolAdapter } from './adapters/base-adapter.js';
import { HarborAdapter } from './adapters/harbor-adapter.js';
import { MorphoAdapter } from './adapters/morpho-adapter.js';
import { FaroSwapAdapter } from './adapters/faroswap-adapter.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { YieldRouter } from './router.js';
import {
  ProtocolId,
  ProtocolVenue,
  UserPosition,
  UnsignedTransaction,
  RoutingPreference,
  RoutingResult,
  ProtocolHealthStatus,
} from './types.js';

export interface AggregatorOptions {
  circuitBreaker?: CircuitBreaker;
  router?: YieldRouter;
  adapters?: ProtocolAdapter[];
}

export class MultiProtocolAggregator {
  private adapters: Map<ProtocolId, ProtocolAdapter> = new Map();
  private circuitBreaker: CircuitBreaker;
  private router: YieldRouter;

  constructor(options: AggregatorOptions = {}) {
    this.circuitBreaker = options.circuitBreaker ?? new CircuitBreaker();
    this.router = options.router ?? new YieldRouter();

    if (options.adapters && options.adapters.length > 0) {
      for (const adapter of options.adapters) {
        this.adapters.set(adapter.protocolId, adapter);
      }
    } else {
      // Default to the 3 primary Pharos DeFi protocols
      const harbor = new HarborAdapter();
      const morpho = new MorphoAdapter();
      const faroswap = new FaroSwapAdapter();
      this.adapters.set(harbor.protocolId, harbor);
      this.adapters.set(morpho.protocolId, morpho);
      this.adapters.set(faroswap.protocolId, faroswap);
    }
  }

  /**
   * Returns current health of all protocol connections and circuit breaker states.
   */
  getHealthStatus(): ProtocolHealthStatus[] {
    const statuses: ProtocolHealthStatus[] = [];
    for (const [id, adapter] of this.adapters.entries()) {
      statuses.push(this.circuitBreaker.getHealth(id, adapter.protocolName));
    }
    return statuses;
  }

  /**
   * Simulates an outage of a specific protocol to verify circuit breaker isolation.
   */
  simulateFailure(protocolId: ProtocolId, isDown: boolean = true): void {
    this.circuitBreaker.simulateFailure(protocolId, isDown);
  }

  /**
   * Queries rates across all protocols concurrently with circuit breaker isolation.
   * If one protocol fails or is down, healthy protocols still return data smoothly.
   */
  async getAllRates(): Promise<{
    venues: ProtocolVenue[];
    degradedProtocols: Array<{ protocolId: ProtocolId; error: string }>;
  }> {
    const allVenues: ProtocolVenue[] = [];
    const degradedProtocols: Array<{ protocolId: ProtocolId; error: string }> = [];

    const tasks = Array.from(this.adapters.entries()).map(async ([protocolId, adapter]) => {
      const { result, error } = await this.circuitBreaker.execute(
        protocolId,
        () => adapter.fetchRates(),
        // Safe fallback if protocol fails
        async () => []
      );

      if (error && (!result || result.length === 0)) {
        degradedProtocols.push({ protocolId, error });
      }

      if (result && result.length > 0) {
        allVenues.push(...result);
      }
    });

    await Promise.allSettled(tasks);

    // Sort by APY descending
    allVenues.sort((a, b) => b.apyPercent - a.apyPercent);

    return {
      venues: allVenues,
      degradedProtocols,
    };
  }

  /**
   * Queries and aggregates user positions across all connected protocols.
   */
  async getUserPositions(userAddress: `0x${string}`): Promise<{
    positions: UserPosition[];
    totalDepositedUsd: number;
    totalEarnedUsd: number;
    weightedAverageApy: number;
    degradedProtocols: ProtocolId[];
  }> {
    const positions: UserPosition[] = [];
    const degradedProtocols: ProtocolId[] = [];

    const tasks = Array.from(this.adapters.entries()).map(async ([protocolId, adapter]) => {
      const { result, error } = await this.circuitBreaker.execute(
        protocolId,
        () => adapter.fetchPositions(userAddress),
        async () => []
      );

      if (error && (!result || result.length === 0)) {
        degradedProtocols.push(protocolId);
      }

      if (result && result.length > 0) {
        positions.push(...result);
      }
    });

    await Promise.allSettled(tasks);

    let totalDeposited = 0;
    let totalEarned = 0;
    let apyWeightSum = 0;

    for (const pos of positions) {
      totalDeposited += pos.depositedValueUsd;
      totalEarned += pos.earnedYieldUsd;
      apyWeightSum += pos.depositedValueUsd * pos.currentApyPercent;
    }

    const weightedApy = totalDeposited > 0 ? apyWeightSum / totalDeposited : 0;

    return {
      positions,
      totalDepositedUsd: totalDeposited,
      totalEarnedUsd: totalEarned,
      weightedAverageApy: parseFloat(weightedApy.toFixed(2)),
      degradedProtocols,
    };
  }

  /**
   * Routes user request to the best venue and prepares the deposit transaction.
   */
  async routeAndPrepareDeposit(
    preference: RoutingPreference,
    userAddress: `0x${string}` = '0x1000000000000000000000000000000000000001'
  ): Promise<RoutingResult> {
    const { venues } = await this.getAllRates();
    const routingResult = this.router.route(venues, preference);

    // Prepare the actual executable unsigned transaction
    const adapter = this.adapters.get(routingResult.bestVenue.protocolId);
    if (adapter) {
      const tx = await adapter.prepareDeposit(
        routingResult.bestVenue.id,
        preference.amountUsd.toString(),
        userAddress
      );
      routingResult.preparedDepositTx = tx;
    }

    return routingResult;
  }

  /**
   * Directly prepares an unsigned deposit transaction for a specific venue.
   */
  async prepareDeposit(
    venueId: string,
    amountUnits: string,
    userAddress: `0x${string}`
  ): Promise<UnsignedTransaction> {
    const protocolId = venueId.split(':')[0] as ProtocolId;
    const adapter = this.adapters.get(protocolId);
    if (!adapter) {
      throw new Error(`Protocol adapter for venue '${venueId}' not found`);
    }

    return adapter.prepareDeposit(venueId, amountUnits, userAddress);
  }

  /**
   * Directly prepares an unsigned withdrawal transaction for a specific venue.
   */
  async prepareWithdraw(
    venueId: string,
    amountUnits: string,
    userAddress: `0x${string}`
  ): Promise<UnsignedTransaction> {
    const protocolId = venueId.split(':')[0] as ProtocolId;
    const adapter = this.adapters.get(protocolId);
    if (!adapter) {
      throw new Error(`Protocol adapter for venue '${venueId}' not found`);
    }

    return adapter.prepareWithdraw(venueId, amountUnits, userAddress);
  }
}
