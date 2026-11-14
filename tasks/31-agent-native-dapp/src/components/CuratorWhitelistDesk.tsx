'use client';

import React, { useState, useMemo } from 'react';
import { IntelligenceFeed, FeedCurationStatus } from '@/types/feed';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserCheck,
  Lock,
  Wallet,
  Search,
  CheckCircle2,
  RefreshCw,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

interface CuratorWhitelistDeskProps {
  feeds: IntelligenceFeed[];
  isCurator: boolean;
  walletAddress: string | null;
  onRefreshFeeds: () => Promise<void>;
  onConnectWallet: () => void;
}

export const CuratorWhitelistDesk: React.FC<CuratorWhitelistDeskProps> = ({
  feeds,
  isCurator,
  walletAddress,
  onRefreshFeeds,
  onConnectWallet,
}) => {
  const [auditReason, setAuditReason] = useState<string>(
    'Verified by curator - passes security schema audit.'
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'REVOKED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // Local overrides map to guarantee instant optimistic updates without waiting for network/caching
  const [localOverrides, setLocalOverrides] = useState<Record<string, FeedCurationStatus>>({});

  // Merge server feeds with local optimistic overrides
  const effectiveFeeds = useMemo(() => {
    return feeds.map((feed) => {
      const overrideStatus = localOverrides[feed.slug];
      if (overrideStatus) {
        return {
          ...feed,
          curationStatus: overrideStatus,
          auditedBy: PHAROS_CONSTANTS.curatorHandle,
          lastUpdated: new Date().toISOString(),
        };
      }
      return feed;
    });
  }, [feeds, localOverrides]);

  const pendingCount = effectiveFeeds.filter((f) => f.curationStatus === 'PENDING_AUDIT').length;
  const activeCount = effectiveFeeds.filter((f) => f.curationStatus === 'ACTIVE').length;
  const revokedCount = effectiveFeeds.filter(
    (f) => f.curationStatus === 'REVOKED' || f.curationStatus === 'SUSPENDED'
  ).length;

  const filteredFeeds = useMemo(() => {
    return effectiveFeeds
      .filter((feed) => {
        // Status filter
        if (statusFilter === 'PENDING' && feed.curationStatus !== 'PENDING_AUDIT') return false;
        if (statusFilter === 'ACTIVE' && feed.curationStatus !== 'ACTIVE') return false;
        if (
          statusFilter === 'REVOKED' &&
          feed.curationStatus !== 'REVOKED' &&
          feed.curationStatus !== 'SUSPENDED'
        )
          return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          return (
            feed.name.toLowerCase().includes(q) ||
            feed.slug.toLowerCase().includes(q) ||
            feed.publisherAddress.toLowerCase().includes(q) ||
            feed.endpointPath.toLowerCase().includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => {
        // ALWAYS prioritize PENDING_AUDIT feeds at the top of the queue
        if (a.curationStatus === 'PENDING_AUDIT' && b.curationStatus !== 'PENDING_AUDIT') return -1;
        if (b.curationStatus === 'PENDING_AUDIT' && a.curationStatus !== 'PENDING_AUDIT') return 1;
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      });
  }, [effectiveFeeds, statusFilter, searchQuery]);

  // Security gate: only designated curator can access
  if (!isCurator) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-10 shadow-sm text-center max-w-lg mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Curator Governance Access Restricted</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          The Curator Whitelist Desk is strictly reserved for the designated Pharos Network Curator (<strong>{PHAROS_CONSTANTS.curatorHandle}</strong>).
          Unauthenticated guests and non-curator wallets cannot review, approve, or revoke marketplace data feeds.
        </p>
        {!walletAddress ? (
          <button
            onClick={onConnectWallet}
            className="inline-flex items-center gap-2 bg-[#0012b8] hover:bg-[#000fa0] text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Wallet className="w-4 h-4" />
            <span>Connect Curator Wallet</span>
          </button>
        ) : (
          <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded border border-red-200 font-mono">
            Connected: {walletAddress} (Unauthorized)
          </div>
        )}
      </div>
    );
  }

  const handleCurationAction = async (slug: string, newStatus: FeedCurationStatus) => {
    setIsProcessing(true);
    setActionMessage(null);

    // 1. Optimistic update: instantly reflect new status in UI so feed NEVER vanishes
    setLocalOverrides((prev) => ({ ...prev, [slug]: newStatus }));

    try {
      const res = await fetch('/api/publisher/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          status: newStatus,
          curatorAddress: walletAddress || PHAROS_CONSTANTS.curatorHandle,
          reason: auditReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(
          `🛡️ Status updated: '${slug}' is now '${newStatus}'. (Curator: ${data.curator})`
        );
        await onRefreshFeeds();
      } else {
        // Rollback optimistic update on error
        setLocalOverrides((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
        setActionMessage(`❌ Access Denied: ${data.error}`);
      }
    } catch (err) {
      // Rollback optimistic update on error
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setActionMessage(`❌ Network error: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="border-b border-[#e2e8f0] pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              Curator Whitelist & Anti-Scam Governance Desk
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Strict on-chain curation gate. Endpoints can only enter active circulation once approved by the designated curator.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#f0fdf4] border border-emerald-200 px-3 py-1.5 rounded-lg text-xs">
            <UserCheck className="w-4 h-4 text-emerald-700" />
            <div>
              <span className="text-gray-500">Authenticated Curator:</span>{' '}
              <strong className="text-emerald-900 font-mono">{PHAROS_CONSTANTS.curatorHandle}</strong>
            </div>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 font-medium flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Curator Identity Box */}
      <div className="bg-[#f9fafb] p-4 rounded-xl border border-[#e5e7eb] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block text-gray-700 font-semibold mb-1">
            Curator Key / Wallet:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={walletAddress || PHAROS_CONSTANTS.curatorAddress}
              className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded-md font-mono text-xs bg-gray-50 text-gray-700"
            />
          </div>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Curator on Pharos Mainnet: <code className="text-gray-600">{PHAROS_CONSTANTS.curatorAddress}</code>
          </span>
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-1">
            Audit Assessment / Attestation Log:
          </label>
          <input
            type="text"
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded-md text-xs focus:outline-none focus:border-[#0012b8]"
            placeholder="Reason for approving or revoking feed..."
          />
          <span className="text-[10px] text-gray-400 mt-1 block">
            This reason is permanently attached to the on-chain audit receipt.
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Feeds ({effectiveFeeds.length})
          </button>

          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            )}
            <span>Pending Audit</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                pendingCount > 0 ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>Active & Whitelisted</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-900 font-bold">
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('REVOKED')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'REVOKED'
                ? 'bg-white text-red-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>Revoked</span>
            {revokedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-red-100 text-red-900 font-bold">
                {revokedCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed name, slug..."
            className="w-full pl-8 pr-8 py-1.5 bg-[#f8faff] border border-[#e2e8f0] rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0012b8]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Feed Whitelisting Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
          <span className="uppercase tracking-wider font-bold text-gray-700">
            Feed Queue & Integrity Audit ({filteredFeeds.length} of {effectiveFeeds.length})
          </span>
          <button
            onClick={() => onRefreshFeeds()}
            disabled={isProcessing}
            className="flex items-center gap-1 text-[#0012b8] hover:underline"
          >
            <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>

        {filteredFeeds.length === 0 ? (
          <div className="bg-[#f8faff] border border-dashed border-[#cbd5e1] rounded-2xl p-8 text-center space-y-3">
            <Clock className="w-8 h-8 text-gray-400 mx-auto" />
            <h4 className="text-sm font-bold text-gray-800">No feeds match this filter</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {statusFilter === 'PENDING'
                ? 'All submitted intelligence feeds have already been audited and whitelisted.'
                : 'No feeds found matching your current query.'}
            </p>
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[#0012b8] hover:underline"
            >
              Reset filter to All Feeds
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredFeeds.map((feed) => {
              const isPending = feed.curationStatus === 'PENDING_AUDIT';
              const isActive = feed.curationStatus === 'ACTIVE';
              const isRevoked =
                feed.curationStatus === 'REVOKED' || feed.curationStatus === 'SUSPENDED';

              return (
                <div
                  key={feed.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPending
                      ? 'border-amber-400 bg-amber-50/50 shadow-xs ring-1 ring-amber-300'
                      : isActive
                      ? 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                      : 'border-red-200 bg-red-50/30'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm tracking-tight truncate">
                          {feed.name}
                        </span>
                        <code className="text-[11px] font-mono text-gray-500 bg-[#f1f5f9] px-2 py-0.5 rounded">
                          {feed.slug}
                        </code>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPending
                              ? 'bg-amber-100 text-amber-900 animate-pulse border border-amber-300'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {isPending && <Clock className="w-3 h-3 text-amber-700 shrink-0" />}
                          {isActive && <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />}
                          {feed.curationStatus}
                        </span>

                        {isActive && (
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            Whitelisted by {feed.auditedBy || PHAROS_CONSTANTS.curatorHandle}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          Publisher:{' '}
                          <code className="font-mono text-gray-700 font-medium">
                            {feed.publisherAddress.slice(0, 10)}...{feed.publisherAddress.slice(-4)}
                          </code>
                        </span>
                        <span>
                          Route:{' '}
                          <code className="font-mono text-gray-500 bg-gray-50 px-1 rounded">
                            {feed.endpointPath}
                          </code>
                        </span>
                        <span>
                          Price:{' '}
                          <strong className="text-[#0012b8]">{feed.pricePerCallUsdc} USDC</strong>
                        </span>
                        <span className="text-gray-400" suppressHydrationWarning>
                          Updated:{' '}
                          {new Date(feed.lastUpdated).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-gray-400 truncate">
                        Schema Hash: {feed.schemaHash}
                      </div>
                    </div>

                    {/* Curator Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCurationAction(feed.slug, 'ACTIVE')}
                        disabled={isProcessing || isActive}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default font-medium'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                        }`}
                        title={isActive ? 'Feed is currently whitelisted and active' : 'Approve feed'}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{isActive ? 'Approved' : 'Approve & Whitelist'}</span>
                      </button>

                      <button
                        onClick={() => handleCurationAction(feed.slug, 'SUSPENDED')}
                        disabled={isProcessing || !isActive}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          !isActive
                            ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                            : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Suspend</span>
                      </button>

                      <button
                        onClick={() => handleCurationAction(feed.slug, 'REVOKED')}
                        disabled={isProcessing || isRevoked}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isRevoked
                            ? 'border-red-200 bg-red-50 text-red-400 cursor-not-allowed'
                            : 'border-red-200 hover:bg-red-50 text-red-700'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
