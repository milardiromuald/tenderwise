import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  const msg = await queryOne('SELECT * FROM contact_messages WHERE id = ?', [id]);
  if (!msg) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  /* Auto-mark as read when opened */
  await execute(
    "UPDATE contact_messages SET statut = 'lu' WHERE id = ? AND statut = 'nouveau'",
    [id]
  );

  return NextResponse.json({ message: msg });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  const { statut } = await req.json() as { statut: string };

  const allowed = ['nouveau', 'lu', 'archive'];
  if (!allowed.includes(statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }

  await execute('UPDATE contact_messages SET statut = ? WHERE id = ?', [statut, id]);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  await execute('DELETE FROM contact_messages WHERE id = ?', [id]);
  return NextResponse.json({ success: true });
}
