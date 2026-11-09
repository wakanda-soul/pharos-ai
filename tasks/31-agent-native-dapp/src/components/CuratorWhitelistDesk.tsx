'use client';

import React, { useState } from 'react';
import { IntelligenceFeed, FeedCurationStatus } from '@/types/feed';
import { Shield, CheckCircle, XCircle, AlertTriangle, UserCheck, Lock, ExternalLink, Wallet } from 'lucide-react';
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
  const [curatorInput, setCuratorInput] = useState<string>(walletAddress || PHAROS_CONSTANTS.curatorHandle);
  const [auditReason, setAuditReason] = useState<string>('Verified by curator - passes security schema audit.');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
        setActionMessage(`🛡️ Status updated: '${slug}' is now '${newStatus}'. (Curator: ${data.curator})`);
        await onRefreshFeeds();
      } else {
        setActionMessage(`❌ Access Denied: ${data.error}`);
      }
    } catch (err) {
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 font-medium">
          {actionMessage}
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

      {/* Feed Whitelisting Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          Feed Queue & Integrity Audit
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {feeds.map((feed) => {
            const isPending = feed.curationStatus === 'PENDING_AUDIT';
            const isActive = feed.curationStatus === 'ACTIVE';

            return (
              <div
                key={feed.id}
                className={`p-4 rounded-xl border transition-all ${
                  isPending
                    ? 'border-amber-300 bg-amber-50/40'
                    : isActive
                    ? 'border-[#e5e7eb] bg-white'
                    : 'border-red-200 bg-red-50/20'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">{feed.name}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPending
                            ? 'bg-amber-100 text-amber-900 animate-pulse'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {feed.curationStatus}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Publisher: <code className="font-mono">{feed.publisherAddress.slice(0, 10)}...</code></span>
                      <span>Route: <code className="font-mono text-gray-500">{feed.endpointPath}</code></span>
                      <span>Price: <strong className="text-[#0012b8]">{feed.pricePerCallUsdc} USDC</strong></span>
                    </div>

                    <div className="text-[11px] font-mono text-gray-400">
                      Schema Hash: {feed.schemaHash}
                    </div>
                  </div>

                  {/* Curator Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCurationAction(feed.slug, 'ACTIVE')}
                      disabled={isProcessing || isActive}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{isActive ? 'Approved' : 'Approve & Whitelist'}</span>
                    </button>

                    <button
                      onClick={() => handleCurationAction(feed.slug, 'SUSPENDED')}
                      disabled={isProcessing || !isActive}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Suspend</span>
                    </button>

                    <button
                      onClick={() => handleCurationAction(feed.slug, 'REVOKED')}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-red-200 hover:bg-red-50 text-red-700 transition-colors"
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
      </div>
    </div>
  );
};
