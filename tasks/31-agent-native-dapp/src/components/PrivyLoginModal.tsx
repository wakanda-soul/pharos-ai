'use client';

import React, { useState } from 'react';
import { X, Shield, Mail, Sparkles, Check, ArrowRight, Wallet, ExternalLink, AlertCircle, Copy, CheckCheck } from 'lucide-react';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { formatUnits, formatEther } from 'viem';
import { pharosPublicClient, PHAROS_CONSTANTS, ERC20_ABI } from '@/lib/pharos-chain';

interface PrivyLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (derivedAddress: string, usdcBalance: number, prosBalance: number, providerType: 'metamask' | 'session_key') => void;
}

export const PrivyLoginModal: React.FC<PrivyLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loginStep, setLoginStep] = useState<'methods' | 'verifying' | 'created'>('methods');
  const [createdAddress, setCreatedAddress] = useState('');
  const [createdBalances, setCreatedBalances] = useState<{ usdc: number; pros: number }>({ usdc: 0, pros: 0 });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // 1. Connect via real MetaMask / Browser Injected Wallet (EIP-1193)
  const handleConnectBrowserWallet = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setLoginStep('verifying');

    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('No Web3 browser wallet detected (e.g. MetaMask, Rabby). Install MetaMask or create an Autonomous Agent Session Key below.');
      }

      const ethereum = (window as any).ethereum;
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected in your browser wallet.');
      }

      const userAddress = accounts[0] as `0x${string}`;

      // Verify and switch to Pharos Mainnet (Chain ID 1672 / 0x688)
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: PHAROS_CONSTANTS.chainIdHex }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902 || switchError.message?.includes('4902')) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: PHAROS_CONSTANTS.chainIdHex,
                chainName: PHAROS_CONSTANTS.chainName,
                rpcUrls: [PHAROS_CONSTANTS.rpcUrl],
                nativeCurrency: { name: 'PROS', symbol: 'PROS', decimals: 18 },
                blockExplorerUrls: [PHAROS_CONSTANTS.explorerUrl],
              },
            ],
          });
        }
      }

      // Fetch real live on-chain balances from Pharos RPC
      const [prosRaw, usdcRaw] = await Promise.all([
        pharosPublicClient.getBalance({ address: userAddress }),
        pharosPublicClient.readContract({
          address: PHAROS_CONSTANTS.nativeUsdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress],
        }).catch(() => BigInt(0)),
      ]);

      const prosBal = parseFloat(formatEther(prosRaw));
      const usdcBal = parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals));

      setCreatedAddress(userAddress);
      setCreatedBalances({ usdc: usdcBal, pros: prosBal });
      setLoginStep('created');

      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess(userAddress, usdcBal, prosBal, 'metamask');
        onClose();
        setLoginStep('methods');
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      setLoginStep('methods');
      setErrorMessage(err?.message || 'Failed to connect browser wallet.');
    }
  };

  // 2. Generate Real Cryptographic Session Key (Autonomous Agent Non-Custodial Wallet)
  const handleGenerateSessionWallet = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setLoginStep('verifying');

    try {
      // Cryptographically generate private key using Viem
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      // Save session key in localStorage for autonomous agent use
      if (typeof window !== 'undefined') {
        localStorage.setItem('pharos_agent_session_pk', privateKey);
        localStorage.setItem('pharos_agent_wallet_address', account.address);
      }

      // Query real on-chain balance on Pharos Mainnet
      const [prosRaw, usdcRaw] = await Promise.all([
        pharosPublicClient.getBalance({ address: account.address }),
        pharosPublicClient.readContract({
          address: PHAROS_CONSTANTS.nativeUsdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        }).catch(() => BigInt(0)),
      ]);

      const prosBal = parseFloat(formatEther(prosRaw));
      const usdcBal = parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals));

      setCreatedAddress(account.address);
      setCreatedBalances({ usdc: usdcBal, pros: prosBal });
      setLoginStep('created');

      setTimeout(() => {
        setIsSubmitting(false);
        onLoginSuccess(account.address, usdcBal, prosBal, 'session_key');
        onClose();
        setLoginStep('methods');
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      setLoginStep('methods');
      setErrorMessage(err?.message || 'Failed to provision session key.');
    }
  };

  const handleSocialClick = (provider: string) => {
    setErrorMessage(
      `Direct ${provider} social OAuth requires setting NEXT_PUBLIC_PRIVY_APP_ID in your environment. To interact with Pharos Mainnet immediately, connect MetaMask or generate a Session Key below!`
    );
  };

  const handleCopy = () => {
    if (createdAddress) {
      navigator.clipboard.writeText(createdAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                  Connect Wallet to Pharos
                </h3>
                <p className="text-[11px] text-gray-500">
                  Pharos Mainnet (Chain ID 1672)
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Connect your Web3 wallet or generate a non-custodial session key to authorize real on-chain x402 data micropayments.
            </p>

            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5 leading-normal">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Primary Option: Real MetaMask / Injected Browser Wallet */}
            <div className="space-y-2 mb-4">
              <button
                onClick={handleConnectBrowserWallet}
                disabled={isSubmitting}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold bg-[#0012b8] hover:bg-[#000f96] text-white rounded-xl transition-all shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-white" />
                  <span>Connect MetaMask / Rabby</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-blue-200" />
              </button>

              <button
                onClick={handleGenerateSessionWallet}
                disabled={isSubmitting}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold border border-[#5c41ff]/30 bg-purple-50 hover:bg-purple-100 text-[#5c41ff] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#5c41ff]" />
                  <span>Generate Agent Session Key</span>
                </div>
                <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-purple-200 font-mono">
                  Autonomous
                </span>
              </button>
            </div>

            <div className="relative flex py-1 items-center mb-3">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-gray-400 uppercase font-mono tracking-wider">
                or social sign-in
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Social Options (Privy SDK integrations) */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => handleSocialClick('Google')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] text-gray-700 transition-colors"
              >
                <span className="font-bold text-red-500 text-xs">G</span> Google
              </button>
              <button
                onClick={() => handleSocialClick('GitHub')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#e5e7eb] rounded-lg hover:bg-[#f9fafb] text-gray-700 transition-colors"
              >
                <span className="font-bold text-gray-900 text-xs">⌘</span> GitHub
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" /> Real RPC: rpc.pharos.xyz
              </span>
              <a
                href="https://pharosscan.xyz"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-600 flex items-center gap-0.5"
              >
                Explorer <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        )}

        {loginStep === 'verifying' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-[#5c41ff] animate-pulse">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Querying Pharos Mainnet...</h4>
              <p className="text-xs text-gray-500 mt-1">
                Connecting address and querying live balances from https://rpc.pharos.xyz...
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
              <h4 className="text-sm font-bold text-gray-900">Connected to Pharos Mainnet!</h4>
              <div className="mt-2 bg-[#f2f4f5] px-2.5 py-1.5 rounded font-mono text-[11px] text-gray-800 break-all flex items-center justify-between gap-1">
                <span>{createdAddress}</span>
                <button onClick={handleCopy} className="text-gray-500 hover:text-gray-900 shrink-0">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-center gap-4 text-xs font-mono">
                <div className="text-gray-600">
                  PROS: <span className="font-bold text-gray-900">{createdBalances.pros.toFixed(4)}</span>
                </div>
                <div className="text-gray-600">
                  USDC: <span className="font-bold text-[#0012b8]">{createdBalances.usdc.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
