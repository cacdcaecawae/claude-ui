export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
  workspace?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export type SyncMode = 'native' | 'fallback';

export interface StorageAdapter {
  mode: SyncMode;
  listSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | null>;
  createSession(title?: string): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  renameSession(id: string, title: string): Promise<void>;
  getMessages(sessionId: string): Promise<Message[]>;
  appendMessage(sessionId: string, message: Omit<Message, 'id'>): Promise<Message>;
  watchChanges(callback: (event: StorageEvent) => void): () => void;
}

export interface StorageEvent {
  type: 'session_added' | 'session_updated' | 'session_deleted' | 'message_added';
  sessionId?: string;
}

export interface StreamEvent {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  message?: string;
}

export interface SyncStatus {
  mode: SyncMode;
}
