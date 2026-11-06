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
