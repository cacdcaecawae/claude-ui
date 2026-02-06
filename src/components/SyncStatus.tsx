'use client';

import { useState, useEffect } from 'react';
import type { SyncMode } from '@/types';

export default function SyncStatus() {
  const [mode, setMode] = useState<SyncMode | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/sync-status');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMode(data.mode);
        }
      } catch {
        // Ignore errors
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!mode) return null;

  const isNative = mode === 'native';

  return (
    <div
      className="relative inline-flex items-center gap-1.5 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={`Sync mode: ${isNative ? 'Native' : 'Fallback'}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isNative ? 'bg-green-500' : 'bg-yellow-500'
        }`}
      />
      <span className="text-xs text-zinc-400">
        {isNative ? 'Native' : 'Fallback'}
      </span>
      {showTooltip && (
        <div className="absolute top-full left-0 mt-1 z-50 px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg whitespace-nowrap">
          {isNative
            ? 'Syncing directly with Claude Code sessions'
            : 'Using file-based fallback storage'}
        </div>
      )}
    </div>
  );
}
