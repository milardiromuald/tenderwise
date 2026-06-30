import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    const row = await queryOne<{ c: number }>(
      "SELECT COUNT(*) as c FROM contact_messages WHERE statut = 'nouveau'"
    );
    return NextResponse.json({ count: Number(row?.c ?? 0) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
