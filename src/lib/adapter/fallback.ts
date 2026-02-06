import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { watch } from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import type { StorageAdapter, Session, Message, StorageEvent } from './types';

const DATA_DIR = join(process.cwd(), 'data', 'sessions');

interface SessionFile {
  session: Session;
  messages: Message[];
}

export class FallbackAdapter implements StorageAdapter {
  readonly mode = 'fallback' as const;
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || DATA_DIR;
    mkdirSync(this.dataDir, { recursive: true });
  }

  private sessionPath(id: string): string {
    // Validate id to prevent path traversal
    if (!id || /[/\\]/.test(id)) {
      throw new Error('Invalid session id');
    }
    return join(this.dataDir, `${id}.json`);
  }

  private readSessionFile(id: string): SessionFile | null {
    const path = this.sessionPath(id);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return null;
    }
  }

  private writeSessionFile(id: string, data: SessionFile): void {
    writeFileSync(this.sessionPath(id), JSON.stringify(data, null, 2), 'utf-8');
  }

  async listSessions(): Promise<Session[]> {
    mkdirSync(this.dataDir, { recursive: true });
    const files = readdirSync(this.dataDir).filter((f) => f.endsWith('.json'));
    const sessions: Session[] = [];

    for (const file of files) {
      try {
        const data: SessionFile = JSON.parse(readFileSync(join(this.dataDir, file), 'utf-8'));
        sessions.push(data.session);
      } catch {
        // Skip corrupt files
      }
    }

    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getSession(id: string): Promise<Session | null> {
    const data = this.readSessionFile(id);
    return data?.session || null;
  }

  async createSession(title?: string): Promise<Session> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const session: Session = {
      id,
      title: title || 'New Conversation',
      createdAt: now,
      updatedAt: now,
      workspace: process.env.CLAUDE_WEB_WORKSPACE,
    };

    this.writeSessionFile(id, { session, messages: [] });
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    const path = this.sessionPath(id);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  async renameSession(id: string, title: string): Promise<void> {
    const data = this.readSessionFile(id);
    if (!data) throw new Error(`Session not found: ${id}`);
    data.session.title = title;
    data.session.updatedAt = new Date().toISOString();
    this.writeSessionFile(id, data);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const data = this.readSessionFile(sessionId);
    return data?.messages || [];
  }

  async appendMessage(sessionId: string, message: Omit<Message, 'id'>): Promise<Message> {
    const data = this.readSessionFile(sessionId);
    if (!data) throw new Error(`Session not found: ${sessionId}`);

    const fullMessage: Message = {
      id: uuidv4(),
      ...message,
    };

    data.messages.push(fullMessage);
    data.session.updatedAt = new Date().toISOString();
    this.writeSessionFile(sessionId, data);
    return fullMessage;
  }

  watchChanges(callback: (event: StorageEvent) => void): () => void {
    mkdirSync(this.dataDir, { recursive: true });

    const watcher = watch(this.dataDir, {
      ignoreInitial: true,
      depth: 0,
      persistent: true,
    });

    watcher.on('add', (path) => {
      const id = path.split('/').pop()?.replace('.json', '');
      callback({ type: 'session_added', sessionId: id });
    });

    watcher.on('change', (path) => {
      const id = path.split('/').pop()?.replace('.json', '');
      callback({ type: 'session_updated', sessionId: id });
    });

    watcher.on('unlink', (path) => {
      const id = path.split('/').pop()?.replace('.json', '');
      callback({ type: 'session_deleted', sessionId: id });
    });

    return () => {
      watcher.close();
    };
  }
}
