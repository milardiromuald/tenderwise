import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllSettings, setSetting } from '@/lib/settings';

const ALLOWED_KEYS_RE = /^[a-z0-9_]{1,80}$/;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getAllSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS_RE.test(key)) continue; // silently skip invalid keys
    await setSetting(key, String(value).slice(0, 10_000));
  }
  return NextResponse.json({ ok: true });
}
