'use client';

import React from 'react';
import { ShieldCheck, Zap, Coins, Lock, Cpu, Globe, ArrowUpRight, Sparkles } from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

export const HeroBanner: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-white via-[#f8faff] to-[#f4f6f8] border-b border-[#e2e8f0]/80 py-8 px-4 sm:px-6 lg:px-8">
      {/* Ambient background glow accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 left-10 w-72 h-72 bg-blue-200/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Main Title & Description */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef2ff] border border-[#c7d2fe]/70 text-xs font-semibold text-[#0012b8] mb-3 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#0012b8] animate-pulse" />
              <span>Pharos Agent-Native L1 Standard · HTTP 402 Paywall Protocol</span>
              <span className="text-gray-300">|</span>
              <span className="font-mono text-[11px] text-[#5c41ff]">Mainnet 1672</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Pharos <span className="pharos-gradient-text">x402 Intelligence Mesh</span>
            </h1>

            <p className="mt-2.5 text-sm text-gray-600 leading-relaxed">
              Curated on-chain data marketplace enabling autonomous AI agents to broker verified DeFi solvency,
              whale telemetry, and smart contract risk feeds using <strong className="text-gray-900 font-semibold">0.001 USDC micro-payments</strong> settled atomically via EIP-712 session keys on Pharos Mainnet.
            </p>

            {/* Quick Gateways Row */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
              <a
                href="https://mcp.pharos.xyz/mcp"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-emerald-200 text-emerald-800 font-mono hover:bg-emerald-50 transition-colors shadow-2xs"
                title="Hosted Streamable HTTP Chain MCP"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Chain MCP</span>
                <span className="text-emerald-500 font-sans">mcp.pharos.xyz</span>
                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              </a>

              <a
                href="https://docs.pharos.xyz"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-blue-800 font-mono hover:bg-blue-50 transition-colors shadow-2xs"
                title="Official Developer Documentation RAG"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Docs MCP</span>
                <span className="text-blue-500 font-sans">docs.pharos.xyz</span>
                <ArrowUpRight className="w-3 h-3 text-blue-500" />
              </a>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-purple-200 text-purple-800 font-mono shadow-2xs">
                <Sparkles className="w-3 h-3 text-[#5c41ff]" />
                <span>Autonomous AI Sandbox</span>
              </span>
            </div>
          </div>

          {/* Quick Architecture Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card p-3.5 rounded-xl border border-gray-200/80 shadow-xs hover:border-[#0012b8]/40 transition-all flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium text-[11px]">
                <Coins className="w-3.5 h-3.5 text-[#0012b8]" />
                Base Fee
              </div>
              <div className="mt-2">
                <div className="font-bold text-gray-900 font-mono text-sm">0.001 USDC</div>
                <div className="text-[10px] text-gray-400 font-mono">1,000 atomic units</div>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-gray-200/80 shadow-xs hover:border-amber-400/40 transition-all flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium text-[11px]">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Network
              </div>
              <div className="mt-2">
                <div className="font-bold text-gray-900 text-sm">Pharos Mainnet</div>
                <div className="text-[10px] text-emerald-600 font-mono font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Chain ID 1672
                </div>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-gray-200/80 shadow-xs hover:border-emerald-400/40 transition-all flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Curation Desk
              </div>
              <div className="mt-2">
                <div className="font-bold text-gray-900 font-mono text-sm">{PHAROS_CONSTANTS.curatorHandle}</div>
                <div className="text-[10px] text-gray-400">Anti-Scam Lockdown</div>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-gray-200/80 shadow-xs hover:border-purple-400/40 transition-all flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium text-[11px]">
                <Lock className="w-3.5 h-3.5 text-[#5c41ff]" />
                Voucher Gate
              </div>
              <div className="mt-2">
                <div className="font-bold text-gray-900 text-sm">EIP-712</div>
                <div className="text-[10px] text-[#5c41ff] font-medium">Cryptographic Proof</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
