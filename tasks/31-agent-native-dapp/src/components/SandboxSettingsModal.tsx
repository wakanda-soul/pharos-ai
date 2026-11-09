'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Shield, Sparkles, Check, Lock, Cpu } from 'lucide-react';

interface SandboxSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiApiKey: string;
  onSaveGeminiApiKey: (key: string) => void;
  oauthAccessToken: string;
  onSaveOAuthToken: (token: string) => void;
}

export const SandboxSettingsModal: React.FC<SandboxSettingsModalProps> = ({
  isOpen,
  onClose,
  geminiApiKey,
  onSaveGeminiApiKey,
  oauthAccessToken,
  onSaveOAuthToken,
}) => {
  const [localApiKey, setLocalApiKey] = useState(geminiApiKey);
  const [localOAuth, setLocalOAuth] = useState(oauthAccessToken);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setLocalApiKey(geminiApiKey);
    setLocalOAuth(oauthAccessToken);
  }, [geminiApiKey, oauthAccessToken]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveGeminiApiKey(localApiKey.trim());
    onSaveOAuthToken(localOAuth.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl pharos-gradient-bg flex items-center justify-center text-white shadow-2xs">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">
              Copilot Sandbox Settings
            </h3>
            <span className="text-xs text-gray-500 font-mono">
              Antigravity Sandbox Engine · Gemini 3.8 Flash
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-4">
          The Copilot runs inside a secure Linux Bubblewrap sandbox on Pharos Mainnet. Preflight gathers live MCP telemetry, and LLM reasoning uses <code>Gemini 3.8 Flash</code>. You can optionally link your custom Gemini API key or OAuth Bearer token below.
        </p>

        {/* Gemini API Key */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Google Gemini API Key (Optional override):
          </label>
          <div className="relative">
            <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="password"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8faff] border border-[#e2e8f0] rounded-xl font-mono focus:outline-none focus:border-[#5c41ff] focus:ring-2 focus:ring-[#5c41ff]/10 transition-all"
            />
          </div>
        </div>

        {/* OAuth Access Token */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Google OAuth 2.0 Bearer Token (Optional):
          </label>
          <input
            type="password"
            value={localOAuth}
            onChange={(e) => setLocalOAuth(e.target.value)}
            placeholder="ya29.a0AfH6SM..."
            className="w-full px-3 py-2 text-xs bg-[#f8faff] border border-[#e2e8f0] rounded-xl font-mono focus:outline-none focus:border-[#5c41ff] focus:ring-2 focus:ring-[#5c41ff]/10 transition-all"
          />
          <span className="text-[10px] text-gray-400 mt-1 block">
            Used for 1-click Google Workspace / Vertex authentication.
          </span>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 ${
            savedSuccess
              ? 'bg-emerald-600 text-white'
              : 'pharos-gradient-bg hover:opacity-95 text-white'
          }`}
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4" /> Preferences Saved!
            </>
          ) : (
            'Save Settings'
          )}
        </button>

        <div className="mt-4 pt-3 border-t border-[#f1f5f9] text-[11px] text-gray-400 flex items-center gap-1.5 justify-center">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          Keys are stored locally in your browser memory and never persisted to external servers.
        </div>
      </div>
    </div>
  );
};
