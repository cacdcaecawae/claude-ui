import { readFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { watch } from 'chokidar';
import type { StorageAdapter, Session, Message, StorageEvent, StorageDetectionResult } from './types';

/**
 * NativeAdapter reads Claude Code's actual JSONL session storage.
 *
 * Storage layout:
 *   ~/.claude/projects/{projectKey}/
 *     sessions-index.json   (optional index with metadata)
 *     {sessionId}.jsonl      (one per session, each line is a JSON record)
 *
 * JSONL record types:
 *   - type: "user"       → user message,  message.content is a string
 *   - type: "assistant"  → assistant msg, message.content is an array of content blocks
 *       Content blocks: {type:"text", text:...}, {type:"thinking",...}, {type:"tool_use",...}
 *       A single response spans MULTIPLE lines with the same message.id;
 *       the LAST line for a given message.id has the most complete content.
 *   - type: "file-history-snapshot" → skip
 *   - type: "system"     → system/command, skip or show as info
 *
 * Messages form a linked list via parentUuid. Root has parentUuid: null.
 */
export class NativeAdapter implements StorageAdapter {
  readonly mode = 'native' as const;
  private projectPath: string;
  private details: Record<string, unknown>;

  constructor(detection: StorageDetectionResult) {
    this.projectPath = detection.path;
    this.details = detection.details;
  }

  async verify(): Promise<void> {
    // Project dir may not exist yet (no sessions for this workspace)
    // That's fine — we'll create it when needed or just return empty lists
    if (existsSync(this.projectPath)) {
      try {
        readdirSync(this.projectPath);
      } catch (err) {
        throw new Error(`Cannot read storage directory: ${err}`);
      }
    }
  }

  async listSessions(): Promise<Session[]> {
    if (!existsSync(this.projectPath)) {
      return [];
    }

    // Strategy 1: Try sessions-index.json for fast metadata
    const indexPath = join(this.projectPath, 'sessions-index.json');
    if (existsSync(indexPath)) {
      try {
        const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
        if (indexData.version === 1 && Array.isArray(indexData.entries)) {
          const sessions: Session[] = indexData.entries
            .filter((e: Record<string, unknown>) => !e.isSidechain)
            .map((entry: Record<string, unknown>) => ({
              id: entry.sessionId as string,
              title: (entry.firstPrompt as string) || 'Untitled',
              createdAt: (entry.created as string) || new Date().toISOString(),
              updatedAt: (entry.modified as string) || new Date().toISOString(),
              messageCount: entry.messageCount as number,
              workspace: entry.projectPath as string,
            }));
          return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        }
      } catch {
        // Fall through to Strategy 2
      }
    }

    // Strategy 2: Scan JSONL files directly
    const sessions: Session[] = [];
    try {
      const entries = readdirSync(this.projectPath);
      for (const entry of entries) {
        if (!entry.endsWith('.jsonl')) continue;

        const filePath = join(this.projectPath, entry);
        try {
          const stat = statSync(filePath);
          if (!stat.isFile()) continue;

          const sessionId = basename(entry, '.jsonl');
          const firstPrompt = this.extractFirstPrompt(filePath);

          sessions.push({
            id: sessionId,
            title: firstPrompt || 'Untitled',
            createdAt: stat.birthtime.toISOString(),
            updatedAt: stat.mtime.toISOString(),
            workspace: this.details.workspace as string,
          });
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Directory unreadable
    }

    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getSession(id: string): Promise<Session | null> {
    const sessions = await this.listSessions();
    return sessions.find((s) => s.id === id) || null;
  }

  async createSession(title?: string): Promise<Session> {
    // We don't write to Claude's storage directly.
    // Instead, we'll let the CLI create the session when the first message is sent.
    // Generate a UUID and return a placeholder — the actual JSONL file will be
    // created by `claude --session-id <id> --print ...`
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const now = new Date().toISOString();

    // Ensure project directory exists
    if (!existsSync(this.projectPath)) {
      mkdirSync(this.projectPath, { recursive: true, mode: 0o700 });
    }

    return {
      id,
      title: title || 'New Conversation',
      createdAt: now,
      updatedAt: now,
      workspace: this.details.workspace as string,
    };
  }

  async deleteSession(id: string): Promise<void> {
    const filePath = join(this.projectPath, `${this.sanitizeId(id)}.jsonl`);
    if (existsSync(filePath)) {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(filePath);
    }
  }

  async renameSession(_id: string, _title: string): Promise<void> {
    // Claude's sessions-index.json uses firstPrompt as title.
    // We can't reliably rename — this is a limitation of native mode.
    // For MVP, this is a no-op. Could maintain a separate title-override map later.
    console.warn('[NativeAdapter] renameSession is not supported in native mode');
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const filePath = join(this.projectPath, `${this.sanitizeId(sessionId)}.jsonl`);
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

    // Parse all records
    const records: Record<string, unknown>[] = [];
    for (const line of lines) {
      try {
        records.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }

    // Group assistant messages by message.id — keep only the LAST occurrence
    // because Claude streams multiple JSONL lines for one response
    const assistantByMsgId = new Map<string, Record<string, unknown>>();
    const orderedRecords: Record<string, unknown>[] = [];

    for (const record of records) {
      const type = record.type as string;

      if (type === 'user') {
        orderedRecords.push(record);
      } else if (type === 'assistant') {
        const msg = record.message as Record<string, unknown> | undefined;
        const msgId = msg?.id as string;
        if (msgId) {
          assistantByMsgId.set(msgId, record);
        } else {
          // No message.id — treat as standalone
          orderedRecords.push(record);
        }
      }
      // Skip file-history-snapshot, system, and other types
    }

    // Insert deduplicated assistant messages in order of their last appearance
    // We need to maintain conversation order, so rebuild from parentUuid chain
    const allRecords = [...orderedRecords, ...assistantByMsgId.values()];

    // Build a map from uuid → record
    const byUuid = new Map<string, Record<string, unknown>>();
    for (const r of allRecords) {
      const uuid = r.uuid as string;
      if (uuid) {
        // For assistant records, later entries (same uuid or same message.id) overwrite
        byUuid.set(uuid, r);
      }
    }

    // Also index by message.id for assistant dedup
    const assistantFinalByMsgId = new Map<string, Record<string, unknown>>();
    for (const r of allRecords) {
      if ((r.type as string) === 'assistant') {
        const msg = r.message as Record<string, unknown> | undefined;
        const msgId = msg?.id as string;
        if (msgId) {
          assistantFinalByMsgId.set(msgId, r);
        }
      }
    }

    // Simple approach: iterate records in file order, skip duplicate assistant msgs
    const messages: Message[] = [];
    const seenAssistantMsgIds = new Set<string>();

    for (const record of records) {
      const type = record.type as string;

      if (type === 'user') {
        const msg = record.message as Record<string, unknown> | undefined;
        const content = msg?.content;
        const text = typeof content === 'string' ? content : '';
        if (!text) continue;

        messages.push({
          id: (record.uuid as string) || '',
          role: 'user',
          content: text,
          timestamp: (record.timestamp as string) || '',
        });
      } else if (type === 'assistant') {
        const msg = record.message as Record<string, unknown> | undefined;
        const msgId = msg?.id as string;

        // Only process the LAST line for each message.id
        if (msgId) {
          if (seenAssistantMsgIds.has(msgId)) continue;
          // Check if this is the last occurrence
          const finalRecord = assistantByMsgId.get(msgId);
          if (finalRecord && finalRecord !== record) continue;
          seenAssistantMsgIds.add(msgId);
        }

        const contentBlocks = msg?.content;
        const text = this.extractTextFromContent(contentBlocks);
        if (!text) continue;

        messages.push({
          id: (record.uuid as string) || msgId || '',
          role: 'assistant',
          content: text,
          timestamp: (record.timestamp as string) || '',
        });
      }
    }

    return messages;
  }

  async appendMessage(_sessionId: string, _message: Omit<Message, 'id'>): Promise<Message> {
    // In native mode, messages are appended by the Claude CLI process itself.
    // We don't write JSONL directly to avoid format/corruption issues.
    throw new Error('Native adapter: messages are written by claude CLI, not directly.');
  }

  watchChanges(callback: (event: StorageEvent) => void): () => void {
    // Ensure directory exists before watching
    if (!existsSync(this.projectPath)) {
      mkdirSync(this.projectPath, { recursive: true, mode: 0o700 });
    }

    const watcher = watch(this.projectPath, {
      ignoreInitial: true,
      depth: 0,
      persistent: true,
    });

    watcher.on('add', (filePath) => {
      if (filePath.endsWith('.jsonl')) {
        callback({ type: 'session_added', sessionId: basename(filePath, '.jsonl') });
      } else if (filePath.endsWith('sessions-index.json')) {
        callback({ type: 'session_updated' });
      }
    });

    watcher.on('change', (filePath) => {
      if (filePath.endsWith('.jsonl')) {
        callback({ type: 'message_added', sessionId: basename(filePath, '.jsonl') });
      } else if (filePath.endsWith('sessions-index.json')) {
        callback({ type: 'session_updated' });
      }
    });

    watcher.on('unlink', (filePath) => {
      if (filePath.endsWith('.jsonl')) {
        callback({ type: 'session_deleted', sessionId: basename(filePath, '.jsonl') });
      }
    });

    return () => {
      watcher.close();
    };
  }

  // ---- Private helpers ----

  private sanitizeId(id: string): string {
    if (!id || /[/\\]/.test(id)) {
      throw new Error('Invalid session id');
    }
    return id;
  }

  /**
   * Read the first user prompt from a JSONL file (for session title).
   */
  private extractFirstPrompt(filePath: string): string | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line);
          if (record.type === 'user') {
            const msg = record.message;
            if (typeof msg?.content === 'string') {
              // Truncate long prompts
              return msg.content.length > 100
                ? msg.content.slice(0, 100) + '...'
                : msg.content;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Unreadable
    }
    return null;
  }

  /**
   * Extract human-readable text from Claude's assistant message content blocks.
   * Content is an array of: {type:"text", text:...}, {type:"thinking",...}, {type:"tool_use",...}
   */
  private extractTextFromContent(contentBlocks: unknown): string {
    if (typeof contentBlocks === 'string') return contentBlocks;
    if (!Array.isArray(contentBlocks)) return '';

    const parts: string[] = [];
    for (const block of contentBlocks) {
      if (typeof block !== 'object' || block === null) continue;
      const b = block as Record<string, unknown>;

      if (b.type === 'text' && typeof b.text === 'string') {
        parts.push(b.text);
      } else if (b.type === 'tool_use') {
        // Show tool usage as formatted info
        const toolName = b.name as string || 'unknown';
        const input = b.input ? JSON.stringify(b.input, null, 2) : '';
        parts.push(`\n\`\`\`tool: ${toolName}\n${input}\n\`\`\`\n`);
      }
      // Skip "thinking" blocks — internal reasoning
    }

    return parts.join('');
  }
}
