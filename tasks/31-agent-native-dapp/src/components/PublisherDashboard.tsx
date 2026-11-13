'use client';

import React, { useState, useEffect } from 'react';
import { IntelligenceFeed } from '@/types/feed';
import { usePharosAuth } from './PrivyClientProvider';
import { isAddress } from 'viem';
import {
  Settings,
  RefreshCw,
  PlusCircle,
  ShieldAlert,
  Lock,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Zap,
  Coins,
  Check,
  ExternalLink,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface PublisherDashboardProps {
  feeds: IntelligenceFeed[];
  walletAddress: string | null;
  onRefreshFeeds: () => Promise<void>;
  onConnectWallet: () => void;
}

const DEFAULT_PLATFORM_PUBLISHER = '0x11D12C00308c92BeB5937Fc9315CFa9B5A3C8b1e';

export const PublisherDashboard: React.FC<PublisherDashboardProps> = ({
  feeds,
  walletAddress,
  onRefreshFeeds,
  onConnectWallet,
}) => {
  const { sendOnChainClaim } = usePharosAuth();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0.001);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSettlingOffChain, setIsSettlingOffChain] = useState(false);
  const [isClaimingViaMetaMask, setIsClaimingViaMetaMask] = useState(false);
  const [isClaimingOnChain, setIsClaimingOnChain] = useState(false);
  const [isConnectingBrowser, setIsConnectingBrowser] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [lastSettlementReceipt, setLastSettlementReceipt] = useState<any | null>(null);

  // Browser Wallet (MetaMask / Rabby) state
  const [browserWallet, setBrowserWallet] = useState<string | null>(null);

  // Active Managing Address: defaults to the feeds owner (0x11D12C00308c92BeB5937Fc9315CFa9B5A3C8b1e) or connected browser/privy wallet
  const [activePublisherAddress, setActivePublisherAddress] = useState<string>(() => {
    // If feeds exist for 0x11D12C00308c92BeB5937Fc9315CFa9B5A3C8b1e, default to it
    const hasDefault = feeds.some(
      (f) => f.publisherAddress.toLowerCase() === DEFAULT_PLATFORM_PUBLISHER.toLowerCase()
    );
    if (hasDefault) return DEFAULT_PLATFORM_PUBLISHER;
    return walletAddress || DEFAULT_PLATFORM_PUBLISHER;
  });

  // New feed form state
  const [feedName, setFeedName] = useState('');
  const [feedSlug, setFeedSlug] = useState('');
  const [feedDesc, setFeedDesc] = useState('');
  const [feedEndpoint, setFeedEndpoint] = useState('');
  const [feedPrice, setFeedPrice] = useState(0.001);
  const [payoutAddress, setPayoutAddress] = useState(DEFAULT_PLATFORM_PUBLISHER);

  // Check if browser wallet (window.ethereum) is already connected on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setBrowserWallet(accounts[0]);
            // If the connected metamask address owns feeds, set it active
            const ownsFeeds = feeds.some(
              (f) => f.publisherAddress.toLowerCase() === accounts[0].toLowerCase()
            );
            if (ownsFeeds) {
              setActivePublisherAddress(accounts[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [feeds]);

  // Gatekeeper: only authenticated publishers can access
  if (!walletAddress) {
    return (
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-10 shadow-sm text-center max-w-lg mx-auto my-6 space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center mx-auto text-[#0012b8]">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Publisher Hub Requires Authentication</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          To manage your registered x402 intelligence endpoints, customize pricing, or review micro-revenue, please connect your embedded agent wallet or Web3 account.
        </p>
        <button
          onClick={onConnectWallet}
          className="inline-flex items-center gap-2 bg-[#5c41ff] hover:bg-[#4b32e0] text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          <Wallet className="w-4 h-4" />
          <span>Connect with Privy</span>
        </button>
      </div>
    );
  }

  // Connect Browser Extension (MetaMask / Rabby)
  const connectBrowserWallet = async (): Promise<string | null> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setStatusMessage('❌ Browser wallet extension (MetaMask, Rabby) not detected in your browser.');
      return null;
    }
    setIsConnectingBrowser(true);
    setStatusMessage(null);
    try {
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        const addr = accounts[0];
        setBrowserWallet(addr);
        setStatusMessage(`🦊 Browser wallet connected: ${addr.slice(0, 8)}...${addr.slice(-6)}`);
        return addr;
      }
    } catch (err: any) {
      setStatusMessage(`❌ Failed to connect browser wallet: ${err?.message || String(err)}`);
    } finally {
      setIsConnectingBrowser(false);
    }
    return null;
  };

  // Switch or Add Pharos Mainnet (Chain ID 1672 / 0x688) in browser wallet
  const ensurePharosNetwork = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return false;
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x688' }], // 1672
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError?.message?.includes('Unrecognized')) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x688',
                chainName: 'Pharos Mainnet',
                nativeCurrency: { name: 'PROS', symbol: 'PROS', decimals: 18 },
                rpcUrls: ['https://rpc.pharos.xyz'],
                blockExplorerUrls: ['https://pharosscan.xyz'],
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add Pharos Mainnet to browser wallet:', addError);
          return false;
        }
      }
      return false;
    }
  };

  // Filter: display feeds owned by the selected publisher address
  const normalizedPublisher = activePublisherAddress.toLowerCase();
  const myFeeds = feeds.filter((f) => f.publisherAddress.toLowerCase() === normalizedPublisher);
  const totalRevenue = myFeeds.reduce((acc, f) => acc + f.grossRevenueUsdc, 0);
  const totalCalls = myFeeds.reduce((acc, f) => acc + f.totalCalls, 0);
  const activeCount = myFeeds.filter((f) => f.curationStatus === 'ACTIVE').length;
  const totalUnsettled = myFeeds.reduce((acc, f) => {
    const unsettled =
      typeof f.unsettledRevenueUsdc === 'number'
        ? f.unsettledRevenueUsdc
        : Math.max(0, Number((f.grossRevenueUsdc - (f.settledRevenueUsdc || 0)).toFixed(4)));
    return acc + unsettled;
  }, 0);
  const totalSettled = myFeeds.reduce((acc, f) => acc + (f.settledRevenueUsdc || 0), 0);

  // Authentic Claim via Browser Extension Wallet (MetaMask / Rabby)
  const handleClaimViaBrowserWallet = async () => {
    if (totalUnsettled <= 0) {
      setStatusMessage('ℹ️ No accrued revenue ready to settle for this publisher address.');
      return;
    }
    setIsClaimingViaMetaMask(true);
    setStatusMessage(null);
    try {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error(
          'Browser wallet extension (MetaMask / Rabby) is not installed. Please install a browser extension to claim accrued rewards directly to your external address.'
        );
      }

      // 1. Request or connect accounts
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No account authorized in browser extension wallet.');
      }
      const activeAccount = accounts[0];
      setBrowserWallet(activeAccount);

      // 2. Ensure chain is Pharos Mainnet (Chain ID 1672)
      await ensurePharosNetwork();

      // 3. Construct authentic EIP-712 settlement voucher claim
      const nonce = Date.now();
      const timestamp = Math.floor(Date.now() / 1000);
      const amountAtomic = BigInt(Math.round(totalUnsettled * 1_000_000)).toString();

      const claimTypedData = {
        domain: {
          name: 'Pharos x402 Marketplace',
          version: '1',
          chainId: 1672,
          verifyingContract: '0x1672000000000000000000000000000000004021',
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          PublisherClaimReceipt: [
            { name: 'publisher', type: 'address' },
            { name: 'totalAmountUsdc', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
        primaryType: 'PublisherClaimReceipt',
        message: {
          publisher: activePublisherAddress,
          totalAmountUsdc: amountAtomic,
          nonce,
          timestamp,
        },
      };

      // 4. Trigger MetaMask native popup to sign the claim voucher
      const signature = await (window as any).ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [activeAccount, JSON.stringify(claimTypedData)],
      });

      // 5. Submit settlement to backend registry
      const res = await fetch('/api/publisher/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherAddress: activePublisherAddress,
          signature,
          claimReceipt: claimTypedData.message,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setLastSettlementReceipt({
          ...data.settlementReceipt,
          destinationWallet: activeAccount,
        });
        setStatusMessage(
          `🎉 Successfully claimed ${totalUnsettled.toFixed(4)} USDC via MetaMask to external wallet ${activeAccount.slice(0, 8)}... on Pharos Mainnet!`
        );
        await onRefreshFeeds();
      } else {
        setStatusMessage(`❌ Settlement failed: ${data.error}`);
      }
    } catch (err: any) {
      console.warn('MetaMask claim error:', err);
      setStatusMessage(`❌ Browser Wallet Claim Error: ${err?.message || String(err)}`);
    } finally {
      setIsClaimingViaMetaMask(false);
    }
  };

  // Authentic On-Chain Settlement from Privy Agent Wallet to External Publisher Wallet
  const handleOnChainClaim = async () => {
    if (totalUnsettled <= 0) return;
    setIsClaimingOnChain(true);
    setStatusMessage(null);
    try {
      const { txHash } = await sendOnChainClaim(activePublisherAddress, totalUnsettled);
      if (!txHash) {
        throw new Error('On-chain claim did not return a valid transaction hash.');
      }
      const res = await fetch('/api/publisher/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherAddress: activePublisherAddress,
          onChainTxHash: txHash,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastSettlementReceipt(data.settlementReceipt);
        setStatusMessage(
          `🎉 Authentic on-chain transfer of ${totalUnsettled.toFixed(4)} USDC confirmed on Pharos Mainnet!`
        );
        await onRefreshFeeds();
      } else {
        setStatusMessage(`❌ Settlement registration error: ${data.error}`);
      }
    } catch (err: any) {
      console.warn('On-chain claim error:', err);
      setStatusMessage(`❌ On-Chain Settlement Error: ${err?.message || String(err)}`);
    } finally {
      setIsClaimingOnChain(false);
    }
  };

  // Off-Chain State Channel Voucher Reconciliation (Gasless)
  const handleOffChainVoucherReconcile = async () => {
    if (totalUnsettled <= 0) return;
    setIsSettlingOffChain(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/publisher/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publisherAddress: activePublisherAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastSettlementReceipt(data.settlementReceipt);
        setStatusMessage(
          `✅ Off-Chain state vouchers reconciled in mesh ledger (${data.settlementReceipt.settledAmountUsdc} USDC).`
        );
        await onRefreshFeeds();
      } else {
        setStatusMessage(`❌ Settlement error: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMessage(`❌ Network error executing voucher reconciliation: ${String(err)}`);
    } finally {
      setIsSettlingOffChain(false);
    }
  };

  const handleUpdatePrice = async (slug: string) => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/publisher/feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, newPriceUsdc: Number(newPrice) }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`✅ Price updated to ${newPrice} USDC for '${slug}'.`);
        setEditingSlug(null);
        await onRefreshFeeds();
      } else {
        setStatusMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setStatusMessage(`❌ Network error: ${String(err)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateApiVersion = async (slug: string) => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/publisher/feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          newEndpointPath: `/api/x402/${slug}-v2`,
          newSchemaHash: `sha256-v2-${Date.now().toString(16)}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`🛡️ Curation Security Trigger: ${data.message}`);
        await onRefreshFeeds();
      } else {
        setStatusMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setStatusMessage(`❌ Network error: ${String(err)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRegisterFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedName || !feedSlug || !feedEndpoint) {
      setStatusMessage('❌ Please fill in all required fields.');
      return;
    }
    const targetPublisher = (payoutAddress || activePublisherAddress).trim();
    if (!isAddress(targetPublisher)) {
      setStatusMessage('❌ Payout address must be a valid 42-character Ethereum address (0x...).');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch('/api/publisher/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedName.trim(),
          slug: feedSlug.trim().toLowerCase(),
          description: feedDesc.trim() || 'Custom publisher data feed',
          category: 'CUSTOM',
          endpointPath: feedEndpoint.trim(),
          pricePerCallUsdc: Number(feedPrice),
          publisherAddress: targetPublisher,
          payoutAddress: targetPublisher,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`🎉 Feed '${data.feed.name}' registered successfully! It is queued for Curator review.`);
        setIsRegisterOpen(false);
        setFeedName('');
        setFeedSlug('');
        setFeedDesc('');
        setFeedEndpoint('');
        setActivePublisherAddress(targetPublisher);
        await onRefreshFeeds();
      } else {
        setStatusMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setStatusMessage(`❌ Failed to register feed: ${String(err)}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const isExternalDefault = activePublisherAddress.toLowerCase() === DEFAULT_PLATFORM_PUBLISHER.toLowerCase();

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 sm:p-7 shadow-xs space-y-6">
      {/* Top Header & Publisher Context Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0012b8]" />
            Publisher Hub & Endpoint Management
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
            <span className="text-gray-500">Managing feeds for:</span>
            <code className="text-[#0012b8] font-mono font-bold bg-[#f1f5f9] px-2 py-0.5 rounded border border-[#e2e8f0]">
              {activePublisherAddress.slice(0, 10)}...{activePublisherAddress.slice(-6)}
            </code>
            {isExternalDefault && (
              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium font-mono">
                External Payout Wallet (MetaMask)
              </span>
            )}
            {activePublisherAddress.toLowerCase() === walletAddress.toLowerCase() && (
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium font-mono">
                Privy Agent Session Wallet
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick toggle between External Owner & Privy */}
          <div className="flex items-center gap-1 bg-[#f8faff] border border-[#e2e8f0] p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActivePublisherAddress(DEFAULT_PLATFORM_PUBLISHER)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] ${
                isExternalDefault
                  ? 'bg-white shadow-xs text-[#0012b8] font-bold border border-[#e2e8f0]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="View endpoints owned by external payout address (0x11D12C00...)"
            >
              External Feeds (0x11D1...)
            </button>
            <button
              type="button"
              onClick={() => setActivePublisherAddress(walletAddress)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] ${
                activePublisherAddress.toLowerCase() === walletAddress.toLowerCase()
                  ? 'bg-white shadow-xs text-[#0012b8] font-bold border border-[#e2e8f0]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="View endpoints owned by your Privy agent wallet"
            >
              Privy Feeds
            </button>
          </div>

          <button
            onClick={() => setIsRegisterOpen(!isRegisterOpen)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold pharos-gradient-bg hover:opacity-95 text-white transition-all shadow-xs active:scale-98"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Register Endpoint</span>
          </button>
          <button
            onClick={onRefreshFeeds}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#f8faff] hover:bg-[#f1f5f9] text-gray-700 transition-colors border border-[#e2e8f0]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Browser Wallet Extension Banner */}
      <div className="bg-[#fcfdff] border border-indigo-100 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold">
            🦊
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              Browser Extension Wallet (MetaMask / Rabby)
            </div>
            <div className="text-gray-500 text-[11px] font-mono">
              {browserWallet ? (
                <span className="text-emerald-700 font-bold">
                  Connected: {browserWallet.slice(0, 10)}...{browserWallet.slice(-6)}
                </span>
              ) : (
                'Not connected. Connect to execute authentic cryptographic claims to your external address.'
              )}
            </div>
          </div>
        </div>

        <div>
          {!browserWallet ? (
            <button
              type="button"
              onClick={connectBrowserWallet}
              disabled={isConnectingBrowser}
              className="px-3.5 py-1.5 rounded-xl font-semibold bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 shadow-2xs transition-all active:scale-98 text-xs flex items-center gap-1.5"
            >
              <span>🦊 Connect MetaMask</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActivePublisherAddress(browserWallet)}
              className="text-[11px] text-[#0012b8] hover:underline font-medium"
            >
              Use as active managing wallet
            </button>
          )}
        </div>
      </div>

      {/* Publisher Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#f8faff] p-3.5 rounded-xl border border-blue-100/80">
          <span className="text-[11px] text-gray-500 font-medium">Registered Endpoints</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900 font-mono">{myFeeds.length}</span>
            <span className="text-[10px] text-emerald-700 font-semibold font-mono">({activeCount} Active)</span>
          </div>
        </div>

        <div className="bg-[#f8faff] p-3.5 rounded-xl border border-blue-100/80">
          <span className="text-[11px] text-gray-500 font-medium">Settled Calls (Mesh)</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900 font-mono">{totalCalls}</span>
            <span className="text-[10px] text-gray-400">Queries</span>
          </div>
        </div>

        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-800 font-medium">Ready to Settle</span>
            {totalUnsettled > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-700 font-mono">${totalUnsettled.toFixed(4)}</span>
            <span className="text-[10px] text-emerald-600 font-mono">USDC</span>
          </div>
        </div>

        <div className="bg-[#f8faff] p-3.5 rounded-xl border border-blue-100/80">
          <span className="text-[11px] text-gray-500 font-medium">Settled on-chain</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-[#0012b8] font-mono">${totalSettled.toFixed(4)}</span>
            <span className="text-[10px] text-gray-400 font-mono">USDC</span>
          </div>
        </div>
      </div>

      {/* Batch Settlement Control Desk */}
      {myFeeds.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/80 p-4 sm:p-5 rounded-2xl border border-blue-200/90 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#0012b8]" /> Revenue Settlement & Claim Desk
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Pharos Mainnet 1672
              </span>
            </div>
            <p className="text-xs text-gray-600 max-w-xl">
              Claim accrued micro-vouchers for external wallet{' '}
              <code className="text-[#0012b8] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-blue-100">
                {activePublisherAddress.slice(0, 10)}...{activePublisherAddress.slice(-6)}
              </code>{' '}
              via MetaMask EIP-712 signature (gasless voucher) or direct on-chain transfer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Primary Browser Extension Claim Button */}
            <button
              onClick={handleClaimViaBrowserWallet}
              disabled={isClaimingViaMetaMask || isClaimingOnChain || isSettlingOffChain || totalUnsettled <= 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 disabled:opacity-50 disabled:bg-gray-200 bg-[#f6851b] hover:bg-[#e2761b] text-white"
              title="Invokes MetaMask/browser extension to sign EIP-712 claim voucher for your external wallet"
            >
              {isClaimingViaMetaMask ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Awaiting MetaMask...</span>
                </>
              ) : (
                <>
                  <span>🦊</span>
                  <span>Claim via MetaMask (EIP-712)</span>
                </>
              )}
            </button>

            {/* Direct On-Chain Claim via Privy Agent Wallet */}
            <button
              onClick={handleOnChainClaim}
              disabled={isClaimingViaMetaMask || isClaimingOnChain || isSettlingOffChain || totalUnsettled <= 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 disabled:opacity-50 disabled:bg-gray-200 bg-emerald-600 hover:bg-emerald-700 text-white"
              title="Executes authentic on-chain ERC-20 transfer from Privy agent wallet directly to your external wallet on Pharos Mainnet"
            >
              {isClaimingOnChain ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Broadcasting On-Chain...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Claim On-Chain (Privy)</span>
                </>
              )}
            </button>

            {/* Gasless state channel reconciliation */}
            <button
              onClick={handleOffChainVoucherReconcile}
              disabled={isClaimingViaMetaMask || isClaimingOnChain || isSettlingOffChain || totalUnsettled <= 0}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-all shadow-2xs active:scale-98 disabled:opacity-50"
              title="Reconciles accumulated EIP-712 payment vouchers in the state channel ledger without network gas"
            >
              {isSettlingOffChain ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reconciling Ledger...</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5 text-[#0012b8]" />
                  <span>Reconcile State Vouchers (Gasless)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Settlement Receipt Drawer / Banner */}
      {lastSettlementReceipt && (
        <div className="p-4 sm:p-5 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {lastSettlementReceipt.settlementTxHash
                  ? 'On-Chain Settlement Receipt Confirmed'
                  : 'EIP-712 State Voucher Claim Verified'}
              </span>
            </div>
            <button
              onClick={() => setLastSettlementReceipt(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white/80 p-3.5 rounded-xl border border-emerald-200">
            <div>
              <span className="text-[10px] text-gray-400 block font-mono">Settled Amount</span>
              <span className="font-bold text-emerald-700 font-mono text-sm">
                +{lastSettlementReceipt.settledAmountUsdc.toFixed(4)} USDC
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block font-mono">Destination Wallet</span>
              <span className="font-mono text-gray-800 text-[11px] truncate block" title={lastSettlementReceipt.destinationWallet}>
                {lastSettlementReceipt.destinationWallet}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block font-mono">
                {lastSettlementReceipt.settlementTxHash ? 'Pharos Mainnet Tx Hash' : 'EIP-712 Claim Signature'}
              </span>
              {lastSettlementReceipt.settlementTxHash ? (
                <a
                  href={`https://pharosscan.xyz/tx/${lastSettlementReceipt.settlementTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[#0012b8] hover:underline text-[11px] truncate flex items-center gap-1"
                >
                  <span>{lastSettlementReceipt.settlementTxHash.slice(0, 16)}...</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span
                  className="font-mono text-emerald-800 text-[11px] truncate block bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                  title={lastSettlementReceipt.signature || lastSettlementReceipt.receiptId}
                >
                  {(lastSettlementReceipt.signature || lastSettlementReceipt.receiptId).slice(0, 20)}...
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-emerald-900 bg-emerald-100/70 px-3 py-2 rounded-lg font-medium flex items-center justify-between">
            <span>
              ℹ️ Standard: <strong>{lastSettlementReceipt.settlementStandard}</strong>.{' '}
              {lastSettlementReceipt.settlementTxHash
                ? 'Broadcast and confirmed on Pharos Mainnet (Chain ID 1672).'
                : 'Cryptographically reconciled via off-chain EIP-712 state channel (zero gas).'}
            </span>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium animate-in fade-in duration-150">
          {statusMessage}
        </div>
      )}

      {/* In-line Feed Registration Drawer with Claimer / Payout Address */}
      {isRegisterOpen && (
        <form onSubmit={handleRegisterFeed} className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Register New x402 Intelligence Feed</h3>
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="text-gray-400 hover:text-gray-700 text-xs"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-700 font-medium mb-1">Feed Name *</label>
              <input
                type="text"
                required
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                placeholder="e.g. Pharos Liquidity Index"
                className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Slug (Identifier) *</label>
              <input
                type="text"
                required
                value={feedSlug}
                onChange={(e) => setFeedSlug(e.target.value)}
                placeholder="e.g. pharos-liquidity"
                className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Endpoint Path *</label>
              <input
                type="text"
                required
                value={feedEndpoint}
                onChange={(e) => setFeedEndpoint(e.target.value)}
                placeholder="e.g. /api/x402/my-custom-feed"
                className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-1">Price per call (USDC) *</label>
              <input
                type="number"
                step="0.0005"
                min="0.0001"
                max="0.005"
                value={feedPrice}
                onChange={(e) => setFeedPrice(parseFloat(e.target.value))}
                className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded bg-white font-mono"
              />
            </div>

            {/* Payout & Claimer Wallet Address Field with Required Helper Tooltip */}
            <div className="sm:col-span-2">
              <label className="block text-gray-700 font-medium mb-1 flex items-center justify-between">
                <span>Claim & Payout Recipient Address (Адрес для клейма и выплат) *</span>
                <span className="text-[10px] text-amber-700 font-semibold">External Web3 Wallet</span>
              </label>
              <input
                type="text"
                required
                value={payoutAddress}
                onChange={(e) => setPayoutAddress(e.target.value)}
                placeholder="0x... (ваш внешний адрес MetaMask / Rabby)"
                className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded bg-white font-mono text-xs focus:ring-1 focus:ring-[#0012b8] focus:border-[#0012b8]"
              />
              <p className="text-[11px] text-gray-500 mt-1.5 flex items-start gap-1 bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-lg text-amber-900">
                <span className="text-amber-600 font-bold shrink-0">💡 Подсказка:</span>
                <span>Укажите адрес вашего внешнего кошелька (например, MetaMask), который будет клеймить накопленные оплаты. Это должен быть отдельный ваш кошелек, а не временный сессионный Privy-кошелек, созданный при регистрации и входе.</span>
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-gray-700 font-medium mb-1">Description</label>
              <input
                type="text"
                value={feedDesc}
                onChange={(e) => setFeedDesc(e.target.value)}
                placeholder="Brief description of what telemetry this endpoint provides"
                className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded bg-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isUpdating}
            className="w-full py-2 bg-[#0012b8] hover:bg-[#000fa0] text-white rounded font-semibold text-xs transition-colors"
          >
            {isUpdating ? 'Registering on Mesh...' : 'Publish Feed Endpoint'}
          </button>
        </form>
      )}

      {/* Feeds Table or Empty State */}
      {myFeeds.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-[#e5e7eb] rounded-xl space-y-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-500">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">No endpoints registered under this address</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              No active x402 endpoints found under address <code className="font-mono text-gray-700">{activePublisherAddress.slice(0, 10)}...</code>. You can switch to the external platform publisher wallet (0x11D1...), or register a fresh custom endpoint.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setActivePublisherAddress(DEFAULT_PLATFORM_PUBLISHER)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#eef2ff] hover:bg-[#e0e7ff] text-[#0012b8] border border-[#c7d2fe] transition-all shadow-2xs"
            >
              <span>Switch to 0x11D12C00... (Default Feeds)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRegisterOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0012b8] hover:bg-[#000fa0] text-white transition-all shadow-xs active:scale-98"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Register Custom Endpoint</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-gray-500 font-semibold bg-[#f9fafb]">
                <th className="py-2.5 px-3">Feed Name</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Current Price</th>
                <th className="py-2.5 px-3">Calls Settled</th>
                <th className="py-2.5 px-3">Revenue (Unsettled / Total)</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f4f5]">
              {myFeeds.map((feed) => {
                const isEditing = editingSlug === feed.slug;
                const isActive = feed.curationStatus === 'ACTIVE';

                return (
                  <tr key={feed.id} className="hover:bg-[#f9fafb] transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900">
                      <div>{feed.name}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{feed.endpointPath}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {feed.curationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.0005"
                            min="0.0001"
                            max="0.005"
                            value={newPrice}
                            onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                            className="w-16 px-1.5 py-0.5 border border-[#e5e7eb] rounded bg-white text-xs"
                          />
                          <button
                            onClick={() => handleUpdatePrice(feed.slug)}
                            disabled={isUpdating}
                            className="p-1 bg-[#0012b8] text-white rounded hover:bg-[#000fa0]"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span>{feed.pricePerCallUsdc} USDC</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono">{feed.totalCalls}</td>
                    <td className="py-3 px-3 font-mono">
                      <div className="text-emerald-700 font-semibold">
                        ${(feed.unsettledRevenueUsdc || 0).toFixed(4)} USDC{' '}
                        <span className="text-[10px] text-gray-400 font-normal">unsettled</span>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Total gross: ${feed.grossRevenueUsdc.toFixed(4)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingSlug(isEditing ? null : feed.slug);
                          setNewPrice(feed.pricePerCallUsdc);
                        }}
                        className="text-[#0012b8] hover:underline font-semibold"
                      >
                        {isEditing ? 'Cancel' : 'Edit Price'}
                      </button>
                      <button
                        onClick={() => handleUpdateApiVersion(feed.slug)}
                        disabled={isUpdating}
                        className="text-amber-600 hover:text-amber-800 hover:underline font-medium ml-2"
                        title="Update API endpoint and schema to trigger security audit"
                      >
                        Upgrade API (v2)
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Security Architecture Notice */}
      <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-gray-700">Anti-Scam Architecture (Mutation Lockdown):</strong> Any update to an endpoint path or payload schema immediately triggers an on-chain event revoking active status to <code className="text-amber-700 font-mono font-bold">PENDING_AUDIT</code>. Endpoints cannot be purchased until reviewed and approved by the designated curator.
        </p>
      </div>
    </div>
  );
};
