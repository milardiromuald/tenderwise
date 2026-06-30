import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { composeHeader } from '@/lib/composeImage';
import { pickRandomBackground } from '@/lib/backgrounds';
import { saveMedia } from '@/lib/media';

interface ReviewRow {
  id: number;
  article_id: number | null;
  status: string;
  is_test: number;
  subject: string | null;
  titre: string | null;
  extrait: string | null;
  categorie: string | null;
}

/** Lit le titre/sous-titre image (tolérant : colonnes éventuellement non migrées). */
async function readImageText(articleId: number | null): Promise<{ title: string; subtitle: string }> {
  if (!articleId) return { title: '', subtitle: '' };
  try {
    const row = await queryOne<{ image_title: string | null; image_subtitle: string | null; titre: string | null; extrait: string | null }>(
      'SELECT image_title, image_subtitle, titre, extrait FROM articles WHERE id = ? LIMIT 1',
      [articleId],
    );
    return {
      title: (row?.image_title || row?.titre || '').trim(),
      subtitle: (row?.image_subtitle || row?.extrait || '').trim(),
    };
  } catch {
    // Colonnes image_* absentes → repli sur titre/extrait.
    const row = await queryOne<{ titre: string | null; extrait: string | null }>(
      'SELECT titre, extrait FROM articles WHERE id = ? LIMIT 1',
      [articleId],
    );
    return { title: (row?.titre || '').trim(), subtitle: (row?.extrait || '').trim() };
  }
}

export async function POST(req: NextRequest) {
  const { token, action, titre, extrait, contenu, meta_title, meta_description, meta_keywords, canonical_url, dataUrl, backgroundUrl, imageTitle, imageSubtitle } = await req.json();
  if (!token || !action) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const review = await queryOne<ReviewRow>(
    `SELECT r.id, r.article_id, r.status, r.is_test, r.subject,
            a.titre, a.extrait, a.categorie
     FROM article_reviews r
     LEFT JOIN articles a ON a.id = r.article_id
     WHERE r.token = ? LIMIT 1`,
    [token],
  );
  if (!review) return NextResponse.json({ error: 'Lien de validation invalide.' }, { status: 404 });

  const articleId = review.article_id;
  const tag = review.is_test ? '[TEST] ' : '';

  try {
    if (action === 'approve') {
      // Validation = l’article passe en attente de programmation (pas de publication immédiate)
      await execute('UPDATE article_reviews SET status = ? WHERE id = ?', ['valide', review.id]);
      await createNotification({ type: 'success', title: `${tag}Article validé — à programmer`, message: 'Programmez sa date de publication dans l’onglet Workflow.', link: '/admin/workflow' });
      return NextResponse.json({ ok: true, status: 'valide', message: 'Article validé. À programmer pour publication dans l’onglet Workflow.' });
    }

    if (action === 'reject') {
      if (articleId) await execute('UPDATE articles SET statut = ? WHERE id = ?', ['refuse', articleId]);
      await execute('UPDATE article_reviews SET status = ? WHERE id = ?', ['refuse', review.id]);
      await createNotification({ type: 'warning', title: `${tag}Article refusé`, link: articleId ? `/admin/articles/${articleId}` : '' });
      return NextResponse.json({ ok: true, status: 'refuse', message: 'Article refusé.' });
    }

    if (action === 'save') {
      if (articleId) {
        await execute(
          `UPDATE articles
              SET titre = ?, extrait = ?, contenu = ?,
                  meta_title = ?, meta_description = ?, meta_keywords = ?, canonical_url = ?
            WHERE id = ?`,
          [
            titre ?? '', extrait ?? '', contenu ?? '',
            meta_title ?? '', meta_description ?? '', meta_keywords ?? '', canonical_url ?? '',
            articleId,
          ],
        );
      }
      await execute('UPDATE article_reviews SET status = ?, note = ? WHERE id = ?', ['modifie', 'Modifié via la page de validation', review.id]);
      await createNotification({ type: 'info', title: `${tag}Article modifié`, message: titre || '', link: articleId ? `/admin/articles/${articleId}` : '' });
      return NextResponse.json({ ok: true, status: 'modifie', message: 'Modifications enregistrées.' });
    }

    if (action === 'delete') {
      // Suppression définitive : l’article ET sa demande de validation.
      // Garde-fou : la suppression d'un article réel est réservée à un admin
      // connecté. Le lien public (token, reçu par e-mail) ne peut supprimer que
      // les articles de TEST — pour le reste, l'éditeur utilise « Refuser ».
      if (!review.is_test) {
        const session = await getSession();
        if (!session) {
          return NextResponse.json(
            { error: 'Suppression réservée à l’administrateur connecté. Utilisez « Refuser » pour écarter cet article.' },
            { status: 403 },
          );
        }
      }
      // (Aucune contrainte FK entre les deux tables — ordre indifférent.)
      if (articleId) await execute('DELETE FROM articles WHERE id = ?', [articleId]);
      await execute('DELETE FROM article_reviews WHERE id = ?', [review.id]);
      await createNotification({ type: 'warning', title: `${tag}Article supprimé`, message: review.titre || review.subject || '', link: '/admin/workflow' });
      return NextResponse.json({ ok: true, deleted: true, status: 'supprime', message: 'Article supprimé définitivement.' });
    }

    if (action === 'recompose_image') {
      // Recompose avec le fond spécifié, ou un fond aléatoire si aucun fourni.
      let bgUrl: string;
      let bgLabel: string;
      if (backgroundUrl && typeof backgroundUrl === 'string') {
        bgUrl = backgroundUrl;
        // Récupère le label depuis la DB pour le message de confirmation.
        try {
          const row = await queryOne<{ label: string }>('SELECT label FROM header_backgrounds WHERE url = ? LIMIT 1', [backgroundUrl]);
          bgLabel = row?.label || '';
        } catch { bgLabel = ''; }
      } else {
        const bg = await pickRandomBackground();
        if (!bg) return NextResponse.json({ error: 'Aucun fond d\'en-tête configuré (Admin → Fonds d\'en-tête).' }, { status: 400 });
        bgUrl = bg.url;
        bgLabel = bg.label || ('#' + bg.id);
      }
      const { title, subtitle } = (imageTitle || imageSubtitle)
        ? { title: (imageTitle as string) || '', subtitle: (imageSubtitle as string) || '' }
        : await readImageText(articleId);
      const buffer = await composeHeader({ backgroundUrl: bgUrl, title, subtitle });
      const filename = 'header-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.png';
      const { url } = await saveMedia(buffer, 'image/png', { filename, source: 'ai', altText: review.titre ?? undefined });
      await execute('UPDATE article_reviews SET image_url = ? WHERE id = ?', [url, review.id]);
      if (articleId) await execute('UPDATE articles SET image = ? WHERE id = ?', [url, articleId]);
      return NextResponse.json({ ok: true, status: review.status, imageUrl: url, message: bgLabel ? `Image recomposée (fond « ${bgLabel} »).` : 'Image recomposée.' });
    }

    if (action === 'compose_image') {
      // Enregistre l’image composée (fond + texte incrusté) envoyée en data URL PNG.
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Image composée invalide.' }, { status: 400 });
      }
      const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
      if (!m) return NextResponse.json({ error: 'Format d’image invalide.' }, { status: 400 });
      const mime = m[1];
      const buffer = Buffer.from(m[2], 'base64');
      const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
      const filename = 'composed-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
      const { url } = await saveMedia(buffer, mime, { filename, source: 'ai', altText: review.titre ?? undefined });
      await execute('UPDATE article_reviews SET image_url = ? WHERE id = ?', [url, review.id]);
      if (articleId) await execute('UPDATE articles SET image = ? WHERE id = ?', [url, articleId]);
      return NextResponse.json({ ok: true, status: review.status, imageUrl: url, message: 'Image composée enregistrée.' });
    }

    return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
