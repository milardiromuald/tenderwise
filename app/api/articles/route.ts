import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';


function generateSlug(titre: string): string {
  return titre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const articles = await query('SELECT * FROM articles ORDER BY date_publication DESC');
  return NextResponse.json(articles);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const slug = body.slug || generateSlug(body.titre || 'article');
  const isFeatured = body.is_featured ? 1 : 0;
  const authorUsername = body.author_username || session.user.name;
  const baseParams = [
    body.titre || '', slug, body.extrait || '', body.contenu || '',
    body.categorie || '', body.image || '',
    body.statut || 'brouillon', body.auteur || '',
    body.date_publication || new Date().toISOString().split('T')[0],
    body.meta_title || '', body.meta_description || '', body.meta_keywords || '',
    body.og_image || '', body.canonical_url || '',
    body.temps_lecture || 0,
    authorUsername,
  ];

  try {
    if (isFeatured) {
      await execute('UPDATE articles SET is_featured = 0');
    }
    const result = await execute(`
      INSERT INTO articles
        (titre, slug, extrait, contenu, categorie, image, statut, auteur, date_publication,
         meta_title, meta_description, meta_keywords, og_image, canonical_url, temps_lecture, is_featured, author_username)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [...baseParams, isFeatured]);
    return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'ER_BAD_FIELD_ERROR') throw err;
    const result = await execute(`
      INSERT INTO articles
        (titre, slug, extrait, contenu, categorie, image, statut, auteur, date_publication,
         meta_title, meta_description, meta_keywords, og_image, canonical_url, temps_lecture)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, baseParams.slice(0, -1));
    return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
  }
}
