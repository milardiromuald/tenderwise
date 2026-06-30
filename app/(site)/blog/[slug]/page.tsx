export const dynamic = 'force-dynamic';

import { query, queryOne } from '@/lib/db';
import { getAllSettings } from '@/lib/settings';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Article {
  id: number; titre: string; slug: string; extrait: string; contenu: string;
  categorie: string; image: string; date_publication: string; auteur: string;
  author_username?: string;
  meta_title?: string; meta_description?: string; meta_keywords?: string;
  og_image?: string; canonical_url?: string; temps_lecture?: number;
}

interface UserProfile {
  display_name: string | null; bio_title: string | null; bio: string | null;
  avatar_url: string | null; linkedin_url: string | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await queryOne<Article>(
    "SELECT * FROM articles WHERE slug = ? AND (statut = 'publie' OR (statut = 'programme' AND date_publication <= NOW()))",
    [slug]
  );
  if (!a) return {};
  const title = a.meta_title || a.titre;
  const description = a.meta_description || a.extrait || '';
  const SITE = 'https://www.tenderwise.fr';
  const rawImage = a.og_image || a.image || '';
  // Force absolute URL — LinkedIn requires a fully-qualified URL for the banner format
  const ogImage = rawImage
    ? (rawImage.startsWith('http') ? rawImage : `${SITE}${rawImage}`)
    : '';
  const ogImages = ogImage
    ? [{ url: ogImage, secureUrl: ogImage, width: 1200, height: 630, alt: title }]
    : [];
  const articleUrl = `${SITE}/blog/${a.slug}`;
  return {
    title, description,
    keywords: a.meta_keywords || '',
    alternates: { canonical: a.canonical_url || articleUrl },
    openGraph: {
      title, description,
      url: articleUrl,
      images: ogImages,
      type: 'article',
      locale: 'fr_FR',
      siteName: 'TenderWise',
    },
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const article = await queryOne<Article>(
    "SELECT * FROM articles WHERE slug = ? AND (statut = 'publie' OR (statut = 'programme' AND date_publication <= NOW()))",
    [slug]
  );
  if (!article) notFound();

  const related = await query<Article>(`
    SELECT id, titre, slug, extrait, categorie, image, date_publication
    FROM articles
    WHERE (statut = 'publie' OR (statut = 'programme' AND date_publication <= NOW())) AND id != ?
    ORDER BY date_publication DESC
    LIMIT 3
  `, [article.id]);

  // Fetch author profile: from users table if author_username set, else fall back to global settings
  let authorProfile: UserProfile | null = null;
  if (article.author_username) {
    authorProfile = await queryOne<UserProfile>(
      'SELECT display_name, bio_title, bio, avatar_url, linkedin_url FROM users WHERE username = ? LIMIT 1',
      [article.author_username]
    ).catch(() => null);
  }

  const settings = await getAllSettings();
  const authorName     = authorProfile?.display_name || settings.admin_display_name || article.auteur || 'TenderWise';
  const authorBioTitle = authorProfile?.bio_title    || settings.admin_bio_title    || '';
  const authorBio      = authorProfile?.bio          || settings.admin_bio          || '';
  const authorAvatar   = authorProfile?.avatar_url   || settings.admin_avatar_url   || '';
  const authorLinkedin = authorProfile?.linkedin_url || settings.social_linkedin    || '';

  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://www.tenderwise.fr/blog/${article.slug}`)}`;

  const articleUrl = `https://www.tenderwise.fr/blog/${article.slug}`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: article.titre,
        description: article.extrait || '',
        image: article.image ? (article.image.startsWith('http') ? article.image : `https://www.tenderwise.fr${article.image}`) : undefined,
        datePublished: article.date_publication,
        author: { '@type': 'Person', name: authorName },
        publisher: {
          '@type': 'Organization',
          name: 'TenderWise',
          url: 'https://www.tenderwise.fr',
          logo: { '@type': 'ImageObject', url: 'https://www.tenderwise.fr/og-image.png' },
        },
        url: articleUrl,
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.tenderwise.fr/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.tenderwise.fr/blog' },
          { '@type': 'ListItem', position: 3, name: article.titre, item: articleUrl },
        ],
      },
    ],
  };

  return (
    <div style={{ backgroundColor: 'var(--site-light)', padding: '4rem 0', minHeight: '70vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '3rem', alignItems: 'start' }}>
          <article>
            <nav style={{ marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--site-text)' }}>
              <Link href="/" style={{ color: 'var(--site-blue)', textDecoration: 'none' }}>Accueil</Link>
              <span style={{ margin: '0 0.5rem', color: 'var(--site-border)' }}>›</span>
              <Link href="/blog" style={{ color: 'var(--site-blue)', textDecoration: 'none' }}>Blog</Link>
              <span style={{ margin: '0 0.5rem', color: 'var(--site-border)' }}>›</span>
              <span style={{ color: 'var(--site-text)' }}>{article.titre}</span>
            </nav>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {article.categorie && <span style={{ background: 'var(--site-blue)', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '4px', textTransform: 'uppercase' }}>{article.categorie}</span>}
              <span style={{ fontSize: '0.85rem', color: 'var(--site-gold)', fontWeight: 600 }}>{formatDate(article.date_publication)}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                {authorAvatar ? (
                  <Image src={authorAvatar} alt={authorName} width={34} height={34} style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.14)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #003366, #004a99)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0, border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.14)' }}>
                    {authorName[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--site-blue-dark)' }}>Par {authorName}</span>
                    {authorBioTitle && (
                      <span style={{ background: '#EBF3FA', color: '#003865', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                        {authorBioTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {article.temps_lecture && article.temps_lecture > 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--site-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {article.temps_lecture} min de lecture
                </span>
              ) : null}
            </div>
            <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: 'var(--site-blue-dark)', lineHeight: 1.2, marginBottom: '1.5rem' }}>{article.titre}</h1>
            {article.image && (
              <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '2.5rem', boxShadow: 'var(--shadow-md)' }}>
                <Image src={article.image} alt={article.titre} width={1200} height={420} priority sizes="(max-width: 900px) 100vw, 800px" style={{ width: '100%', height: '420px', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            {article.extrait && (
              <p style={{ fontSize: '1.15rem', color: 'var(--site-text)', lineHeight: 1.7, fontStyle: 'italic', borderLeft: '4px solid var(--site-gold)', paddingLeft: '1.5rem', marginBottom: '2rem', background: 'white', padding: '1.25rem 1.5rem', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
                {article.extrait}
              </p>
            )}
            <div className="article-content" style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '2.5rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--site-border)' }}
              dangerouslySetInnerHTML={{ __html: article.contenu || '' }} />
            {/* ── Carte bio auteur ─────────────────────────────── */}
            {(authorBio || authorAvatar) && (
              <div style={{ marginTop: '2.5rem', background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', padding: '2rem', display: 'flex', gap: '1.75rem', alignItems: 'flex-start' }} className="author-card">
                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {authorAvatar ? (
                    <Image src={authorAvatar} alt={authorName} width={96} height={96} style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 14px rgba(0,0,0,0.12)', display: 'block' }} />
                  ) : (
                    <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(135deg, #003366, #004a99)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2.2rem', fontWeight: 700, border: '4px solid white', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
                      {authorName[0].toUpperCase()}
                    </div>
                  )}
                  {/* Badge doré vérifié */}
                  <div style={{ position: 'absolute', bottom: '4px', right: '4px', width: '24px', height: '24px', background: 'var(--site-gold)', borderRadius: '50%', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>

                {/* Contenu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.25rem', fontWeight: 800, color: 'var(--site-blue-dark)', margin: 0 }}>
                      {authorName}
                    </h3>
                    {authorBioTitle && (
                      <span style={{ background: '#EBF3FA', color: '#003865', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', letterSpacing: '0.04em' }}>
                        {authorBioTitle}
                      </span>
                    )}
                  </div>
                  {authorBio && (
                    <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                      {authorBio}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    <Link href="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--site-gold)', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
                      Voir tous les articles
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </Link>
                    {authorLinkedin && (
                      <a href={authorLinkedin} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#94a3b8', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500 }} title="LinkedIn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--site-blue-dark)', fontSize: '0.95rem' }}>Partager :</span>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#0a66c2', color: 'white', borderRadius: '6px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            </div>
            <div style={{ marginTop: '2rem' }}>
              <Link href="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--site-blue)', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem' }}>← Retour aux articles</Link>
            </div>
          </article>
          <aside>
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--site-border)', position: 'sticky', top: 'calc(var(--header-height) + 2rem)' }}>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', color: 'var(--site-blue-dark)', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--site-gold)' }}>Articles récents</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {related.map((r) => (
                  <Link key={r.id} href={`/blog/${r.slug}`} style={{ textDecoration: 'none', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      {r.image ? <Image src={r.image} alt={r.titre} width={70} height={70} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--site-light)', fontSize: '0.7rem', color: 'var(--site-text)', fontWeight: 700 }}>TW</div>}
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--site-gold)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{formatDate(r.date_publication)}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--site-blue-dark)', fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{r.titre}</span>
                    </div>
                  </Link>
                ))}
              </div>
              <Link href="/blog" style={{ display: 'block', marginTop: '1.5rem', textAlign: 'center', padding: '10px', background: 'var(--site-light)', color: 'var(--site-blue)', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', border: '1px solid var(--site-border)' }}>Tous les articles →</Link>
            </div>
          </aside>
        </div>
      </div>
      <style>{`.linkedin-share-btn:hover { opacity: 0.85; } @media (max-width: 900px) { div[style*="grid-template-columns: 1fr 340px"] { grid-template-columns: 1fr !important; } aside { display: none; } } @media (max-width: 600px) { .author-card { flex-direction: column !important; align-items: center !important; text-align: center !important; } .author-card h3 { justify-content: center; } .author-card > div:last-child > div:last-child { flex-direction: column !important; align-items: center !important; } }`}</style>
    </div>
  );
}
