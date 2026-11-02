import {
  PublicClient,
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  encodeFunctionData,
  parseUnits,
  parseEther,
  toHex,
} from 'viem';
import {
  ParsedPaymentIntent,
  PreFlightSummary,
  UnsignedPaymentTransaction,
  WalletSigningRequest,
  PaymentAgentPreparationResult,
} from './types.js';
import { NaturalLanguagePaymentParser } from './intent-parser.js';
import { PaymentRequestValidator } from './payment-validator.js';
import { PharosNameResolver } from './name-resolver.js';
import { PharosTokenRegistry } from './token-registry.js';

const ORACLE_ADDRESS: `0x${string}` = '0x1Ed3e8CdC173363593BfAD9bF77aa2A0e7351DB8';
const ORACLE_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
]);

export class NaturalLanguagePaymentAgent {
  private parser: NaturalLanguagePaymentParser;
  private validator: PaymentRequestValidator;
  private nameResolver: PharosNameResolver;
  private tokenRegistry: PharosTokenRegistry;
  private client: PublicClient;

  constructor(client?: PublicClient) {
    this.nameResolver = new PharosNameResolver();
    this.tokenRegistry = new PharosTokenRegistry();
    this.parser = new NaturalLanguagePaymentParser(this.nameResolver, this.tokenRegistry);
    this.client =
      client ??
      createPublicClient({
        transport: http('https://rpc.pharos.xyz', {
          retryCount: 5,
          retryDelay: 1000,
        }),
      });
    this.validator = new PaymentRequestValidator(this.client);
  }

  /**
   * Turns plain-language instructions like "send 100 USDC to alice.pharos"
   * into a fully validated, human-readable pre-flight summary and unsigned transaction (Harbor action pattern).
   */
  async preparePayment(
    instructionText: string,
    senderAddress: `0x${string}` = '0x6119871b4eb66db137dcfad59655853ea6fe58ce',
    mockBalances?: { nativePros?: number; tokenAmount?: number }
  ): Promise<PaymentAgentPreparationResult> {
    // 1. Requirement 01: Parse free text & detect ambiguities
    const intent = this.parser.parse(instructionText);
    if (!intent.isComplete) {
      return {
        status: 'AMBIGUOUS_INPUT',
        intent,
      };
    }

    // 2. Requirement 02: Validate recipient format, token contract, sufficient balance
    const validation = await this.validator.validate(intent, senderAddress, mockBalances);
    if (!validation.isValid) {
      return {
        status: 'VALIDATION_FAILED',
        intent,
        validation,
      };
    }

    const token = intent.token!;
    const amount = intent.amount!;
    const recipient = intent.resolvedRecipient!;

    // 3. Requirement 03: Human-readable pre-flight summary with USD conversions
    const oraclePriceUsd = await this.fetchOraclePriceUsd();
    let assetUsdRate = 1.0;
    if (token.isNative) {
      assetUsdRate = oraclePriceUsd;
    } else if (token.symbol === 'USDC') {
      assetUsdRate = 1.0;
    } else if (token.symbol === 'LINK') {
      assetUsdRate = 15.0; // Benchmark rate
    }

    const totalUsdValue = amount * assetUsdRate;

    // Estimate gas limit
    const estimatedGasLimit = token.isNative ? 21000n : 65000n;
    const gasPriceGwei = 10.0;
    const estimatedFeeProsBigInt = estimatedGasLimit * 10000000000n; // 10 Gwei
    const estimatedFeePros = formatUnits(estimatedFeeProsBigInt, 18);
    const estimatedFeeUsd = parseFloat(estimatedFeePros) * oraclePriceUsd;

    const summaryId = `sum-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const isDomain = Boolean(intent.recipientInput && (intent.recipientInput.includes('.') || !intent.recipientInput.startsWith('0x')));

    const summary: PreFlightSummary = {
      summaryId,
      timestamp: new Date().toISOString(),
      sender: senderAddress,
      recipient: {
        rawInput: intent.recipientInput ?? recipient,
        resolvedAddress: recipient,
        isDomainName: isDomain,
      },
      asset: {
        symbol: token.symbol,
        amount,
        tokenAddress: token.address,
        decimals: token.decimals,
      },
      fiatEstimation: {
        oraclePriceUsd,
        assetUsdRate,
        totalUsdValue,
      },
      networkFee: {
        estimatedGasLimit,
        gasPriceGwei,
        estimatedFeePros,
        estimatedFeeUsd,
      },
      balanceProjection: {
        currentBalance: validation.senderBalance.tokenAmount,
        postTransferBalance: Math.max(0, validation.senderBalance.tokenAmount - amount),
        currencySymbol: token.symbol,
      },
    };

    // 4. Requirement 04: Never signs or sends on its own. Emits unsigned transaction / signing request
    let targetTo: `0x${string}`;
    let txValueHex: `0x${string}`;
    let txDataHex: `0x${string}`;

    if (token.isNative) {
      targetTo = recipient;
      txValueHex = toHex(parseEther(amount.toString()));
      txDataHex = '0x';
    } else {
      targetTo = token.address as `0x${string}`;
      txValueHex = '0x0';
      const parsedAmount = parseUnits(amount.toString(), token.decimals);
      txDataHex = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipient, parsedAmount],
      });
    }

    const unsignedTx: UnsignedPaymentTransaction = {
      chainId: 1672,
      from: senderAddress,
      to: targetTo,
      value: txValueHex,
      data: txDataHex,
      gas: toHex(estimatedGasLimit),
      maxFeePerGas: toHex(12000000000n), // 12 Gwei
      maxPriorityFeePerGas: toHex(1500000000n), // 1.5 Gwei
    };

    // Build cast command for developer terminal execution
    const castParts = [
      'cast send',
      targetTo,
      `--from ${senderAddress}`,
      `--value ${txValueHex}`,
      `--gas-limit ${estimatedGasLimit.toString()}`,
      `--rpc-url https://rpc.pharos.xyz`,
    ];
    if (txDataHex !== '0x') {
      castParts.push(`--data "${txDataHex}"`);
    }

    const signingRequest: WalletSigningRequest = {
      signingProtocol: 'EIP-1193',
      method: 'eth_sendTransaction',
      payload: unsignedTx,
      humanReadableSummary: `Transfer ${amount} ${token.symbol} to ${recipient} (Pharos Mainnet Chain ID 1672)`,
      foundryCastCommand: castParts.join(' '),
      warningNotice:
        'NON-CUSTODIAL AGENT INVARIANT: This transaction has NOT been signed or broadcast. Please review all details carefully in your secure wallet before authorizing signature.',
    };

    return {
      status: 'READY_FOR_SIGNATURE',
      intent,
      validation,
      summary,
      unsignedTransaction: unsignedTx,
      signingRequest,
    };
  }

  getParser(): NaturalLanguagePaymentParser {
    return this.parser;
  }

  getValidator(): PaymentRequestValidator {
    return this.validator;
  }

  getNameResolver(): PharosNameResolver {
    return this.nameResolver;
  }

  getTokenRegistry(): PharosTokenRegistry {
    return this.tokenRegistry;
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
      return 2284.0;
    }
  }
}
