'use client';

import { useState, useCallback } from 'react';
import { useSessions } from '@/hooks/useSessions';
import { useChat } from '@/hooks/useChat';
import SessionList from '@/components/SessionList';
import ChatView from '@/components/ChatView';
import MessageInput from '@/components/MessageInput';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const {
    sessions,
    activeSessionId,
    selectSession,
    createSession,
    deleteSession,
    renameSession,
    loading,
    error: sessionsError,
  } = useSessions();

  const {
    messages,
    isGenerating,
    sendMessage,
    stopGeneration,
    error: chatError,
  } = useChat(activeSessionId);

  const handleSend = useCallback(async (content: string) => {
    if (!activeSessionId) {
      const newId = await createSession();
      if (newId) {
        setTimeout(() => sendMessage(content), 100);
      }
      return;
    }
    sendMessage(content);
  }, [activeSessionId, createSession, sendMessage]);

  const handleSelectSession = useCallback((id: string) => {
    selectSession(id);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [selectSession]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          {sidebarOpen ? (
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative z-40 h-full
          w-80 flex-shrink-0 border-r border-zinc-800
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-translate-x-full'}
        `}
      >
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={createSession}
          onDeleteSession={deleteSession}
          onRenameSession={renameSession}
          loading={loading}
        />
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Error banner */}
        {(sessionsError || chatError) && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-800/50 text-red-300 text-sm flex-shrink-0">
            {sessionsError?.message || chatError?.message}
          </div>
        )}

        {/* Chat view or empty state */}
        {activeSessionId ? (
          <>
            {/* Chat header */}
            <div className="flex-shrink-0 border-b border-zinc-800 px-4 py-3 flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-3 p-1 rounded hover:bg-zinc-800 text-zinc-400 lg:hidden"
                aria-label="Toggle sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <h2 className="text-sm font-medium text-zinc-300 truncate">
                {sessions.find((s) => s.id === activeSessionId)?.title || 'Chat'}
              </h2>
            </div>

            <ChatView messages={messages} isGenerating={isGenerating} />
            <MessageInput
              onSend={handleSend}
              onStop={stopGeneration}
              isGenerating={isGenerating}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-400/60">C</span>
                </div>
                <h2 className="text-xl font-medium text-zinc-300 mb-2">Claude Web</h2>
                <p className="text-zinc-500 text-sm mb-6">Select a conversation or start a new chat</p>
                <button
                  onClick={createSession}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  New Chat
                </button>
              </div>
            </div>
            <MessageInput
              onSend={handleSend}
              onStop={stopGeneration}
              isGenerating={false}
            />
          </div>
        )}
      </main>
    </div>
  );
}
