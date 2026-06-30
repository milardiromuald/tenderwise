import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markAllRead, markRead } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });

  let id: number | undefined;
  try {
    const body = await req.json();
    id = body?.id;
  } catch { /* corps vide = tout marquer lu */ }

  try {
    if (id) await markRead(id);
    else await markAllRead();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
