import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { shareArticleOnLinkedIn } from '@/lib/linkedinShare';

interface ReviewRow {
  id: number;
  article_id: number | null;
  status: string;
  is_test: number;
  titre?: string | null;
}

/**
 * Enregistre l'intention de partage LinkedIn (case à cocher de l'UI) sur la
 * demande de validation. Tolérant : si le schéma v2 n'est pas migré, on ignore
 * silencieusement (la publication du blog n'est jamais bloquée).
 */
async function saveLinkedInIntent(
  reviewId: number,
  opts: { liShare?: unknown; liTarget?: unknown; liText?: unknown },
): Promise<void> {
  if (opts.liShare === undefined && opts.liTarget === undefined && opts.liText === undefined) return;
  const cols: string[] = [];
  const vals: unknown[] = [];
  if (opts.liShare !== undefined)  { cols.push('li_share = ?');  vals.push(opts.liShare ? 1 : 0); }
  if (opts.liTarget !== undefined) { cols.push('li_target = ?'); vals.push(opts.liTarget === 'person' ? 'person' : 'organization'); }
  if (opts.liText !== undefined)   { cols.push('li_text = ?');   vals.push(String(opts.liText ?? '')); }
  if (cols.length === 0) return;
  vals.push(reviewId);
  try {
    await execute(`UPDATE article_reviews SET ${cols.join(', ')} WHERE id = ?`, vals);
  } catch { /* colonnes v2 absentes — ignoré */ }
}

/** "YYYY-MM-DDTHH:mm" (datetime-local) → "YYYY-MM-DD HH:mm:00" */
function toMysqlDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:00`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, action, scheduledAt, liShare, liTarget, liText } = await req.json();
  if (!id || !action) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });

  const review = await queryOne<ReviewRow>(
    `SELECT r.id, r.article_id, r.status, r.is_test, a.titre
       FROM article_reviews r LEFT JOIN articles a ON a.id = r.article_id
      WHERE r.id = ? LIMIT 1`,
    [id],
  );
  if (!review) return NextResponse.json({ error: 'Élément introuvable' }, { status: 404 });

  const tag = review.is_test ? '[TEST] ' : '';
  const title = review.titre ?? '';

  try {
    if (action === 'schedule') {
      const when = toMysqlDate(String(scheduledAt || ''));
      if (!when) return NextResponse.json({ error: 'Date invalide' }, { status: 400 });
      // Mémorise le choix de partage LinkedIn : il sera exécuté à la publication
      // automatique (publishDue) le moment venu.
      await saveLinkedInIntent(review.id, { liShare, liTarget, liText });
      await execute('UPDATE article_reviews SET status = ?, scheduled_at = ? WHERE id = ?', ['programme', when, review.id]);
      await createNotification({ type: 'info', title: `${tag}Article programmé : ${title}`, message: `Publication prévue le ${when}`, link: '/admin/workflow' });
      return NextResponse.json({ ok: true, status: 'programme' });
    }

    if (action === 'unschedule') {
      await execute('UPDATE article_reviews SET status = ?, scheduled_at = NULL WHERE id = ?', ['valide', review.id]);
      return NextResponse.json({ ok: true, status: 'valide' });
    }

    if (action === 'publish') {
      await saveLinkedInIntent(review.id, { liShare, liTarget, liText });
      if (review.article_id) await execute('UPDATE articles SET statut = ? WHERE id = ?', ['publie', review.article_id]);
      await execute('UPDATE article_reviews SET status = ?, published_at = NOW() WHERE id = ?', ['publie', review.id]);
      await createNotification({ type: 'success', title: `${tag}Article publié : ${title}`, link: review.article_id ? `/admin/articles/${review.article_id}` : '' });

      // ── Partage LinkedIn (si coché). Non bloquant : la mise en ligne du blog
      //    a déjà eu lieu ci-dessus, le résultat LinkedIn est seulement remonté.
      // Intention effective : valeur transmise par l'UI, sinon valeur stockée
      // (cas d'un article programmé publié manuellement via « Publier maintenant »).
      let effShare: unknown = liShare;
      if (effShare === undefined) {
        try {
          const r = await queryOne<{ li_share: number }>('SELECT li_share FROM article_reviews WHERE id = ?', [review.id]);
          effShare = r?.li_share;
        } catch { /* colonne absente — pas de partage */ }
      }
      let linkedin: { ok: boolean; url?: string; error?: string } | undefined;
      if (effShare) {
        const r = await shareArticleOnLinkedIn(review.id).catch((e): import('@/lib/linkedinShare').ShareResult => ({ ok: false, skipped: false, url: undefined, error: e instanceof Error ? e.message : String(e) }));
        if (!r.skipped) {
          linkedin = { ok: r.ok, url: r.url, error: r.error };
          await createNotification(
            r.ok
              ? { type: 'success', title: `${tag}Partagé sur LinkedIn : ${title}`, link: r.url || '/admin/linkedin' }
              : { type: 'warning', title: `${tag}Partage LinkedIn échoué : ${title}`, message: r.error || '', link: '/admin/linkedin' },
          );
        }
      }
      return NextResponse.json({ ok: true, status: 'publie', linkedin });
    }

    if (action === 'reject') {
      if (review.article_id) await execute('UPDATE articles SET statut = ? WHERE id = ?', ['refuse', review.article_id]);
      await execute('UPDATE article_reviews SET status = ? WHERE id = ?', ['refuse', review.id]);
      return NextResponse.json({ ok: true, status: 'refuse' });
    }

    if (action === 'revalidate') {
      await execute('UPDATE article_reviews SET status = ?, scheduled_at = NULL WHERE id = ?', ['valide', review.id]);
      return NextResponse.json({ ok: true, status: 'valide' });
    }

    if (action === 'delete') {
      if (review.article_id) {
        await execute('DELETE FROM articles WHERE id = ? AND statut IN ("brouillon", "refuse")', [review.article_id]);
      }
      await execute('DELETE FROM article_reviews WHERE id = ?', [review.id]);
      return NextResponse.json({ ok: true, status: 'deleted' });
    }

    return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
