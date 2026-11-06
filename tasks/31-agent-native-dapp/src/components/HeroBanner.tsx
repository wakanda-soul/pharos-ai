'use client';

import React from 'react';
import { ShieldCheck, Zap, Coins, Lock } from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

export const HeroBanner: React.FC = () => {
  return (
    <div className="bg-white border-b border-[#e5e7eb] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#eef2ff] border border-[#c7d2fe] text-xs font-semibold text-[#0012b8] mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0012b8]" />
              Pharos Agent-Native L1 Standard · HTTP 402 Paywall Protocol
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              x402 Intelligence Mesh
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-2xl leading-relaxed">
              Curated on-chain data marketplace enabling autonomous AI agents to broker verified DeFi solvency,
              whale telemetry, and smart contract risk feeds using <strong>0.001 USDC micro-payments</strong> settled on Pharos Mainnet.
            </p>
          </div>

          {/* Quick Architecture Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f2f4f5] p-3 rounded-xl border border-[#e5e7eb] text-xs">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-gray-500 font-medium">
                <Coins className="w-3.5 h-3.5 text-[#0012b8]" />
                Base Fee
              </div>
              <div className="font-semibold text-gray-900 font-mono">0.001 USDC</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-gray-500 font-medium">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Network
              </div>
              <div className="font-semibold text-gray-900">Chain ID 1672</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-gray-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Curation
              </div>
              <div className="font-semibold text-gray-900 font-mono">wakanda-soul</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-gray-500 font-medium">
                <Lock className="w-3.5 h-3.5 text-[#5c41ff]" />
                Security
              </div>
              <div className="font-semibold text-gray-900">3-Layer Gate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
