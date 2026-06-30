import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface IdeaRow {
  id: number;
  titre_propose: string;
  angle_editorial: string;
  sources_trouvees: string;
  mots_cles: string;
  categorie: string;
  statut: string;
  article_review_id: number | null;
  date_generee: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rows = await query<IdeaRow>(
    `SELECT id, titre_propose, angle_editorial, sources_trouvees, mots_cles,
            categorie, statut, article_review_id, date_generee
     FROM article_ideas
     WHERE statut = 'proposee'
     ORDER BY date_generee DESC
     LIMIT 10`,
  );

  const ideas = rows.map(r => ({
    ...r,
    sources_trouvees: (() => {
      try { return JSON.parse(r.sources_trouvees || '[]') as string[]; } catch { return []; }
    })(),
  }));

  return NextResponse.json({ ideas });
}
