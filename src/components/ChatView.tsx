'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/types';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatViewProps {
  messages: Message[];
  isGenerating: boolean;
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ChatView({ messages, isGenerating }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Track if user has scrolled up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-zinc-500 text-lg mb-2">Select or create a conversation</div>
          <div className="text-zinc-600 text-sm">
            Start a new chat to begin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto custom-scrollbar"
    >
      <div className="max-w-3xl mx-auto py-6 px-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`message-appear mb-4 flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
            style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-100'
              }`}
            >
              {message.role === 'user' ? (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              ) : (
                <div className="text-[15px]">
                  {message.content ? (
                    <MarkdownRenderer content={message.content} />
                  ) : isGenerating && index === messages.length - 1 ? null : (
                    <span className="text-zinc-500 italic">Empty response</span>
                  )}
                  {isGenerating &&
                    index === messages.length - 1 &&
                    message.role === 'assistant' && (
                      <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-0.5 align-middle" />
                    )}
                </div>
              )}
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-zinc-500'
                }`}
              >
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}
