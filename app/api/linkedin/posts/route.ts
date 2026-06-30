import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Variante riche (schéma v2 migré) puis repli sur les colonnes de base.
  // Garde le même contrat de réponse quel que soit l'état du schéma.
  const richSql =
    `SELECT id, text, linkedin_urn, linkedin_url, status, source,
            target, article_id, image_url, likes, comments, created_at
       FROM linkedin_posts
       ORDER BY created_at DESC
       LIMIT 50`;
  const baseSql =
    `SELECT id, text, linkedin_urn, linkedin_url, status, source, created_at
       FROM linkedin_posts
       ORDER BY created_at DESC
       LIMIT 50`;

  try {
    return NextResponse.json(await query(richSql));
  } catch {
    try {
      return NextResponse.json(await query(baseSql));
    } catch {
      // Table absente → liste vide
      return NextResponse.json([]);
    }
  }
}
