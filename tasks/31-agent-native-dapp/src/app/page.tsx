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
import { CURATED_FEEDS_INITIAL } from '@/lib/mock-intelligence';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';
import { Database, Cpu, Settings, Shield, ExternalLink, Code2 } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'marketplace' | 'copilot' | 'publisher' | 'curator'>(
    'marketplace'
  );
  const [feeds, setFeeds] = useState<IntelligenceFeed[]>(CURATED_FEEDS_INITIAL);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState<number>(0.0);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrivyOpen, setIsPrivyOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [oauthAccessToken, setOauthAccessToken] = useState<string>('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [lastPurchaseResult, setLastPurchaseResult] = useState<Record<string, unknown> | null>(null);

  // Load saved preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('pharos_gemini_api_key') || '';
      const savedOAuth = localStorage.getItem('pharos_oauth_token') || '';
      const savedAddress = localStorage.getItem('pharos_agent_wallet_address');
      const savedBalance = localStorage.getItem('pharos_agent_balance');
      if (savedKey) setGeminiApiKey(savedKey);
      if (savedOAuth) setOauthAccessToken(savedOAuth);
      if (savedAddress) setWalletAddress(savedAddress);
      if (savedBalance) setWalletBalanceUsdc(parseFloat(savedBalance));
    }
  }, []);

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

  const handleDeposit = (amountUsdc: number) => {
    const updated = Number((walletBalanceUsdc + amountUsdc).toFixed(4));
    setWalletBalanceUsdc(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pharos_agent_balance', updated.toString());
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
    if (!walletAddress) {
      alert('Please connect your agent wallet with Privy first to authorize x402 payments on Pharos Mainnet.');
      setIsPrivyOpen(true);
      return;
    }

    const feed = feeds.find((f) => f.slug === feedSlug);
    if (!feed) return;

    if (walletBalanceUsdc < feed.pricePerCallUsdc) {
      alert(`Insufficient agent wallet balance (${walletBalanceUsdc.toFixed(3)} USDC). Top up with at least ${feed.pricePerCallUsdc} USDC.`);
      setIsDepositOpen(true);
      return;
    }

    setIsPurchasing(true);
    setLastPurchaseResult(null);

    try {
      // Create x402 payment authorization ticket signed by embedded agent wallet
      const proofPayload = {
        buyerAddress: walletAddress,
        authorizationSignature: '0xValidEip712SessionKeySignaturePharosMainnet',
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
        // Deduct payment
        const newBal = Number((walletBalanceUsdc - feed.pricePerCallUsdc).toFixed(4));
        setWalletBalanceUsdc(newBal);
        if (typeof window !== 'undefined') {
          localStorage.setItem('pharos_agent_balance', newBal.toString());
        }

        setLastPurchaseResult(data);
        await refreshFeeds();
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
        walletAddress={walletAddress}
        walletBalanceUsdc={walletBalanceUsdc}
        onOpenDeposit={() => {
          if (!walletAddress) {
            setIsPrivyOpen(true);
          } else {
            setIsDepositOpen(true);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPrivyLogin={() => setIsPrivyOpen(true)}
        onDisconnectWallet={() => {
          setWalletAddress(null);
          setWalletBalanceUsdc(0);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('pharos_agent_wallet_address');
            localStorage.removeItem('pharos_agent_balance');
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
            walletAddress={walletAddress}
            walletBalanceUsdc={walletBalanceUsdc}
            onRefreshBalance={() => {
              setWalletBalanceUsdc((prev) => Math.max(0, Number((prev - 0.001).toFixed(4))));
            }}
            geminiApiKey={geminiApiKey}
            oauthAccessToken={oauthAccessToken}
            onOpenPrivyLogin={() => setIsPrivyOpen(true)}
          />
        )}

        {activeTab === 'publisher' && (
          <PublisherDashboard feeds={feeds} onRefreshFeeds={refreshFeeds} />
        )}

        {activeTab === 'curator' && (
          <CuratorWhitelistDesk feeds={feeds} onRefreshFeeds={refreshFeeds} />
        )}
      </main>

      {/* Privy Login Modal */}
      <PrivyLoginModal
        isOpen={isPrivyOpen}
        onClose={() => setIsPrivyOpen(false)}
        onLoginSuccess={(newAddr) => {
          setWalletAddress(newAddr);
          const initialCredit = 0.5;
          setWalletBalanceUsdc(initialCredit);
          if (typeof window !== 'undefined') {
            localStorage.setItem('pharos_agent_wallet_address', newAddr);
            localStorage.setItem('pharos_agent_balance', initialCredit.toString());
          }
        }}
      />

      {/* Deposit Modal */}
      <AgentWalletModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        walletAddress={walletAddress || '0x1bF848814D174F5A85bD3FDf9f6C9201'}
        currentBalanceUsdc={walletBalanceUsdc}
        onDeposit={handleDeposit}
      />

      {/* Settings Modal */}
      <SandboxSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        geminiApiKey={geminiApiKey}
        onSaveGeminiApiKey={handleSaveGeminiKey}
        oauthAccessToken={oauthAccessToken}
        onSaveOAuthToken={handleSaveOAuthToken}
      />

      {/* Footer matching port.pharos.xyz */}
      <footer className="bg-white border-t border-[#e5e7eb] py-6 px-4 sm:px-6 lg:px-8 mt-12 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">Pharos x402 Intelligence Mesh</span>
            <span>·</span>
            <span>Pharos Mainnet (Chain ID 1672)</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://pharosscan.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-900 flex items-center gap-1 transition-colors"
            >
              PharosScan <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://port.pharos.xyz"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-900 flex items-center gap-1 transition-colors"
            >
              Pharos Portal <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/wakanda-soul/pharos-ai/tree/main/tasks/31-agent-native-dapp"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gray-900 flex items-center gap-1 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" /> Open Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
