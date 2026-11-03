/**
 * Pharos Portfolio Assistant - Domain Types & Provenance Schemas
 * 
 * Provides types for multi-protocol DeFi positions, token balances,
 * natural-language query intents, and cryptographic provenance attributions.
 */

export type QueryIntentType =
  | 'YIELD_AND_EARNINGS'       // "what am I earning?", "what is my APY?"
  | 'ASSET_LOCATION'           // "where is my USDC?", "which pools hold my tokens?"
  | 'BIGGEST_POSITION'         // "what's my biggest position?", "highest allocation?"
  | 'NET_WORTH_OVERVIEW'       // "what's my total net worth?", "portfolio summary"
  | 'DEBT_AND_LIABILITIES'     // "do I have any loans or debt?", "collateral ratio?"
  | 'UNKNOWN_OR_UNSUPPORTED';  // Unsupported protocol or unanswerable query (zero-guessing)

export interface ContractProvenance {
  /** Name of the protocol or asset issuer */
  readonly protocolName: string;
  /** Physical EVM smart contract address on Pharos Mainnet */
  readonly contractAddress: `0x${string}`;
  /** Confirmed block height where this state was queried */
  readonly blockNumber: number;
  /** ISO timestamp of reading */
  readonly queriedAtIso: string;
  /** Direct link to Pharos block explorer */
  readonly explorerUrl: string;
}

export interface WalletBalanceRecord {
  readonly tokenSymbol: string;
  readonly tokenName: string;
  readonly tokenAddress: `0x${string}`;
  readonly rawBalanceUnits: bigint;
  readonly balanceFormatted: string;
  readonly balanceNumeric: number;
  readonly priceUsd: number;
  readonly balanceUsd: number;
  readonly provenance: ContractProvenance;
}

export interface ProtocolPositionRecord {
  readonly positionId: string;
  readonly protocolName: string;
  readonly vaultName: string;
  readonly assetSymbol: string;
  readonly depositedAmount: string;
  readonly depositedNumeric: number;
  readonly depositedUsd: number;
  readonly apyPercent: number;
  readonly annualYieldUsd: number;
  /** Optional borrowed liability details for lending markets */
  readonly borrowedAmount?: string;
  readonly borrowedNumeric?: number;
  readonly borrowedUsd?: number;
  readonly healthFactor?: number;
  readonly provenance: ContractProvenance;
}

export interface PortfolioAggregateSnapshot {
  readonly walletAddress: `0x${string}`;
  readonly totalNetWorthUsd: number;
  readonly totalWalletTokensUsd: number;
  readonly totalDeFiDepositsUsd: number;
  readonly totalDeFiDebtUsd: number;
  readonly weightedApyPercent: number;
  readonly projectedAnnualEarningsUsd: number;
  readonly walletBalances: WalletBalanceRecord[];
  readonly protocolPositions: ProtocolPositionRecord[];
  readonly snapshotBlockNumber: number;
  readonly generatedAtIso: string;
}

export interface ProvenanceCitationFigure {
  readonly metricLabel: string;
  readonly numericDisplay: string;
  readonly provenance: ContractProvenance;
}

export interface PortfolioAssistantAnswer {
  readonly queryText: string;
  readonly detectedIntent: QueryIntentType;
  readonly primaryAnswerMarkdown: string;
  readonly detailedFigures: ProvenanceCitationFigure[];
  /** Explicit statement when protocol is unknown or data is unverified (Req 04) */
  readonly zeroGuessingDisclaimer?: string;
  /** Read-only guarantee: strictly true (Req 05) */
  readonly isReadOnly: true;
  readonly answeredAtBlock: number;
}
