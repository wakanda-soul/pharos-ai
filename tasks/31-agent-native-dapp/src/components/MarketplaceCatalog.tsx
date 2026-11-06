'use client';

import React, { useState } from 'react';
import { IntelligenceFeed, FeedCategory } from '@/types/feed';
import { EndpointCard } from './EndpointCard';
import { Search, Filter, CheckCircle2, X } from 'lucide-react';

interface MarketplaceCatalogProps {
  feeds: IntelligenceFeed[];
  onBuyFeed: (feedSlug: string) => Promise<void>;
  isPurchasing: boolean;
  lastPurchaseResult: Record<string, unknown> | null;
  onClearPurchaseResult: () => void;
}

export const MarketplaceCatalog: React.FC<MarketplaceCatalogProps> = ({
  feeds,
  onBuyFeed,
  isPurchasing,
  lastPurchaseResult,
  onClearPurchaseResult,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredFeeds = feeds.filter((feed) => {
    const matchesSearch =
      feed.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || feed.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: { label: string; value: string }[] = [
    { label: 'All Feeds', value: 'ALL' },
    { label: 'DeFi & Solvency', value: 'DEFI' },
    { label: 'On-Chain Monitoring', value: 'MONITORING' },
    { label: 'Security & Honeypot', value: 'SECURITY' },
  ];

  return (
    <div className="space-y-6">
      {/* Live Purchase Result Alert */}
      {lastPurchaseResult && (
        <div className="bg-[#f0fdf4] border border-emerald-300 rounded-xl p-4 text-xs shadow-sm flex flex-col gap-2 relative">
          <button
            onClick={onClearPurchaseResult}
            className="absolute top-3 right-3 text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            Autonomous x402 Payment Settled on Pharos Mainnet!
          </div>
          <div className="text-emerald-700">
            Receipt ID: <code className="font-mono font-bold">{String((lastPurchaseResult.receipt as Record<string, unknown>)?.receiptId || '')}</code> | Paid:{' '}
            <strong>{String((lastPurchaseResult.receipt as Record<string, unknown>)?.paidUsdc || 0.001)} USDC</strong>
          </div>
          <div className="bg-white border border-emerald-200 rounded p-2 text-gray-800 font-mono text-[11px] overflow-x-auto max-h-48">
            <pre>{JSON.stringify(lastPurchaseResult.intelligence, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all shrink-0 ${
                selectedCategory === cat.value
                  ? 'bg-[#0012b8] text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-[#e5e7eb]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search verified feeds..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#0012b8] focus:ring-1 focus:ring-[#0012b8] transition-colors"
          />
        </div>
      </div>

      {/* Grid of Curated Endpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredFeeds.map((feed) => (
          <EndpointCard
            key={feed.id}
            feed={feed}
            onBuyFeed={onBuyFeed}
            isPurchasing={isPurchasing}
          />
        ))}
      </div>

      {filteredFeeds.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-[#e5e7eb]">
          <p className="text-sm text-gray-500">No feeds match your search criteria.</p>
        </div>
      )}
    </div>
  );
};
