'use client';

import React from 'react';
import { Shield, Wallet, Cpu, Database, CheckCircle, Settings, PlusCircle } from 'lucide-react';
import { PHAROS_CONSTANTS } from '@/lib/pharos-chain';

interface NavbarProps {
  activeTab: 'marketplace' | 'copilot' | 'publisher' | 'curator';
  setActiveTab: (tab: 'marketplace' | 'copilot' | 'publisher' | 'curator') => void;
  walletAddress: string;
  walletBalanceUsdc: number;
  onOpenDeposit: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  walletAddress,
  walletBalanceUsdc,
  onOpenDeposit,
  onOpenSettings,
}) => {
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '0x...';

  return (
    <header className="sticky top-0 z-50 bg-[#ffffff] border-b border-[#e5e7eb] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#0012b8] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              <span className="tracking-tighter">φ</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-base tracking-tight">
                  Pharos x402 Mesh
                </span>
                <span className="text-[11px] font-medium bg-[#eef2ff] text-[#0012b8] px-2 py-0.5 rounded-full border border-[#c7d2fe]">
                  Mainnet 1672
                </span>
              </div>
              <span className="text-xs text-gray-500 hidden sm:block">
                Agent-Native Data Marketplace
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-[#f2f4f5] p-1 rounded-md border border-[#e5e7eb]">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-[#0012b8]" />
              Data Catalog
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                activeTab === 'copilot'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#5c41ff]" />
              AI Copilot
            </button>
            <button
              onClick={() => setActiveTab('publisher')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                activeTab === 'publisher'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-gray-600" />
              Publisher Hub
            </button>
            <button
              onClick={() => setActiveTab('curator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                activeTab === 'curator'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Curator Desk
            </button>
          </nav>

          {/* Wallet & Auth Pill */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-md border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors"
              title="Copilot Sandbox & Gemini OAuth Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Embedded Agent Wallet */}
            <div className="flex items-center bg-[#f9fafb] border border-[#e5e7eb] rounded-md p-1 pl-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-gray-700 hidden sm:inline">{shortAddress}</span>
              </div>
              <div className="bg-white border border-[#e5e7eb] px-2 py-0.5 rounded font-semibold text-[#0012b8]">
                {walletBalanceUsdc.toFixed(3)} USDC
              </div>
              <button
                onClick={onOpenDeposit}
                className="bg-[#0012b8] hover:bg-[#000fa0] text-white p-1 rounded-sm flex items-center justify-center transition-colors"
                title="Deposit USDC to Embedded Agent Wallet"
              >
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation tab bar */}
      <div className="md:hidden flex items-center justify-around border-t border-[#e5e7eb] bg-[#f9fafb] p-1.5 text-xs">
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-2 py-1 rounded ${activeTab === 'marketplace' ? 'font-bold text-[#0012b8]' : 'text-gray-600'}`}
        >
          Catalog
        </button>
        <button
          onClick={() => setActiveTab('copilot')}
          className={`px-2 py-1 rounded ${activeTab === 'copilot' ? 'font-bold text-[#5c41ff]' : 'text-gray-600'}`}
        >
          AI Copilot
        </button>
        <button
          onClick={() => setActiveTab('publisher')}
          className={`px-2 py-1 rounded ${activeTab === 'publisher' ? 'font-bold text-gray-900' : 'text-gray-600'}`}
        >
          Publisher
        </button>
        <button
          onClick={() => setActiveTab('curator')}
          className={`px-2 py-1 rounded ${activeTab === 'curator' ? 'font-bold text-emerald-700' : 'text-gray-600'}`}
        >
          Curator
        </button>
      </div>
    </header>
  );
};
