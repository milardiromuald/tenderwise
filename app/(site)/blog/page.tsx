export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { query } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Actualités & Conseils Immobiliers',
  description: 'Blog TenderWise : actualités AMO, décret tertiaire, réhabilitation, facility management et conseils en gestion de patrimoine immobilier par nos experts.',
  alternates: { canonical: 'https://www.tenderwise.fr/blog' },
  openGraph: {
    type: 'website',
    url: 'https://www.tenderwise.fr/blog',
    title: 'Actualités & Conseils Immobiliers — TenderWise',
    description: 'Décryptages, guides et conseils d\'experts sur l\'AMO, le facility management et la réhabilitation immobilière.',
  },
};
import Link from 'next/link';
import Image from 'next/image';

interface Article {
  id: number;
  titre: string;
  slug: string;
  extrait: string;
  categorie: string;
  image: string;
  date_publication: string;
  auteur: string;
  temps_lecture: number;
  is_featured: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

const FALLBACK =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80';

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;

  let allArticles: Article[];
  try {
    allArticles = await query<Article>(`
      SELECT id, titre, slug, extrait, categorie, image, date_publication, auteur, temps_lecture,
             COALESCE(is_featured, 0) as is_featured
      FROM articles
      WHERE statut = 'publie' OR (statut = 'programme' AND date_publication <= NOW())
      ORDER BY is_featured DESC, date_publication DESC
    `);
  } catch (err: unknown) {
    // Colonne is_featured absente — migration SQL non encore exécutée
    if ((err as { code?: string }).code !== 'ER_BAD_FIELD_ERROR') throw err;
    const rows = await query<Omit<Article, 'is_featured'>>(`
      SELECT id, titre, slug, extrait, categorie, image, date_publication, auteur, temps_lecture
      FROM articles
      WHERE statut = 'publie'
      ORDER BY date_publication DESC
    `);
    allArticles = rows.map((r) => ({ ...r, is_featured: 0 }));
  }

  // Categories with counts — gère les catégories multiples séparées par virgule
  const splitCats = (raw?: string | null): string[] =>
    raw ? raw.split(',').map(c => c.trim()).filter(Boolean) : [];

  const catCounts = allArticles.reduce<Record<string, number>>((acc, a) => {
    splitCats(a.categorie).forEach(c => { acc[c] = (acc[c] || 0) + 1; });
    return acc;
  }, {});
  const categories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  // Filter by category
  const articles = cat
    ? allArticles.filter((a) => splitCats(a.categorie).includes(cat))
    : allArticles;

  // Featured = most recent when no filter, else first in filtered
  const featured = articles[0] ?? null;
  const rest = articles.slice(1);

  // Sidebar recent: 5 most recent by date (independent of pin order)
  const recentSidebar = [...allArticles]
    .sort((a, b) => new Date(String(b.date_publication)).getTime() - new Date(String(a.date_publication)).getTime())
    .slice(0, 5);

  return (
    <>
      <style>{`
        /* ── Featured ──────────────────────────────── */
        .blog-featured { transition: box-shadow 0.3s; }
        .blog-featured:hover { box-shadow: 0 20px 50px rgba(0,0,0,0.18) !important; }
        .blog-featured:hover .bf-img { transform: scale(1.03); }
        .bf-img { transition: transform 0.6s ease; }

        /* ── Cards ─────────────────────────────────── */
        .blog-card-new { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
        .blog-card-new:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 40px rgba(0,74,153,0.12) !important;
          border-top-color: var(--site-gold) !important;
        }
        .blog-card-new:hover .bc-img { transform: scale(1.06); }
        .bc-img { transition: transform 0.5s ease; }
        .blog-card-new:hover .bc-read { color: var(--site-gold) !important; }

        /* ── Sidebar ───────────────────────────────── */
        .sb-recent:hover { background: var(--site-blue-light) !important; }
        .cat-pill:hover { background: var(--site-blue) !important; color: white !important; }
        .cat-pill.active { background: var(--site-blue) !important; color: white !important; }

        /* ── Responsive ────────────────────────────── */
        @media (max-width: 1024px) {
          .blog-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 768px) {
          .blog-layout { grid-template-columns: 1fr !important; }
          .blog-featured-inner { grid-template-columns: 1fr !important; }
          .blog-featured-img { height: 260px !important; }
          .blog-grid { grid-template-columns: 1fr !important; }
          .blog-sidebar { display: none !important; }
        }
      `}</style>

      <div style={{ background: 'var(--site-light)', minHeight: '70vh' }}>

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, var(--site-blue-dark) 0%, var(--site-blue) 100%)',
          padding: '2rem 0',
        }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '3px', height: '32px', background: 'var(--site-gold)', borderRadius: '2px', flexShrink: 0 }} />
              <div>
                <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4rem', color: 'white', margin: 0, fontWeight: 800, lineHeight: 1.2 }}>
                  Actualités & Expertise
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', margin: 0, marginTop: '2px' }}>
                  {allArticles.length} publication{allArticles.length > 1 ? 's' : ''} · {categories.length} thématique{categories.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Link href="/" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Retour au site
            </Link>
          </div>
        </div>

        {/* ── Category filter bar ─────────────────────────────────────── */}
        {categories.length > 0 && (
          <div style={{ background: 'white', borderBottom: '1px solid var(--site-border)', position: 'sticky', top: 'var(--header-height)', zIndex: 100 }}>
            <div className="container">
              <div style={{ display: 'flex', gap: '8px', padding: '0.85rem 0', overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap', alignItems: 'center' }}>
                <Link
                  href="/blog"
                  className={`cat-pill${!cat ? ' active' : ''}`}
                  style={{
                    padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700,
                    textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                    background: !cat ? 'var(--site-blue)' : '#f3f4f6',
                    color: !cat ? 'white' : 'var(--site-text)',
                    border: '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  Tous ({allArticles.length})
                </Link>
                {categories.map(([name, count]) => (
                  <Link
                    key={name}
                    href={`/blog?cat=${encodeURIComponent(name)}`}
                    className={`cat-pill${cat === name ? ' active' : ''}`}
                    style={{
                      padding: '6px 16px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 600,
                      textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                      background: cat === name ? 'var(--site-blue)' : '#f3f4f6',
                      color: cat === name ? 'white' : 'var(--site-text)',
                      border: '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {name} ({count})
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="container" style={{ padding: '3rem 0 5rem' }}>

          {articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--site-border)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
              <p style={{ color: 'var(--site-text)', fontSize: '1.1rem' }}>
                Aucun article dans cette catégorie.{' '}
                <Link href="/blog" style={{ color: 'var(--site-blue)', fontWeight: 600 }}>Voir tout →</Link>
              </p>
            </div>
          ) : (
            <div className="blog-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '3rem', alignItems: 'start' }}>

              {/* ── LEFT COLUMN ─────────────────────────────────────── */}
              <div>

                {/* ── FEATURED ARTICLE ──────────────────────────────── */}
                {featured && (
                  <Link href={`/blog/${featured.slug}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '2.5rem' }}>
                    <article
                      className="blog-featured"
                      style={{
                        borderRadius: '16px', overflow: 'hidden',
                        background: 'var(--site-blue-dark)',
                        boxShadow: '0 8px 32px rgba(0,51,102,0.2)',
                        position: 'relative',
                      }}
                    >
                      <div
                        className="blog-featured-inner"
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '400px' }}
                      >
                        {/* Text side */}
                        <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 1 }}>
                          <div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                              <span style={{ background: 'var(--site-gold)', color: 'white', fontSize: '0.7rem', fontWeight: 800, padding: '4px 12px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                À la une
                              </span>
                              {splitCats(featured.categorie).map(c => (
                                <span key={c} style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {c}
                                </span>
                              ))}
                            </div>

                            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.35rem, 2.5vw, 1.85rem)', color: 'white', lineHeight: 1.3, margin: '0 0 1rem', fontWeight: 800 }}>
                              {featured.titre}
                            </h2>

                            {featured.extrait && (
                              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                                {featured.extrait}
                              </p>
                            )}
                          </div>

                          <div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--site-gold)', fontWeight: 600 }}>
                                {formatDate(featured.date_publication)}
                              </span>
                              {featured.auteur && (
                                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
                                  Par {featured.auteur}
                                </span>
                              )}
                              {featured.temps_lecture > 0 && (
                                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  {featured.temps_lecture} min
                                </span>
                              )}
                            </div>

                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '8px',
                              background: 'var(--site-gold)', color: 'white',
                              padding: '11px 24px', borderRadius: '6px',
                              fontSize: '0.88rem', fontWeight: 700,
                              fontFamily: 'Montserrat, sans-serif',
                            }}>
                              Lire l&apos;article
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            </span>
                          </div>
                        </div>

                        {/* Image side */}
                        <div className="blog-featured-img" style={{ position: 'relative', overflow: 'hidden', minHeight: '340px' }}>
                          <Image
                            src={featured.image || FALLBACK}
                            alt={featured.titre}
                            fill
                            priority
                            sizes="(max-width: 900px) 100vw, 620px"
                            className="bf-img"
                            style={{ objectFit: 'cover' }}
                          />
                          {/* Left gradient blend */}
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, var(--site-blue-dark) 0%, transparent 40%)' }} />
                        </div>
                      </div>
                    </article>
                  </Link>
                )}

                {/* ── REST OF ARTICLES ──────────────────────────────── */}
                {rest.length > 0 && (
                  <>
                    {!cat && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.75rem' }}>
                        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--site-blue-dark)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Toutes les publications
                        </h2>
                        <div style={{ flex: 1, height: '1px', background: 'var(--site-border)' }} />
                      </div>
                    )}

                    <div
                      className="blog-grid"
                      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}
                    >
                      {rest.map((article) => (
                        <Link
                          key={article.id}
                          href={`/blog/${article.slug}`}
                          style={{ textDecoration: 'none', display: 'block' }}
                        >
                          <article
                            className="blog-card-new"
                            style={{
                              background: 'white',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              border: '1px solid var(--site-border)',
                              borderTop: '3px solid var(--site-border)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            {/* Image */}
                            <div style={{ position: 'relative', height: '180px', overflow: 'hidden', background: 'var(--site-blue-light)', flexShrink: 0 }}>
                              <Image
                                src={article.image || FALLBACK}
                                alt={article.titre}
                                fill
                                sizes="(max-width: 768px) 100vw, 430px"
                                className="bc-img"
                                style={{ objectFit: 'cover' }}
                              />
                              {splitCats(article.categorie).length > 0 && (
                                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {splitCats(article.categorie).map(c => (
                                    <span key={c} style={{ background: 'var(--site-blue)', color: 'white', fontSize: '0.67rem', fontWeight: 800, padding: '3px 10px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {article.temps_lecture > 0 && (
                                <span style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '0.68rem', fontWeight: 600, padding: '3px 8px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  {article.temps_lecture} min
                                </span>
                              )}
                            </div>

                            {/* Content */}
                            <div style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                              <div style={{ fontSize: '0.73rem', color: 'var(--site-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>
                                {formatDateShort(article.date_publication)}
                              </div>

                              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.97rem', color: 'var(--site-blue-dark)', margin: '0 0 0.5rem', lineHeight: 1.4, fontWeight: 700, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                                {article.titre}
                              </h3>

                              {article.extrait && (
                                <p style={{ color: 'var(--site-text)', fontSize: '0.83rem', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 auto' } as React.CSSProperties}>
                                  {article.extrait}
                                </p>
                              )}

                              {/* Footer */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--site-border)' }}>
                                {article.auteur ? (
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                                    {article.auteur}
                                  </span>
                                ) : <span />}
                                <span className="bc-read" style={{ fontSize: '0.78rem', color: 'var(--site-blue)', fontWeight: 700, whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
                                  Lire →
                                </span>
                              </div>
                            </div>
                          </article>
                        </Link>
                      ))}
                    </div>
                  </>
                )}

                {/* If filtered and only 1 result (the featured) */}
                {cat && rest.length === 0 && featured && (
                  <p style={{ color: 'var(--site-text)', fontSize: '0.9rem', marginTop: '1rem' }}>
                    Seul cet article correspond à cette thématique.{' '}
                    <Link href="/blog" style={{ color: 'var(--site-blue)', fontWeight: 600 }}>Voir tout →</Link>
                  </p>
                )}
              </div>

              {/* ── SIDEBAR ─────────────────────────────────────────── */}
              <aside className="blog-sidebar" style={{ position: 'sticky', top: 'calc(var(--header-height) + 64px)' }}>

                {/* Categories */}
                {categories.length > 0 && (
                  <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--site-border)', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.82rem', fontWeight: 800, color: 'var(--site-blue-dark)', margin: '0 0 1.1rem', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                      Thématiques
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Link
                        href="/blog"
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', borderRadius: '8px',
                          textDecoration: 'none', fontSize: '0.87rem', fontWeight: !cat ? 700 : 500,
                          background: !cat ? 'var(--site-blue-light)' : 'transparent',
                          color: !cat ? 'var(--site-blue)' : 'var(--site-text)',
                          transition: 'background 0.15s',
                        }}
                        className="sb-recent"
                      >
                        <span>Toutes</span>
                        <span style={{ background: !cat ? 'var(--site-blue)' : '#e2e8f0', color: !cat ? 'white' : '#64748b', padding: '2px 7px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {allArticles.length}
                        </span>
                      </Link>
                      {categories.map(([name, count]) => (
                        <Link
                          key={name}
                          href={`/blog?cat=${encodeURIComponent(name)}`}
                          className="sb-recent"
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 12px', borderRadius: '8px',
                            textDecoration: 'none', fontSize: '0.87rem', fontWeight: cat === name ? 700 : 500,
                            background: cat === name ? 'var(--site-blue-light)' : 'transparent',
                            color: cat === name ? 'var(--site-blue)' : 'var(--site-text)',
                            transition: 'background 0.15s',
                          }}
                        >
                          <span>{name}</span>
                          <span style={{ background: cat === name ? 'var(--site-blue)' : '#e2e8f0', color: cat === name ? 'white' : '#64748b', padding: '2px 7px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700 }}>
                            {count}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent articles */}
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--site-border)', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.82rem', fontWeight: 800, color: 'var(--site-blue-dark)', margin: '0 0 1.1rem', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Publications récentes
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {recentSidebar.map((a, i) => (
                      <Link
                        key={a.id}
                        href={`/blog/${a.slug}`}
                        className="sb-recent"
                        style={{
                          display: 'flex', gap: '10px', alignItems: 'flex-start',
                          padding: '10px 8px', borderRadius: '8px',
                          textDecoration: 'none', transition: 'background 0.15s',
                          borderBottom: i < recentSidebar.length - 1 ? '1px solid var(--site-border)' : 'none',
                        }}
                      >
                        {/* Thumbnail */}
                        <div style={{ width: '52px', height: '40px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'var(--site-blue-light)' }}>
                          <Image
                            src={a.image || FALLBACK}
                            alt=""
                            width={52}
                            height={40}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--site-blue-dark)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                            {a.titre}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                            {formatDateShort(a.date_publication)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* CTA Expert */}
                <div style={{ background: 'linear-gradient(135deg, var(--site-blue-dark) 0%, var(--site-blue) 100%)', borderRadius: '12px', padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(197,160,89,0.15)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '40px', height: '40px', background: 'var(--site-gold)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    </div>
                    <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', color: 'white', margin: '0 0 0.6rem', fontWeight: 800 }}>
                      Besoin d&apos;un conseil expert ?
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.83rem', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
                      Nos équipes répondent à vos questions sur vos projets immobiliers et appels d&apos;offres.
                    </p>
                    <Link
                      href="/contact"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'var(--site-gold)', color: 'white',
                        padding: '10px 20px', borderRadius: '7px',
                        fontSize: '0.85rem', fontWeight: 700,
                        textDecoration: 'none', fontFamily: 'Montserrat, sans-serif',
                      }}
                    >
                      Nous contacter
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </Link>
                  </div>
                </div>

              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
