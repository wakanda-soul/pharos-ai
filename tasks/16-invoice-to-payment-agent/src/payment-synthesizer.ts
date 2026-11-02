import {
  encodeFunctionData,
  parseAbi,
  parseUnits,
  parseEther,
  stringToHex,
  concatHex,
} from 'viem';
import {
  ExtractedInvoiceMetadata,
  InvoiceAnomalyFlag,
  InvoicePaymentSummary,
  PreparedUnsignedTransaction,
} from './types.js';
import { PHAROS_SETTLEMENT_TOKENS } from './token-registry.js';

const ERC20_ABI = parseAbi([
  'function transfer(address recipient, uint256 amount) external returns (bool)',
]);

/**
 * Enterprise Payment Synthesizer for Pharos Mainnet (Chain ID 1672).
 * Fulfills Requirement 03: Produces payment summary and unsigned transaction
 * with the invoice reference embedded directly in the calldata.
 */
export class InvoicePaymentSynthesizer {
  private readonly pharosChainId = 1672;

  synthesize(
    metadata: ExtractedInvoiceMetadata,
    resolvedPayee: `0x${string}`,
    tokenContract: `0x${string}` | undefined,
    tokenDecimals: number,
    anomalies: readonly InvoiceAnomalyFlag[]
  ): InvoicePaymentSummary {
    const hasBlockingDiscrepancy = anomalies.some((a) => a.severity === 'BLOCKING_ERROR');
    const tokenSymbol = metadata.settlementCurrency || 'USDC';
    const isNativePros = tokenSymbol === 'PROS' || !tokenContract;
    const isZeroPayee = !resolvedPayee || resolvedPayee === '0x0000000000000000000000000000000000000000';

    // Convert invoice reference into canonical UTF-8 hex memo
    // Attach invoice reference so on-chain reconciliation matches internal ledger
    const sanitizedReference = metadata.invoiceReference || 'REF-UNSPECIFIED';
    const invoiceMemoHex = stringToHex(sanitizedReference);

    let unsignedTx: PreparedUnsignedTransaction | undefined;

    if (!hasBlockingDiscrepancy && !isZeroPayee) {
      if (isNativePros) {
        // Native PROS Transfer: transaction value carries coins; data payload carries reference memo
        // Watch out: limit decimals to 18 to avoid viem parseEther precision crashes
        const prosAmountString = metadata.totalBilledAmount.toFixed(18).replace(/\.?0+$/, '');
        const rawWei = parseEther(prosAmountString);
        const gasLimit = 35000n; // Standard transfer with calldata memo headroom

        const castCmd = `cast send ${resolvedPayee} ` +
          `--value ${rawWei.toString()} ` +
          `--data ${invoiceMemoHex} ` +
          `--rpc-url https://rpc.pharos.xyz`;

        unsignedTx = {
          chainId: this.pharosChainId,
          to: resolvedPayee,
          data: invoiceMemoHex,
          valueWei: rawWei,
          gasLimitEstimated: gasLimit,
          invoiceReferenceHexMemo: invoiceMemoHex,
          foundryCastCommand: castCmd,
          eip1193Payload: {
            to: resolvedPayee,
            data: invoiceMemoHex,
            value: `0x${rawWei.toString(16)}`,
            gas: `0x${gasLimit.toString(16)}`,
            chainId: `0x${this.pharosChainId.toString(16)}`,
          },
        };
      } else {
        // ERC-20 Transfer (e.g. native USDC on Pharos):
        // Standard ERC-20 transfer calldata is 68 bytes. We append the reference hex memo
        // directly as calldata suffix. The EVM reads the first 68 bytes, while indexers
        // and explorers permanently store the invoice reference in the transaction calldata.
        const tokenDec = tokenDecimals || 6;
        // Watch out: format amount to token decimals so parseUnits never throws DecimalPlacesExceeded
        const sanitizedDecimalString = metadata.totalBilledAmount.toFixed(tokenDec);
        const rawUnits = parseUnits(sanitizedDecimalString, tokenDec);
        const standardCalldata = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [resolvedPayee, rawUnits],
        });

        // Concat standard calldata with the invoice reference memo suffix
        const calldataWithReference = concatHex([standardCalldata, invoiceMemoHex]);
        const gasLimit = 65000n;

        const castCmd = `cast send ${tokenContract} ` +
          `"transfer(address,uint256)" ${resolvedPayee} ${rawUnits.toString()} ` +
          `--data-suffix ${invoiceMemoHex} ` +
          `--rpc-url https://rpc.pharos.xyz`;

        unsignedTx = {
          chainId: this.pharosChainId,
          to: tokenContract,
          data: calldataWithReference,
          valueWei: 0n,
          gasLimitEstimated: gasLimit,
          invoiceReferenceHexMemo: invoiceMemoHex,
          foundryCastCommand: castCmd,
          eip1193Payload: {
            to: tokenContract,
            data: calldataWithReference,
            value: '0x0',
            gas: `0x${gasLimit.toString(16)}`,
            chainId: `0x${this.pharosChainId.toString(16)}`,
          },
        };
      }
    }

    const estimatedGasFeePros = isNativePros ? '0.000035 PROS' : '0.000065 PROS';
    const estimatedUsdVal = isNativePros
      ? `$${(metadata.totalBilledAmount * 2280).toFixed(2)}`
      : `$${metadata.totalBilledAmount.toFixed(2)}`;

    return {
      invoiceReference: sanitizedReference,
      vendorName: metadata.vendorLegalName || 'Unknown Vendor',
      payeeTarget: metadata.payeeAddressOrDomain,
      resolvedPayee,
      billedAmountFormatted: `${metadata.totalBilledAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })} ${tokenSymbol}`,
      tokenSymbol,
      tokenContract: tokenContract ?? 'NATIVE_PROS',
      estimatedGasFeePros,
      estimatedUsdValuation: estimatedUsdVal,
      verificationStatus: hasBlockingDiscrepancy
        ? 'DISCREPANCY_FLAGGED'
        : 'VERIFIED_READY_FOR_SIGNATURE',
      anomalyFlags: anomalies,
      unsignedTransaction: unsignedTx,
    };
  }
}
