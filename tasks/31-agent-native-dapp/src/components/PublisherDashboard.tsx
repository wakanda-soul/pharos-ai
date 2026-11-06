'use client';

import React, { useState } from 'react';
import { IntelligenceFeed } from '@/types/feed';
import { Settings, Save, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface PublisherDashboardProps {
  feeds: IntelligenceFeed[];
  onRefreshFeeds: () => Promise<void>;
}

export const PublisherDashboard: React.FC<PublisherDashboardProps> = ({
  feeds,
  onRefreshFeeds,
}) => {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0.001);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e7eb] pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#0012b8]" />
            Publisher Dashboard & Fee Management
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Manage your registered on-chain intelligence endpoints, customize pricing, and inspect micro-revenue.
          </p>
        </div>

        <button
          onClick={onRefreshFeeds}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#f2f4f5] hover:bg-[#e5e7eb] text-gray-700 transition-colors border border-[#e5e7eb]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stats
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-medium">
          {statusMessage}
        </div>
      )}

      {/* Feeds Table */}
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
            {feeds.map((feed) => {
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
