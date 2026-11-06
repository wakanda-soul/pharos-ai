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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl border border-[#e5e7eb] max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-md bg-[#5c41ff] flex items-center justify-center text-white">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">
              Copilot Sandbox Settings
            </h3>
            <span className="text-xs text-gray-500">
              Gemini 1.5 Integration & OAuth Configuration
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed mb-4">
          The Copilot runs in <strong>Deterministic Sandbox Mode</strong> out of the box with zero external setup needed. You can optionally link your own Google Gemini API key or OAuth Bearer token below.
        </p>

        {/* Gemini API Key */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Google Gemini API Key (Optional):
          </label>
          <div className="relative">
            <Key className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="password"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded-md font-mono focus:outline-none focus:border-[#5c41ff]"
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
            className="w-full px-3 py-1.5 text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded-md font-mono focus:outline-none focus:border-[#5c41ff]"
          />
          <span className="text-[10px] text-gray-400 mt-1 block">
            Used for 1-click Google Workspace / Vertex authentication.
          </span>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`w-full py-2.5 px-4 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            savedSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-[#5c41ff] hover:bg-[#4930d6] text-white shadow-sm'
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

        <div className="mt-4 pt-3 border-t border-[#f2f4f5] text-[11px] text-gray-400 flex items-center gap-1.5 justify-center">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          Keys are stored locally in your browser memory and never persisted to external servers.
        </div>
      </div>
    </div>
  );
};
