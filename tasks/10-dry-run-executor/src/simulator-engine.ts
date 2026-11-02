import {
  createPublicClient,
  http,
  PublicClient,
  formatEther,
  formatUnits,
  parseAbi,
  decodeErrorResult,
  sha256,
  toHex,
} from 'viem';
import {
  TransactionSimulationRequest,
  SimulationResult,
  GasEstimationBreakdown,
  RevertCategory,
  PreparedExecution,
} from './types.js';
import { StateInspector, DecodedCallInfo } from './state-inspector.js';

const ORACLE_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

export class DryRunExecutorEngine {
  private client: PublicClient;
  private stateInspector: StateInspector;
  private readonly oracleAddress: `0x${string}` = '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8';
  private readonly defaultSender: `0x${string}` = '0x6119871b4eb66db137dcfad59655853ea6fe58ce';

  constructor(client?: PublicClient) {
    this.client = client ?? createPublicClient({
      transport: http('https://rpc.pharos.xyz', {
        retryCount: 5,
        retryDelay: 1000,
      }),
    });
    this.stateInspector = new StateInspector(this.client);
  }

  /**
   * Core simulation pipeline:
   * 1. Decodes calldata and captures pre-execution state.
   * 2. Simulates transaction via eth_call and eth_estimateGas (zero broadcast).
   * 3. Calculates precise gas cost in PROS and USD.
   * 4. Synthesizes predicted post-execution state diff.
   * 5. Enforces automated execution gate (CLEARED vs BLOCKED).
   */
  async simulate(request: TransactionSimulationRequest): Promise<SimulationResult> {
    const simulationId = `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toISOString();
    const from = request.from ?? this.defaultSender;
    const to = request.to;
    const data = request.data ?? '0x';
    const valueWei = typeof request.value === 'bigint' ? request.value : BigInt(request.value ?? 0);
    const diagnostics: string[] = [];

    let blockNumber = 21911000;
    try {
      blockNumber = Number(await this.client.getBlockNumber());
    } catch {
      // fallback
    }

    // 1. Analyze calldata
    const decodedCall: DecodedCallInfo = await this.stateInspector.decodeCall(to, data);

    // 2. Query gas price & oracle price for accurate fee prediction
    const gasPriceWei = await this.fetchGasPrice();
    const oraclePriceUsd = await this.fetchOraclePriceUsd();

    // 3. Pre-execution simulation via eth_call and eth_estimateGas
    let gasLimitEstimated = 21000n;
    let revertReason: string | undefined;
    let revertData: `0x${string}` | undefined;
    let revertCategory: RevertCategory | undefined;
    let simulationSuccess = false;

    try {
      // Step A: eth_call to test execution without broadcasting
      await this.client.call({
        account: from,
        to,
        data,
        value: valueWei,
      });

      // Step B: eth_estimateGas to get precise gas usage
      gasLimitEstimated = await this.client.estimateGas({
        account: from,
        to,
        data,
        value: valueWei,
      });

      simulationSuccess = true;
    } catch (err: any) {
      simulationSuccess = false;
      const parsedError = this.parseSimulationError(err);
      revertReason = parsedError.reason;
      revertData = parsedError.data;
      revertCategory = parsedError.category;
    }

    // 4. Calculate Gas Fee Breakdown
    const effectiveGasLimit = request.gasLimit ?? (gasLimitEstimated > 0n ? (gasLimitEstimated * 120n) / 100n : 50000n);
    const totalGasFeeWei = effectiveGasLimit * gasPriceWei;
    const totalGasFeePros = parseFloat(formatEther(totalGasFeeWei)).toFixed(8);
    const totalGasFeeUsd = oraclePriceUsd > 0
      ? parseFloat((parseFloat(formatEther(totalGasFeeWei)) * oraclePriceUsd).toFixed(4))
      : undefined;

    const gasBreakdown: GasEstimationBreakdown = {
      gasLimitEstimated,
      gasPriceWei,
      gasPriceGwei: parseFloat(formatUnits(gasPriceWei, 9)),
      totalGasFeeWei,
      totalGasFeePros: `${totalGasFeePros} PROS`,
      totalGasFeeUsd,
      oraclePriceUsd,
    };

    // 5. Pre & Post State Diff Inspection
    const tokenInfo = decodedCall.isErc20 && decodedCall.tokenAddress && decodedCall.symbol && decodedCall.decimals !== undefined
      ? { address: decodedCall.tokenAddress, symbol: decodedCall.symbol, decimals: decodedCall.decimals }
      : undefined;

    const senderPre = await this.stateInspector.captureSnapshot(from, tokenInfo);
    const recipientAddr = decodedCall.recipient ?? (to !== from ? to : undefined);
    const recipientPre = recipientAddr ? await this.stateInspector.captureSnapshot(recipientAddr, tokenInfo) : undefined;

    // Check sender solvency for native transfer + gas fee
    if (simulationSuccess && senderPre.nativeBalanceWei < (valueWei + totalGasFeeWei)) {
      simulationSuccess = false;
      revertReason = `Insufficient native balance: Sender has ${senderPre.nativeBalanceFormatted}, required ${parseFloat(formatEther(valueWei + totalGasFeeWei)).toFixed(6)} PROS (including estimated gas fee).`;
      revertCategory = 'INSUFFICIENT_FUNDS';
    }

    const stateDiff = this.stateInspector.computeStateDiff(
      senderPre,
      recipientPre,
      request,
      decodedCall,
      gasBreakdown
    );

    // 6. Automated Gate Enforcement (Requirement 04)
    const canExecute = simulationSuccess;
    const gateVerdict = canExecute ? 'PROCEED_CLEARED' : 'EXECUTION_BLOCKED';
    const status = canExecute ? 'SIMULATION_PASSED' : 'SIMULATION_REVERTED';

    let preparedExecution: PreparedExecution | undefined;

    if (canExecute) {
      const ticketPayload = `${simulationId}:${blockNumber}:${from}:${to}:${data}:${valueWei}`;
      const executionTicketHash = sha256(toHex(ticketPayload));
      const castCommand = this.buildCastCommand(from, to, data, valueWei, effectiveGasLimit);

      preparedExecution = {
        castCommand,
        recommendedGasLimit: effectiveGasLimit,
        executionTicketHash,
        simulatedAtBlock: blockNumber,
      };

      diagnostics.push('Pre-flight simulation succeeded: 0 EVM opcodes reverted.');
      diagnostics.push(`Gas viability verified: ${gasBreakdown.totalGasFeePros} (~$${totalGasFeeUsd ?? '0.00'}).`);
      diagnostics.push('Execution gate unlocked: Transaction is safe to broadcast.');
    } else {
      diagnostics.push(`Pre-flight simulation failed: ${revertReason ?? 'Execution reverted'}.`);
      diagnostics.push('Automatic Safety Gate engaged: Transaction broadcast BLOCKED to prevent on-chain gas loss.');
      if (revertCategory === 'TRANSFER_EXCEEDS_BALANCE') {
        diagnostics.push('Remediation hint: Verify sender token balance before initiating ERC-20 transfer.');
      } else if (revertCategory === 'INSUFFICIENT_ALLOWANCE') {
        diagnostics.push('Remediation hint: Submit an ERC-20 approve() transaction to grant sufficient spending allowance.');
      } else if (revertCategory === 'INSUFFICIENT_FUNDS') {
        diagnostics.push('Remediation hint: Fund sender address with additional native PROS to cover value and gas.');
      } else {
        diagnostics.push('Remediation hint: Review contract constraints, preconditions, and calldata arguments.');
      }
    }

    return {
      simulationId,
      timestamp,
      network: 'Pharos Mainnet',
      chainId: 1672,
      blockNumber,
      status,
      gateVerdict,
      canExecute,
      request: {
        from,
        to,
        data,
        value: valueWei.toString(),
        description: request.description,
      },
      gasBreakdown,
      revertReason,
      revertData,
      revertCategory,
      stateDiff,
      preparedExecution,
      diagnostics,
    };
  }

  private parseSimulationError(err: any): { reason: string; data?: `0x${string}`; category: RevertCategory } {
    const rawMsg = err.shortMessage || err.message || '';
    const details = err.details || '';
    let reason = rawMsg;
    let data: `0x${string}` | undefined = err.data;

    // Check for standard Solidity revert strings
    const reasonMatch = details.match(/execution reverted: (.+)/i) || rawMsg.match(/reverted with reason: (.+)/i);
    if (reasonMatch && reasonMatch[1]) {
      reason = reasonMatch[1].trim();
    }

    // Classify category
    let category: RevertCategory = 'UNKNOWN';
    const lower = reason.toLowerCase();
    if (lower.includes('transfer amount exceeds balance') || lower.includes('exceeds balance')) {
      category = 'TRANSFER_EXCEEDS_BALANCE';
    } else if (lower.includes('allowance') || lower.includes('insufficient allowance')) {
      category = 'INSUFFICIENT_ALLOWANCE';
    } else if (lower.includes('insufficient funds') || lower.includes('balance too low')) {
      category = 'INSUFFICIENT_FUNDS';
    } else if (lower.includes('out of gas')) {
      category = 'OUT_OF_GAS';
    } else if (reason.length > 0) {
      category = 'CUSTOM_REVERT';
    }

    return { reason, data, category };
  }

  private async fetchGasPrice(): Promise<bigint> {
    try {
      return await this.client.getGasPrice();
    } catch {
      return 1000000000n; // 1 Gwei fallback
    }
  }

  private async fetchOraclePriceUsd(): Promise<number> {
    try {
      const data = await this.client.readContract({
        address: this.oracleAddress,
        abi: ORACLE_ABI,
        functionName: 'latestRoundData',
      });
      const [, answerRaw] = data as [bigint, bigint, bigint, bigint, bigint];
      return parseFloat(formatUnits(answerRaw, 18));
    } catch {
      return 2300.0; // Fallback estimate
    }
  }

  private buildCastCommand(
    from: `0x${string}`,
    to: `0x${string}`,
    data: `0x${string}`,
    valueWei: bigint,
    gasLimit: bigint
  ): string {
    const parts = ['cast send', to];
    if (data && data !== '0x') {
      parts.push(`--data "${data}"`);
    }
    if (valueWei > 0n) {
      parts.push(`--value ${valueWei.toString()}`);
    }
    parts.push(`--from ${from}`);
    parts.push(`--gas-limit ${gasLimit.toString()}`);
    parts.push('--rpc-url https://rpc.pharos.xyz');
    return parts.join(' ');
  }
}
