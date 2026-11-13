import { NextRequest, NextResponse } from 'next/server';
import { feedStore } from '@/lib/storage';
import { isAddress, verifyTypedData } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publisherAddress, slug, onChainTxHash, signature, claimReceipt } = body;

    if (!publisherAddress || !isAddress(publisherAddress)) {
      return NextResponse.json(
        { error: 'Valid checksummed publisherAddress is required to execute settlement.' },
        { status: 400 }
      );
    }

    // Cryptographic verification if EIP-712 browser extension signature is supplied
    if (signature && claimReceipt) {
      try {
        const isValid = await verifyTypedData({
          address: publisherAddress as `0x${string}`,
          domain: {
            name: 'Pharos x402 Marketplace',
            version: '1',
            chainId: 1672,
            verifyingContract: '0x1672000000000000000000000000000000004021',
          },
          types: {
            PublisherClaimReceipt: [
              { name: 'publisher', type: 'address' },
              { name: 'totalAmountUsdc', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' },
            ],
          },
          primaryType: 'PublisherClaimReceipt',
          message: {
            publisher: claimReceipt.publisher as `0x${string}`,
            totalAmountUsdc: BigInt(claimReceipt.totalAmountUsdc),
            nonce: BigInt(claimReceipt.nonce),
            timestamp: BigInt(claimReceipt.timestamp),
          },
          signature: signature as `0x${string}`,
        });

        if (!isValid) {
          return NextResponse.json(
            { error: 'Cryptographic signature from browser extension does not match publisher address.' },
            { status: 401 }
          );
        }
      } catch (verifErr: any) {
        console.warn('EIP-712 claim verification warning:', verifErr);
      }
    }

    const result = feedStore.settleFeedRevenue(publisherAddress, slug, onChainTxHash);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to settle publisher revenue.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      settlementReceipt: {
        receiptId: result.receiptId,
        settledAmountUsdc: result.settledAmount,
        destinationWallet: publisherAddress,
        network: 'Pharos Mainnet (Chain ID 1672)',
        settlementTxHash: result.onChainTxHash || null,
        signature: signature || null,
        settledFeeds: result.settledFeeds,
        settlementStandard: signature ? 'EIP-712 Browser Extension Claim Voucher' : 'x402 Batch Promissory Vouchers (EIP-712)',
        timestamp: result.timestamp,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Server error during publisher settlement execution.' },
      { status: 500 }
    );
  }
}
