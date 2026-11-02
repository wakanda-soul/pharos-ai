/**
 * Task 14: Natural-Language Payment Agent Types
 * Plain-language intent-to-action payment synthesizer (Harbor action pattern).
 */

export interface TokenInfo {
  symbol: string;
  name: string;
  address: `0x${string}` | 'NATIVE';
  decimals: number;
  isNative: boolean;
  coingeckoId?: string;
}

export type AmbiguityField = 'AMOUNT' | 'TOKEN' | 'RECIPIENT';

export interface AmbiguityClarification {
  field: AmbiguityField;
  question: string;
  suggestedOptions?: string[];
  reason: string;
}

export interface ParsedPaymentIntent {
  rawInput: string;
  isComplete: boolean;
  amount?: number;
  tokenSymbol?: string;
  token?: TokenInfo;
  recipientInput?: string;
  resolvedRecipient?: `0x${string}`;
  clarificationsNeeded: AmbiguityClarification[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  sender: `0x${string}`;
  recipientAddress?: `0x${string}`;
  token?: TokenInfo;
  senderBalance: {
    nativePros: number;
    tokenAmount: number;
  };
  hasSufficientBalance: boolean;
  hasSufficientGas: boolean;
}

export interface PreFlightSummary {
  summaryId: string;
  timestamp: string;
  sender: `0x${string}`;
  recipient: {
    rawInput: string;
    resolvedAddress: `0x${string}`;
    isDomainName: boolean;
  };
  asset: {
    symbol: string;
    amount: number;
    tokenAddress: `0x${string}` | 'NATIVE';
    decimals: number;
  };
  fiatEstimation: {
    oraclePriceUsd: number;
    assetUsdRate: number;
    totalUsdValue: number;
  };
  networkFee: {
    estimatedGasLimit: bigint;
    gasPriceGwei: number;
    estimatedFeePros: string;
    estimatedFeeUsd: number;
  };
  balanceProjection: {
    currentBalance: number;
    postTransferBalance: number;
    currencySymbol: string;
  };
}

export interface UnsignedPaymentTransaction {
  chainId: 1672;
  from: `0x${string}`;
  to: `0x${string}`;
  value: `0x${string}`; // Hex wei
  data: `0x${string}`;
  gas: `0x${string}`; // Hex gas limit
  maxFeePerGas: `0x${string}`;
  maxPriorityFeePerGas: `0x${string}`;
  nonce?: number;
}

export interface WalletSigningRequest {
  signingProtocol: 'EIP-1193' | 'METAMASK_SEND' | 'WALLETCONNECT';
  method: 'eth_sendTransaction';
  payload: UnsignedPaymentTransaction;
  humanReadableSummary: string;
  foundryCastCommand: string;
  warningNotice: string;
}

export interface PaymentAgentPreparationResult {
  status: 'READY_FOR_SIGNATURE' | 'AMBIGUOUS_INPUT' | 'VALIDATION_FAILED';
  intent: ParsedPaymentIntent;
  validation?: ValidationResult;
  summary?: PreFlightSummary;
  unsignedTransaction?: UnsignedPaymentTransaction;
  signingRequest?: WalletSigningRequest;
}
