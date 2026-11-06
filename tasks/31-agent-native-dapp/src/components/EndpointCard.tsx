'use client';

import React, { useState } from 'react';
import { IntelligenceFeed } from '@/types/feed';
import { ShieldCheck, AlertTriangle, Key, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

interface EndpointCardProps {
  feed: IntelligenceFeed;
  onBuyFeed: (feedSlug: string) => Promise<void>;
  isPurchasing: boolean;
}

export const EndpointCard: React.FC<EndpointCardProps> = ({ feed, onBuyFeed, isPurchasing }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing402, setTesting402] = useState(false);

  const handleTestChallenge = async () => {
    setTesting402(true);
    setTestResult(null);
    try {
      const res = await fetch(feed.endpointPath);
      const data = await res.json();
      setTestResult({
        httpStatus: res.status,
        headers: {
          'www-authenticate': res.headers.get('www-authenticate'),
          'x-402-price-usdc': res.headers.get('x-402-price-usdc'),
          'x-402-chain-id': res.headers.get('x-402-chain-id'),
        },
        responseBody: data,
      });
      setShowDetails(true);
    } catch (err) {
      setTestResult({ error: String(err) });
      setShowDetails(true);
    } finally {
      setTesting402(false);
    }
  };

  const isWhitelisted = feed.curationStatus === 'ACTIVE';

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] p-5 shadow-sm hover:border-[#c7d2fe] transition-all flex flex-col justify-between">
      <div>
        {/* Header tags */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0012b8] bg-[#eef2ff] px-2 py-0.5 rounded border border-[#c7d2fe]">
            {feed.category}
          </span>

          {isWhitelisted ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Curated by {feed.auditedBy || 'wakanda-soul'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              {feed.curationStatus}
            </span>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-semibold text-gray-900 tracking-tight">{feed.name}</h3>
        <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{feed.description}</p>

        {/* Endpoint path & price badge */}
        <div className="mt-3 flex items-center justify-between bg-[#f9fafb] p-2.5 rounded-lg border border-[#e5e7eb] text-xs">
          <div className="flex items-center gap-1.5 font-mono text-gray-700 truncate max-w-[200px] sm:max-w-[240px]">
            <Key className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{feed.endpointPath}</span>
          </div>
          <div className="font-semibold text-[#0012b8] bg-white border border-[#c7d2fe] px-2 py-0.5 rounded font-mono shrink-0">
            {feed.pricePerCallUsdc} USDC
          </div>
        </div>

        {/* Publisher & Stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
          <div>
            Publisher: <span className="text-gray-800 font-medium">{feed.publisherName}</span>
          </div>
          <div className="text-right">
            Settled: <span className="font-mono text-gray-800 font-semibold">{feed.totalCalls} calls</span> (${feed.grossRevenueUsdc.toFixed(3)})
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-[#f2f4f5] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onBuyFeed(feed.slug)}
            disabled={!isWhitelisted || isPurchasing}
            className={`flex-1 py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              !isWhitelisted
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#0012b8] hover:bg-[#000fa0] text-white shadow-sm'
            }`}
          >
            {isPurchasing ? (
              'Settling x402...'
            ) : (
              <>
                Buy with Agent Wallet ({feed.pricePerCallUsdc} USDC)
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <button
            onClick={handleTestChallenge}
            disabled={testing402}
            className="py-2 px-2.5 rounded-md text-xs font-medium bg-[#f2f4f5] hover:bg-[#e5e7eb] text-gray-700 border border-[#e5e7eb] transition-colors flex items-center gap-1"
            title="Send unauthenticated GET request to inspect HTTP 402 challenge header"
          >
            <Terminal className="w-3.5 h-3.5" />
            {testing402 ? '...' : '402'}
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-50"
            title="Toggle Details"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsible Inspection Panel */}
        {showDetails && (
          <div className="mt-2 p-3 bg-[#0d1117] text-gray-200 rounded-lg text-[11px] font-mono overflow-x-auto border border-gray-800">
            <div className="flex items-center justify-between text-gray-400 mb-2 border-b border-gray-800 pb-1">
              <span>Schema Fingerprint:</span>
              <span className="text-gray-500 truncate max-w-[150px]">{feed.schemaHash}</span>
            </div>

            {testResult ? (
              <div>
                <div className="text-emerald-400 mb-1">
                  &gt; HTTP {String(testResult.httpStatus || 402)} Payment Required:
                </div>
                <pre className="text-gray-300 text-[10px] leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            ) : (
              <div>
                <div className="text-gray-400 mb-1">&gt; Verified Sample Payload:</div>
                <pre className="text-emerald-300 text-[10px] leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(feed.sampleResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
