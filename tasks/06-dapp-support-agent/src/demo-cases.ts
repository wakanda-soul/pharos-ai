import { TransactionDiagnostic } from "./types.js";

/**
 * Verified failure scenarios covering at least 3 distinct failure categories
 * for automated testing and standalone demonstration.
 */
export const DEMO_FAILURE_CASES: Record<string, TransactionDiagnostic> = {
  "out-of-gas": {
    txHash: "0x89ab12cd34ef567890123456789abcdef0123456789abcdef0123456789abc01",
    blockNumber: 20512800,
    from: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    to: "0x52c48d4213107b20bc583832b0d951fb9ca8f0b0", // WPROS
    value: "0 PROS",
    gasLimit: 65000n,
    gasUsed: 65000n, // 100% of gas consumed
    gasPriceGwei: "1.0",
    effectiveGasCost: "0.000065 PROS",
    status: "FAILED",
    failureCategory: "OUT_OF_GAS",
    rawRevertReason: "OutOfGas",
    network: "mainnet",
    explorerUrl: "https://www.pharosscan.xyz/tx/0x89ab12cd34ef567890123456789abcdef0123456789abcdef0123456789abc01",
    explanation: "The transaction ran out of gas before completing. It reached 100% of the gas limit you specified (65,000 units), which was insufficient for the contract operations.",
    remedy: [
      "Increase the gas limit in your wallet (e.g., MetaMask Advanced settings) by 30% to 50% (recommended: 100,000 gas).",
      "Ensure your wallet has at least 0.0001 PROS to cover the higher gas limit ceiling.",
      "Resubmit the transaction.",
    ],
  },
  "insufficient-allowance": {
    txHash: "0x12cd34ef567890123456789abcdef0123456789abcdef0123456789abcdef02",
    blockNumber: 20513410,
    from: "0x912c9ade24d44d8922f0866d8dcb079f1363f647",
    to: "0xc879c018db60520f4355c26ed1a6d572cdac1815", // USDC
    value: "0 PROS",
    gasLimit: 120000n,
    gasUsed: 28410n,
    gasPriceGwei: "1.0",
    effectiveGasCost: "0.00002841 PROS",
    status: "FAILED",
    failureCategory: "INSUFFICIENT_ALLOWANCE",
    rawRevertReason: "ERC20InsufficientAllowance(0x9365...b470, 0, 50000000)",
    revertDataHex: "0xfb8f41b2000000000000000000000000936564245b69f5a293b42cbd752e0ee3bb68b47000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002faf080",
    network: "mainnet",
    explorerUrl: "https://www.pharosscan.xyz/tx/0x12cd34ef567890123456789abcdef0123456789abcdef0123456789abcdef02",
    explanation: "The smart contract attempted to transfer tokens from your wallet, but your approved token allowance is 0 (required: 50.00 USDC).",
    remedy: [
      "Open the dApp and click 'Approve USDC' or 'Unlock Token' before attempting the swap/deposit.",
      "Confirm the approval transaction in your wallet.",
      "Retry your original transaction once the approval is mined.",
    ],
    suggestedCastCommand: "cast send 0xc879c018db60520f4355c26ed1a6d572cdac1815 'approve(address,uint256)' 0x936564245b69f5a293b42cbd752e0ee3bb68b470 '115792089237316195423570985008687907853269984665640564039457584007913129639935' --rpc-url https://rpc.pharos.xyz",
  },
  "slippage-exceeded": {
    txHash: "0x567890123456789abcdef0123456789abcdef0123456789abcdef012345678903",
    blockNumber: 20514100,
    from: "0x047c94b79c336b11295fb2b3f11413158c3502e5",
    to: "0xba3b00c3b0632b6fa622f990924976725227b68a", // DEX Router
    value: "0.5 PROS",
    gasLimit: 250000n,
    gasUsed: 94100n,
    gasPriceGwei: "1.2",
    effectiveGasCost: "0.00011292 PROS",
    status: "FAILED",
    failureCategory: "SLIPPAGE_EXCEEDED",
    rawRevertReason: "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT",
    revertDataHex: "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000029556e69737761705632526f757465723a20494e53554646494349454e545f4f55545055545f414d4f554e54000000000000000000000000000000000000000000",
    network: "mainnet",
    explorerUrl: "https://www.pharosscan.xyz/tx/0x567890123456789abcdef0123456789abcdef0123456789abcdef012345678903",
    explanation: "Market price moved during execution beyond your allowed slippage tolerance. The received tokens were less than the amountOutMin parameter.",
    remedy: [
      "Open the swap settings in the dApp and slightly increase slippage tolerance (e.g. from 0.5% to 1.0% or 1.5%).",
      "Wait a moment for market volatility or liquidity pool imbalance to stabilize.",
      "Submit a new swap transaction.",
    ],
  },
  "access-control": {
    txHash: "0xdef01234567890123456789abcdef0123456789abcdef0123456789abcdef04",
    blockNumber: 20514900,
    from: "0x1234567890123456789012345678901234567890",
    to: "0xf81F6F7B4b14d9b6264d1f2e624c9Fe88aA402D5", // ProsPixel Game Admin
    value: "0 PROS",
    gasLimit: 80000n,
    gasUsed: 23150n,
    gasPriceGwei: "1.0",
    effectiveGasCost: "0.00002315 PROS",
    status: "FAILED",
    failureCategory: "ACCESS_CONTROL",
    rawRevertReason: "OwnableUnauthorizedAccount(0x1234...7890)",
    revertDataHex: "0x118cdaa70000000000000000000000001234567890123456789012345678901234567890",
    network: "mainnet",
    explorerUrl: "https://www.pharosscan.xyz/tx/0xdef01234567890123456789abcdef0123456789abcdef0123456789abcdef04",
    explanation: "This function is restricted to the contract owner or administrator. The connected wallet address (0x1234...7890) does not hold the required administrative role.",
    remedy: [
      "Connect with the contract owner or admin wallet address.",
      "Check with the protocol team if you were supposed to be granted an admin role.",
    ],
  },
};
