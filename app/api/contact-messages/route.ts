import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statut  = searchParams.get('statut') || '';
  const page    = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit   = 20;
  const offset  = (page - 1) * limit;

  const where = statut ? 'WHERE statut = ?' : '';
  const params: unknown[] = statut ? [statut] : [];

  const [messages, totalRow] = await Promise.all([
    query(
      `SELECT id, nom, email, telephone, societe, objet, LEFT(message,200) as message_preview,
              statut, rgpd_consent, created_at
       FROM contact_messages ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
    query<{ c: number }>(
      `SELECT COUNT(*) as c FROM contact_messages ${where}`,
      params
    ),
  ]);

  return NextResponse.json({
    messages,
    total: Number(totalRow[0]?.c ?? 0),
    page,
    limit,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { ids } = await req.json() as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Aucun ID fourni' }, { status: 400 });
  }
  const placeholders = ids.map(() => '?').join(',');
  await execute(`DELETE FROM contact_messages WHERE id IN (${placeholders})`, ids);
  return NextResponse.json({ success: true, deleted: ids.length });
}
