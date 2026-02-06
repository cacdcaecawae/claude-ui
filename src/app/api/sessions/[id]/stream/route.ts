import { NextRequest } from 'next/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createAdapter } from '@/lib/adapter';
import { processManager } from '@/lib/claude-process';
import { encodeProjectKey } from '@/lib/adapter/detect';
import { homedir } from 'node:os';

function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// GET /api/sessions/[id]/stream?message=...
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateId(id)) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Invalid session ID' })}\n\n`,
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const message = req.nextUrl.searchParams.get('message');
  if (!message || !message.trim()) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Message is required' })}\n\n`,
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }

  const workspace = process.env.CLAUDE_WEB_WORKSPACE || process.cwd();

  try {
    // For native mode, check if the JSONL file already exists to determine resume
    const adapter = await createAdapter();
    let resume = false;

    if (adapter.mode === 'native') {
      const projectKey = encodeProjectKey(workspace);
      const jsonlPath = join(homedir(), '.claude', 'projects', projectKey, `${id}.jsonl`);
      resume = existsSync(jsonlPath);
    } else {
      // Fallback mode: check if session has existing messages
      const existingMessages = await adapter.getMessages(id).catch(() => []);
      resume = existingMessages.length > 0;

      // Save user message to fallback storage
      await adapter.appendMessage(id, {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }

    const stream = processManager.spawn(id, message, workspace, { resume });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`,
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
    );
  }
}
