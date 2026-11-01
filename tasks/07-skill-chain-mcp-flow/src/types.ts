/**
 * Task 07: Skill + Chain MCP Flow Types & Models
 * Defines data structures flowing between Chain MCP, SkillEngine, and Orchestrator.
 */

export interface ChainTelemetry {
  network: string;
  chainId: number;
  blockNumber: number;
  blockTimestamp: number;
  treasuryAddress: `0x${string}`;
  nativeBalanceWei: string;
  nativeBalancePros: number;
  usdcBalanceRaw: string;
  usdcBalanceUnits: number;
  gasPriceGwei: number;
  totalValuationUsd: number;
}

export interface TreasuryPolicy {
  targetUsdcRatio: number; // e.g. 0.60 for 60% USDC
  targetProsRatio: number; // e.g. 0.40 for 40% PROS
  toleranceBandPct: number; // e.g. 5.0 for +/- 5% drift tolerance
  minimumReserveUsd: number; // e.g. 500 USD floor
  assumedProsPriceUsd: number; // e.g. 1.25 USD per PROS
}

export type SkillDecisionVerdict =
  | 'IN_EQUILIBRIUM'
  | 'REBALANCE_NEEDED'
  | 'EMERGENCY_REPLENISH'
  | 'CAPITAL_IDLE_SURPLUS';

export interface SkillRebalanceAction {
  type: 'SWAP_PROS_TO_USDC' | 'SWAP_USDC_TO_PROS' | 'DEPOSIT_HARBOR_YIELD' | 'NONE';
  tokenIn: string;
  tokenOut: string;
  amountUnits: number;
  formattedAmount: string;
  rationale: string;
  estimatedTargetRatioAfter: string;
}

export interface SkillDecision {
  verdict: SkillDecisionVerdict;
  policySummary: {
    targetRatio: string;
    actualRatio: string;
    driftPercentage: number;
    driftExceedsTolerance: boolean;
  };
  explanation: string;
  actionRequired: boolean;
  rebalanceAction?: SkillRebalanceAction;
  riskEvaluation: {
    reserveHealth: 'HEALTHY' | 'CRITICAL_LOW' | 'SURPLUS';
    volatilityBuffer: string;
    gasCondition: 'FAVORABLE' | 'ELEVATED';
  };
}

export interface PreparedExecution {
  targetContract: `0x${string}`;
  methodSignature: string;
  calldata: `0x${string}`;
  valueHex: string;
  estimatedGas: string;
  castCommand: string;
  humanDescription: string;
}

export interface FlowTraceStep {
  stepNumber: number;
  component: 'Chain MCP' | 'SkillEngine' | 'Flow Orchestrator';
  action: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  timestamp: string;
}

export interface FlowResult {
  executionId: string;
  executedAt: string;
  treasuryAddress: `0x${string}`;
  telemetry: ChainTelemetry;
  decision: SkillDecision;
  preparedExecution?: PreparedExecution;
  trace: FlowTraceStep[];
}
