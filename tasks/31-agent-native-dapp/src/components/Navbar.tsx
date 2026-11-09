'use client';

import React from 'react';
import { Shield, Wallet, Cpu, Database, CheckCircle, Settings, PlusCircle, Activity } from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

interface NavbarProps {
  activeTab: 'marketplace' | 'copilot' | 'publisher' | 'curator';
  setActiveTab: (tab: 'marketplace' | 'copilot' | 'publisher' | 'curator') => void;
  walletAddress: string | null;
  walletBalanceUsdc: number;
  isCurator?: boolean;
  onOpenDeposit: () => void;
  onOpenSettings: () => void;
  onOpenPrivyLogin: () => void;
  onDisconnectWallet: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  walletAddress,
  walletBalanceUsdc,
  isCurator = false,
  onOpenDeposit,
  onOpenSettings,
  onOpenPrivyLogin,
  onDisconnectWallet,
}) => {
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl pharos-gradient-bg flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-[#0012b8]/20 transition-transform hover:scale-105">
              <span className="tracking-tighter">φ</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-base tracking-tight">
                  Pharos x402 Mesh
                </span>
                <span className="text-[10px] font-semibold bg-[#eef2ff] text-[#0012b8] px-2 py-0.5 rounded-full border border-[#c7d2fe] flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Mainnet 1672
                </span>
              </div>
              <span className="text-[11px] text-gray-500 hidden sm:block">
                Agent-Native Data Marketplace · port.pharos.xyz
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
            <button
              onClick={() => setActiveTab('copilot')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'copilot'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#5c41ff]" />
              <span>AI Copilot</span>
              <span className="text-[9px] bg-purple-50 text-[#5c41ff] border border-purple-200 px-1 py-0.2 rounded font-mono">
                3.8 Flash
              </span>
            </button>

            <button
              onClick={() => setActiveTab('marketplace')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-[#0012b8]" />
              <span>Data Catalog</span>
            </button>

            <button
              onClick={() => setActiveTab('publisher')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'publisher'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-gray-600" />
              <span>Publisher Hub</span>
            </button>

            {isCurator && (
              <button
                onClick={() => setActiveTab('curator')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'curator'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-900 hover:bg-white/50'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Curator Desk</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>
            )}
          </nav>

          {/* Wallet & Auth Pill */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-lg border border-[#e2e8f0] hover:bg-[#f8faff] transition-colors"
              title="Copilot Sandbox & Gemini OAuth Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Embedded Agent Wallet / Privy Login */}
            {walletAddress ? (
              <div className="flex items-center bg-[#f8faff] border border-[#e2e8f0] rounded-xl p-1 pl-2.5 gap-2 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono text-gray-700 font-medium hidden sm:inline">{shortAddress}</span>
                </div>
                <div className="bg-white border border-[#c7d2fe]/70 px-2 py-0.5 rounded-md font-bold text-[#0012b8] font-mono shadow-2xs">
                  {walletBalanceUsdc.toFixed(3)} USDC
                </div>
                <button
                  onClick={onOpenDeposit}
                  className="bg-[#0012b8] hover:bg-[#000fa0] text-white p-1 rounded-md flex items-center justify-center transition-colors shadow-2xs hover:scale-105"
                  title="Deposit USDC to Embedded Agent Wallet"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onDisconnectWallet}
                  className="text-gray-400 hover:text-red-600 px-1 text-[11px] font-medium transition-colors"
                  title="Disconnect Wallet"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenPrivyLogin}
                className="flex items-center gap-1.5 bg-[#5c41ff] hover:bg-[#4b32e0] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs hover:shadow-[#5c41ff]/20 active:scale-98"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect with Privy</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile navigation tab bar */}
      <div className="md:hidden flex items-center justify-around border-t border-[#e2e8f0] bg-[#f8faff] p-1.5 text-xs">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`px-2.5 py-1 rounded-md ${activeTab === 'copilot' ? 'font-bold text-[#5c41ff] bg-white shadow-2xs' : 'text-gray-600'}`}
        >
          AI Copilot
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-2.5 py-1 rounded-md ${activeTab === 'marketplace' ? 'font-bold text-[#0012b8] bg-white shadow-2xs' : 'text-gray-600'}`}
        >
          Data Catalog
        </button>
        <button
          onClick={() => setActiveTab('publisher')}
          className={`px-2.5 py-1 rounded-md ${activeTab === 'publisher' ? 'font-bold text-gray-900 bg-white shadow-2xs' : 'text-gray-600'}`}
        >
          Publisher Hub
        </button>
        {isCurator && (
          <button
            onClick={() => setActiveTab('curator')}
            className={`px-2.5 py-1 rounded-md ${activeTab === 'curator' ? 'font-bold text-emerald-800 bg-white shadow-2xs' : 'text-emerald-600'}`}
          >
            Curator Desk
          </button>
        )}
      </div>
    </header>
  );
};
