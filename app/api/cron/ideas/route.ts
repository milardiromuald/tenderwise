import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { generateArticleIdeas } from '@/lib/agents/ideaAgent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Génération quotidienne d'idées d'articles — à appeler par une tâche planifiée
 * externe (cron o2switch, UptimeRobot, GitHub Actions…) chaque matin à l'heure souhaitée.
 *
 * Exemple (tous les jours à 4h) :
 *   curl -fsS "https://www.tenderwise.fr/api/cron/ideas?key=VOTRE_SECRET"
 *
 * Paramètres :
 *   ?force=1  — Régénère même si des idées existent déjà pour aujourd'hui
 *
 * Authentification : même mécanique que /api/cron/publish
 *   - Authorization: Bearer <CRON_SECRET>
 *   - x-cron-key: <CRON_SECRET>
 *   - ?key=<CRON_SECRET>
 *   - ou session admin valide (déclenchement manuel)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';

  let authorized = false;
  if (secret) {
    const bearer   = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const hKey     = req.headers.get('x-cron-key')?.trim();
    const qKey     = req.nextUrl.searchParams.get('key')?.trim();
    authorized = bearer === secret || hKey === secret || qKey === secret;
  }

  if (!authorized) {
    const session = await getSession();
    authorized = !!session;
  }

  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';

  // Idempotence : ne pas regénérer si des idées "proposée" existent déjà ce jour
  if (!force) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await query(
      `SELECT id FROM article_ideas WHERE DATE(date_generee) = ? AND statut = 'proposee' LIMIT 1`,
      [today],
    );
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, skipped: true, message: 'Idées déjà générées aujourd\'hui (utilisez ?force=1 pour régénérer)' });
    }
  } else {
    // Forcer : on supprime d'abord les idées "proposée" en cours pour repartir proprement
    await execute(`DELETE FROM article_ideas WHERE statut = 'proposee'`).catch(() => {});
  }

  try {
    const ideas = await generateArticleIdeas();

    for (const idea of ideas) {
      await execute(
        `INSERT INTO article_ideas
           (titre_propose, angle_editorial, sources_trouvees, mots_cles, categorie, statut, date_generee)
         VALUES (?, ?, ?, ?, ?, 'proposee', NOW())`,
        [
          idea.titre_propose,
          idea.angle_editorial,
          JSON.stringify(idea.sources_trouvees || []),
          idea.mots_cles || '',
          idea.categorie || 'Actualités',
        ],
      );
    }

    return NextResponse.json({ ok: true, generated: ideas.length, ideas });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erreur de génération' },
      { status: 500 },
    );
  }
}
