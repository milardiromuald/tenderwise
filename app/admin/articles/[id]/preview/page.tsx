import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { queryOne } from '@/lib/db';
import PreviewTopBar from '@/app/admin/PreviewTopBar';

interface Article {
  id: number;
  titre: string;
  slug: string;
  extrait: string;
  contenu: string;
  categorie: string;
  image: string;
  statut: string;
  auteur: string;
  date_publication: string;
  meta_title: string;
  meta_description: string;
  temps_lecture: number;
}

function formatDate(d: string) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  publie:     { text: 'Publié',     bg: '#d1fae5', color: '#065f46' },
  brouillon:  { text: 'Brouillon',  bg: '#f3f4f6', color: '#6b7280' },
  programme:  { text: 'Programmé',  bg: '#fef3c7', color: '#92400e' },
};

export default async function ArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { id } = await params;
  const article = await queryOne<Article>('SELECT * FROM articles WHERE id = ?', [id]);
  if (!article) notFound();

  const status = STATUS_LABEL[article.statut] ?? STATUS_LABEL.brouillon;

  return (
    <>

      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

        {/* Barre d’outils admin */}
        <PreviewTopBar
          backHref="/admin/articles"
          backLabel="Mes articles"
          title={article.titre}
          status={status}
          action={{ type: 'link', href: `/admin/articles/${article.id}`, label: 'Modifier' }}
          showNotifications={session.user.role === 'admin'}
        />

        {/* Contenu */}
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

          {/* Image de couverture */}
          {article.image && (
            <div style={{ marginBottom: '2rem', borderRadius: 12, overflow: 'hidden', maxHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
              <img src={article.image} alt={article.titre} style={{ width: '100%', objectFit: 'cover', maxHeight: 420, display: 'block' }} />
            </div>
          )}

          {/* Méta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {article.categorie && (
              <span style={{ padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                {article.categorie}
              </span>
            )}
            {article.date_publication && (
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{formatDate(article.date_publication)}</span>
            )}
            {article.temps_lecture > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>· {article.temps_lecture} min de lecture</span>
            )}
            {article.auteur && (
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>· par {article.auteur}</span>
            )}
          </div>

          {/* Titre */}
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.25, margin: '0 0 1rem' }}>
            {article.titre}
          </h1>

          {/* Extrait */}
          {article.extrait && (
            <p style={{ fontSize: '1.05rem', color: '#475569', lineHeight: 1.7, margin: '0 0 2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              {article.extrait}
            </p>
          )}

          {/* Corps */}
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: article.contenu || '<p style="color:#9ca3af;font-style:italic">Aucun contenu.</p>' }}
          />

          {/* Encadré SEO (discret) */}
          {(article.meta_title || article.meta_description) && (
            <div style={{ marginTop: '3rem', padding: '1rem 1.25rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                Aperçu SEO
              </div>
              {article.meta_title && (
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1a0dab', marginBottom: '3px' }}>{article.meta_title}</div>
              )}
              {article.meta_description && (
                <div style={{ fontSize: '0.8rem', color: '#545454', lineHeight: 1.5 }}>{article.meta_description}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
