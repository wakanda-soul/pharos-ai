'use client';

import React, { useState } from 'react';
import { IntelligenceFeed } from '@/types/feed';
import {
  ShieldCheck,
  AlertTriangle,
  Key,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Terminal,
  Activity,
  Zap,
  Copy,
  Check,
} from 'lucide-react';

interface EndpointCardProps {
  feed: IntelligenceFeed;
  onBuyFeed: (feedSlug: string) => Promise<void>;
  isPurchasing: boolean;
}

export const EndpointCard: React.FC<EndpointCardProps> = ({ feed, onBuyFeed, isPurchasing }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing402, setTesting402] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleCopyPath = () => {
    navigator.clipboard.writeText(feed.endpointPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isWhitelisted = feed.curationStatus === 'ACTIVE';

  const categoryBadge = () => {
    switch (feed.category) {
      case 'DEFI':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'SECURITY':
        return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'MONITORING':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-xs hover:border-[#c7d2fe] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Header tags */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${categoryBadge()} font-mono`}
          >
            {feed.category}
          </span>

          {isWhitelisted ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Curated by {feed.auditedBy || 'wakanda-soul'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{feed.curationStatus}</span>
            </span>
          )}
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-bold text-gray-900 tracking-tight">{feed.name}</h3>
        <p className="mt-1.5 text-xs text-gray-600 leading-relaxed min-h-[36px]">{feed.description}</p>

        {/* Endpoint path & price badge */}
        <div className="mt-3.5 flex items-center justify-between bg-[#f8faff] p-2.5 rounded-xl border border-[#e2e8f0] text-xs">
          <div className="flex items-center gap-2 font-mono text-gray-700 truncate max-w-[200px] sm:max-w-[240px]">
            <Key className="w-3.5 h-3.5 text-[#5c41ff] shrink-0" />
            <span className="truncate">{feed.endpointPath}</span>
            <button
              onClick={handleCopyPath}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              title="Copy endpoint path"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="font-bold text-[#0012b8] bg-white border border-[#c7d2fe] px-2.5 py-1 rounded-lg font-mono text-xs shadow-2xs shrink-0">
            {feed.pricePerCallUsdc} USDC
          </div>
        </div>

        {/* Publisher & Stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500 pt-2 border-t border-[#f1f5f9]">
          <div>
            Publisher: <span className="text-gray-800 font-medium">{feed.publisherName}</span>
          </div>
          <div className="text-right">
            Settled: <span className="font-mono text-gray-900 font-bold">{feed.totalCalls} calls</span>{' '}
            <span className="text-emerald-700 font-semibold">(${feed.grossRevenueUsdc.toFixed(3)})</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onBuyFeed(feed.slug)}
            disabled={!isWhitelisted || isPurchasing}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs ${
              !isWhitelisted
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'pharos-gradient-bg hover:opacity-95 text-white active:scale-98'
            }`}
          >
            {isPurchasing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Settling x402...
              </span>
            ) : (
              <>
                <span>Buy with Agent Wallet ({feed.pricePerCallUsdc} USDC)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <button
            onClick={handleTestChallenge}
            disabled={testing402}
            className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#f8faff] hover:bg-[#f1f5f9] text-gray-700 border border-[#e2e8f0] transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Inspect HTTP 402 challenge header response"
          >
            <Terminal className="w-3.5 h-3.5 text-[#5c41ff]" />
            <span>{testing402 ? '...' : '402'}</span>
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
            title="Toggle Inspection Drawer"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsible Inspection Panel */}
        {showDetails && (
          <div className="mt-2.5 p-3.5 bg-[#0b132b] text-gray-200 rounded-xl text-[11px] font-mono overflow-x-auto border border-gray-800 shadow-inner">
            <div className="flex items-center justify-between text-gray-400 mb-2 border-b border-gray-800 pb-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400">Schema Fingerprint:</span>
              <span className="text-gray-400 truncate max-w-[180px]">{feed.schemaHash}</span>
            </div>

            {testResult ? (
              <div>
                <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  &gt; HTTP {String(testResult.httpStatus || 402)} Payment Required Challenge:
                </div>
                <pre className="text-gray-300 text-[10px] leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            ) : (
              <div>
                <div className="text-emerald-400 font-bold mb-1">&gt; Verified Sample Payload (Pre-Audit):</div>
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
