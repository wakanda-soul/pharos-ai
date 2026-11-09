'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Database,
  Settings,
  Shield,
  Wallet,
  PlusCircle,
  Copy,
  CheckCheck,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sliders,
  Radio,
  BookOpen,
} from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

interface SidebarProps {
  activeTab: 'copilot' | 'marketplace' | 'publisher' | 'curator';
  setActiveTab: (tab: 'copilot' | 'marketplace' | 'publisher' | 'curator') => void;
  walletAddress: string | null;
  walletBalanceUsdc: number;
  walletBalancePros: number;
  isCurator: boolean;
  onOpenDeposit: () => void;
  onOpenSettings: () => void;
  onOpenPrivyLogin: () => void;
  onDisconnectWallet: () => void;
  totalFeedsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  walletAddress,
  walletBalanceUsdc,
  walletBalancePros,
  isCurator,
  onOpenDeposit,
  onOpenSettings,
  onOpenPrivyLogin,
  onDisconnectWallet,
  totalFeedsCount = 4,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const navItems = [
    {
      id: 'copilot' as const,
      label: 'AI Copilot',
      icon: Sparkles,
      badge: '3.8 Flash',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      pulse: true,
    },
    {
      id: 'marketplace' as const,
      label: 'Data Catalog',
      icon: Database,
      badge: `${totalFeedsCount} Feeds`,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
      pulse: false,
    },
    {
      id: 'publisher' as const,
      label: 'Publisher Hub',
      icon: Settings,
      badge: null,
      badgeColor: '',
      pulse: false,
    },
    {
      id: 'curator' as const,
      label: 'Curator Desk',
      icon: Shield,
      badge: isCurator ? 'Curator' : null,
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
      pulse: false,
    },
  ];

  return (
    <aside className="w-64 sm:w-72 bg-white border-r border-[#e2e8f0] flex flex-col h-screen shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl pharos-gradient-bg flex items-center justify-center text-white font-bold text-base shadow-xs">
            φ
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-900 tracking-tight text-sm">
                Pharos Mesh
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[11px] text-gray-500 font-mono">
              x402 Protocol · Chain 1672
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Copilot Sandbox Settings"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* Main Navigation Tabs */}
      <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
        <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-gray-400 px-3 py-1 block">
          Platform Navigation
        </span>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'pharos-gradient-bg text-white shadow-xs'
                  : 'text-gray-700 hover:bg-[#f8faff] hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#0012b8]'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1 border ${
                    isActive
                      ? 'bg-white/20 text-white border-white/30'
                      : item.badgeColor
                  }`}
                >
                  {item.pulse && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-white' : 'bg-emerald-500'
                      } animate-pulse`}
                    />
                  )}
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Live MCP Mesh Telemetry Links */}
        <div className="pt-4 mt-3 border-t border-[#f1f5f9] px-1 space-y-2">
          <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-gray-400 px-2 block">
            Connected Gateways
          </span>

          <a
            href="https://mcp.pharos.xyz/mcp"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-xl text-[11px] text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200/80 transition-all font-mono"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Chain MCP (RPC)</span>
            </div>
            <ExternalLink className="w-3 h-3 text-emerald-600" />
          </a>

          <a
            href="https://docs.pharos.xyz"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-xl text-[11px] text-blue-800 bg-blue-50/70 hover:bg-blue-100 border border-blue-200/80 transition-all font-mono"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-3 h-3 text-blue-600" />
              <span>Docs MCP (RAG)</span>
            </div>
            <ExternalLink className="w-3 h-3 text-blue-600" />
          </a>

          <a
            href="https://pharosscan.xyz"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-2 rounded-xl text-[11px] text-purple-800 bg-purple-50/70 hover:bg-purple-100 border border-purple-200/80 transition-all font-mono"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-3 h-3 text-purple-600" />
              <span>PharosScan (1672)</span>
            </div>
            <ExternalLink className="w-3 h-3 text-purple-600" />
          </a>
        </div>
      </div>

      {/* Sidebar Footer: Agent Wallet & Balance Widget */}
      <div className="p-3 border-t border-[#e2e8f0] bg-[#fafbfc]">
        {walletAddress ? (
          <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 font-medium">Session Wallet:</span>
              <button
                onClick={handleCopy}
                className="text-gray-500 hover:text-gray-900 flex items-center gap-1 font-mono text-[10px]"
                title="Copy full address"
              >
                <span>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                {copied ? <CheckCheck className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#f1f5f9]">
              <div>
                <span className="text-[10px] text-gray-400 block font-mono">Usable Balance</span>
                <span className="text-sm font-bold text-[#0012b8] font-mono">
                  ${walletBalanceUsdc.toFixed(3)}{' '}
                  <span className="text-[10px] font-normal text-gray-500">USDC</span>
                </span>
              </div>

              <button
                onClick={onOpenDeposit}
                className="p-1.5 rounded-lg pharos-gradient-bg text-white hover:opacity-95 shadow-2xs transition-all flex items-center gap-1 text-[11px] font-semibold"
                title="Top up session balance"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Top Up</span>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between text-[10px] text-gray-400 border-t border-[#f1f5f9]">
              <span className="font-mono">{walletBalancePros.toFixed(2)} PROS</span>
              <button
                onClick={onDisconnectWallet}
                className="text-gray-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                title="Disconnect session key"
              >
                <LogOut className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenPrivyLogin}
            className="w-full py-2.5 px-3 rounded-xl pharos-gradient-bg hover:opacity-95 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
          >
            <Wallet className="w-4 h-4" />
            <span>Connect with Privy</span>
          </button>
        )}
      </div>
    </aside>
  );
};
