import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  ).slice(0, 45);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!await checkRateLimit(`track-dur:${ip}`, 120, 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const visitId  = typeof body.visit_id === 'number' && body.visit_id > 0 ? body.visit_id : null;
    const duration = typeof body.duration_seconds === 'number' ? Math.round(body.duration_seconds) : null;

    if (!visitId || !duration || duration < 2 || duration > 7200) {
      return NextResponse.json({ ok: false });
    }

    await execute(
      'UPDATE site_visits SET duration_seconds = ? WHERE id = ? AND duration_seconds IS NULL',
      [duration, visitId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/track-duration]', err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
