import { NextRequest, NextResponse } from 'next/server';
import { createAdapter } from '@/lib/adapter';

function validateId(id: string): boolean {
  // Prevent path traversal - only allow alphanumeric, hyphens, underscores
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// DELETE /api/sessions/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateId(id)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  try {
    const adapter = await createAdapter();
    await adapter.deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete session', details: String(err) },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id] - rename
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateId(id)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  try {
    const body = await req.json();
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const adapter = await createAdapter();
    await adapter.renameSession(id, body.title.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to rename session', details: String(err) },
      { status: 500 }
    );
  }
}
