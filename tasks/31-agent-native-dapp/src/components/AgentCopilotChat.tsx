'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AgentChatMessage } from '@/types/agent';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  Cpu,
  Send,
  ShieldAlert,
  CheckCircle,
  Zap,
  Terminal,
  CornerDownLeft,
  Sparkles,
  AlertOctagon,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface AgentCopilotChatProps {
  walletAddress: string | null;
  walletBalanceUsdc: number;
  onRefreshBalance: () => void;
  onDeductBalance?: (amountUsdc: number) => void;
  geminiApiKey?: string;
  oauthAccessToken?: string;
  onOpenPrivyLogin?: () => void;
}

export const AgentCopilotChat: React.FC<AgentCopilotChatProps> = ({
  walletAddress,
  walletBalanceUsdc,
  onRefreshBalance,
  onDeductBalance,
  geminiApiKey,
  oauthAccessToken,
  onOpenPrivyLogin,
}) => {
  const INITIAL_MESSAGE: AgentChatMessage = {
    id: 'init_1',
    sender: 'agent',
    text: `Hello! I am your **Pharos x402 Intelligence Copilot** on Pharos Mainnet (Chain ID 1672).\n\nConnected MCP Gateways:\n• ⚡ **Pharos Chain MCP**: \`https://mcp.pharos.xyz/mcp\` (Live Streamable HTTP RPC telemetry)\n• 📚 **Pharos Docs MCP**: \`https://docs.pharos.xyz/index.md?ask=...\` (Official developer documentation RAG)\n\nI autonomously query the verified marketplace mesh and execute 0.001 USDC micro-payments on your behalf using your embedded agent wallet.\n\n*Notice: I am strictly an on-chain data researcher & documentation assistant. I do not generate programming scripts or arbitrary execution code.*`,
    timestamp: new Date().toISOString(),
  };

  const [messages, setMessages] = useState<AgentChatMessage[]>([INITIAL_MESSAGE]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Keep input focused so user is never kicked out of the text field
  useEffect(() => {
    inputRef.current?.focus();
  }, [isLoading]);

  const presetPrompts = [
    { label: '🔗 Check MCP Mesh', prompt: 'Check live status and links for https://mcp.pharos.xyz/mcp and Pharos Docs MCP' },
    { label: '📚 Docs MCP: Deploy Guide', prompt: 'How do I compile, test, and deploy a contract using Foundry on Pharos?' },
    { label: '⚡ Chain MCP: Live Status', prompt: 'Query live block and tool status from Pharos Chain MCP server at https://mcp.pharos.xyz/mcp' },
    { label: '🐋 Whale Radar', prompt: 'Analyze recent whale movements and large transfers on Pharos Mainnet.' },
    { label: '🏦 Harbor Solvency', prompt: 'Audit the solvency and reserves depth of Harbor DEX pools.' },
    { label: '🛡️ Contract Risk', prompt: 'Run a honeypot and vulnerability scan on native USDC contract.' },
    { label: '⚠️ Python Script (Refusal Test)', prompt: 'Write me a python script to swap tokens automatically.' },
  ];

  const handleResetChat = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,
        id: `init_${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    ]);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMsg: AgentChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    // Keep focus in the input element immediately
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

    try {
      // Keep ephemeral in-memory context ultra-compact (last 3 messages, max 250 chars each)
      // Filters out initial greeting so no context is wasted, while follow-ups still work
      const historyPayload = messages
        .filter((m) => (m.sender === 'user' || m.sender === 'agent') && m.text && m.id !== 'init_1')
        .slice(-3)
        .map((m) => ({
          sender: m.sender,
          text: m.text.length > 250 ? `${m.text.slice(0, 250)}...` : m.text,
        }));

      const res = await fetch('/api/agent/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          conversationHistory: historyPayload,
          agentWalletAddress: walletAddress,
          agentWalletBalanceUsdc: walletBalanceUsdc,
          geminiApiKey,
          oauthAccessToken,
        }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        // If a buy tool call was performed, deduct from session budget and refresh user balance
        const buyCalls = data.message.toolCalls?.filter((t: { toolName: string }) => t.toolName === 'buy_intelligence_feed');
        if (buyCalls && buyCalls.length > 0) {
          const totalCost = buyCalls.reduce((acc: number, c: any) => {
            const cost = typeof c.arguments?.costUsdc === 'number' ? c.arguments.costUsdc : parseFloat(c.arguments?.costUsdc || '0.001');
            return acc + (isNaN(cost) ? 0.001 : cost);
          }, 0);
          if (onDeductBalance && totalCost > 0) {
            onDeductBalance(totalCost);
          }
        }
        onRefreshBalance();
      } else {
        throw new Error(data.error || 'Failed to receive copilot response');
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'agent',
          text: `⚠️ Network error: ${String(err)}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    }
  };

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-xs flex flex-col h-full flex-1 overflow-hidden">
      {/* Copilot Header */}
      <div className="p-4 border-b border-[#e2e8f0] bg-gradient-to-r from-[#f8faff] to-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl pharos-gradient-bg flex items-center justify-center text-white shadow-xs">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                Pharos Intelligence Copilot
              </h3>
              <span
                className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200/80 px-2.5 py-0.5 rounded-full font-mono font-medium flex items-center gap-1.5 shadow-2xs"
                title="Google Gemini 3.8 Flash low-latency inference engine"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Gemini 3.8 Flash
              </span>
              <span
                className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 shadow-2xs"
                title="Linux Bubblewrap (bwrap) unprivileged container isolation with strict RPC/MCP access policies"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Secure Sandbox</span>
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <a
                href="https://mcp.pharos.xyz/mcp"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-emerald-700 bg-emerald-50/80 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 font-mono"
                title="Hosted Streamable HTTP Chain MCP (https://mcp.pharos.xyz/mcp)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Chain MCP: mcp.pharos.xyz
              </a>
              <a
                href="https://docs.pharos.xyz"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-700 bg-blue-50/80 border border-blue-200 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors inline-flex items-center gap-1 font-mono"
                title="Official Developer Docs MCP"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Docs MCP: docs.pharos.xyz
              </a>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetChat}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-xs flex items-center gap-1"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Reset</span>
          </button>

          {walletAddress ? (
            <div className="text-xs text-gray-600 bg-white border border-[#e2e8f0] px-3 py-1.5 rounded-xl font-mono shadow-2xs">
              Budget: <span className="text-[#0012b8] font-bold">{walletBalanceUsdc.toFixed(3)} USDC</span>
            </div>
          ) : (
            <button
              onClick={onOpenPrivyLogin}
              className="text-xs bg-[#5c41ff] hover:bg-[#4b32e0] text-white px-3 py-1.5 rounded-xl font-semibold transition-all shadow-xs"
            >
              Connect with Privy
            </button>
          )}
        </div>
      </div>

      {/* Preset Action Chips */}
      <div className="px-4 py-2 border-b border-[#f1f5f9] bg-[#fafbfc] flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-gray-400 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#5c41ff]" /> Try:
        </span>
        {presetPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => {
              handleSendMessage(p.prompt);
              inputRef.current?.focus();
            }}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:border-[#5c41ff]/40 hover:bg-purple-50/50 text-gray-700 transition-all shrink-0 font-medium shadow-2xs active:scale-98 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs bg-[#fdfdfe]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isGatekeeper = msg.sender === 'policy_gatekeeper';
          const isRefusal = msg.policyFlags?.isRefusal;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 leading-relaxed shadow-xs ${
                  isUser
                    ? 'pharos-gradient-bg text-white rounded-br-xs'
                    : isGatekeeper
                    ? 'bg-amber-50 border border-amber-300 text-amber-950 rounded-bl-xs'
                    : isRefusal
                    ? 'bg-rose-50/90 border border-rose-200 text-rose-950 rounded-bl-xs'
                    : 'bg-white border border-[#e2e8f0] text-gray-900 rounded-bl-xs'
                }`}
              >
                {/* Refusal / Warning Badge */}
                {isRefusal && (
                  <div className="flex items-center gap-1.5 text-rose-700 font-semibold mb-2.5 pb-2 border-b border-rose-200/70 text-[11px]">
                    <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                    Security Guardrail Activated: Prohibited Action Refused
                  </div>
                )}

                {/* Message Body */}
                <div className="font-sans text-xs leading-relaxed">
                  <MarkdownRenderer content={msg.text} isUser={isUser} />
                </div>

                {/* Tool Executions Badge */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-200/80 space-y-2">
                    {msg.toolCalls.map((tc, idx) => {
                      const isPaid = tc.toolName === 'buy_intelligence_feed';
                      const costText = isPaid
                        ? 'x402 Micropayment · 0.001 USDC'
                        : tc.toolName === 'search_feeds'
                        ? 'Free · Catalog Mesh'
                        : 'Free · Telemetry MCP';

                      return (
                        <div
                          key={idx}
                          className="bg-[#f8faff] p-2.5 rounded-xl border border-blue-100 font-mono text-[11px] text-gray-700 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-[#0012b8] font-bold">
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-500" />
                              Tool: {tc.toolName}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/80'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {costText}
                            </span>
                          </div>
                          {tc.output && (
                            <details className="mt-2 text-[10px] bg-white p-2 rounded-lg border border-gray-200">
                              <summary className="cursor-pointer text-gray-500 font-semibold hover:text-gray-900 flex items-center justify-between">
                                <span>Inspect Technical Telemetry Payload</span>
                                <span className="text-[9px] text-gray-400 font-sans font-normal">(Verified on-chain data)</span>
                              </summary>
                              <pre className="mt-1.5 overflow-x-auto text-gray-800 font-mono text-[10px] max-h-36 whitespace-pre-wrap">
                                {JSON.stringify(tc.output, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Attached Intelligence Preview */}
                {msg.attachedIntelligence && (
                  <details className="mt-3 bg-[#0d1117] text-gray-200 rounded-xl p-3 text-[10px] font-mono border border-gray-800">
                    <summary className="cursor-pointer text-emerald-400 font-bold hover:underline">
                      Inspect Unlocked Data Packet (JSON)
                    </summary>
                    <pre className="mt-2 overflow-x-auto text-emerald-300">
                      {JSON.stringify(msg.attachedIntelligence, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              <span className="text-[10px] text-gray-400 px-1 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2.5 text-xs text-gray-500 bg-[#f8faff] p-3 rounded-xl border border-blue-100 max-w-sm animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5c41ff] animate-ping" />
            <span className="font-medium text-gray-700">
              Copilot querying live mesh telemetry & Gemini 3.8 Flash...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3.5 border-t border-[#e2e8f0] bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isLoading && inputPrompt.trim()) {
              handleSendMessage();
            }
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={
                isLoading
                  ? 'Copilot is synthesizing telemetry... (you can prepare next prompt)'
                  : 'Ask Copilot to analyze feeds, query live whale telemetry, or check Docs MCP...'
              }
              className="w-full px-3.5 py-2.5 text-xs bg-[#f8faff] border border-[#e2e8f0] rounded-xl focus:outline-none focus:border-[#0012b8] focus:bg-white focus:ring-1 focus:ring-[#0012b8]/30 transition-all shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="pharos-gradient-bg hover:opacity-95 disabled:bg-gray-200 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0 active:scale-98"
          >
            {isLoading ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
