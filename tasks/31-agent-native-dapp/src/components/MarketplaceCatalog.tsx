'use client';

import React, { useState } from 'react';
import { IntelligenceFeed, FeedCategory } from '@/types/feed';
import { EndpointCard } from './EndpointCard';
import { Search, Filter, CheckCircle2, X, Sparkles, Database, ShieldCheck, Copy, Check } from 'lucide-react';

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
  const [receiptCopied, setReceiptCopied] = useState(false);

  const filteredFeeds = feeds.filter((feed) => {
    const matchesSearch =
      feed.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      feed.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || feed.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: { label: string; value: string; count: number }[] = [
    { label: 'All Feeds', value: 'ALL', count: feeds.length },
    { label: 'DeFi & Solvency', value: 'DEFI', count: feeds.filter((f) => f.category === 'DEFI').length },
    { label: 'Monitoring', value: 'MONITORING', count: feeds.filter((f) => f.category === 'MONITORING').length },
    { label: 'Security & Risk', value: 'SECURITY', count: feeds.filter((f) => f.category === 'SECURITY').length },
  ];

  const handleCopyReceipt = (rcptId: string) => {
    navigator.clipboard.writeText(rcptId);
    setReceiptCopied(true);
    setTimeout(() => setReceiptCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Live Purchase Result Alert */}
      {lastPurchaseResult && (
        <div className="bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 border border-emerald-300 rounded-2xl p-5 text-xs shadow-sm flex flex-col gap-3 relative animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={onClearPurchaseResult}
            className="absolute top-4 right-4 text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 text-emerald-900 font-bold text-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span>Autonomous x402 Payment Settled on Pharos Mainnet!</span>
              <div className="text-[11px] font-normal text-emerald-700">
                Settled atomically via EIP-712 Voucher · Chain ID 1672
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-emerald-800 text-[11px]">
            <span className="font-medium">Receipt ID:</span>
            <code className="font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 shadow-2xs">
              {String((lastPurchaseResult.receipt as Record<string, unknown>)?.receiptId || '')}
              <button
                onClick={() =>
                  handleCopyReceipt(
                    String((lastPurchaseResult.receipt as Record<string, unknown>)?.receiptId || '')
                  )
                }
                className="text-emerald-600 hover:text-emerald-900"
              >
                {receiptCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </code>
            <span className="text-gray-300">|</span>
            <span>
              Paid: <strong>{String((lastPurchaseResult.receipt as Record<string, unknown>)?.paidUsdc || 0.001)} USDC</strong>
            </span>
          </div>

          <details className="bg-[#0b132b] border border-gray-800 rounded-xl p-3 text-gray-200 font-mono text-[11px] overflow-hidden">
            <summary className="cursor-pointer text-emerald-400 font-bold hover:underline">
              Inspect Unlocked Feed Payload (JSON)
            </summary>
            <pre className="mt-2 overflow-x-auto text-emerald-300 max-h-48 whitespace-pre-wrap text-[10px]">
              {JSON.stringify(lastPurchaseResult.intelligence, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#e2e8f0] shadow-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                selectedCategory === cat.value
                  ? 'pharos-gradient-bg text-white shadow-xs'
                  : 'bg-[#f8faff] text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200/80'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedCategory === cat.value ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search verified feeds by keyword or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#f8faff] border border-[#e2e8f0] rounded-xl focus:outline-none focus:border-[#0012b8] focus:bg-white focus:ring-1 focus:ring-[#0012b8]/30 transition-all shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
        <div className="text-center py-16 bg-white rounded-2xl border border-[#e2e8f0] shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">No feeds match your search criteria</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try adjusting your search terms or select "All Feeds" to explore the catalog.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('ALL');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0012b8] text-white text-xs font-semibold shadow-xs hover:bg-[#000fa0] transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
