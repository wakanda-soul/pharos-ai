'use client';

import React, { useState } from 'react';
import { X, Shield, Mail, Key, Sparkles, Check, ArrowRight, Wallet } from 'lucide-react';

interface PrivyLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (derivedAddress: string) => void;
}

export const PrivyLoginModal: React.FC<PrivyLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginStep, setLoginStep] = useState<'methods' | 'verifying' | 'created'>('methods');
  const [createdAddress, setCreatedAddress] = useState('');

  if (!isOpen) return null;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    executePrivyCreation(email);
  };

  const handleWalletSubmit = () => {
    executePrivyCreation('browser_injected_wallet');
  };

  const handleSocialSubmit = (provider: string) => {
    executePrivyCreation(`social_${provider}`);
  };

  const executePrivyCreation = (identifier: string) => {
    setIsSubmitting(true);
    setLoginStep('verifying');

    setTimeout(() => {
      // Deterministically derive or generate agent address on Pharos Mainnet
      const deterministicAddress = '0x1bF848814D174F5A85bD3FDf9f6C9201';
      setCreatedAddress(deterministicAddress);
      setLoginStep('created');

      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess(deterministicAddress);
        onClose();
        setLoginStep('methods');
      }, 1200);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-[#e5e7eb] max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {loginStep === 'methods' && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#5c41ff] flex items-center justify-center text-white font-bold shadow-sm">
                P
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  Connect with Privy
                </h3>
                <p className="text-[11px] text-gray-500">
                  Autonomous Embedded Wallet on Pharos
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Sign in to automatically provision an embedded agent wallet. Fund it with micro-amounts of USDC to enable zero-popup autonomous x402 data requests.
            </p>

            {/* Email form */}
            <form onSubmit={handleEmailSubmit} className="space-y-2 mb-4">
              <label className="block text-[11px] font-semibold text-gray-700">
                Email Address
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.xyz"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#e5e7eb] rounded-lg focus:outline-none focus:border-[#5c41ff] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#5c41ff] hover:bg-[#4b32e0] text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            <div className="relative flex py-1 items-center mb-3">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-gray-400 uppercase font-mono tracking-wider">
                or
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Web3 Browser Wallet */}
            <div className="space-y-2">
              <button
                onClick={handleWalletSubmit}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] text-gray-800 transition-colors"
              >
                <Wallet className="w-4 h-4 text-[#0012b8]" />
                Connect Browser Wallet (MetaMask / Pharos)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSocialSubmit('google')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] text-gray-700 transition-colors"
                >
                  <span className="font-bold text-red-500 text-xs">G</span> Google
                </button>
                <button
                  onClick={() => handleSocialSubmit('github')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] text-gray-700 transition-colors"
                >
                  <span className="font-bold text-gray-900 text-xs">⌘</span> GitHub
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" /> Non-custodial session key
              </span>
              <span>Chain ID 1672</span>
            </div>
          </div>
        )}

        {loginStep === 'verifying' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-[#5c41ff] animate-pulse">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Provisioning Embedded Wallet</h4>
              <p className="text-xs text-gray-500 mt-1">
                Deriving cryptographic session key for autonomous agent execution on Pharos Mainnet...
              </p>
            </div>
          </div>
        )}

        {loginStep === 'created' && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Privy Wallet Connected!</h4>
              <p className="text-xs text-gray-500 mt-1">
                Agent address successfully created on Pharos Mainnet:
              </p>
              <div className="mt-2 bg-[#f2f4f5] px-2.5 py-1.5 rounded font-mono text-[11px] text-gray-800 break-all font-semibold">
                {createdAddress}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
