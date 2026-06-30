import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { publishDue } from '@/lib/workflowPublish';

export interface WorkflowItem {
  id: number;
  article_id: number | null;
  token: string;
  subject: string;
  status: string;
  drive_link: string;
  image_url: string;
  is_test: number;
  source: string;
  scheduled_at: string | null;
  created_at: string;
  titre: string | null;
  article_statut: string | null;
  steps_log: string | null;
  channel: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    const published = await publishDue();

    // Colonnes éventuellement non migrées (`steps_log`, `channel`) : on tente la
    // requête la plus riche puis on retombe sur des littéraux pour ces colonnes.
    const buildSql = (stepsExpr: string, channelExpr: string) =>
      `SELECT r.id, r.article_id, r.token, r.subject, r.status, r.drive_link, r.image_url,
              r.is_test, r.source, r.scheduled_at, r.created_at,
              a.titre, a.statut AS article_statut, ${stepsExpr}, ${channelExpr}
         FROM article_reviews r
         LEFT JOIN articles a ON a.id = r.article_id
        WHERE (r.article_id IS NULL OR a.id IS NOT NULL)
        ORDER BY r.created_at DESC`;
    const variants = [
      buildSql('r.steps_log', 'r.channel'),
      buildSql('r.steps_log', `'blog' AS channel`),
      buildSql('NULL AS steps_log', `'blog' AS channel`),
    ];
    let rows: WorkflowItem[] | null = null;
    for (const sql of variants) {
      try { rows = await query<WorkflowItem>(sql); break; } catch { /* colonne absente → variante suivante */ }
    }
    if (!rows) throw new Error('schema');

    const groups: Record<string, WorkflowItem[]> = {
      en_cours: [], en_attente: [], modifie: [], valide: [], programme: [], publie: [], refuse: [],
    };
    for (const r of rows) {
      (groups[r.status] ??= []).push(r);
    }

    const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
    return NextResponse.json({ groups, counts, autoPublished: published });
  } catch {
    // Tables du workflow non créées → listes vides
    return NextResponse.json({
      groups: { en_cours: [], en_attente: [], modifie: [], valide: [], programme: [], publie: [], refuse: [] },
      counts: {}, autoPublished: 0, needsMigration: true,
    });
  }
}
