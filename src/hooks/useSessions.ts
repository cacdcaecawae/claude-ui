'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Session } from '@/types';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch sessions on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchSessions() {
      try {
        setLoading(true);
        const res = await fetch('/api/sessions');
        if (!res.ok) throw new Error('Failed to fetch sessions');
        const data = await res.json();
        if (!cancelled) {
          const sessionList = data.sessions || [];
          setSessions(sessionList);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch sessions'));
          setLoading(false);
        }
      }
    }

    fetchSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/watch');
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'session_added' && data.session) {
          setSessions((prev) => {
            const exists = prev.some((s) => s.id === data.session.id);
            if (exists) return prev;
            return [data.session, ...prev];
          });
        } else if (data.type === 'session_updated' && data.session) {
          setSessions((prev) =>
            prev.map((s) => (s.id === data.session.id ? { ...s, ...data.session } : s))
          );
        } else if (data.type === 'session_deleted' && data.sessionId) {
          setSessions((prev) => prev.filter((s) => s.id !== data.sessionId));
          setActiveSessionId((prev) => (prev === data.sessionId ? null : prev));
        } else if (data.type === 'sessions_changed') {
          // Re-fetch all sessions
          fetch('/api/sessions')
            .then((res) => res.json())
            .then((d) => setSessions(d.sessions || []))
            .catch(() => {});
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // Will auto-reconnect
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  const selectSession = useCallback((id: string | null) => {
    setActiveSessionId(id);
  }, []);

  const createSession = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      const newSession = data.session;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      return newSession.id;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create session'));
      return null;
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete session');
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeSessionId === id) {
          setActiveSessionId(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to delete session'));
      }
    },
    [activeSessionId]
  );

  const renameSession = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to rename session');
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to rename session'));
    }
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSession,
    activeSessionId,
    selectSession,
    createSession,
    deleteSession,
    renameSession,
    loading,
    error,
  };
}
