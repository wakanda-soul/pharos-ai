'use client';

import React, { useState } from 'react';
import { IntelligenceFeed } from '@/types/feed';
import { Settings, RefreshCw, PlusCircle, ShieldAlert, Lock, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';

interface PublisherDashboardProps {
  feeds: IntelligenceFeed[];
  walletAddress: string | null;
  onRefreshFeeds: () => Promise<void>;
  onConnectWallet: () => void;
}

export const PublisherDashboard: React.FC<PublisherDashboardProps> = ({
  feeds,
  walletAddress,
  onRefreshFeeds,
  onConnectWallet,
}) => {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0.001);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // New feed form state
  const [feedName, setFeedName] = useState('');
  const [feedSlug, setFeedSlug] = useState('');
  const [feedDesc, setFeedDesc] = useState('');
  const [feedEndpoint, setFeedEndpoint] = useState('');
  const [feedPrice, setFeedPrice] = useState(0.001);

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

  // Filter: ONLY display feeds owned by the current active wallet
  const normalizedUser = walletAddress.toLowerCase();
  const myFeeds = feeds.filter((f) => f.publisherAddress.toLowerCase() === normalizedUser);
  const totalRevenue = myFeeds.reduce((acc, f) => acc + f.grossRevenueUsdc, 0);
  const totalCalls = myFeeds.reduce((acc, f) => acc + f.totalCalls, 0);
  const activeCount = myFeeds.filter((f) => f.curationStatus === 'ACTIVE').length;

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

  const handleSimulateMutation = async (slug: string) => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/publisher/feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          newEndpointPath: `/api/x402/${slug}-v2-mutated`,
          newSchemaHash: `sha256-mutated-${Date.now().toString(16)}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`🛡️ Anti-Scam Triggered: ${data.message}`);
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
          publisherAddress: walletAddress,
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

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 sm:p-7 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0012b8]" />
            Publisher Hub & Endpoint Management
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Managing endpoints owned by <code className="text-[#0012b8] font-mono font-semibold">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Publisher Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#f8faff] p-3.5 rounded-xl border border-blue-100/80">
          <span className="text-[11px] text-gray-500 font-medium">Registered Endpoints</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900 font-mono">{myFeeds.length}</span>
            <span className="text-[10px] text-emerald-700 font-semibold font-mono">({activeCount} Active)</span>
          </div>
        </div>

        <div className="bg-[#f8faff] p-3.5 rounded-xl border border-blue-100/80">
          <span className="text-[11px] text-gray-500 font-medium">Total Micro-Revenue</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#0012b8] font-mono">${totalRevenue.toFixed(3)}</span>
            <span className="text-[10px] text-gray-400 font-mono">USDC (6 dec)</span>
          </div>
        </div>

        <div className="bg-[#f8faff] p-3.5 rounded-xl border border-blue-100/80">
          <span className="text-[11px] text-gray-500 font-medium">Settled Calls (Mesh)</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900 font-mono">{totalCalls}</span>
            <span className="text-[10px] text-gray-400">Autonomous queries</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium animate-in fade-in duration-150">
          {statusMessage}
        </div>
      )}

      {/* In-line Feed Registration Drawer */}
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
        <div className="p-8 text-center border border-dashed border-[#e5e7eb] rounded-xl space-y-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-500">
            <PlusCircle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No endpoints registered under your wallet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            You haven&apos;t registered any x402 endpoints yet under address <code className="font-mono text-gray-700">{walletAddress.slice(0, 10)}...</code>. Register your API endpoint above to begin monetizing autonomous agent traffic.
          </p>
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
                <th className="py-2.5 px-3">Gross Revenue</th>
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
                      <div className="font-mono text-[10px] text-gray-400">{feed.endpointPath}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {feed.curationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.0005"
                            min="0.0001"
                            max="0.005"
                            value={newPrice}
                            onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-xs border border-[#0012b8] rounded font-mono"
                          />
                          <span className="text-[11px] text-gray-500">USDC</span>
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-[#0012b8]">
                          {feed.pricePerCallUsdc} USDC
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-700">{feed.totalCalls}</td>
                    <td className="py-3 px-3 font-mono font-medium text-emerald-700">
                      ${feed.grossRevenueUsdc.toFixed(4)} USDC
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleUpdatePrice(feed.slug)}
                              disabled={isUpdating}
                              className="bg-[#0012b8] hover:bg-[#000fa0] text-white px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSlug(null)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-[11px]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingSlug(feed.slug);
                                setNewPrice(feed.pricePerCallUsdc);
                              }}
                              className="text-[#0012b8] hover:underline font-medium text-xs px-2 py-1"
                            >
                              Edit Price
                            </button>
                            <button
                              onClick={() => handleSimulateMutation(feed.slug)}
                              disabled={isUpdating}
                              title="Tests the anti-scam lockdown: alters route and confirms automatic drop to PENDING_AUDIT"
                              className="text-amber-700 hover:bg-amber-50 border border-amber-200 px-2 py-1 rounded text-[10px] font-mono"
                            >
                              Simulate Mutation
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Security notice box */}
      <div className="bg-[#f2f4f5] p-4 rounded-xl border border-[#e5e7eb] flex items-start gap-3 text-xs text-gray-600">
        <ShieldAlert className="w-5 h-5 text-[#0012b8] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-gray-900">Anti-Scam Architecture (Mutation Lockdown)</span>:
          Any update to an endpoint path or payload schema immediately triggers an on-chain event revoking active status to{' '}
          <code className="text-amber-800 font-bold bg-amber-50 px-1 rounded">PENDING_AUDIT</code>. Endpoints cannot be purchased until reviewed and approved by the designated curator.
        </div>
      </div>
    </div>
  );
};
