import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  const article = await queryOne('SELECT * FROM articles WHERE id = ?', [id]);
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(article);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  const body = await req.json();
  const isFeatured = body.is_featured ? 1 : 0;
  const baseParams = [
    body.titre || '', body.slug || '', body.extrait || '', body.contenu || '',
    body.categorie || '', body.image || '', body.statut || 'brouillon',
    body.auteur || '', body.date_publication || '',
    body.meta_title || '', body.meta_description || '', body.meta_keywords || '',
    body.og_image || '', body.canonical_url || '',
    body.temps_lecture || 0,
  ];

  try {
    if (isFeatured) {
      await execute('UPDATE articles SET is_featured = 0 WHERE id != ?', [id]);
    }
    await execute(`
      UPDATE articles SET
        titre=?, slug=?, extrait=?, contenu=?, categorie=?, image=?, statut=?, auteur=?, date_publication=?,
        meta_title=?, meta_description=?, meta_keywords=?, og_image=?, canonical_url=?, temps_lecture=?, is_featured=?
      WHERE id=?
    `, [...baseParams, isFeatured, id]);
    revalidatePath(`/admin/articles/${id}`);
    revalidatePath('/admin/articles');
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Colonne is_featured absente — migration SQL non encore exécutée
    if ((err as { code?: string }).code !== 'ER_BAD_FIELD_ERROR') throw err;
    await execute(`
      UPDATE articles SET
        titre=?, slug=?, extrait=?, contenu=?, categorie=?, image=?, statut=?, auteur=?, date_publication=?,
        meta_title=?, meta_description=?, meta_keywords=?, og_image=?, canonical_url=?, temps_lecture=?
      WHERE id=?
    `, [...baseParams, id]);
    revalidatePath(`/admin/articles/${id}`);
    revalidatePath('/admin/articles');
    return NextResponse.json({ ok: true });
  }
}

/** PATCH — mise à jour partielle (statut uniquement pour l'instant) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const body = await req.json();
  const ALLOWED_STATUTS = ['publie', 'brouillon', 'programme'];
  if (body.statut && ALLOWED_STATUTS.includes(body.statut)) {
    await execute('UPDATE articles SET statut = ? WHERE id = ?', [body.statut, id]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  await execute('DELETE FROM articles WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
