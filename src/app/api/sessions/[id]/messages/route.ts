import { NextRequest, NextResponse } from 'next/server';
import { createAdapter } from '@/lib/adapter';

function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// GET /api/sessions/[id]/messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateId(id)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  try {
    const adapter = await createAdapter();
    const messages = await adapter.getMessages(id);
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to get messages', details: String(err) },
      { status: 500 }
    );
  }
}
