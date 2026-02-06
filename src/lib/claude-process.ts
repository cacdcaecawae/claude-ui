import { spawn, type ChildProcess } from 'node:child_process';

class ClaudeProcessManager {
  private processes: Map<string, ChildProcess> = new Map();

  /**
   * Spawn a `claude` CLI process for a given session.
   *
   * Uses `--print --output-format stream-json` for structured streaming output.
   * - New sessions: `claude --session-id <id> -p "<message>" --output-format stream-json`
   * - Existing sessions: `claude --resume <id> -p "<message>" --output-format stream-json`
   *
   * Returns a ReadableStream that emits SSE-formatted events:
   *   data: {"type":"chunk","content":"text"}\n\n
   *   data: {"type":"done"}\n\n
   *   data: {"type":"error","message":"..."}\n\n
   */
  spawn(
    sessionId: string,
    message: string,
    workspace: string,
    options?: { resume?: boolean }
  ): ReadableStream<Uint8Array> {
    // Kill existing process for this session if any
    this.abort(sessionId);

    const args: string[] = [];

    if (options?.resume) {
      args.push('--resume', sessionId);
    } else {
      args.push('--session-id', sessionId);
    }

    // -p = print mode (non-interactive, flag only, no value)
    // --output-format stream-json requires --verbose
    // message goes last as positional argument
    args.push('-p', '--output-format', 'stream-json', '--verbose', message);

    const child = spawn('claude', args, {
      cwd: workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });

    this.processes.set(sessionId, child);

    const sessionIdRef = sessionId;
    const processesRef = this.processes;

    return new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

        function sendSSE(event: { type: string; content?: string; message?: string }) {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            closed = true;
          }
        }

        function closeStream() {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // Already closed
          }
          processesRef.delete(sessionIdRef);
        }

        let buffer = '';

        child.stdout?.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();

          // stream-json outputs one JSON object per line
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);

              // Claude stream-json emits various event types:
              // - {type:"assistant", message:{content:[{type:"text",text:...}]}} — full/partial msg
              // - {type:"content_block_delta", delta:{text:"..."}} — streaming delta
              // - {type:"result", result:{text:"..."}} — final result
              // - message_start, content_block_start, message_stop, message_delta — metadata

              if (parsed.type === 'assistant' && parsed.message?.content) {
                const contentBlocks = parsed.message.content;
                if (Array.isArray(contentBlocks)) {
                  for (const block of contentBlocks) {
                    if (block.type === 'text' && block.text) {
                      sendSSE({ type: 'chunk', content: block.text });
                    }
                  }
                }
              } else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                sendSSE({ type: 'chunk', content: parsed.delta.text });
              } else if (parsed.result?.text) {
                sendSSE({ type: 'chunk', content: parsed.result.text });
              } else if (
                parsed.type === 'message_start' ||
                parsed.type === 'content_block_start' ||
                parsed.type === 'message_stop' ||
                parsed.type === 'message_delta'
              ) {
                // Skip metadata events
              }
              // Other unknown events are silently skipped
            } catch {
              // Not valid JSON — forward as raw text
              if (trimmed) {
                sendSSE({ type: 'chunk', content: trimmed });
              }
            }
          }
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          const text = chunk.toString().trim();
          if (text) {
            // stderr often has progress/status info, not always real errors
            // Only forward if it looks like an actual error
            const lower = text.toLowerCase();
            if (lower.includes('error') || lower.includes('fatal') || lower.includes('exception')) {
              sendSSE({ type: 'error', message: text });
            }
          }
        });

        child.on('close', () => {
          // Flush remaining buffer
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (parsed.result?.text) {
                sendSSE({ type: 'chunk', content: parsed.result.text });
              }
            } catch {
              if (buffer.trim()) {
                sendSSE({ type: 'chunk', content: buffer.trim() });
              }
            }
          }

          sendSSE({ type: 'done' });
          closeStream();
        });

        child.on('error', (err) => {
          sendSSE({ type: 'error', message: err.message });
          closeStream();
        });
      },

      cancel() {
        child.kill('SIGTERM');
        processesRef.delete(sessionIdRef);
      },
    });
  }

  abort(sessionId: string): boolean {
    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(sessionId);
      return true;
    }
    return false;
  }

  isRunning(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }
}

// Singleton
export const processManager = new ClaudeProcessManager();
