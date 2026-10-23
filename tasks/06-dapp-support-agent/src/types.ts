export type FailureCategory =
  | "OUT_OF_GAS"
  | "INSUFFICIENT_ALLOWANCE"
  | "INSUFFICIENT_BALANCE"
  | "SLIPPAGE_EXCEEDED"
  | "DEADLINE_EXPIRED"
  | "ACCESS_CONTROL"
  | "CUSTOM_CONTRACT_REVERT"
  | "MATH_PANIC"
  | "UNKNOWN_REVERT";

export interface TransactionDiagnostic {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: string;
  gasLimit: bigint;
  gasUsed: bigint;
  gasPriceGwei: string;
  effectiveGasCost: string;
  status: "SUCCESS" | "FAILED";
  failureCategory?: FailureCategory;
  rawRevertReason?: string;
  revertDataHex?: string;
  explanation: string;
  remedy: string[];
  suggestedCastCommand?: string;
  protocol?: string;
  network: "mainnet" | "atlantic-testnet";
  explorerUrl: string;
}

export interface RevertSignature {
  selector: string;
  name: string;
  category: FailureCategory;
  explanation: (decoded?: any) => string;
  remedy: (tx?: any) => string[];
}
