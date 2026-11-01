import { ChainMcpReader } from './chain-mcp-reader.js';
import { SkillEngineEvaluator } from './skill-engine.js';
import {
  FlowResult,
  FlowTraceStep,
  TreasuryPolicy,
  PreparedExecution,
  SkillRebalanceAction,
} from './types.js';
import { encodeFunctionData, parseUnits, parseAbi } from 'viem';

const FAROSWAP_ROUTER: `0x${string}` = '0xba3b00c3b0632b6fa622f990924976725227b68a';
const USDC_ADDRESS: `0x${string}` = '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0';
const WPROS_ADDRESS: `0x${string}` = '0xd0cd44cbddfd3e8117769e6b66b3b55bb74fb9bb';

const ROUTER_ABI = parseAbi([
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
]);

export interface FlowOptions {
  treasuryAddress?: `0x${string}`;
  policy?: Partial<TreasuryPolicy>;
  chainReader?: ChainMcpReader;
  skillEvaluator?: SkillEngineEvaluator;
}

export class FlowOrchestrator {
  private chainReader: ChainMcpReader;
  private skillEvaluator: SkillEngineEvaluator;

  constructor(options: FlowOptions = {}) {
    this.chainReader = options.chainReader ?? new ChainMcpReader();
    this.skillEvaluator = options.skillEvaluator ?? new SkillEngineEvaluator();
  }

  /**
   * Runs the complete composed agent flow end-to-end from a single user invocation:
   * [Chain MCP Fetch] -> [SkillEngine Decision Evaluation] -> [Action Calldata Synthesis]
   */
  async runFlow(
    treasuryAddress: `0x${string}` = '0xa0c048d1afb32de4e4b8756a55e22fde5c74e932',
    customPolicy?: Partial<TreasuryPolicy>,
    mockBalances?: { pros?: number; usdc?: number }
  ): Promise<FlowResult> {
    const trace: FlowTraceStep[] = [];
    const executionId = `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();

    // -------------------------------------------------------------
    // Step 1: Chain MCP queries live blockchain state
    // -------------------------------------------------------------
    trace.push({
      stepNumber: 1,
      component: 'Chain MCP',
      action: 'Query on-chain live block, balances, and gas telemetry for treasury address',
      inputData: { treasuryAddress, targetContracts: [USDC_ADDRESS, 'native:PROS'], simulated: !!mockBalances },
      outputData: { status: 'PENDING' },
      timestamp: new Date().toISOString(),
    });

    const assumedPrice = customPolicy?.assumedProsPriceUsd ?? 1.25;
    const telemetry = await this.chainReader.fetchTreasuryTelemetry(treasuryAddress, assumedPrice, mockBalances);

    trace[0].outputData = {
      blockNumber: telemetry.blockNumber,
      nativePros: telemetry.nativeBalancePros,
      usdc: telemetry.usdcBalanceUnits,
      gasPriceGwei: telemetry.gasPriceGwei,
      totalUsd: telemetry.totalValuationUsd,
    };

    // -------------------------------------------------------------
    // Step 2: SkillEngine ingests Chain MCP telemetry and evaluates policy
    // -------------------------------------------------------------
    trace.push({
      stepNumber: 2,
      component: 'SkillEngine',
      action: 'Ingest live on-chain data and compute target-drift risk decision',
      inputData: {
        liveUsdc: telemetry.usdcBalanceUnits,
        livePros: telemetry.nativeBalancePros,
        totalValuationUsd: telemetry.totalValuationUsd,
        policy: customPolicy || 'Default 60:40 Policy',
      },
      outputData: { status: 'PENDING' },
      timestamp: new Date().toISOString(),
    });

    const decision = this.skillEvaluator.evaluate(telemetry, customPolicy);

    trace[1].outputData = {
      verdict: decision.verdict,
      driftPct: decision.policySummary.driftPercentage,
      actionRequired: decision.actionRequired,
      actionType: decision.rebalanceAction?.type || 'NONE',
    };

    // -------------------------------------------------------------
    // Step 3: Flow Orchestrator synthesizes executable transaction if needed
    // -------------------------------------------------------------
    let preparedExecution: PreparedExecution | undefined;

    if (decision.actionRequired && decision.rebalanceAction && decision.rebalanceAction.type !== 'NONE') {
      trace.push({
        stepNumber: 3,
        component: 'Flow Orchestrator',
        action: 'Synthesize executable calldata and Foundry cast command for rebalance action',
        inputData: {
          action: decision.rebalanceAction.type,
          amount: decision.rebalanceAction.formattedAmount,
        },
        outputData: { status: 'PENDING' },
        timestamp: new Date().toISOString(),
      });

      preparedExecution = this.buildPreparedExecution(
        decision.rebalanceAction,
        treasuryAddress
      );

      trace[2].outputData = {
        targetContract: preparedExecution.targetContract,
        method: preparedExecution.methodSignature,
        calldataLength: preparedExecution.calldata.length,
      };
    }

    return {
      executionId,
      executedAt: nowIso,
      treasuryAddress,
      telemetry,
      decision,
      preparedExecution,
      trace,
    };
  }

  private buildPreparedExecution(
    action: SkillRebalanceAction,
    treasuryAddress: `0x${string}`
  ): PreparedExecution {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

    if (action.type === 'SWAP_PROS_TO_USDC') {
      // PROS is native token -> swapExactETHForTokens on FaroSwap
      const amountInWei = parseUnits(action.amountUnits.toString(), 18);
      // Min output with 1.5% slippage
      const estimatedUsdcOut = parseUnits((action.amountUnits * 1.25 * 0.985).toFixed(0), 6);

      const calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [
          estimatedUsdcOut,
          [WPROS_ADDRESS, USDC_ADDRESS],
          treasuryAddress,
          deadline,
        ],
      });

      const castCommand = `cast send ${FAROSWAP_ROUTER} "swapExactETHForTokens(uint256,address[],address,uint256)" ${estimatedUsdcOut.toString()} "[${WPROS_ADDRESS},${USDC_ADDRESS}]" ${treasuryAddress} ${deadline} --value ${amountInWei.toString()} --rpc-url https://rpc.pharos.xyz`;

      return {
        targetContract: FAROSWAP_ROUTER,
        methodSignature: 'swapExactETHForTokens(uint256,address[],address,uint256)',
        calldata,
        valueHex: `0x${amountInWei.toString(16)}`,
        estimatedGas: '180000',
        castCommand,
        humanDescription: `Swap ${action.formattedAmount} via FaroSwap to acquire USDC and restore target ratio`,
      };
    } else {
      // SWAP_USDC_TO_PROS -> swapExactTokensForETH on FaroSwap
      const amountInRaw = parseUnits(action.amountUnits.toFixed(0), 6);
      const estimatedProsOut = parseUnits(((action.amountUnits / 1.25) * 0.985).toFixed(4), 18);

      const calldata = encodeFunctionData({
        abi: ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [
          amountInRaw,
          estimatedProsOut,
          [USDC_ADDRESS, WPROS_ADDRESS],
          treasuryAddress,
          deadline,
        ],
      });

      const castCommand = `cast send ${FAROSWAP_ROUTER} "swapExactTokensForETH(uint256,uint256,address[],address,uint256)" ${amountInRaw.toString()} ${estimatedProsOut.toString()} "[${USDC_ADDRESS},${WPROS_ADDRESS}]" ${treasuryAddress} ${deadline} --rpc-url https://rpc.pharos.xyz`;

      return {
        targetContract: FAROSWAP_ROUTER,
        methodSignature: 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
        calldata,
        valueHex: '0x0',
        estimatedGas: '210000',
        castCommand,
        humanDescription: `Swap ${action.formattedAmount} via FaroSwap to acquire PROS and restore target ratio`,
      };
    }
  }
}
