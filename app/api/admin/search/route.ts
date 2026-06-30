import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

interface SearchResult {
  type: 'article' | 'message' | 'application' | 'project';
  id: number;
  title: string;
  sub: string;
  href: string;
}

const PER_TYPE_LIMIT = 5;

/**
 * Recherche unifiée admin (articles, messages de contact, candidatures, projets).
 * Chaque section avait déjà sa propre recherche locale (articles) — aucun moyen
 * de chercher à travers tout le contenu en une fois.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const like = `%${q}%`;
  const results: SearchResult[] = [];

  const tasks: Promise<void>[] = [
    query<{ id: number; titre: string; statut: string }>(
      'SELECT id, titre, statut FROM articles WHERE titre LIKE ? ORDER BY id DESC LIMIT ?',
      [like, PER_TYPE_LIMIT],
    ).then((rows) => {
      for (const r of rows) {
        results.push({ type: 'article', id: r.id, title: r.titre, sub: `Article · ${r.statut}`, href: `/admin/articles/${r.id}` });
      }
    }).catch(() => {}),

    query<{ id: number; nom: string; objet: string }>(
      'SELECT id, nom, objet FROM contact_messages WHERE nom LIKE ? OR email LIKE ? OR objet LIKE ? ORDER BY id DESC LIMIT ?',
      [like, like, like, PER_TYPE_LIMIT],
    ).then((rows) => {
      for (const r of rows) {
        results.push({ type: 'message', id: r.id, title: r.nom, sub: `Message · ${r.objet}`, href: '/admin/contact' });
      }
    }).catch(() => {}),

    query<{ id: number; nom: string; prenom: string; job_title: string | null }>(
      'SELECT id, nom, prenom, job_title FROM job_applications WHERE nom LIKE ? OR prenom LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT ?',
      [like, like, like, PER_TYPE_LIMIT],
    ).then((rows) => {
      for (const r of rows) {
        results.push({ type: 'application', id: r.id, title: `${r.prenom} ${r.nom}`, sub: `Candidature · ${r.job_title || 'Spontanée'}`, href: '/admin/applications' });
      }
    }).catch(() => {}),

    query<{ id: number; nom: string; slug: string; statut: string }>(
      'SELECT id, nom, slug, statut FROM projects WHERE nom LIKE ? ORDER BY id DESC LIMIT ?',
      [like, PER_TYPE_LIMIT],
    ).then((rows) => {
      for (const r of rows) {
        results.push({ type: 'project', id: r.id, title: r.nom, sub: `Réalisation · ${r.statut}`, href: `/admin/projects/${r.id}` });
      }
    }).catch(() => {}),
  ];

  await Promise.all(tasks);

  return NextResponse.json({ results });
}
