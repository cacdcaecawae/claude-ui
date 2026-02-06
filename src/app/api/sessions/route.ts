import { NextRequest, NextResponse } from 'next/server';
import { createAdapter } from '@/lib/adapter';

// GET /api/sessions - list all sessions
export async function GET() {
  try {
    const adapter = await createAdapter();
    const sessions = await adapter.listSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to list sessions', details: String(err) },
      { status: 500 }
    );
  }
}

// POST /api/sessions - create a new session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title : undefined;
    const adapter = await createAdapter();
    const session = await adapter.createSession(title);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create session', details: String(err) },
      { status: 500 }
    );
  }
}
