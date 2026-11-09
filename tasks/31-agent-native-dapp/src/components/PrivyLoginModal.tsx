'use client';

import React, { useState } from 'react';
import { X, Shield, Mail, Sparkles, Check, ArrowRight, Wallet, ExternalLink, AlertCircle, Copy, CheckCheck, KeyRound } from 'lucide-react';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { formatUnits, formatEther } from 'viem';
import { pharosPublicClient, PHAROS_CONSTANTS, ERC20_ABI, ensurePharosNetwork } from '@/lib/pharos-chain';
import { usePharosAuth } from './PrivyClientProvider';

interface PrivyLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (derivedAddress: string, usdcBalance: number, prosBalance: number, providerType: 'metamask' | 'session_key' | 'privy') => void;
}

export const PrivyLoginModal: React.FC<PrivyLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const { isPrivyConfigured, privyAppId, setPrivyAppId, login: privyLogin } = usePharosAuth();

  const [inputAppId, setInputAppId] = useState(privyAppId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loginStep, setLoginStep] = useState<'methods' | 'verifying' | 'created'>('methods');
  const [createdAddress, setCreatedAddress] = useState('');
  const [createdBalances, setCreatedBalances] = useState<{ usdc: number; pros: number }>({ usdc: 0, pros: 0 });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // 1. Official Privy Login (Opens real Privy Modal with Google, Email, Embedded Wallet)
  const handleOfficialPrivyLogin = () => {
    onClose();
    privyLogin();
  };

  // 2. Set Privy App ID
  const handleSavePrivyAppId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = inputAppId.trim();
    // Allow both legacy 'cl' and modern 'cm' prefixes for Privy App IDs
    const isValidPrivyId = /^(cl|cm)[a-zA-Z0-9_-]{12,}$/.test(cleanId);
    if (!isValidPrivyId) {
      setErrorMessage('Invalid Privy App ID format. A valid Privy App ID starts with "cm" or "cl" (e.g. cmw6zurar00910hl1rsqen5go). Obtain one at dashboard.privy.io');
      return;
    }
    setPrivyAppId(cleanId);
    setErrorMessage(null);
    alert('Privy App ID activated! The official Privy login modal is now live.');
    onClose();
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  // 3. Connect via real MetaMask / Browser Injected Wallet (EIP-1193)
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
      await ensurePharosNetwork(ethereum);

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

  // 4. Generate Real Cryptographic Session Key (Autonomous Agent Non-Custodial Wallet)
  const handleGenerateSessionWallet = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setLoginStep('verifying');

    try {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      if (typeof window !== 'undefined') {
        localStorage.setItem('pharos_agent_session_pk', privateKey);
        localStorage.setItem('pharos_agent_wallet_address', account.address);
      }

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

  const handleCopy = () => {
    if (createdAddress) {
      navigator.clipboard.writeText(createdAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {loginStep === 'methods' && (
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-xl pharos-gradient-bg flex items-center justify-center text-white font-bold text-sm shadow-2xs">
                φ
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">
                  Connect with Privy
                </h3>
                <p className="text-[11px] text-gray-500 font-mono">
                  Embedded Agent Wallet · Chain ID 1672
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Authenticate to provision an embedded agent session wallet and authorize on-chain x402 data micropayments.
            </p>

            {errorMessage && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5 leading-normal">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Official Privy Login when configured */}
            {isPrivyConfigured ? (
              <div className="space-y-2 mb-4">
                <button
                  onClick={handleOfficialPrivyLogin}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold pharos-gradient-bg hover:opacity-95 text-white rounded-xl transition-all shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Open Privy Modal (Google / Email)</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-200" />
                </button>
              </div>
            ) : (
              /* If Privy App ID not configured yet, let user paste it or connect browser wallet */
              <div className="space-y-3 mb-4">
                <form onSubmit={handleSavePrivyAppId} className="bg-[#f8faff] p-3.5 rounded-xl border border-blue-100/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-gray-800 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-[#5c41ff]" /> Privy App ID:
                    </span>
                    <a
                      href="https://dashboard.privy.io"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#0012b8] hover:underline flex items-center gap-0.5 font-medium"
                    >
                      Get free ID <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={inputAppId}
                      onChange={(e) => setInputAppId(e.target.value)}
                      placeholder="cm..."
                      className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#5c41ff] font-mono"
                    />
                    <button
                      type="submit"
                      className="pharos-gradient-bg hover:opacity-95 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 shadow-2xs"
                    >
                      Activate
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
                    Paste your Privy App ID to trigger official Google OAuth and embedded wallet creation.
                  </p>
                </form>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-gray-400 uppercase font-mono tracking-wider">
                    or instant direct connect
                  </span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <button
                  onClick={handleConnectBrowserWallet}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold pharos-gradient-bg hover:opacity-95 text-white rounded-xl transition-all shadow-xs active:scale-[0.99]"
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
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium border border-[#e2e8f0] bg-white hover:bg-slate-50 text-gray-700 rounded-xl transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#5c41ff]" />
                    <span>Generate Local Session Key</span>
                  </div>
                  <span className="text-[10px] bg-[#f1f5f9] px-1.5 py-0.5 rounded border border-[#e2e8f0] font-mono text-gray-600">
                    Zero-Config
                  </span>
                </button>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-gray-400">
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 tracking-tight">Connected to Pharos Mainnet!</h4>
              <div className="mt-3 bg-[#f8faff] border border-[#e2e8f0] px-3 py-2 rounded-xl font-mono text-[11px] text-gray-800 break-all flex items-center justify-between gap-1 shadow-2xs">
                <span>{createdAddress}</span>
                <button onClick={handleCopy} className="text-gray-500 hover:text-gray-900 shrink-0 p-1 rounded hover:bg-white transition-colors">
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="mt-3.5 flex items-center justify-center gap-4 text-xs font-mono bg-[#f8faff] border border-[#e2e8f0] py-2 rounded-xl">
                <div className="text-gray-600">
                  PROS: <span className="font-bold text-gray-900">{createdBalances.pros.toFixed(4)}</span>
                </div>
                <div className="text-gray-300">|</div>
                <div className="text-gray-600">
                  USDC: <span className="font-bold text-[#0012b8]">${createdBalances.usdc.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
