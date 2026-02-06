'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export default function MessageInput({
  onSend,
  onStop,
  isGenerating,
  disabled = false,
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 6 * 24; // ~6 rows
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled || isGenerating) return;
    onSend(value);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, isGenerating, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="max-w-3xl mx-auto flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          disabled={disabled || isGenerating}
          rows={1}
          className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 text-[15px] placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Message input"
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
            aria-label="Stop generating"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="14" height="14" rx="2" fill="white" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 13L13 8L3 3V7L9 8L3 9V13Z"
                fill="white"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
