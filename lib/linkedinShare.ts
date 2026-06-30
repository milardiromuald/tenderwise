import { queryOne, execute } from './db';
import { getMedia } from './media';
import { publishLinkedInPost, type LinkedInTarget } from './linkedin';
import { SITE_URL } from './siteUrl';

/**
 * Partage d'un article publié vers LinkedIn.
 *
 * Appelé au moment de la PUBLICATION d'un article (manuelle ou auto-programmée),
 * uniquement si l'éditeur a coché « Partager sur LinkedIn » à la validation.
 *
 * Conçu pour ne JAMAIS faire échouer la publication du blog : toute erreur est
 * capturée et tracée dans `article_reviews.li_status = 'failed'`. La mise en
 * ligne de l'article reste donc indépendante du succès LinkedIn.
 */

interface ShareRow {
  review_id:    number;
  article_id:   number | null;
  li_share:     number;
  li_target:    string;
  li_text:      string | null;
  li_status:    string;
  titre:        string | null;
  extrait:      string | null;
  slug:         string | null;
  image:        string | null;
  canonical_url: string | null;
  meta_keywords: string | null;
}

export interface ShareResult {
  ok:      boolean;
  skipped: boolean;
  url?:    string;
  error?:  string;
}

/** Construit l'URL publique de l'article (canonique si définie, sinon /blog/{slug}). */
function articleUrl(row: ShareRow): string {
  const c = (row.canonical_url || '').trim();
  if (c) return c;
  if (row.slug) return `${SITE_URL}/blog/${row.slug}`;
  return SITE_URL;
}

/** Transforme une liste de mots-clés en hashtags LinkedIn (#MotCle), max 4. */
function keywordsToHashtags(meta?: string | null): string {
  if (!meta) return '';
  const tags = meta
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map(kw =>
      '#' +
      kw.normalize('NFD').replace(/[̀-ͯ]/g, '')   // retire les accents
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')
        .replace(/[^A-Za-z0-9]/g, ''),
    )
    .filter(t => t.length > 1);
  return tags.join(' ');
}

/**
 * Texte par défaut d'un post LinkedIn dérivé de l'article.
 * Déterministe (aucun token IA) : titre, extrait, lien, hashtags.
 * Exporté pour pré-remplir le champ éditable côté UI.
 */
export function buildArticlePostText(row: {
  titre?: string | null; extrait?: string | null; slug?: string | null;
  canonical_url?: string | null; meta_keywords?: string | null;
}): string {
  const url = articleUrl(row as ShareRow);
  const titre = (row.titre || '').trim();
  const extrait = (row.extrait || '').trim();
  const hashtags = keywordsToHashtags(row.meta_keywords);
  return [
    titre ? `📌 ${titre}` : '',
    extrait,
    `👉 À lire sur notre blog : ${url}`,
    hashtags,
  ].filter(Boolean).join('\n\n');
}

/** Lit les octets d'une image stockée en base si l'URL est /api/media/{id}. */
async function readArticleImage(image?: string | null): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!image) return null;
  const m = image.match(/^\/api\/media\/(\d+)$/);
  if (!m) return null; // image externe → publication texte seul (l'aperçu de lien suffit)
  try {
    const media = await getMedia(parseInt(m[1], 10));
    if (media?.data) return { buffer: media.data, mime: media.mime_type };
  } catch { /* image non bloquante */ }
  return null;
}

/**
 * Exécute le partage pour une demande de validation donnée.
 * Idempotent : ne republie pas si li_status vaut déjà 'published'.
 */
export async function shareArticleOnLinkedIn(reviewId: number): Promise<ShareResult> {
  const row = await queryOne<ShareRow>(
    `SELECT r.id AS review_id, r.article_id, r.li_share, r.li_target, r.li_text, r.li_status,
            a.titre, a.extrait, a.slug, a.image, a.canonical_url, a.meta_keywords
       FROM article_reviews r
       LEFT JOIN articles a ON a.id = r.article_id
      WHERE r.id = ? LIMIT 1`,
    [reviewId],
  ).catch(() => null);

  if (!row) return { ok: false, skipped: true, error: 'Demande introuvable' };
  if (!row.li_share)               return { ok: false, skipped: true };
  if (row.li_status === 'published') return { ok: true, skipped: true };

  const target: LinkedInTarget = row.li_target === 'person' ? 'person' : 'organization';
  const text = (row.li_text && row.li_text.trim()) || buildArticlePostText(row);

  try {
    const img = await readArticleImage(row.image);
    const { postUrn, url } = await publishLinkedInPost(
      text, img?.buffer, img?.mime, { as: target },
    );

    // Trace dans l'historique LinkedIn (source 'blog' + lien article + cible).
    // Repli sur les colonnes de base si le schéma v2 n'est pas encore migré.
    try {
      await execute(
        `INSERT INTO linkedin_posts (text, linkedin_urn, linkedin_url, status, source, target, article_id, image_url)
         VALUES (?, ?, ?, 'published', 'blog', ?, ?, ?)`,
        [text, postUrn, url, target, row.article_id ?? null, row.image ?? null],
      );
    } catch {
      await execute(
        `INSERT INTO linkedin_posts (text, linkedin_urn, linkedin_url, status, source)
         VALUES (?, ?, ?, 'published', 'blog')`,
        [text, postUrn, url],
      ).catch(() => {});
    }

    await execute(
      `UPDATE article_reviews SET li_status = 'published', li_url = ?, li_urn = ? WHERE id = ?`,
      [url, postUrn, reviewId],
    ).catch(() => {});

    return { ok: true, skipped: false, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await execute(
      `INSERT INTO linkedin_posts (text, status, source, target, article_id)
       VALUES (?, 'failed', 'blog', ?, ?)`,
      [text, target, row.article_id ?? null],
    ).catch(async () => {
      await execute(
        `INSERT INTO linkedin_posts (text, status, source) VALUES (?, 'failed', 'blog')`,
        [text],
      ).catch(() => {});
    });
    await execute(
      `UPDATE article_reviews SET li_status = 'failed' WHERE id = ?`,
      [reviewId],
    ).catch(() => {});
    return { ok: false, skipped: false, error: msg };
  }
}
