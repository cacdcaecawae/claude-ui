import { createAdapter } from '@/lib/adapter';

// GET /api/watch - SSE endpoint for storage change events
export async function GET() {
  const adapter = await createAdapter();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial heartbeat
      controller.enqueue(encoder.encode(`: heartbeat\n\n`));

      const unsubscribe = adapter.watchChanges((event) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream may be closed
        }
      });

      // Send periodic heartbeats to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      // Store cleanup for cancel
      (controller as unknown as Record<string, unknown>).__cleanup = cleanup;
    },

    cancel(controller) {
      const cleanup = (controller as unknown as Record<string, unknown>)?.__cleanup;
      if (typeof cleanup === 'function') cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
