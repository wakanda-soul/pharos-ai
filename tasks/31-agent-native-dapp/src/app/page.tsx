'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
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
import { PHAROS_CONSTANTS, pharosPublicClient, ERC20_ABI } from '@/lib/pharos-chain';
import { usePharosAuth } from '@/components/PrivyClientProvider';
import { formatUnits, formatEther } from 'viem';
import { Database, Cpu, Settings, Shield, ExternalLink, Code2 } from 'lucide-react';

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

  // Privy hook integration
  const {
    isPrivyConfigured,
    authenticated: isPrivyAuth,
    walletAddress: privyWalletAddress,
    walletBalanceUsdc: privyUsdcBal,
    login: privyLogin,
    logout: privyLogout,
    refreshBalances: privyRefreshBalances,
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
      const usdcBal = parseFloat(formatUnits(usdcRaw, PHAROS_CONSTANTS.usdcDecimals));
      setWalletBalancePros(prosBal);
      setWalletBalanceUsdc(usdcBal);
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
      const res = await fetch('/api/publisher/feeds');
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
    const updated = Number((walletBalanceUsdc + amountUsdc).toFixed(4));
    setWalletBalanceUsdc(updated);
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
    if (!feed) return;

    setIsPurchasing(true);
    setLastPurchaseResult(null);

    try {
      let authorizationSignature = '0xValidEip712SessionKeySignaturePharosMainnet';

      // If connected via MetaMask, request real EIP-712 cryptographic signature
      if (typeof window !== 'undefined' && (window as any).ethereum && walletProvider === 'metamask') {
        try {
          const msgParams = JSON.stringify({
            domain: {
              name: 'Pharos x402 Intelligence Mesh',
              version: '1',
              chainId: PHAROS_CONSTANTS.chainId,
              verifyingContract: PHAROS_CONSTANTS.registryContractAddress,
            },
            message: {
              buyerAddress: activeWalletAddress,
              feedSlug,
              priceUsdcAtomic: feed.priceAtomicUnits,
              timestamp: Date.now(),
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
        nonce: Date.now(),
        queryHash: `0x${feedSlug}_${Date.now()}`,
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

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f4f5]">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        walletAddress={activeWalletAddress}
        walletBalanceUsdc={activeBalanceUsdc}
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
        onDisconnectWallet={() => {
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
        }}
      />

      {/* Hero Banner */}
      <HeroBanner />

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'marketplace' && (
          <MarketplaceCatalog
            feeds={feeds}
            onBuyFeed={handleBuyFeed}
            isPurchasing={isPurchasing}
            lastPurchaseResult={lastPurchaseResult}
            onClearPurchaseResult={() => setLastPurchaseResult(null)}
          />
        )}

        {activeTab === 'copilot' && (
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
            geminiApiKey={geminiApiKey}
            oauthAccessToken={oauthAccessToken}
            onOpenPrivyLogin={handleOpenPrivyLogin}
          />
        )}

        {activeTab === 'publisher' && (
          <PublisherDashboard
            feeds={feeds}
            walletAddress={activeWalletAddress}
            onRefreshFeeds={refreshFeeds}
            onConnectWallet={handleOpenPrivyLogin}
          />
        )}

        {activeTab === 'curator' && (
          <CuratorWhitelistDesk
            feeds={feeds}
            isCurator={isCurator}
            walletAddress={activeWalletAddress}
            onRefreshFeeds={refreshFeeds}
            onConnectWallet={handleOpenPrivyLogin}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e5e7eb] py-6 mt-12 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">Pharos x402 Mesh</span>
            <span>·</span>
            <a
              href="https://pharosscan.xyz"
              target="_blank"
              rel="noreferrer"
              className="text-[#0012b8] hover:underline flex items-center gap-1"
            >
              Pharos Mainnet (Chain ID 1672) <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Registry: <code className="bg-[#f2f4f5] px-1.5 py-0.5 rounded text-gray-700">0x1672...4021</code></span>
            <span>Curator: <code className="bg-[#f2f4f5] px-1.5 py-0.5 rounded text-gray-700">wakanda-soul</code></span>
          </div>
        </div>
      </footer>

      {/* Wallet Funding Modal */}
      <AgentWalletModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        walletAddress={activeWalletAddress}
        currentBalanceUsdc={activeBalanceUsdc}
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
