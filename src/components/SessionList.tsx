'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import type { Session } from '@/types';
import SyncStatus from './SyncStatus';

interface SessionListProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  loading?: boolean;
}

function relativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

export default function SessionList({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  loading = false,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startRename = useCallback((session: Session) => {
    setEditingId(session.id);
    setEditValue(session.title);
  }, []);

  const finishRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRenameSession(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, onRenameSession]);

  const handleRenameKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        finishRename();
      } else if (e.key === 'Escape') {
        setEditingId(null);
        setEditValue('');
      }
    },
    [finishRename]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (confirmDeleteId === id) {
        onDeleteSession(id);
        setConfirmDeleteId(null);
      } else {
        setConfirmDeleteId(id);
        setTimeout(() => setConfirmDeleteId(null), 3000);
      }
    },
    [confirmDeleteId, onDeleteSession]
  );

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-zinc-100">Claude Web</h1>
          <SyncStatus />
        </div>
        <button
          onClick={onNewSession}
          className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          aria-label="New chat"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-4 text-center text-zinc-500 text-sm">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-sm">
            No conversations yet
          </div>
        ) : (
          <div className="py-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (editingId !== session.id) {
                    onSelectSession(session.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editingId !== session.id) {
                    onSelectSession(session.id);
                  }
                }}
                className={`group relative mx-2 mb-0.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  activeSessionId === session.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
                aria-label={`Session: ${session.title}`}
                aria-current={activeSessionId === session.id ? 'true' : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    {editingId === session.id ? (
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={finishRename}
                        onKeyDown={handleRenameKeyDown}
                        className="w-full bg-zinc-700 text-zinc-100 text-sm rounded px-2 py-1 border border-zinc-600 focus:outline-none focus:border-blue-500"
                        aria-label="Rename session"
                      />
                    ) : (
                      <>
                        <div className="text-sm truncate font-medium">
                          {session.title || 'Untitled'}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {relativeTime(session.updatedAt || session.createdAt)}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action buttons - visible on hover */}
                  {editingId !== session.id && (
                    <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(session);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                        aria-label="Rename"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          confirmDeleteId === session.id
                            ? 'text-red-400 hover:text-red-300 bg-red-900/30'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700'
                        }`}
                        aria-label={confirmDeleteId === session.id ? 'Confirm delete' : 'Delete'}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 3H10M4 3V2H8V3M5 5V9M7 5V9M3 3V10C3 10.5 3.5 11 4 11H8C8.5 11 9 10.5 9 10V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
