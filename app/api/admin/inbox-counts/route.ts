import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Compteurs « non lus » de la boîte de réception, pour les pastilles de la
 * barre latérale admin. Un élément est non lu tant que son statut vaut
 * « nouveau » (les pages Messages / Candidatures le passent à « lu » à
 * l'ouverture). Tolérant aux tables absentes (renvoie 0).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let messages = 0;
  let applications = 0;

  try {
    const row = await queryOne<{ c: number }>(
      "SELECT COUNT(*) AS c FROM contact_messages WHERE statut = 'nouveau'"
    );
    messages = Number(row?.c ?? 0);
  } catch { /* table absente */ }

  try {
    const row = await queryOne<{ c: number }>(
      "SELECT COUNT(*) AS c FROM job_applications WHERE statut = 'nouveau'"
    );
    applications = Number(row?.c ?? 0);
  } catch { /* table absente */ }

  return NextResponse.json({ messages, applications });
}
