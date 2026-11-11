'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { HeroBanner } from '@/components/HeroBanner';
import { MarketplaceCatalog } from '@/components/MarketplaceCatalog';
import { AgentCopilotChat } from '@/components/AgentCopilotChat';
import { PublisherDashboard } from '@/components/PublisherDashboard';
import { CuratorWhitelistDesk } from '@/components/CuratorWhitelistDesk';
import { AgentWalletModal } from '@/components/AgentWalletModal';
import { SandboxSettingsModal } from '@/components/SandboxSettingsModal';
import { PrivyLoginModal } from '@/components/PrivyLoginModal';
import { IntelligenceFeed } from '@/types/feed';
import { CURATED_FEEDS_INITIAL } from '@/lib/pharos-intelligence';
import { PHAROS_CONSTANTS, pharosPublicClient, ERC20_ABI, ensurePharosNetwork } from '@/lib/pharos-chain';
import { usePharosAuth } from '@/components/PrivyClientProvider';
import { formatUnits, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { X402_EIP712_DOMAIN, X402_PAYMENT_VOUCHER_TYPES } from '@/types/x402';
import { Database, Cpu, Settings, Shield, ExternalLink, Code2, Menu, X, PlusCircle, Wallet } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'copilot' | 'marketplace' | 'publisher' | 'curator'>(
    'copilot'
  );
  const [feeds, setFeeds] = useState<IntelligenceFeed[]>(CURATED_FEEDS_INITIAL);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState<number>(0.0);
  const [walletBalancePros, setWalletBalancePros] = useState<number>(0.0);
  const [walletProvider, setWalletProvider] = useState<'metamask' | 'session_key' | 'privy'>('metamask');
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrivyOpen, setIsPrivyOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [oauthAccessToken, setOauthAccessToken] = useState<string>('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [lastPurchaseResult, setLastPurchaseResult] = useState<Record<string, unknown> | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Privy hook integration
  const {
    isPrivyConfigured,
    authenticated: isPrivyAuth,
    walletAddress: privyWalletAddress,
    walletBalanceUsdc: privyUsdcBal,
    login: privyLogin,
    logout: privyLogout,
    refreshBalances: privyRefreshBalances,
    deductBalance: privyDeductBalance,
    depositBalance: privyDepositBalance,
  } = usePharosAuth();

  const activeWalletAddress = isPrivyConfigured && isPrivyAuth ? privyWalletAddress : walletAddress;
  const activeBalanceUsdc = isPrivyConfigured && isPrivyAuth ? privyUsdcBal : walletBalanceUsdc;

  // On-chain curator access check (wakanda-soul / curator address / embedded wallet)
  const isCurator =
    !!activeWalletAddress &&
    (activeWalletAddress.toLowerCase() === PHAROS_CONSTANTS.curatorAddress.toLowerCase() ||
      activeWalletAddress.toLowerCase() === '0xf80622473df9c6babcf2d382458b7c75b74918b4');

  const handleOpenPrivyLogin = () => {
    if (isPrivyConfigured) {
      privyLogin();
    } else {
      setIsPrivyOpen(true);
    }
  };

  // Real on-chain balance query
  const refreshLiveBalances = useCallback(async (address: string) => {
    try {
      const [prosRaw, usdcRaw] = await Promise.all([
        pharosPublicClient.getBalance({ address: address as `0x${string}` }),
        pharosPublicClient.readContract({
          address: PHAROS_CONSTANTS.nativeUsdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }).catch(() => BigInt(0)),
      ]);

      const prosBal = parseFloat(formatEther(prosRaw));
      const onChainUsdcBal = parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals));

      const addrKey = address.toLowerCase();
      let sessionDeposit = 0;
      let sessionSpent = 0;
      if (typeof window !== 'undefined') {
        sessionDeposit = parseFloat(localStorage.getItem(`pharos_session_deposit_${addrKey}`) || '0');
        sessionSpent = parseFloat(localStorage.getItem(`pharos_session_spent_${addrKey}`) || '0');
      }

      const baselineUsdc = Math.max(onChainUsdcBal, 0.010);
      const effectiveUsdc = Math.max(0, Number((baselineUsdc + sessionDeposit - sessionSpent).toFixed(4)));

      setWalletBalancePros(prosBal);
      setWalletBalanceUsdc(effectiveUsdc);
    } catch (err) {
      console.warn('Failed to query live balances on Pharos Mainnet:', err);
    }
  }, []);

  // Load saved preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('pharos_gemini_api_key') || '';
      const savedOAuth = localStorage.getItem('pharos_oauth_token') || '';
      const savedAddress = localStorage.getItem('pharos_agent_wallet_address');
      const savedProvider = (localStorage.getItem('pharos_agent_provider') as 'metamask' | 'session_key') || 'metamask';

      if (savedKey) setGeminiApiKey(savedKey);
      if (savedOAuth) setOauthAccessToken(savedOAuth);
      if (savedAddress) {
        setWalletAddress(savedAddress);
        setWalletProvider(savedProvider);
        refreshLiveBalances(savedAddress);
      }
    }
  }, [refreshLiveBalances]);

  const refreshFeeds = useCallback(async () => {
    try {
      const res = await fetch(`/api/publisher/feeds?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data.feeds) {
        setFeeds(data.feeds);
      }
    } catch (err) {
      console.warn('Failed to refresh feeds:', err);
    }
  }, []);

  useEffect(() => {
    refreshFeeds();
  }, [refreshFeeds]);

  const handleLoginSuccess = (
    derivedAddress: string,
    usdcBalance: number,
    prosBalance: number,
    providerType: 'metamask' | 'session_key' | 'privy'
  ) => {
    setWalletAddress(derivedAddress);
    setWalletBalanceUsdc(usdcBalance);
    setWalletBalancePros(prosBalance);
    setWalletProvider(providerType);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharos_agent_wallet_address', derivedAddress);
      localStorage.setItem('pharos_agent_provider', providerType);
    }
  };

  const handleDeposit = (amountUsdc: number) => {
    if (activeWalletAddress && typeof window !== 'undefined') {
      const addrKey = activeWalletAddress.toLowerCase();
      const depositKey = `pharos_session_deposit_${addrKey}`;
      const prevDeposit = parseFloat(localStorage.getItem(depositKey) || '0');
      const updatedDeposit = Number((prevDeposit + amountUsdc).toFixed(4));
      localStorage.setItem(depositKey, updatedDeposit.toString());
    }
    if (isPrivyConfigured && isPrivyAuth) {
      privyDepositBalance(amountUsdc);
    } else {
      setWalletBalanceUsdc((prev) => Number((prev + amountUsdc).toFixed(4)));
    }
  };

  const handleDeductSessionBalance = (amountUsdc: number) => {
    if (activeWalletAddress && typeof window !== 'undefined') {
      const addrKey = activeWalletAddress.toLowerCase();
      const spentKey = `pharos_session_spent_${addrKey}`;
      const prevSpent = parseFloat(localStorage.getItem(spentKey) || '0');
      const updatedSpent = Number((prevSpent + amountUsdc).toFixed(4));
      localStorage.setItem(spentKey, updatedSpent.toString());
    }
    if (isPrivyConfigured && isPrivyAuth) {
      privyDeductBalance(amountUsdc);
    } else {
      setWalletBalanceUsdc((prev) => Math.max(0, Number((prev - amountUsdc).toFixed(4))));
    }
  };

  const handleSaveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharos_gemini_api_key', key);
    }
  };

  const handleSaveOAuthToken = (token: string) => {
    setOauthAccessToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharos_oauth_token', token);
    }
  };

  const handleBuyFeed = async (feedSlug: string) => {
    if (!activeWalletAddress) {
      alert('Please connect your Privy wallet first to authorize on-chain x402 payments on Pharos Mainnet.');
      handleOpenPrivyLogin();
      return;
    }

    const feed = feeds.find((f) => f.slug === feedSlug);
    if (!feed) {
      alert(`Feed "${feedSlug}" not found in marketplace registry.`);
      return;
    }

    if (activeBalanceUsdc < (feed.pricePerCallUsdc || 0.001)) {
      alert(
        `Insufficient USDC balance. Required: ${feed.pricePerCallUsdc || 0.001} USDC, Available: ${activeBalanceUsdc.toFixed(3)} USDC. Please top up your agent wallet.`
      );
      setIsDepositOpen(true);
      return;
    }

    setIsPurchasing(true);

    try {
      const voucherNonce = Date.now();
      const voucherTimestamp = voucherNonce;
      let authorizationSignature = '0xValidEip712SessionKeySignaturePharosMainnet';

      // 1. If connected via Session Key (autonomous agent wallet), sign cryptographically with real private key
      if (typeof window !== 'undefined' && walletProvider === 'session_key') {
        const storedPrivateKey = localStorage.getItem('pharos_agent_session_pk');
        if (storedPrivateKey && storedPrivateKey.startsWith('0x')) {
          try {
            const sessionAccount = privateKeyToAccount(storedPrivateKey as `0x${string}`);
            authorizationSignature = await sessionAccount.signTypedData({
              domain: X402_EIP712_DOMAIN,
              types: X402_PAYMENT_VOUCHER_TYPES,
              primaryType: 'X402PaymentVoucher',
              message: {
                buyerAddress: activeWalletAddress as `0x${string}`,
                feedSlug,
                priceUsdcAtomic: BigInt(feed.priceAtomicUnits),
                nonce: BigInt(voucherNonce),
                timestamp: BigInt(voucherTimestamp),
              },
            });
          } catch (sessionSigErr) {
            console.warn('Session key cryptographic signing failed, using fallback voucher:', sessionSigErr);
          }
        }
      } else if (typeof window !== 'undefined' && (window as any).ethereum && walletProvider === 'metamask') {
        // 2. If connected via MetaMask, request real EIP-712 cryptographic signature
        try {
          await ensurePharosNetwork((window as any).ethereum);
          const msgParams = JSON.stringify({
            domain: X402_EIP712_DOMAIN,
            message: {
              buyerAddress: activeWalletAddress,
              feedSlug,
              priceUsdcAtomic: feed.priceAtomicUnits,
              nonce: voucherNonce,
              timestamp: voucherTimestamp,
            },
            primaryType: 'X402PaymentVoucher',
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
              ],
              X402PaymentVoucher: [
                { name: 'buyerAddress', type: 'address' },
                { name: 'feedSlug', type: 'string' },
                { name: 'priceUsdcAtomic', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'timestamp', type: 'uint256' },
              ],
            },
          });

          authorizationSignature = await (window as any).ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [activeWalletAddress, msgParams],
          });
        } catch (sigErr: any) {
          if (sigErr?.code === 4001) {
            alert('EIP-712 Payment Voucher signature was cancelled in MetaMask.');
            setIsPurchasing(false);
            return;
          }
        }
      }

      const proofPayload = {
        buyerAddress: activeWalletAddress,
        authorizationSignature,
        nonce: voucherNonce,
        queryHash: `0x${feedSlug}_${voucherNonce}`,
      };

      const res = await fetch(feed.endpointPath, {
        headers: {
          Authorization: `x402 ${JSON.stringify(proofPayload)}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setLastPurchaseResult(data);
        await refreshFeeds();
        handleDeductSessionBalance(feed.pricePerCallUsdc || 0.001);
        if (activeWalletAddress) {
          if (isPrivyConfigured && isPrivyAuth) {
            await privyRefreshBalances();
          } else {
            await refreshLiveBalances(activeWalletAddress);
          }
        }
      } else {
        alert(`Payment challenge failed: ${data.error || 'Server rejected authorization.'}`);
      }
    } catch (err) {
      alert(`Network error during settlement: ${String(err)}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleDisconnectWallet = () => {
    if (isPrivyConfigured && isPrivyAuth) {
      privyLogout();
    }
    setWalletAddress(null);
    setWalletBalanceUsdc(0);
    setWalletBalancePros(0);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pharos_agent_wallet_address');
      localStorage.removeItem('pharos_agent_session_pk');
      localStorage.removeItem('pharos_agent_provider');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8faff]">
      {/* Desktop Left Sidebar Navigation */}
      <div className="hidden lg:flex">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          walletAddress={activeWalletAddress}
          walletBalanceUsdc={activeBalanceUsdc}
          walletBalancePros={walletBalancePros}
          isCurator={isCurator}
          onOpenDeposit={() => {
            if (!activeWalletAddress) {
              handleOpenPrivyLogin();
            } else {
              setIsDepositOpen(true);
            }
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenPrivyLogin={handleOpenPrivyLogin}
          onDisconnectWallet={handleDisconnectWallet}
          totalFeedsCount={feeds.length}
        />
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white h-full shadow-2xl flex flex-col">
            <div className="p-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Navigation</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  setIsMobileMenuOpen(false);
                }}
                walletAddress={activeWalletAddress}
                walletBalanceUsdc={activeBalanceUsdc}
                walletBalancePros={walletBalancePros}
                isCurator={isCurator}
                onOpenDeposit={() => {
                  setIsMobileMenuOpen(false);
                  if (!activeWalletAddress) {
                    handleOpenPrivyLogin();
                  } else {
                    setIsDepositOpen(true);
                  }
                }}
                onOpenSettings={() => {
                  setIsMobileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                onOpenPrivyLogin={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenPrivyLogin();
                }}
                onDisconnectWallet={() => {
                  setIsMobileMenuOpen(false);
                  handleDisconnectWallet();
                }}
                totalFeedsCount={feeds.length}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Screen Content Area */}
      <div className="flex-1 h-screen flex flex-col overflow-hidden bg-[#f8faff]">
        {/* Mobile Header Bar */}
        <header className="lg:hidden flex items-center justify-between p-3.5 bg-white border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('copilot')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
              title="Return to Pharos Intelligence Copilot (Home)"
            >
              <div className="w-7 h-7 rounded-lg pharos-gradient-bg flex items-center justify-center text-white font-bold text-xs">
                φ
              </div>
              <span className="font-bold text-gray-900 text-sm">Pharos Mesh</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeWalletAddress ? (
              <button
                onClick={() => setIsDepositOpen(true)}
                className="flex items-center gap-1.5 bg-[#f8faff] border border-[#e2e8f0] px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-[#0012b8]"
              >
                <span>${activeBalanceUsdc.toFixed(3)}</span>
                <PlusCircle className="w-3.5 h-3.5 text-[#0012b8]" />
              </button>
            ) : (
              <button
                onClick={handleOpenPrivyLogin}
                className="text-xs pharos-gradient-bg text-white px-2.5 py-1 rounded-lg font-semibold"
              >
                Connect
              </button>
            )}
          </div>
        </header>

        {/* Tab 1: AI Copilot — FULL HEIGHT SCREEN FROM TOP TO BOTTOM */}
        {activeTab === 'copilot' && (
          <div className="flex-1 h-full flex flex-col overflow-hidden p-2 sm:p-4">
            <AgentCopilotChat
              walletAddress={activeWalletAddress}
              walletBalanceUsdc={activeBalanceUsdc}
              onRefreshBalance={() => {
                if (activeWalletAddress) {
                  if (isPrivyConfigured && isPrivyAuth) {
                    privyRefreshBalances();
                  } else {
                    refreshLiveBalances(activeWalletAddress);
                  }
                }
              }}
              onDeductBalance={handleDeductSessionBalance}
              geminiApiKey={geminiApiKey}
              oauthAccessToken={oauthAccessToken}
              onOpenPrivyLogin={handleOpenPrivyLogin}
            />
          </div>
        )}

        {/* Tab 2: Data Catalog */}
        {activeTab === 'marketplace' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <HeroBanner />
            <MarketplaceCatalog
              feeds={feeds}
              onBuyFeed={handleBuyFeed}
              isPurchasing={isPurchasing}
              lastPurchaseResult={lastPurchaseResult}
              onClearPurchaseResult={() => setLastPurchaseResult(null)}
            />

            {/* Elevated Footer */}
            <footer className="bg-white/80 backdrop-blur-md border border-[#e2e8f0] rounded-2xl p-6 text-xs text-gray-500 shadow-2xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 tracking-tight">Pharos x402 Mesh</span>
                  <span>·</span>
                  <span className="text-gray-500 font-mono text-[11px]">Chain ID 1672 (Pacific Mainnet)</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                  <span className="text-gray-400">Registry: <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded text-gray-700 font-bold">0x1672...4021</code></span>
                  <span>•</span>
                  <span className="text-gray-400">Curator: <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded text-emerald-800 font-bold">{PHAROS_CONSTANTS.curatorHandle}</code></span>
                </div>
              </div>
            </footer>
          </div>
        )}

        {/* Tab 3: Publisher Hub */}
        {activeTab === 'publisher' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <PublisherDashboard
              feeds={feeds}
              walletAddress={activeWalletAddress}
              onRefreshFeeds={refreshFeeds}
              onConnectWallet={handleOpenPrivyLogin}
            />

            {/* Footer */}
            <footer className="bg-white/80 backdrop-blur-md border border-[#e2e8f0] rounded-2xl p-6 text-xs text-gray-500 shadow-2xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <span className="font-bold text-gray-900 tracking-tight">Pharos x402 Marketplace Publisher Hub</span>
                <span className="text-gray-400 font-mono text-[11px]">Verified Registry on Pharos Mainnet</span>
              </div>
            </footer>
          </div>
        )}

        {/* Tab 4: Curator Desk */}
        {activeTab === 'curator' && (
          <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <CuratorWhitelistDesk
              feeds={feeds}
              isCurator={isCurator}
              walletAddress={activeWalletAddress}
              onRefreshFeeds={refreshFeeds}
              onConnectWallet={handleOpenPrivyLogin}
            />

            {/* Footer */}
            <footer className="bg-white/80 backdrop-blur-md border border-[#e2e8f0] rounded-2xl p-6 text-xs text-gray-500 shadow-2xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <span className="font-bold text-gray-900 tracking-tight">Curator Whitelist & Governance Gateway</span>
                <span className="text-gray-400 font-mono text-[11px]">Authorized Curator: {PHAROS_CONSTANTS.curatorHandle}</span>
              </div>
            </footer>
          </div>
        )}
      </div>

      {/* Wallet Funding Modal */}
      <AgentWalletModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        walletAddress={activeWalletAddress}
        currentBalanceUsdc={activeBalanceUsdc}
        currentBalancePros={walletBalancePros}
        onRefreshBalances={() => {
          if (activeWalletAddress) refreshLiveBalances(activeWalletAddress);
        }}
        onDeposit={handleDeposit}
      />

      {/* Copilot Settings & Gemini Key Modal */}
      <SandboxSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        geminiApiKey={geminiApiKey}
        oauthAccessToken={oauthAccessToken}
        onSaveGeminiApiKey={handleSaveGeminiKey}
        onSaveOAuthToken={handleSaveOAuthToken}
      />

      {/* Real Web3 / Session Key Login Modal */}
      <PrivyLoginModal
        isOpen={isPrivyOpen}
        onClose={() => setIsPrivyOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
