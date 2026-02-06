import type { Session, Message, SyncMode, StorageEvent, StorageAdapter } from '@/types';

export type { Session, Message, SyncMode, StorageEvent, StorageAdapter };

export interface StorageDetectionResult {
  found: boolean;
  path: string;              // project directory path (or projects dir if no workspace)
  format: 'jsonl' | 'unknown';
  details: {
    projectKey?: string;
    workspace?: string;
    sessionCount?: number;
    hasIndex?: boolean;
    claudeDir?: string;
    projectsDir?: string;
    projectCount?: number;
    note?: string;
    reason?: string;
  };
}

export interface SessionIndexEntry {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  firstPrompt: string;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch: string;
  projectPath: string;
  isSidechain: boolean;
}

export interface SessionIndex {
  version: number;
  entries: SessionIndexEntry[];
}

// Raw JSONL line types from Claude storage
export interface JsonlUserLine {
  type: 'user';
  message: { content: string };
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
}

export interface JsonlAssistantLine {
  type: 'assistant';
  message: {
    id: string;
    content: Array<
      | { type: 'thinking'; thinking: string }
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: unknown }
      | { type: 'tool_result'; tool_use_id: string; content: string }
    >;
  };
  uuid: string;
  parentUuid: string | null;
}

export interface JsonlSystemLine {
  type: 'system';
  uuid: string;
  parentUuid: string | null;
}

export type JsonlLine = JsonlUserLine | JsonlAssistantLine | JsonlSystemLine | { type: string; [key: string]: unknown };
