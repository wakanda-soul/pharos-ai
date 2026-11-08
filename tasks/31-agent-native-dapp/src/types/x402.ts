/**
 * Core specification types for the x402 HTTP challenge-response payment protocol
 * tailored for autonomous AI agent micro-transactions on Pharos Mainnet.
 */

export interface X402Challenge {
  tokenAddress: string;
  amountAtomic: string; // e.g. "1000" for 0.001 USDC (6 decimals)
  amountUsdc: number; // e.g. 0.001
  recipientAddress: string;
  memo: string;
  chainId: number;
  network: string;
  feedId: string;
}

export interface X402PaymentProof {
  buyerAddress: string;
  authorizationSignature: string;
  nonce: number;
  queryHash: string;
  receiptId?: string;
  txHash?: string;
}

export interface X402GateResult<T> {
  status: 200 | 402 | 403 | 500;
  challenge?: X402Challenge;
  data?: T;
  receiptId?: string;
  error?: string;
}

export const X402_EIP712_DOMAIN = {
  name: 'Pharos x402 Intelligence Mesh',
  version: '1',
  chainId: 1672,
  verifyingContract: '0x1672402000000000000000000000000000004021' as `0x${string}`,
} as const;

export const X402_PAYMENT_VOUCHER_TYPES = {
  X402PaymentVoucher: [
    { name: 'buyerAddress', type: 'address' },
    { name: 'feedSlug', type: 'string' },
    { name: 'priceUsdcAtomic', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;
