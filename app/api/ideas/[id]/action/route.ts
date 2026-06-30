import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { execute, queryOne } from '@/lib/db';
import { runArticleWorkflow } from '@/lib/workflow';
import { getBaseUrl } from '@/lib/google';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface IdeaRow {
  id: number;
  titre_propose: string;
  mots_cles: string;
  categorie: string;
  statut: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const body = await req.json() as { action?: string };
  const action = body.action;

  const idea = await queryOne<IdeaRow>(
    `SELECT id, titre_propose, mots_cles, categorie, statut FROM article_ideas WHERE id = ?`,
    [id],
  );
  if (!idea) return NextResponse.json({ error: 'Idée introuvable' }, { status: 404 });
  if (idea.statut !== 'proposee') return NextResponse.json({ error: 'Idée déjà traitée' }, { status: 409 });

  if (action === 'refuse') {
    await execute(`UPDATE article_ideas SET statut = 'refusee' WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  }

  if (action === 'accept') {
    // Marquer comme acceptée immédiatement
    await execute(`UPDATE article_ideas SET statut = 'acceptee' WHERE id = ?`, [id]);

    // Lancer le workflow en arrière-plan (fire-and-forget).
    // runArticleWorkflow insère une ligne en_cours dès le démarrage,
    // ce qui déclenche la mise à jour SSE en temps réel côté UI.
    const baseUrl = getBaseUrl(req);
    void runArticleWorkflow({
      subject: idea.titre_propose,
      baseUrl,
      source: 'idea',
    }).then(async result => {
      if (result.ok) {
        await execute(
          `UPDATE article_ideas SET statut = 'converted' WHERE id = ?`,
          [id],
        ).catch(() => {});
      } else {
        // Remettre en proposée si le workflow échoue pour permettre une relance
        await execute(
          `UPDATE article_ideas SET statut = 'proposee' WHERE id = ?`,
          [id],
        ).catch(() => {});
      }
    }).catch(() => {});

    return NextResponse.json({ ok: true, launched: true });
  }

  return NextResponse.json({ error: 'Action invalide (accept | refuse)' }, { status: 400 });
}
