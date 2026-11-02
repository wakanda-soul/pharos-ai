/**
 * Task 17: x402 Paywalled API
 * Core protocol types for HTTP-native micro-payments on Pharos Atlantic Testnet (eip155:688689).
 */

export const ATLANTIC_TESTNET = {
  chainId: 688689,
  networkIdentifier: 'eip155:688689',
  networkName: 'Pharos Atlantic Testnet',
  rpcUrl: 'https://atlantic.dplabs-internal.com',
  explorerBaseUrl: 'https://atlantic-scan.pharos.xyz',
  testUsdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
  usdcDecimals: 6,
} as const;

export type PaymentScheme = 'exact';

export interface X402PaymentRequirement {
  readonly scheme: PaymentScheme;
  readonly network: string; // e.g. "eip155:688689"
  readonly price: string; // e.g. "0.05"
  readonly currency: string; // e.g. "USDC"
  readonly tokenAddress: `0x${string}`;
  readonly payTo: `0x${string}`;
  readonly validUntilTimestamp: number; // Unix timestamp in seconds
  readonly paymentMemoId: string;
}

export interface Eip712PaymentAuthorization {
  readonly clientPayerAddress: `0x${string}`;
  readonly payToRecipient: `0x${string}`;
  readonly tokenAddress: `0x${string}`;
  readonly authorizedAmountUnits: string; // token units as string
  readonly decimalPriceUsdc: number;
  readonly nonce: string;
  readonly validUntilTimestamp: number;
  readonly signatureHex: `0x${string}`;
}

export interface FacilitatorSupportedResponse {
  readonly versions: readonly string[];
  readonly networks: readonly string[];
  readonly schemes: readonly string[];
  readonly supportedTokens: readonly {
    readonly symbol: string;
    readonly address: `0x${string}`;
    readonly decimals: number;
    readonly network: string;
  }[];
}

export interface FacilitatorVerifyRequest {
  readonly requirement: X402PaymentRequirement;
  readonly authorization: Eip712PaymentAuthorization;
}

export interface FacilitatorVerifyResponse {
  readonly isValid: boolean;
  readonly rejectionReason?: string;
  readonly verifiedPayer?: `0x${string}`;
  readonly settledUnits?: string;
}

export interface FacilitatorSettleRequest {
  readonly requirement: X402PaymentRequirement;
  readonly authorization: Eip712PaymentAuthorization;
}

export interface FacilitatorSettleResponse {
  readonly success: boolean;
  readonly transactionHash?: `0x${string}`;
  readonly explorerUrl?: string;
  readonly network: string;
  readonly settlementTimestamp: string;
  readonly errorMessage?: string;
}

export interface PaywalledRouteConfig {
  readonly path: string;
  readonly method: 'GET' | 'POST';
  readonly isPaid: boolean;
  readonly priceUsdc?: number;
  readonly description: string;
}

export interface X402PaymentResponsePayload {
  readonly status: 'SETTLED';
  readonly network: string;
  readonly transactionHash: `0x${string}`;
  readonly explorerUrl: string;
  readonly amountSettled: string;
  readonly tokenSymbol: string;
  readonly payer: `0x${string}`;
}
