import { NextRequest, NextResponse } from 'next/server';
import { processManager } from '@/lib/claude-process';

function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// POST /api/sessions/[id]/stop
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateId(id)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const stopped = processManager.abort(id);
  return NextResponse.json({ ok: true, stopped });
}
