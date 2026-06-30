import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import Link from 'next/link';
import ArticleListClient from './ArticleListClient';

interface Article {
  id: number; titre: string; slug: string; categorie: string;
  statut: string; date_publication: string; meta_title: string;
  meta_description: string; temps_lecture: number; is_featured: number;
}

async function fetchArticles(search?: string): Promise<Article[]> {
  try {
    if (search) {
      const like = `%${search}%`;
      return await query<Article>(
        `SELECT id, titre, slug, categorie, statut, date_publication, meta_title, meta_description,
                temps_lecture, COALESCE(is_featured, 0) as is_featured
         FROM articles
         WHERE titre LIKE ? OR categorie LIKE ?
         ORDER BY id DESC`,
        [like, like],
      );
    }
    return await query<Article>(
      'SELECT id, titre, slug, categorie, statut, date_publication, meta_title, meta_description, temps_lecture, COALESCE(is_featured, 0) as is_featured FROM articles ORDER BY id DESC'
    );
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'ER_BAD_FIELD_ERROR') throw err;
    const rows = await query<Omit<Article, 'is_featured'>>(
      'SELECT id, titre, slug, categorie, statut, date_publication, meta_title, meta_description, temps_lecture FROM articles ORDER BY id DESC'
    );
    return rows.map((r) => ({ ...r, is_featured: 0 }));
  }
}

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const params  = await searchParams;
  const search  = params.q?.trim() || '';
  const articles = await fetchArticles(search || undefined);

  const published = articles.filter((a) => a.statut === 'publie').length;
  const drafts    = articles.filter((a) => a.statut === 'brouillon').length;
  const scheduled = articles.filter((a) => a.statut === 'programme').length;
  const featured  = articles.find((a) => a.is_featured);

  return (
    <div style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>Articles & Blog</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>● {published} publié{published !== 1 ? 's' : ''}</span>
            {scheduled > 0 && <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: 600 }}>⏰ {scheduled} programmé{scheduled !== 1 ? 's' : ''}</span>}
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>○ {drafts} brouillon{drafts !== 1 ? 's' : ''}</span>
            {featured && <span style={{ fontSize: '0.85rem', color: '#c5a059', fontWeight: 600 }}>📌 À la une : {featured.titre.slice(0, 30)}{featured.titre.length > 30 ? '…' : ''}</span>}
          </div>
        </div>
        <Link href="/admin/articles/new" style={{ padding: '12px 24px', background: '#004a99', color: 'white', borderRadius: '8px', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}>
          + Nouvel article
        </Link>
      </div>

      <ArticleListClient articles={articles} />
    </div>
  );
}
