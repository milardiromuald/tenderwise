import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { buildArticlePostText } from '@/lib/linkedinShare';
import { SITE_URL } from '@/lib/siteUrl';

interface Row {
  titre:         string | null;
  extrait:       string | null;
  slug:          string | null;
  image:         string | null;
  canonical_url: string | null;
  meta_keywords: string | null;
}

/** URL publique de l'article (canonique si définie, sinon /blog/{slug}). */
function articleUrl(row: Row): string {
  const c = (row.canonical_url || '').trim();
  if (c) return c;
  if (row.slug) return `${SITE_URL}/blog/${row.slug}`;
  return SITE_URL;
}

/**
 * Données nécessaires à l'aperçu LinkedIn d'un article validé.
 * Le texte pré-rempli provient de la MÊME fonction que le partage réel
 * (`buildArticlePostText`) afin que l'aperçu soit fidèle au post publié.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get('id') || 0);
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });

  const row = await queryOne<Row>(
    `SELECT a.titre, a.extrait, a.slug, a.image, a.canonical_url, a.meta_keywords
       FROM article_reviews r
       LEFT JOIN articles a ON a.id = r.article_id
      WHERE r.id = ? LIMIT 1`,
    [id],
  ).catch(() => null);

  if (!row) return NextResponse.json({ error: 'introuvable' }, { status: 404 });

  return NextResponse.json({
    ok:      true,
    text:    buildArticlePostText(row),
    title:   row.titre || '',
    excerpt: row.extrait || '',
    url:     articleUrl(row),
    image:   row.image || '',
  });
}
