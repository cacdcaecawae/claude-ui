'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message } from '@/types';

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch messages when session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function fetchMessages() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages`);
        if (!res.ok) throw new Error('Failed to fetch messages');
        const data = await res.json();
        if (!cancelled) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
        }
      }
    }

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const stopGeneration = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (sessionId) {
      try {
        await fetch(`/api/sessions/${sessionId}/stop`, { method: 'POST' });
      } catch {
        // Ignore stop errors
      }
    }
    setIsGenerating(false);
  }, [sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim()) return;

      setError(null);

      // Add user message immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);

      // Create placeholder for assistant response
      const assistantId = `temp-assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const encodedMessage = encodeURIComponent(content.trim());
        const eventSource = new EventSource(
          `/api/sessions/${sessionId}/stream?message=${encodedMessage}`
        );
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'chunk') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content + (data.content || '') }
                    : msg
                )
              );
            } else if (data.type === 'done') {
              eventSource.close();
              eventSourceRef.current = null;
              setIsGenerating(false);
            } else if (data.type === 'error') {
              setError(new Error(data.message || 'Stream error'));
              eventSource.close();
              eventSourceRef.current = null;
              setIsGenerating(false);
            }
          } catch {
            // Try raw text append
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + event.data }
                  : msg
              )
            );
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          eventSourceRef.current = null;
          setIsGenerating(false);
        };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to send message'));
        setIsGenerating(false);
      }
    },
    [sessionId]
  );

  return { messages, isGenerating, sendMessage, stopGeneration, error };
}
