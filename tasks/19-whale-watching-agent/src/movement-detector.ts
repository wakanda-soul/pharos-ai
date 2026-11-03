/**
 * Significance Threshold Evaluator for High-Volume Capital Flows.
 * Determines whether an on-chain transaction crosses alerting criteria
 * via global USD benchmarks, per-token nominal minimums, or whale-specific overrides.
 */

import { type SignificanceThresholdConfig, type TokenAssetProfile, type WhaleRawTransferPayload } from './types.js';
import { computeUsdValuation } from './token-registry.js';

export interface MovementSignificanceResult {
  readonly isSignificant: boolean;
  readonly computedValuationUsd: number;
  readonly triggeredThresholdRule?: string;
  readonly isSelfTransfer: boolean;
}

export const DEFAULT_SIGNIFICANCE_CONFIG: SignificanceThresholdConfig = {
  minimumUsdValuation: 50_000, // Standard $50k USD baseline
  perTokenMinimumVolume: {
    // 25,000 PROS (18 decimals)
    PROS: 25_000n * 10n ** 18n,
    // 50,000 USDC (6 decimals)
    USDC: 50_000n * 10n ** 6n,
    // 50,000 USDT (6 decimals)
    USDT: 50_000n * 10n ** 6n,
    // 20 WETH (18 decimals)
    WETH: 20n * 10n ** 18n,
  },
  suppressSelfTransfers: true,
  captureZeroValueContractInteractions: false,
};

export class WhaleMovementDetector {
  private thresholdConfig: SignificanceThresholdConfig;

  constructor(customConfig?: Partial<SignificanceThresholdConfig>) {
    this.thresholdConfig = {
      ...DEFAULT_SIGNIFICANCE_CONFIG,
      ...customConfig,
      perTokenMinimumVolume: {
        ...DEFAULT_SIGNIFICANCE_CONFIG.perTokenMinimumVolume,
        ...customConfig?.perTokenMinimumVolume,
      },
    };
  }

  /**
   * Updates threshold parameters dynamically at runtime
   */
  public updateThresholdConfig(newConfig: Partial<SignificanceThresholdConfig>): void {
    this.thresholdConfig = {
      ...this.thresholdConfig,
      ...newConfig,
      perTokenMinimumVolume: {
        ...this.thresholdConfig.perTokenMinimumVolume,
        ...newConfig.perTokenMinimumVolume,
      },
    };
  }

  public get currentConfig(): SignificanceThresholdConfig {
    return { ...this.thresholdConfig };
  }

  /**
   * Evaluates if a raw transaction payload meets or exceeds significance criteria.
   * Checks token amount threshold, USD valuation, and whale-specific overrides.
   */
  public evaluateMovement(
    transfer: WhaleRawTransferPayload,
    token: TokenAssetProfile,
    whaleCustomThresholdUsd?: number,
  ): MovementSignificanceResult {
    const isSelfTransfer = transfer.fromAddress.toLowerCase() === transfer.toAddress.toLowerCase();

    // Gotcha: Whales sometimes invoke contracts with 0-value to change approval/governance
    if (transfer.rawValue === 0n && !this.thresholdConfig.captureZeroValueContractInteractions) {
      return {
        isSignificant: false,
        computedValuationUsd: 0,
        isSelfTransfer,
      };
    }

    // Ignore circular wash or self-transfers if configured
    if (isSelfTransfer && this.thresholdConfig.suppressSelfTransfers) {
      return {
        isSignificant: false,
        computedValuationUsd: 0,
        isSelfTransfer: true,
      };
    }

    const valuationUsd = computeUsdValuation(transfer.rawValue, token);

    // Rule 1: Whale-specific custom USD threshold override takes highest priority
    if (whaleCustomThresholdUsd !== undefined && whaleCustomThresholdUsd > 0) {
      if (valuationUsd >= whaleCustomThresholdUsd) {
        return {
          isSignificant: true,
          computedValuationUsd: valuationUsd,
          triggeredThresholdRule: `Exceeded custom whale floor of $${whaleCustomThresholdUsd.toLocaleString()} (nominal $${valuationUsd.toLocaleString()})`,
          isSelfTransfer,
        };
      }
      return {
        isSignificant: false,
        computedValuationUsd: valuationUsd,
        isSelfTransfer,
      };
    }

    // Rule 2: Token-specific nominal base units threshold
    const tokenSymbolUpper = token.symbol.toUpperCase();
    const tokenMinimum = this.thresholdConfig.perTokenMinimumVolume?.[tokenSymbolUpper];
    if (tokenMinimum !== undefined && transfer.rawValue >= tokenMinimum) {
      return {
        isSignificant: true,
        computedValuationUsd: valuationUsd,
        triggeredThresholdRule: `Crossed nominal token quota of ${tokenSymbolUpper} minimum threshold`,
        isSelfTransfer,
      };
    }

    // Rule 3: Global USD valuation benchmark
    if (valuationUsd >= this.thresholdConfig.minimumUsdValuation) {
      return {
        isSignificant: true,
        computedValuationUsd: valuationUsd,
        triggeredThresholdRule: `Crossed global valuation threshold of $${this.thresholdConfig.minimumUsdValuation.toLocaleString()} USD`,
        isSelfTransfer,
      };
    }

    return {
      isSignificant: false,
      computedValuationUsd: valuationUsd,
      isSelfTransfer,
    };
  }
}
