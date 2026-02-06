'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export function useSSE(
  url: string | null,
  onMessage: (data: unknown) => void
): { connected: boolean; error: Error | null } {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const onMessageRef = useRef(onMessage);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url) {
      setConnected(false);
      setError(null);
      return;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current(data);
      } catch {
        onMessageRef.current(event.data);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      if (eventSource.readyState === EventSource.CLOSED) {
        setError(new Error('SSE connection closed'));
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [url]);

  return { connected, error };
}
