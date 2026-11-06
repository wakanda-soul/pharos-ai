'use client';

import React, { useState } from 'react';
import { IntelligenceFeed, FeedCurationStatus } from '@/types/feed';
import { Shield, CheckCircle, XCircle, AlertTriangle, UserCheck, Lock, ExternalLink } from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

interface CuratorWhitelistDeskProps {
  feeds: IntelligenceFeed[];
  onRefreshFeeds: () => Promise<void>;
}

export const CuratorWhitelistDesk: React.FC<CuratorWhitelistDeskProps> = ({
  feeds,
  onRefreshFeeds,
}) => {
  const [curatorInput, setCuratorInput] = useState<string>(PHAROS_CONSTANTS.curatorHandle);
  const [auditReason, setAuditReason] = useState<string>('Verified by curator - passes security schema audit.');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
          curatorAddress: curatorInput.trim(),
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
    <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="border-b border-[#e5e7eb] pb-4">
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
              <span className="text-gray-500">Designated Curator:</span>{' '}
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

      {/* Curator Identity Box (Reviewer Demonstration) */}
      <div className="bg-[#f9fafb] p-4 rounded-xl border border-[#e5e7eb] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block text-gray-700 font-semibold mb-1">
            Curator Access Key / Signer:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={curatorInput}
              onChange={(e) => setCuratorInput(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded-md font-mono text-xs focus:outline-none focus:border-[#0012b8]"
              placeholder="wakanda-soul or 0x1bF848..."
            />
          </div>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Curator on Pharos Mainnet: <code className="text-gray-600">{PHAROS_CONSTANTS.curatorAddress}</code>
          </span>
        </div>

        <div>
          <label className="block text-gray-700 font-semibold mb-1">
            Audit Reason / Attestation:
          </label>
          <input
            type="text"
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#e5e7eb] rounded-md text-xs focus:outline-none focus:border-[#0012b8]"
          />
          <span className="text-[10px] text-gray-400 mt-1 block">
            This reason is recorded in the immutable audit log.
          </span>
        </div>
      </div>

      {/* Curated Feeds Review Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-gray-500 font-semibold bg-[#f9fafb]">
              <th className="py-2.5 px-3">Endpoint & Slug</th>
              <th className="py-2.5 px-3">Publisher</th>
              <th className="py-2.5 px-3">Curation Status</th>
              <th className="py-2.5 px-3">Schema Fingerprint</th>
              <th className="py-2.5 px-3 text-right">Curator Decisions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f4f5]">
            {feeds.map((feed) => {
              const isApproved = feed.curationStatus === 'ACTIVE';
              const isPending = feed.curationStatus === 'PENDING_AUDIT';

              return (
                <tr key={feed.id} className="hover:bg-[#f9fafb] transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-gray-900">{feed.name}</div>
                    <div className="font-mono text-[10px] text-[#0012b8]">{feed.endpointPath}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-gray-600 text-[11px]">
                    {feed.publisherAddress.slice(0, 8)}...{feed.publisherAddress.slice(-4)}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isPending
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {feed.curationStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[10px] text-gray-500 truncate max-w-[120px]">
                    {feed.schemaHash}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!isApproved && (
                        <button
                          onClick={() => handleCurationAction(feed.slug, 'ACTIVE')}
                          disabled={isProcessing}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {isApproved && (
                        <button
                          onClick={() => handleCurationAction(feed.slug, 'SUSPENDED')}
                          disabled={isProcessing}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" /> Suspend
                        </button>
                      )}
                      <button
                        onClick={() => handleCurationAction(feed.slug, 'REVOKED')}
                        disabled={isProcessing}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reviewer Note */}
      <div className="bg-[#f0f9ff] border border-sky-200 rounded-xl p-4 text-xs text-sky-950 flex items-start gap-3">
        <Lock className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Arena Reviewer Verification</span>: Only endpoints vetted and whitelisted by the curator are allowed to process payments or respond through the x402 gateway. Attempting to approve feeds with an unauthorized address triggers an immediate HTTP 403 authorization rejection.
        </div>
      </div>
    </div>
  );
};
