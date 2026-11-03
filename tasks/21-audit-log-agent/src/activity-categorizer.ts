/**
 * Transaction Activity Categorizer for Pharos Network.
 * Fulfills Requirement 02: Classifies on-chain transactions into 5 canonical categories:
 * - Transfers In
 * - Transfers Out
 * - Swaps
 * - Approvals
 * - Contract Interactions
 */

import { type Address, formatEther, formatUnits, getAddress } from 'viem';
import {
  type AuditActivityCategory,
  type CategorizedLedgerEntry,
  type RawTransactionRecord,
} from './types.js';
import { buildPharosExplorerUrl, resolveAuditCounterparty } from './directory.js';

// Benchmark reference quotes for valuation estimates
const TOKEN_PRICES_USD: Record<string, number> = {
  PROS: 1.5,
  WPROS: 1.5,
  USDC: 1.0,
  USDT: 1.0,
  WETH: 2500.0,
};

export class ActivityCategorizer {
  /**
   * Evaluates a raw on-chain transaction from the perspective of the audited wallet
   * and produces a normalized, categorized ledger entry.
   */
  public categorizeTransaction(
    tx: RawTransactionRecord,
    auditedWallet: Address,
  ): CategorizedLedgerEntry {
    const normalizedWallet = getAddress(auditedWallet).toLowerCase();
    const isSender = tx.fromAddress.toLowerCase() === normalizedWallet;
    const isReceiver = tx.toAddress.toLowerCase() === normalizedWallet;

    // Deduce counterparty
    const counterpartyRaw = isSender ? tx.toAddress : tx.fromAddress;
    const counterpartyMeta = resolveAuditCounterparty(counterpartyRaw);

    // Compute gas fee in PROS
    const gasUsed = tx.gasUsed ?? 21000n;
    const gasPriceGwei = tx.gasPriceGwei ?? 1.5;
    const gasCostGwei = Number(gasUsed) * gasPriceGwei;
    const gasFeePaidPros = (gasCostGwei / 1e9).toFixed(6);

    // Determine category, asset, nominal amount, and USD valuation
    const classification = this.determineCategoryAndAsset(tx, normalizedWallet, counterpartyMeta.label);

    // Detect notable criteria for compliance spotlight
    const notableInfo = this.evaluateNotability(tx, classification);

    const timestampIso = new Date(tx.blockTimestamp * 1000).toISOString();
    const explorerUrl = buildPharosExplorerUrl(tx.txHash);

    return {
      entryId: `audit-${tx.txHash.slice(0, 10)}-${tx.blockNumber}`,
      txHash: tx.txHash,
      blockNumber: tx.blockNumber,
      timestampIso,
      category: classification.category,
      counterpartyAddress: getAddress(counterpartyRaw),
      counterpartyLabel: counterpartyMeta.label,
      assetSymbol: classification.assetSymbol,
      nominalAmountFormatted: classification.nominalAmountFormatted,
      estimatedUsdValuation: classification.estimatedUsdValuation,
      gasFeePaidPros,
      isNotable: notableInfo.isNotable,
      notableReason: notableInfo.reason,
      plainLanguageDescription: classification.plainDescription,
      explorerUrl,
    };
  }

  private determineCategoryAndAsset(
    tx: RawTransactionRecord,
    walletLower: string,
    counterpartyLabel: string,
  ): {
    category: AuditActivityCategory;
    assetSymbol: string;
    nominalAmountFormatted: string;
    estimatedUsdValuation: number;
    plainDescription: string;
  } {
    // 1. Approvals Check
    const hasApprovals =
      (tx.tokenApprovals && tx.tokenApprovals.length > 0) ||
      tx.functionMethodName?.toLowerCase().includes('approve') ||
      tx.functionMethodName?.toLowerCase().includes('allowance');

    if (hasApprovals) {
      const approval = tx.tokenApprovals?.[0];
      const token = approval?.tokenSymbol ?? 'ERC20';
      const spenderMeta = approval ? resolveAuditCounterparty(approval.spenderAddress) : { label: counterpartyLabel };
      const isUnlimited = approval?.isUnlimited ?? true;
      const amountStr = isUnlimited ? 'Unlimited (MaxUint256)' : formatUnits(approval?.rawAllowance ?? 0n, 18);

      return {
        category: 'TOKEN_APPROVAL',
        assetSymbol: token,
        nominalAmountFormatted: amountStr,
        estimatedUsdValuation: 0,
        plainDescription: `Granted ${isUnlimited ? 'unlimited' : amountStr} ${token} spending approval to ${spenderMeta.label}.`,
      };
    }

    // 2. Swaps Check
    const isDexInteraction =
      counterpartyLabel.toLowerCase().includes('faroswap') ||
      counterpartyLabel.toLowerCase().includes('router') ||
      counterpartyLabel.toLowerCase().includes('amm') ||
      tx.functionMethodName?.toLowerCase().includes('swap');

    if (isDexInteraction) {
      const transfers = tx.tokenTransfers ?? [];
      const sent = transfers.find((t) => t.fromAddress.toLowerCase() === walletLower);
      const received = transfers.find((t) => t.toAddress.toLowerCase() === walletLower);

      let swapDescription = `Executed token swap via ${counterpartyLabel}`;
      let primaryAsset = 'DEX Token';
      let formattedAmount = '0.00';
      let valuation = 0;

      if (sent && received) {
        const sentFormatted = formatUnits(sent.rawAmount, sent.decimals);
        const recvFormatted = formatUnits(received.rawAmount, received.decimals);
        swapDescription = `Swapped ${sentFormatted} ${sent.tokenSymbol} for ${recvFormatted} ${received.tokenSymbol} via ${counterpartyLabel}.`;
        primaryAsset = `${sent.tokenSymbol} ➔ ${received.tokenSymbol}`;
        formattedAmount = `${sentFormatted} / ${recvFormatted}`;
        const price = TOKEN_PRICES_USD[sent.tokenSymbol] ?? 1.0;
        valuation = Math.round(Number(sentFormatted) * price * 100) / 100;
      } else if (tx.valueWei > 0n) {
        const prosVal = formatEther(tx.valueWei);
        swapDescription = `Supplied ${prosVal} PROS into ${counterpartyLabel} for swap execution.`;
        primaryAsset = 'PROS';
        formattedAmount = prosVal;
        valuation = Math.round(Number(prosVal) * (TOKEN_PRICES_USD.PROS ?? 1.5) * 100) / 100;
      }

      return {
        category: 'DEX_SWAP',
        assetSymbol: primaryAsset,
        nominalAmountFormatted: formattedAmount,
        estimatedUsdValuation: valuation,
        plainDescription: swapDescription,
      };
    }

    // 3. ERC-20 Token Transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      const inboundTransfer = tx.tokenTransfers.find((t) => t.toAddress.toLowerCase() === walletLower);
      const outboundTransfer = tx.tokenTransfers.find((t) => t.fromAddress.toLowerCase() === walletLower);

      if (inboundTransfer) {
        const formatted = formatUnits(inboundTransfer.rawAmount, inboundTransfer.decimals);
        const price = TOKEN_PRICES_USD[inboundTransfer.tokenSymbol] ?? 1.0;
        const valuation = Math.round(Number(formatted) * price * 100) / 100;
        const senderMeta = resolveAuditCounterparty(inboundTransfer.fromAddress);

        return {
          category: 'TRANSFER_IN',
          assetSymbol: inboundTransfer.tokenSymbol,
          nominalAmountFormatted: `+${formatted}`,
          estimatedUsdValuation: valuation,
          plainDescription: `Received ${formatted} ${inboundTransfer.tokenSymbol} (~$${valuation.toLocaleString()} USD) from ${senderMeta.label}.`,
        };
      }

      if (outboundTransfer) {
        const formatted = formatUnits(outboundTransfer.rawAmount, outboundTransfer.decimals);
        const price = TOKEN_PRICES_USD[outboundTransfer.tokenSymbol] ?? 1.0;
        const valuation = Math.round(Number(formatted) * price * 100) / 100;
        const recipientMeta = resolveAuditCounterparty(outboundTransfer.toAddress);

        return {
          category: 'TRANSFER_OUT',
          assetSymbol: outboundTransfer.tokenSymbol,
          nominalAmountFormatted: `-${formatted}`,
          estimatedUsdValuation: valuation,
          plainDescription: `Dispatched ${formatted} ${outboundTransfer.tokenSymbol} (~$${valuation.toLocaleString()} USD) to ${recipientMeta.label}.`,
        };
      }
    }

    // 4. Native PROS Coin Transfers
    if (tx.valueWei > 0n) {
      const formattedPros = formatEther(tx.valueWei);
      const valuation = Math.round(Number(formattedPros) * (TOKEN_PRICES_USD.PROS ?? 1.5) * 100) / 100;

      if (tx.toAddress.toLowerCase() === walletLower) {
        return {
          category: 'TRANSFER_IN',
          assetSymbol: 'PROS',
          nominalAmountFormatted: `+${formattedPros}`,
          estimatedUsdValuation: valuation,
          plainDescription: `Received native inbound transfer of ${formattedPros} PROS (~$${valuation.toLocaleString()} USD) from ${counterpartyLabel}.`,
        };
      }

      if (tx.fromAddress.toLowerCase() === walletLower) {
        // If contract interaction with value
        const isContract = counterpartyLabel.toLowerCase().includes('vault') || counterpartyLabel.toLowerCase().includes('pool') || counterpartyLabel.toLowerCase().includes('bridge');
        if (isContract) {
          return {
            category: 'CONTRACT_INTERACTION',
            assetSymbol: 'PROS',
            nominalAmountFormatted: formattedPros,
            estimatedUsdValuation: valuation,
            plainDescription: `Deposited ${formattedPros} PROS (~$${valuation.toLocaleString()} USD) into ${counterpartyLabel}.`,
          };
        }

        return {
          category: 'TRANSFER_OUT',
          assetSymbol: 'PROS',
          nominalAmountFormatted: `-${formattedPros}`,
          estimatedUsdValuation: valuation,
          plainDescription: `Dispatched native transfer of ${formattedPros} PROS (~$${valuation.toLocaleString()} USD) to ${counterpartyLabel}.`,
        };
      }
    }

    // 5. General Contract Interactions (e.g. Staking, Borrowing, Governance)
    return {
      category: 'CONTRACT_INTERACTION',
      assetSymbol: 'PROS',
      nominalAmountFormatted: '0.00',
      estimatedUsdValuation: 0,
      plainDescription: `Executed contract method "${tx.functionMethodName ?? 'invoke'}" on ${counterpartyLabel}.`,
    };
  }

  private evaluateNotability(
    tx: RawTransactionRecord,
    classification: {
      category: AuditActivityCategory;
      estimatedUsdValuation: number;
    },
  ): { isNotable: boolean; reason?: string } {
    if (!tx.isSuccess) {
      return { isNotable: true, reason: 'Transaction execution failed / reverted on-chain' };
    }

    if (classification.category === 'TOKEN_APPROVAL') {
      const approval = tx.tokenApprovals?.[0];
      if (approval?.isUnlimited) {
        return { isNotable: true, reason: `Unlimited token allowance granted for ${approval.tokenSymbol}` };
      }
    }

    if (classification.estimatedUsdValuation >= 10000) {
      return {
        isNotable: true,
        reason: `High capital movement exceeding $10,000 threshold ($${classification.estimatedUsdValuation.toLocaleString()} USD)`,
      };
    }

    return { isNotable: false };
  }
}
