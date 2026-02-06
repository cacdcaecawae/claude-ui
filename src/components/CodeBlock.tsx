'use client';

import { useState, useCallback } from 'react';

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
  inline?: boolean;
}

export default function CodeBlock({ className, children, inline }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') || '';

  const handleCopy = useCallback(async () => {
    const text = String(children).replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [children]);

  if (inline) {
    return (
      <code className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-700"
          aria-label="Copy code"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 m-0 text-sm leading-relaxed">
          <code className={className}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}
