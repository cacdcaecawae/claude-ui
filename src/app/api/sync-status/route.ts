import { NextResponse } from 'next/server';
import { createAdapter } from '@/lib/adapter';

// GET /api/sync-status
export async function GET() {
  try {
    const adapter = await createAdapter();
    return NextResponse.json({ mode: adapter.mode });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to get sync status', details: String(err) },
      { status: 500 }
    );
  }
}
