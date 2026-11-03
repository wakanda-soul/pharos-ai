import { encodeFunctionData, parseAbi } from 'viem';
import { SwitchingFrictionCalculator } from './friction-calculator.js';
import {
  ItemizedSwitchingFriction,
  RebalanceDecision,
  RebalanceEvaluationConfig,
  RebalanceEvaluationReport,
  UnsignedRebalanceTransaction,
  YieldVenueRecord,
} from './types.js';
import { YieldVenueReader } from './yield-reader.js';

const ERC4626_ABI = parseAbi([
  'function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)',
  'function deposit(uint256 assets, address receiver) external returns (uint256 shares)',
]);

export const DEFAULT_OPTIMIZER_CONFIG: RebalanceEvaluationConfig = {
  minimumHoldingPeriodDays: 30,
  minimumNetGainHurdleUsd: 25.0, // Minimum $25 net profit to justify operational friction
};

/**
 * YieldOptimizerEngine
 * 
 * Autonomous cross-protocol yield surveillance and capital rebalance optimizer.
 * Compares >= 3 yield sources, amortizes switching friction over holding horizons,
 * gates decisions behind net profit hurdles, and prepares unsigned calldata payloads.
 */
export class YieldOptimizerEngine {
  private readonly reader: YieldVenueReader;
  private readonly frictionCalculator: SwitchingFrictionCalculator;
  private readonly config: RebalanceEvaluationConfig;

  constructor(
    customReader?: YieldVenueReader,
    customFrictionCalculator?: SwitchingFrictionCalculator,
    customConfig?: Partial<RebalanceEvaluationConfig>
  ) {
    this.reader = customReader ?? new YieldVenueReader();
    this.frictionCalculator = customFrictionCalculator ?? new SwitchingFrictionCalculator();
    this.config = {
      ...DEFAULT_OPTIMIZER_CONFIG,
      ...(customConfig ?? {}),
    };
  }

  /**
   * Evaluates capital migration from a current source venue to a specific target venue.
   */
  public evaluateMigrationPair(
    capitalAmountUsd: number,
    holdingPeriodDays: number,
    sourceVenue: YieldVenueRecord,
    targetVenue: YieldVenueRecord,
    userWalletAddress: `0x${string}` = '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E'
  ): RebalanceEvaluationReport {
    if (capitalAmountUsd <= 0) {
      throw new Error(`[YieldOptimizerEngine] Capital amount must be positive. Received: ${capitalAmountUsd}`);
    }

    if (holdingPeriodDays <= 0) {
      throw new Error(`[YieldOptimizerEngine] Holding period days must be positive. Received: ${holdingPeriodDays}`);
    }

    const evaluationId = `opt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const evaluatedAtIso = new Date().toISOString();

    // 1. Gross APY spread
    const grossApySpread = Number((targetVenue.apyPercent - sourceVenue.apyPercent).toFixed(2));

    // 2. Projected Gross Incremental Gain over holding horizon (Holding Period Amortization - Req 02)
    // Formula: Capital * (Spread / 100) * (HoldingDays / 365)
    const annualSpreadFactor = grossApySpread / 100;
    const timeFraction = holdingPeriodDays / 365;
    const projectedGrossGainUsd = Number((capitalAmountUsd * annualSpreadFactor * timeFraction).toFixed(2));

    // 3. Switching Friction (Exit fee + Entry fee + Gas - Req 02)
    const switchingFriction = this.frictionCalculator.calculateFriction(
      capitalAmountUsd,
      sourceVenue,
      targetVenue
    );

    // 4. Net Profit & Annualized ROI
    const projectedNetGainUsd = Number((projectedGrossGainUsd - switchingFriction.totalFrictionUsd).toFixed(2));
    const netAnnualizedRoiPercent = Number(
      (((projectedNetGainUsd / capitalAmountUsd) * (365 / holdingPeriodDays)) * 100).toFixed(2)
    );

    // 5. Break-Even Holding Horizon in Days
    // Daily incremental gain = Capital * (Spread / 100 / 365)
    const dailyIncrementalGross = capitalAmountUsd * (annualSpreadFactor / 365);
    const breakEvenDays =
      dailyIncrementalGross > 0
        ? Math.ceil(switchingFriction.totalFrictionUsd / dailyIncrementalGross)
        : 999999;

    // 6. Decision Gating (Requirement 03: Clear recommendation or Stay Put)
    let decision: RebalanceDecision = 'STAY_PUT';
    let decisionRationale = '';
    const preparedTransactions: UnsignedRebalanceTransaction[] = [];

    if (grossApySpread <= 0) {
      decision = 'STAY_PUT';
      decisionRationale = `Stay put: Target vault '${targetVenue.vaultName}' (${targetVenue.apyPercent}% APY) does not offer a higher yield than current vault '${sourceVenue.vaultName}' (${sourceVenue.apyPercent}% APY). Gross spread is ${grossApySpread}%.`;
    } else if (holdingPeriodDays < breakEvenDays || projectedNetGainUsd <= 0) {
      decision = 'STAY_PUT';
      decisionRationale = `Stay put: Planned holding horizon of ${holdingPeriodDays} days is too short to amortize $${switchingFriction.totalFrictionUsd.toFixed(2)} USD in switching friction (exit fee, entry fee, and gas). Moving funds requires at least ${breakEvenDays} days to break even; currently projects a net loss of $${Math.abs(projectedNetGainUsd).toFixed(2)} USD.`;
    } else if (projectedNetGainUsd < this.config.minimumNetGainHurdleUsd) {
      decision = 'STAY_PUT';
      decisionRationale = `Stay put: Projected net gain of +$${projectedNetGainUsd.toFixed(2)} USD is positive, but fails to clear the configured minimum threshold hurdle of $${this.config.minimumNetGainHurdleUsd.toFixed(2)} USD for operational execution.`;
    } else {
      decision = 'REBALANCE_RECOMMENDED';
      decisionRationale = `Rebalance recommended: Moving $${capitalAmountUsd.toLocaleString('en-US')} USD from ${sourceVenue.protocolName} (${sourceVenue.apyPercent}% APY) to ${targetVenue.protocolName} (${targetVenue.apyPercent}% APY) yields an expected net gain of +$${projectedNetGainUsd.toFixed(2)} USD over ${holdingPeriodDays} days after deducting $${switchingFriction.totalFrictionUsd.toFixed(2)} USD in fees and gas. Break-even achieved in ${breakEvenDays} days.`;

      // Synthesize Unsigned Transactions (Requirement 04: Non-custodial)
      preparedTransactions.push(
        ...this.synthesizeUnsignedRebalanceTransactions(
          capitalAmountUsd,
          sourceVenue,
          targetVenue,
          userWalletAddress
        )
      );
    }

    return {
      evaluationId,
      sourceVenue,
      targetVenue,
      capitalAmountUsd,
      holdingPeriodDays,
      grossApySpread,
      projectedGrossGainUsd,
      switchingFriction,
      projectedNetGainUsd,
      netAnnualizedRoiPercent,
      breakEvenDays,
      decision,
      decisionRationale,
      preparedTransactions,
      agentHoldsKeys: false, // Strictly non-custodial guarantee (Req 04)
      evaluatedAtIso,
    };
  }

  /**
   * Synthesizes unsigned calldata payloads ready for user signature.
   * Requirement 04: The agent never holds keys.
   */
  public synthesizeUnsignedRebalanceTransactions(
    capitalAmountUsd: number,
    sourceVenue: YieldVenueRecord,
    targetVenue: YieldVenueRecord,
    userWalletAddress: `0x${string}`
  ): UnsignedRebalanceTransaction[] {
    const rawAssetUnits = BigInt(Math.floor(capitalAmountUsd * 1e6)); // 6 decimals for USDC

    // Transaction 1: Withdraw from source vault
    const withdrawCalldata = encodeFunctionData({
      abi: ERC4626_ABI,
      functionName: 'withdraw',
      args: [rawAssetUnits, userWalletAddress, userWalletAddress],
    });

    const step1: UnsignedRebalanceTransaction = {
      stepIndex: 1,
      actionDescription: `Redeem and withdraw $${capitalAmountUsd.toLocaleString('en-US')} USDC principal from ${sourceVenue.vaultName}`,
      targetContract: sourceVenue.contractAddress,
      functionName: 'withdraw(uint256,address,address)',
      calldata: withdrawCalldata,
      valueWei: '0',
      estimatedGasUnits: 160000,
      castCommand: `cast send ${sourceVenue.contractAddress} "withdraw(uint256,address,address)" ${rawAssetUnits} ${userWalletAddress} ${userWalletAddress} --rpc-url https://rpc.pharos.xyz`,
    };

    // Transaction 2: Deposit into target vault
    const depositCalldata = encodeFunctionData({
      abi: ERC4626_ABI,
      functionName: 'deposit',
      args: [rawAssetUnits, userWalletAddress],
    });

    const step2: UnsignedRebalanceTransaction = {
      stepIndex: 2,
      actionDescription: `Supply and deposit $${capitalAmountUsd.toLocaleString('en-US')} USDC into ${targetVenue.vaultName}`,
      targetContract: targetVenue.contractAddress,
      functionName: 'deposit(uint256,address)',
      calldata: depositCalldata,
      valueWei: '0',
      estimatedGasUnits: 160000,
      castCommand: `cast send ${targetVenue.contractAddress} "deposit(uint256,address)" ${rawAssetUnits} ${userWalletAddress} --rpc-url https://rpc.pharos.xyz`,
    };

    return [step1, step2];
  }

  /**
   * Compares all available yield venues against current position and recommends best rebalance.
   * Requirement 01: Compares at least 3 yield sources.
   */
  public async findOptimalRebalance(
    sourceVenueId: string,
    capitalAmountUsd: number,
    holdingPeriodDays: number,
    userWalletAddress: `0x${string}` = '0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E'
  ): Promise<{
    bestOpportunity?: RebalanceEvaluationReport;
    allEvaluations: RebalanceEvaluationReport[];
  }> {
    const allVenues = await this.reader.getAvailableYieldVenues('USDC');
    const sourceVenue = allVenues.find((v) => v.venueId === sourceVenueId);

    if (!sourceVenue) {
      throw new Error(`[YieldOptimizerEngine] Current source venue '${sourceVenueId}' not found among live venues`);
    }

    const candidateVenues = allVenues.filter((v) => v.venueId !== sourceVenueId);
    const allEvaluations: RebalanceEvaluationReport[] = [];

    for (const targetVenue of candidateVenues) {
      const evaluation = this.evaluateMigrationPair(
        capitalAmountUsd,
        holdingPeriodDays,
        sourceVenue,
        targetVenue,
        userWalletAddress
      );
      allEvaluations.push(evaluation);
    }

    // Sort by projected net gain descending
    const recommendedOpportunities = allEvaluations
      .filter((e) => e.decision === 'REBALANCE_RECOMMENDED')
      .sort((a, b) => b.projectedNetGainUsd - a.projectedNetGainUsd);

    const bestOpportunity =
      recommendedOpportunities.length > 0 ? recommendedOpportunities[0] : allEvaluations[0];

    return {
      bestOpportunity,
      allEvaluations,
    };
  }

  public getReader(): YieldVenueReader {
    return this.reader;
  }

  public getFrictionCalculator(): SwitchingFrictionCalculator {
    return this.frictionCalculator;
  }
}
