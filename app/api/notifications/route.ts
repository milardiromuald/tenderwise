import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listNotifications, unreadCount, deleteNotification, deleteAllNotifications } from '@/lib/notifications';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Reserve aux administrateurs' }, { status: 403 });

  try {
    const [items, unread] = await Promise.all([listNotifications(50), unreadCount()]);
    return NextResponse.json({ items, unread });
  } catch {
    return NextResponse.json({ items: [], unread: 0 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Reserve aux administrateurs' }, { status: 403 });

  try {
    let id: number | undefined;
    try { const b = await req.json(); id = b?.id; } catch { /* corps vide = tout supprimer */ }
    if (id) await deleteNotification(id);
    else await deleteAllNotifications();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
