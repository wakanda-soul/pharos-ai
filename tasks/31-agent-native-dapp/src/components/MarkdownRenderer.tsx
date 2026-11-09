'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2.5 rounded-xl overflow-hidden border border-gray-700/80 bg-[#0b132b] shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#121b36] border-b border-gray-700/60 text-[11px] font-mono text-gray-300">
        <span className="text-gray-400 font-semibold">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-300 hover:text-white hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-gray-300" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed whitespace-pre">
        <code>{value}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  isUser = false,
}) => {
  if (isUser) {
    return <div className={`whitespace-pre-wrap ${className}`}>{content}</div>;
  }

  return (
    <div className={`prose-sm max-w-none text-xs leading-relaxed space-y-2.5 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-gray-900 mt-3.5 mb-2 border-b border-gray-200 pb-1.5 tracking-tight flex items-center gap-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-gray-900 mt-3 mb-1.5 tracking-tight flex items-center gap-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold text-gray-800 mt-2.5 mb-1 tracking-tight">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-gray-800">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2.5 text-gray-800">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2.5 text-gray-800">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#0012b8] pl-3 py-1 my-2 bg-blue-50/50 rounded-r-lg text-gray-700 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-gray-200 my-3" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0012b8] hover:text-[#000fa0] underline font-medium inline-flex items-center gap-0.5"
            >
              <span>{children}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </a>
          ),
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const rawContent = String(children).replace(/\n$/, '');
            const isInline = !className && !rawContent.includes('\n');

            if (!isInline && match) {
              return <CodeBlock language={match[1]} value={rawContent} />;
            }

            if (!isInline && rawContent.includes('\n')) {
              return <CodeBlock language="text" value={rawContent} />;
            }

            return (
              <code
                className="bg-[#f1f5f9] text-[#0012b8] px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border border-[#e2e8f0]"
                {...props}
              >
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-2.5 rounded-xl border border-gray-200 shadow-2xs">
              <table className="min-w-full divide-y divide-gray-200 text-[11px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#f8faff]">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase tracking-wider text-[10px]">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-3 py-2 text-gray-800 font-mono text-[11px]">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
