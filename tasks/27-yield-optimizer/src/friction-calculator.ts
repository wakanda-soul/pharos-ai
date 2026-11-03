import { ItemizedSwitchingFriction, YieldVenueRecord } from './types.js';

export const DEFAULT_GAS_PRICE_GWEI = 1.2;
export const DEFAULT_PROS_PRICE_USD = 1.48;
export const ESTIMATED_REBALANCE_GAS_UNITS = 320000; // 160k withdraw + 160k deposit

/**
 * SwitchingFrictionCalculator
 * 
 * Accurately models the true economic cost of migrating capital between DeFi vaults:
 *   1. Source vault exit/redemption fee
 *   2. Target vault entry/issuance fee
 *   3. EVM execution gas cost across withdraw + deposit transactions
 */
export class SwitchingFrictionCalculator {
  private readonly gasPriceGwei: number;
  private readonly prosPriceUsd: number;

  constructor(gasPriceGwei?: number, prosPriceUsd?: number) {
    this.gasPriceGwei = gasPriceGwei ?? DEFAULT_GAS_PRICE_GWEI;
    this.prosPriceUsd = prosPriceUsd ?? DEFAULT_PROS_PRICE_USD;
  }

  /**
   * Calculates itemized switching friction for moving capital between two venues.
   * Requirement 02: Accounts for gas, entry/exit fees.
   */
  public calculateFriction(
    capitalUsd: number,
    sourceVenue: YieldVenueRecord,
    targetVenue: YieldVenueRecord,
    customGasUnits?: number
  ): ItemizedSwitchingFriction {
    const gasUnits = customGasUnits ?? ESTIMATED_REBALANCE_GAS_UNITS;

    // 1. Source vault exit fee (bps / 10,000)
    const exitFeeUsd = Number(((capitalUsd * sourceVenue.exitFeeBps) / 10000).toFixed(2));

    // 2. Target vault entry fee (bps / 10,000)
    const entryFeeUsd = Number(((capitalUsd * targetVenue.entryFeeBps) / 10000).toFixed(2));

    // 3. EVM network gas cost in USD
    const totalGasPros = (gasUnits * this.gasPriceGwei * 1e-9);
    const gasCostUsd = Number((totalGasPros * this.prosPriceUsd).toFixed(4));

    const totalFrictionUsd = Number((exitFeeUsd + entryFeeUsd + gasCostUsd).toFixed(2));

    return {
      exitFeeBps: sourceVenue.exitFeeBps,
      exitFeeUsd,
      entryFeeBps: targetVenue.entryFeeBps,
      entryFeeUsd,
      estimatedGasUnits: gasUnits,
      gasPriceGwei: this.gasPriceGwei,
      gasCostUsd,
      totalFrictionUsd,
    };
  }

  public getGasPriceGwei(): number {
    return this.gasPriceGwei;
  }

  public getProsPriceUsd(): number {
    return this.prosPriceUsd;
  }
}
