import { FailureCategory } from "./types.js";

export interface DecodedError {
  category: FailureCategory;
  name: string;
  summary: string;
  plainEnglishExplanation: string;
  actionableSteps: string[];
  suggestedFixCommand?: (to: string, from: string) => string;
}

export const PANIC_CODES: Record<number, string> = {
  0x01: "Assertion failed (assert)",
  0x11: "Arithmetic operation resulted in an underflow or overflow",
  0x12: "Division or modulo by zero",
  0x21: "Conversion to an invalid enum type",
  0x22: "Storage byte array encoding error",
  0x31: "Pop called on an empty array",
  0x32: "Array index out-of-bounds",
  0x41: "Allocated too much memory or memory buffer overflow",
  0x51: "Zero initialized variable of internal function type called",
};

/**
 * Known 4-byte custom error selectors across EVM, OpenZeppelin, and Uniswap.
 */
export const KNOWN_CUSTOM_ERRORS: Record<string, {
  name: string;
  category: FailureCategory;
  explain: string;
  steps: string[];
  fixCommand?: (to: string, from: string) => string;
}> = {
  // OpenZeppelin ERC20 Custom Errors
  "0xfb8f41b2": {
    name: "ERC20InsufficientAllowance",
    category: "INSUFFICIENT_ALLOWANCE",
    explain: "The smart contract tried to spend tokens on your behalf, but your approved token allowance is lower than the amount required.",
    steps: [
      "Open your wallet or the dApp interface and find the 'Approve' or 'Unlock Token' button.",
      "Submit an approval transaction granting the contract permission to spend your tokens.",
      "Retry your original transaction once the approval is confirmed on Pharos."
    ],
    fixCommand: (to) => `cast send <TOKEN_ADDRESS> "approve(address,uint256)" ${to} "115792089237316195423570985008687907853269984665640564039457584007913129639935" --rpc-url https://rpc.pharos.xyz`,
  },
  "0xe450d38c": {
    name: "ERC20InsufficientBalance",
    category: "INSUFFICIENT_BALANCE",
    explain: "Your wallet does not hold enough token balance to complete this transfer, swap, or deposit.",
    steps: [
      "Check your token balance in your wallet or on the PharosScan explorer.",
      "Acquire more tokens or reduce the transaction amount to match your available balance.",
      "Ensure you keep sufficient native PROS to cover future gas fees."
    ],
  },
  "0x118cdaa7": {
    name: "OwnableUnauthorizedAccount",
    category: "ACCESS_CONTROL",
    explain: "This contract function is restricted to the contract owner or admin. Your wallet address is not authorized.",
    steps: [
      "Verify that you are connected with the owner/admin wallet address.",
      "If interacting via a script, ensure you exported the correct PRIVATE_KEY in your environment.",
    ],
  },
  // OpenZeppelin ERC721 / NFT Errors
  "0xa9264fa7": {
    name: "ERC721NonexistentToken",
    category: "CUSTOM_CONTRACT_REVERT",
    explain: "The token ID specified in this call does not exist or has already been burned.",
    steps: [
      "Verify the token ID on PharosScan explorer.",
      "Ensure the NFT minting or transfer transaction was not re-ordered.",
    ],
  },
};

/**
 * Standard revert strings seen across popular dApps (Uniswap, PancakeSwap, etc.)
 */
export function matchKnownStringReverts(msg: string): DecodedError | null {
  const lower = msg.toLowerCase();

  if (lower.includes("insufficient_output_amount") || lower.includes("too little received") || lower.includes("slippage")) {
    return {
      category: "SLIPPAGE_EXCEEDED",
      name: "SlippageToleranceExceeded",
      summary: "Market price moved during execution beyond your allowed slippage tolerance.",
      plainEnglishExplanation: "The tokens you would have received dropped below the minimum amount you specified in your slippage settings before your transaction was mined.",
      actionableSteps: [
        "Increase your slippage tolerance in the dApp swap settings (e.g., from 0.5% to 1.0% or 2.0%).",
        "Wait a few moments for market volatility on Pharos to settle.",
        "Resubmit the swap."
      ],
    };
  }

  if (lower.includes("expired") || lower.includes("deadline")) {
    return {
      category: "DEADLINE_EXPIRED",
      name: "TransactionDeadlineExpired",
      summary: "Transaction deadline elapsed before inclusion into a Pharos block.",
      plainEnglishExplanation: "Your transaction sat pending in the mempool or was submitted with a timestamp deadline that expired before miners/validators included it.",
      actionableSteps: [
        "Increase the transaction deadline in your dApp settings (e.g. from 20 minutes to 30 minutes).",
        "Submit a fresh swap transaction.",
      ],
    };
  }

  if (lower.includes("transfer_failed") || lower.includes("stf") || lower.includes("safetransferfrom")) {
    return {
      category: "INSUFFICIENT_ALLOWANCE",
      name: "TokenTransferFailed",
      summary: "The contract could not transfer the requested tokens from your wallet.",
      plainEnglishExplanation: "This usually occurs when token allowance is missing, or the token contract has fees on transfer, or balance is insufficient.",
      actionableSteps: [
        "Verify you have approved the contract to spend your tokens.",
        "Check that your token balance covers the amount plus any transfer tax.",
      ],
    };
  }

  if (lower.includes("ownable: caller is not the owner") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return {
      category: "ACCESS_CONTROL",
      name: "UnauthorizedAccess",
      summary: "Function restricted to authorized accounts only.",
      plainEnglishExplanation: "You are attempting to execute an administrative function using an unauthorized wallet address.",
      actionableSteps: [
        "Switch to the contract owner/deployer wallet address in your wallet.",
      ],
    };
  }

  return null;
}
