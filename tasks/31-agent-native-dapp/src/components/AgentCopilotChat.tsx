'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AgentChatMessage } from '@/types/agent';
import { Cpu, Send, ShieldAlert, CheckCircle, Zap, Terminal, CornerDownLeft, Sparkles, AlertOctagon } from 'lucide-react';

interface AgentCopilotChatProps {
  walletAddress: string | null;
  walletBalanceUsdc: number;
  onRefreshBalance: () => void;
  geminiApiKey?: string;
  oauthAccessToken?: string;
  onOpenPrivyLogin?: () => void;
}

export const AgentCopilotChat: React.FC<AgentCopilotChatProps> = ({
  walletAddress,
  walletBalanceUsdc,
  onRefreshBalance,
  geminiApiKey,
  oauthAccessToken,
  onOpenPrivyLogin,
}) => {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'init_1',
      sender: 'agent',
      text: `Hello! I am your **Pharos x402 Intelligence Copilot** on Pharos Mainnet (Chain ID 1672).\n\nI autonomously query the verified marketplace mesh and execute 0.001 USDC micro-payments on your behalf using your embedded agent wallet.\n\n*Notice: I am strictly an on-chain data researcher. I do not generate programming scripts or arbitrary execution code.*`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const presetPrompts = [
    { label: '🐋 Whale Radar', prompt: 'Analyze recent whale movements and large transfers on Pharos Mainnet.' },
    { label: '🏦 Harbor Solvency', prompt: 'Audit the solvency and reserves depth of Harbor DEX pools.' },
    { label: '🛡️ Contract Risk', prompt: 'Run a honeypot and vulnerability scan on native USDC contract.' },
    { label: '⚠️ Python Script (Refusal Test)', prompt: 'Write me a python script to swap tokens automatically.' },
  ];

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

    try {
      const res = await fetch('/api/agent/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          agentWalletAddress: walletAddress,
          agentWalletBalanceUsdc: walletBalanceUsdc,
          geminiApiKey,
          oauthAccessToken,
        }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        // If a buy tool call was performed, refresh user balance
        if (data.message.toolCalls?.some((t: { toolName: string }) => t.toolName === 'buy_intelligence_feed')) {
          onRefreshBalance();
        }
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
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm flex flex-col h-[650px] overflow-hidden">
      {/* Copilot Header */}
      <div className="p-4 border-b border-[#e5e7eb] bg-[#f9fafb] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#5c41ff] flex items-center justify-center text-white shadow-sm">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                Sandboxed AI Copilot
              </h3>
              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-mono">
                Gemini 3-Layer Shield
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Autonomous x402 broker · Tool-gated · Non-custodial execution
            </p>
          </div>
        </div>

        {walletAddress ? (
          <div className="text-xs text-gray-600 bg-white border border-[#e5e7eb] px-2.5 py-1 rounded-md font-mono">
            Budget: <span className="text-[#0012b8] font-bold">{walletBalanceUsdc.toFixed(3)} USDC</span>
          </div>
        ) : (
          <button
            onClick={onOpenPrivyLogin}
            className="text-xs bg-[#5c41ff] hover:bg-[#4b32e0] text-white px-2.5 py-1 rounded-md font-medium transition-colors shadow-sm"
          >
            Connect with Privy
          </button>
        )}
      </div>

      {/* Preset Action Chips */}
      <div className="px-4 py-2 border-b border-[#f2f4f5] bg-white flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-gray-400 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#5c41ff]" /> Try:
        </span>
        {presetPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p.prompt)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-md bg-[#f2f4f5] hover:bg-[#e5e7eb] text-gray-700 transition-colors shrink-0 font-medium"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isGatekeeper = msg.sender === 'policy_gatekeeper';
          const isRefusal = msg.policyFlags?.isRefusal;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3.5 leading-relaxed ${
                  isUser
                    ? 'bg-[#0012b8] text-white rounded-br-sm'
                    : isGatekeeper
                    ? 'bg-amber-50 border border-amber-300 text-amber-900 rounded-bl-sm'
                    : isRefusal
                    ? 'bg-rose-50 border border-rose-200 text-rose-950 rounded-bl-sm'
                    : 'bg-[#f2f4f5] text-gray-800 rounded-bl-sm'
                }`}
              >
                {/* Refusal / Warning Badge */}
                {isRefusal && (
                  <div className="flex items-center gap-1.5 text-rose-700 font-semibold mb-2 pb-1.5 border-b border-rose-200 text-[11px]">
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                    Security Guardrail Activated: Prohibited Action Refused
                  </div>
                )}

                {/* Message Body */}
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Tool Executions Badge */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-300/50 space-y-2">
                    {msg.toolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        className="bg-white/80 p-2 rounded border border-gray-200 font-mono text-[11px] text-gray-700"
                      >
                        <div className="flex items-center justify-between text-[#0012b8] font-bold">
                          <span>⚡ Tool: {tc.toolName}</span>
                          {tc.costUsdc && (
                            <span className="bg-emerald-100 text-emerald-800 px-1 rounded">
                              -{tc.costUsdc} USDC
                            </span>
                          )}
                        </div>
                        {tc.paymentReceipt && (
                          <div className="text-[10px] text-gray-500 mt-1">
                            Receipt: {tc.paymentReceipt} (Settled on Pharos)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Attached Intelligence Preview */}
                {msg.attachedIntelligence && (
                  <details className="mt-2.5 bg-[#0d1117] text-gray-200 rounded p-2 text-[10px] font-mono">
                    <summary className="cursor-pointer text-emerald-400 font-bold hover:underline">
                      Inspect Unlocked Data Packet (JSON)
                    </summary>
                    <pre className="mt-2 overflow-x-auto text-emerald-300">
                      {JSON.stringify(msg.attachedIntelligence, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500 italic">
            <span className="w-2 h-2 rounded-full bg-[#5c41ff] animate-ping" />
            Copilot checking deterministic policy & broker tools...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-[#e5e7eb] bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask Copilot to analyze feeds or query on-chain intelligence..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-xs bg-[#f9fafb] border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#0012b8] focus:bg-white transition-colors"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="bg-[#0012b8] hover:bg-[#000fa0] disabled:bg-gray-200 text-white px-3.5 py-2 rounded-md text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
