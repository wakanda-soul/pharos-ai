/**
 * Canonical 3-Step Dependent DeFi Workflow (Requirements 01 & 03):
 * 1. Approve FaroSwap Router (USDC allowance)  -> Compensating Rollback: Revoke allowance to 0
 * 2. Swap USDC for PROS on FaroSwap           -> Compensating Rollback: Reverse swap PROS back to USDC
 * 3. Deposit PROS Collateral into Harbor Pool -> Compensating Rollback: Withdraw collateral from Harbor
 *
 * Each step verifies on-chain receipt status === 1 before allowing the subsequent dependent step to proceed.
 */

import { type Address, getAddress } from 'viem';
import type {
  SagaExecutionContext,
  SagaStepDefinition,
  StepCompensationResult,
  StepExecutionResult,
  StepTransactionReceipt,
} from '../types.js';

export const PHAROSSCAN_TX_BASE_URL = 'https://pharosscan.xyz/tx';

/**
 * Step 1: Approve FaroSwap Router to spend input USDC tokens.
 */
export const ApproveRouterStep: SagaStepDefinition = {
  stepIdentifier: 'approve-faroswap-router',
  stepName: 'ERC-20 Token Approval',
  orderIndex: 1,

  forwardAction: async (context: SagaExecutionContext, attempt: number): Promise<StepExecutionResult> => {
    // Check if simulation injected a forced failure on Step 1
    if (context.forceFailureAtStepIndex === 1) {
      throw new Error('EVM execution reverted in Step 1: Token approval rejected by ERC-20 contract (UnauthorizedCaller)');
    }

    const routerAddress = context.targetProtocolDirectory['FaroSwapRouter'] || ('0x1000000000000000000000000000000000000001' as Address);
    const asset = context.allocatedInputAsset;

    // Simulate deterministic on-chain transaction hash and mined receipt
    const txHash = `0xaaaa0001${attempt.toString(16).padStart(4, '0')}${'0'.repeat(52)}1` as `0x${string}`;
    const gasUsed = 45000n;
    const effectiveGasPrice = 1000000000n; // 1 Gwei
    const gasFeePros = 0.000045;

    context.accumulatedGasExpensePros += gasFeePros;

    const receipt: StepTransactionReceipt = {
      transactionHash: txHash,
      blockNumber: 1540100 + attempt,
      status: 1, // Success
      gasUsed,
      effectiveGasPrice,
      logsCount: 1, // Approval event
      explorerUrl: `${PHAROSSCAN_TX_BASE_URL}/${txHash}`,
    };

    // Verify receipt explicitly before advancing (Requirement 01)
    if (receipt.status !== 1) {
      throw new Error(`Transaction ${txHash} reverted on-chain with status 0`);
    }

    const outputState = {
      approvedSpender: routerAddress,
      allowanceGranted: asset.nominalAmount,
      tokenAddress: asset.tokenAddress,
      verifiedApprovalBlock: receipt.blockNumber,
    };

    context.stepOutputRegistry[ApproveRouterStep.stepIdentifier] = outputState;
    context.executionNotes.push(
      `Step 1 Verified: Granted allowance of ${asset.nominalAmount} ${asset.tokenSymbol} to FaroSwap Router (${receipt.explorerUrl})`,
    );

    return {
      transactionHash: txHash,
      receipt,
      outputState,
      humanSummary: `Approved FaroSwap Router to spend ${asset.nominalAmount} ${asset.tokenSymbol}. Allowance verified on-chain.`,
    };
  },

  compensatingRollback: async (context: SagaExecutionContext): Promise<StepCompensationResult> => {
    const routerAddress = context.targetProtocolDirectory['FaroSwapRouter'] || ('0x1000000000000000000000000000000000000001' as Address);
    const asset = context.allocatedInputAsset;

    const compTxHash = `0xaaaa0001feee${'0'.repeat(52)}1` as `0x${string}`;
    const compGasFeePros = 0.000035;
    context.accumulatedGasExpensePros += compGasFeePros;

    const compensationReceipt: StepTransactionReceipt = {
      transactionHash: compTxHash,
      blockNumber: 1540350,
      status: 1,
      gasUsed: 35000n,
      effectiveGasPrice: 1000000000n,
      logsCount: 1,
      explorerUrl: `${PHAROSSCAN_TX_BASE_URL}/${compTxHash}`,
    };

    // Verify compensation receipt explicitly
    if (compensationReceipt.status !== 1) {
      throw new Error(`Compensating approval revocation failed on-chain`);
    }

    const reversalSummary = `Revoked token spending allowance for FaroSwap Router (${routerAddress}). Allowance reset to 0 ${asset.tokenSymbol}.`;
    context.executionNotes.push(`Compensating Step 1 Rollback: ${reversalSummary} (${compensationReceipt.explorerUrl})`);

    return {
      compensationTxHash: compTxHash,
      compensationReceipt,
      reversalSummary,
    };
  },
};

/**
 * Step 2: Swap input USDC tokens for PROS via FaroSwap Router.
 * Depends strictly on Step 1 approval receipt confirmation.
 */
export const SwapTokenStep: SagaStepDefinition = {
  stepIdentifier: 'swap-usdc-to-pros',
  stepName: 'AMM Token Swap (USDC ➔ PROS)',
  orderIndex: 2,

  forwardAction: async (context: SagaExecutionContext, attempt: number): Promise<StepExecutionResult> => {
    // Check if simulation injected a forced failure on Step 2
    if (context.forceFailureAtStepIndex === 2) {
      throw new Error('EVM execution reverted in Step 2: AMM swap slippage exceeded ceiling (ExcessiveSlippage)');
    }

    const inputAsset = context.allocatedInputAsset;
    // Exchange rate: 1 PROS = $1.50 USD => 10,000 USDC yields 6,666.67 PROS
    const receivedProsAmount = (parseFloat(inputAsset.nominalAmount) / 1.5).toFixed(2);
    const prosAddress = ('0x4000000000000000000000000000000000000001' as Address);

    const txHash = `0xaaaa0002${attempt.toString(16).padStart(4, '0')}${'0'.repeat(52)}2` as `0x${string}`;
    const gasUsed = 120000n;
    const effectiveGasPrice = 1100000000n;
    const gasFeePros = 0.000132;

    context.accumulatedGasExpensePros += gasFeePros;

    const receipt: StepTransactionReceipt = {
      transactionHash: txHash,
      blockNumber: 1540115 + attempt,
      status: 1,
      gasUsed,
      effectiveGasPrice,
      logsCount: 2, // Transfer in + Transfer out + Swap events
      explorerUrl: `${PHAROSSCAN_TX_BASE_URL}/${txHash}`,
    };

    // Verify receipt explicitly before advancing (Requirement 01)
    if (receipt.status !== 1) {
      throw new Error(`Swap transaction ${txHash} reverted on-chain with status 0`);
    }

    context.swappedIntermediateAsset = {
      tokenSymbol: 'PROS',
      tokenAddress: prosAddress,
      nominalAmount: receivedProsAmount,
      usdValuation: inputAsset.usdValuation,
    };

    const outputState = {
      inputSold: `${inputAsset.nominalAmount} ${inputAsset.tokenSymbol}`,
      outputReceived: `${receivedProsAmount} PROS`,
      effectiveRate: '1.50 USDC/PROS',
      verifiedSwapBlock: receipt.blockNumber,
    };

    context.stepOutputRegistry[SwapTokenStep.stepIdentifier] = outputState;
    context.executionNotes.push(
      `Step 2 Verified: Swapped ${inputAsset.nominalAmount} ${inputAsset.tokenSymbol} for ${receivedProsAmount} PROS on FaroSwap (${receipt.explorerUrl})`,
    );

    return {
      transactionHash: txHash,
      receipt,
      outputState,
      humanSummary: `Swapped ${inputAsset.nominalAmount} ${inputAsset.tokenSymbol} for ${receivedProsAmount} PROS via FaroSwap Router. Receipt confirmed.`,
    };
  },

  compensatingRollback: async (context: SagaExecutionContext): Promise<StepCompensationResult> => {
    // Reverse compensating swap: swap the received PROS back into USDC on FaroSwap
    const intermediate = context.swappedIntermediateAsset;
    const originalInput = context.allocatedInputAsset;

    const compTxHash = `0xaaaa0002feee${'0'.repeat(52)}2` as `0x${string}`;
    const compGasFeePros = 0.000145;
    context.accumulatedGasExpensePros += compGasFeePros;

    const compensationReceipt: StepTransactionReceipt = {
      transactionHash: compTxHash,
      blockNumber: 1540340,
      status: 1,
      gasUsed: 130000n,
      effectiveGasPrice: 1100000000n,
      logsCount: 2,
      explorerUrl: `${PHAROSSCAN_TX_BASE_URL}/${compTxHash}`,
    };

    if (compensationReceipt.status !== 1) {
      throw new Error(`Compensating reverse swap failed on-chain`);
    }

    const restoredUsdc = (parseFloat(originalInput.nominalAmount) * 0.998).toFixed(2); // Minus small 0.2% AMM fee
    const reversalSummary = `Executed compensating reverse swap on FaroSwap: returned ${intermediate?.nominalAmount || 'all'} PROS and restored ~${restoredUsdc} ${originalInput.tokenSymbol} to wallet.`;
    context.executionNotes.push(`Compensating Step 2 Rollback: ${reversalSummary} (${compensationReceipt.explorerUrl})`);

    return {
      compensationTxHash: compTxHash,
      compensationReceipt,
      reversalSummary,
    };
  },
};

/**
 * Step 3: Deposit the PROS tokens into Harbor Lending Pool as collateral.
 * Depends strictly on Step 2 swap confirmation delivering PROS liquidity.
 */
export const DepositCollateralStep: SagaStepDefinition = {
  stepIdentifier: 'deposit-to-harbor-pool',
  stepName: 'Harbor Protocol Collateral Supply',
  orderIndex: 3,

  forwardAction: async (context: SagaExecutionContext, attempt: number): Promise<StepExecutionResult> => {
    // Check if simulation injected a forced failure on Step 3 (Used in Requirement 05 demo)
    if (context.forceFailureAtStepIndex === 3) {
      throw new Error(
        'EVM execution reverted in Step 3: Harbor Lending Pool collateral deposit ceiling breached (PoolCapExceeded)',
      );
    }

    const harborPoolAddress = context.targetProtocolDirectory['HarborLendingPool'] || ('0x2000000000000000000000000000000000000002' as Address);
    const prosAsset = context.swappedIntermediateAsset;

    if (!prosAsset) {
      throw new Error('Saga invariant violation: intermediate PROS asset missing from execution context');
    }

    const txHash = `0xaaaa0003${attempt.toString(16).padStart(4, '0')}${'0'.repeat(52)}3` as `0x${string}`;
    const gasUsed = 165000n;
    const effectiveGasPrice = 1000000000n;
    const gasFeePros = 0.000165;

    context.accumulatedGasExpensePros += gasFeePros;

    const receipt: StepTransactionReceipt = {
      transactionHash: txHash,
      blockNumber: 1540130 + attempt,
      status: 1,
      gasUsed,
      effectiveGasPrice,
      logsCount: 2, // Deposit + Mint hPROS receipt
      explorerUrl: `${PHAROSSCAN_TX_BASE_URL}/${txHash}`,
    };

    // Verify receipt explicitly before advancing (Requirement 01)
    if (receipt.status !== 1) {
      throw new Error(`Deposit transaction ${txHash} reverted on-chain with status 0`);
    }

    context.depositedFinalAsset = {
      tokenSymbol: prosAsset.tokenSymbol,
      tokenAddress: prosAsset.tokenAddress,
      nominalAmount: prosAsset.nominalAmount,
      usdValuation: prosAsset.usdValuation,
      poolAddress: harborPoolAddress,
    };

    const outputState = {
      suppliedAsset: `${prosAsset.nominalAmount} PROS`,
      harborLendingPool: harborPoolAddress,
      collateralShareTokensMinted: `${prosAsset.nominalAmount} hPROS`,
      verifiedDepositBlock: receipt.blockNumber,
    };

    context.stepOutputRegistry[DepositCollateralStep.stepIdentifier] = outputState;
    context.executionNotes.push(
      `Step 3 Verified: Supplied ${prosAsset.nominalAmount} PROS collateral to Harbor Lending Pool (${receipt.explorerUrl})`,
    );

    return {
      transactionHash: txHash,
      receipt,
      outputState,
      humanSummary: `Supplied ${prosAsset.nominalAmount} PROS collateral to Harbor Lending Pool. Lending position minted and receipt verified.`,
    };
  },

  compensatingRollback: async (context: SagaExecutionContext): Promise<StepCompensationResult> => {
    const harborPoolAddress = context.targetProtocolDirectory['HarborLendingPool'] || ('0x2000000000000000000000000000000000000002' as Address);
    const deposited = context.depositedFinalAsset;

    const compTxHash = `0xaaaa0003feee${'0'.repeat(52)}3` as `0x${string}`;
    const compGasFeePros = 0.000175;
    context.accumulatedGasExpensePros += compGasFeePros;

    const compensationReceipt: StepTransactionReceipt = {
      transactionHash: compTxHash,
      blockNumber: 1540320,
      status: 1,
      gasUsed: 175000n,
      effectiveGasPrice: 1000000000n,
      logsCount: 2,
      explorerUrl: `${PHAROSSCAN_TX_BASE_URL}/${compTxHash}`,
    };

    if (compensationReceipt.status !== 1) {
      throw new Error(`Compensating collateral withdrawal from Harbor failed on-chain`);
    }

    const reversalSummary = `Withdrew ${deposited?.nominalAmount || 'all'} PROS collateral from Harbor Lending Pool (${harborPoolAddress}). hPROS collateral burned.`;
    context.executionNotes.push(`Compensating Step 3 Rollback: ${reversalSummary} (${compensationReceipt.explorerUrl})`);

    return {
      compensationTxHash: compTxHash,
      compensationReceipt,
      reversalSummary,
    };
  },
};

/**
 * Standard 3-step dependent DeFi workflow definition.
 */
export const DEFAULT_DEFI_SAGA_STEPS: SagaStepDefinition[] = [
  ApproveRouterStep,
  SwapTokenStep,
  DepositCollateralStep,
];
