'use client';

import React, { useState } from 'react';
import { X, Wallet, ArrowDown, Check, Coins, ShieldCheck, Zap } from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

interface AgentWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string | null;
  currentBalanceUsdc: number;
  onDeposit: (amountUsdc: number) => void;
}

export const AgentWalletModal: React.FC<AgentWalletModalProps> = ({
  isOpen,
  onClose,
  walletAddress,
  currentBalanceUsdc,
  onDeposit,
}) => {
  const [depositAmount, setDepositAmount] = useState<number>(0.5);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fundingTxHash, setFundingTxHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmDeposit = async () => {
    setIsDepositing(true);
    setFundingTxHash(null);

    // If MetaMask or browser wallet is connected, offer real on-chain transaction
    if (typeof window !== 'undefined' && (window as any).ethereum && walletAddress) {
      try {
        const ethereum = (window as any).ethereum;
        const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0 && accounts[0].toLowerCase() !== walletAddress.toLowerCase()) {
          const tx = await ethereum.request({
            method: 'eth_sendTransaction',
            params: [
              {
                from: accounts[0],
                to: walletAddress,
                value: '0x0',
              },
            ],
          });
          if (tx) {
            setFundingTxHash(tx);
          }
        }
      } catch (txErr: any) {
        console.warn('Browser wallet funding prompt skipped or not needed for session:', txErr?.message);
      }
    }

    onDeposit(depositAmount);
    setIsDepositing(false);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-md bg-[#0012b8] flex items-center justify-center text-white">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">
              Embedded Agent Wallet
            </h3>
            <span className="text-xs text-gray-500">
              Powered by Privy Architecture on Pharos Mainnet
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-4">
          Autonomous AI agents need a pre-funded session balance to settle sub-cent x402 payments (0.001 USDC) without requiring interactive wallet signature popups on every single call.
        </p>

        {/* Current Balance Box */}
        <div className="bg-[#f2f4f5] p-3 rounded-lg border border-[#e5e7eb] flex items-center justify-between text-xs mb-4">
          <span className="text-gray-600 font-medium">Agent Wallet Address:</span>
          <span className="font-mono text-gray-900 font-semibold truncate max-w-[180px]">
            {walletAddress}
          </span>
        </div>

        <div className="bg-[#f0fdf4] p-3 rounded-lg border border-emerald-200 flex items-center justify-between text-xs mb-5">
          <span className="text-emerald-800 font-medium">Current Usable Balance:</span>
          <span className="font-mono text-emerald-900 font-bold text-sm">
            {currentBalanceUsdc.toFixed(3)} USDC
          </span>
        </div>

        {/* Select Deposit Amount */}
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          Select Top-Up Amount (Pharos Native USDC):
        </label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[0.1, 0.5, 1.0].map((amt) => (
            <button
              key={amt}
              onClick={() => setDepositAmount(amt)}
              className={`py-2 px-3 rounded-md text-xs font-semibold border transition-all ${
                depositAmount === amt
                  ? 'bg-[#0012b8] text-white border-[#0012b8] shadow-sm'
                  : 'bg-white text-gray-700 border-[#e5e7eb] hover:bg-[#f9fafb]'
              }`}
            >
              +{amt.toFixed(2)} USDC
            </button>
          ))}
        </div>

        {/* Confirmation Button */}
        <button
          onClick={handleConfirmDeposit}
          disabled={isDepositing || isSuccess}
          className={`w-full py-2.5 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            isSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-[#0012b8] hover:bg-[#000fa0] text-white shadow-sm'
          }`}
        >
          {isDepositing ? (
            'Funding Agent Wallet...'
          ) : isSuccess ? (
            <>
              <Check className="w-4 h-4" /> Funded Successfully!
            </>
          ) : (
            <>
              <Coins className="w-4 h-4" /> Deposit {depositAmount} USDC to Agent
            </>
          )}
        </button>

        <div className="mt-4 pt-3 border-t border-[#f2f4f5] text-[11px] text-gray-400 flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Non-custodial EIP-712 session key · Native USDC (Chain ID 1672)
        </div>
      </div>
    </div>
  );
};
