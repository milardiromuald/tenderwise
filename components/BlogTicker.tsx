'use client';

import Link from 'next/link';
import Image from 'next/image';

interface Article {
  id: number;
  titre: string;
  slug: string;
  image: string;
  categorie: string;
  date_publication: string;
}

interface BlogTickerProps {
  articles: Article[];
  settings?: Record<string, string>;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogTicker({ articles, settings = {} }: BlogTickerProps) {
  const blogTitle = settings.blog_title || 'Dernières Actualités';

  const doubled = [...articles, ...articles]; // duplicate for infinite scroll

  if (!articles.length) return null;

  return (
    <section style={{ backgroundColor: '#f8fafc', padding: '5rem 0', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3.5rem', padding: '0 1rem' }}>
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', color: 'var(--site-blue-dark)', marginBottom: '1rem' }}>
          {blogTitle}
        </h2>
        <div style={{ display: 'block', width: '50px', height: '3px', background: 'var(--site-gold)', margin: '1rem auto 0', borderRadius: '2px' }} />
        <p style={{ color: 'var(--site-text)', marginTop: '1rem', fontSize: '1.1rem', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          Restez informé des dernières tendances et actualités du secteur immobilier.
        </p>
      </div>

      {/* Ticker */}
      <div
        className="ticker-wrapper"
        style={{
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          padding: '1rem 0 2rem',
        }}
      >
        <div className="ticker-track" style={{ display: 'flex', gap: '2rem', width: 'max-content', animation: 'tickerScroll 50s linear infinite' }}>
          {doubled.map((article, i) => (
            <Link
              key={`${article.id}-${i}`}
              href={`/blog/${article.slug}`}
              style={{
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                width: '300px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                textDecoration: 'none',
                overflow: 'hidden',
                border: '1px solid var(--site-border)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-8px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'var(--shadow-lg)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--site-gold)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'var(--shadow-sm)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--site-border)';
              }}
            >
              {/* Image */}
              <div style={{ position: 'relative', height: '180px', width: '100%', overflow: 'hidden', backgroundColor: 'var(--site-light)' }}>
                {article.image ? (
                  <Image
                    src={article.image}
                    alt={article.titre}
                    fill
                    sizes="(max-width: 768px) 85vw, 340px"
                    style={{ objectFit: 'cover', transition: 'transform 0.6s ease' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--site-border)', fontSize: '2.5rem', background: 'var(--site-light)' }}>TW</div>
                )}
                {article.categorie && (
                  <span style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: 'rgba(255,255,255,0.95)',
                    color: 'var(--site-blue-dark)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize: '0.7rem', fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '5px 10px', borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderBottom: '2px solid var(--site-gold)',
                  }}>
                    {article.categorie}
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--site-gold)', fontWeight: 700, marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {formatDate(article.date_publication)}
                </span>
                <h3 style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '1.1rem', fontWeight: 700,
                  color: 'var(--site-blue-dark)',
                  lineHeight: 1.4, margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  transition: 'color 0.3s',
                } as React.CSSProperties}>
                  {article.titre}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Link
          href="/blog"
          style={{
            display: 'inline-block',
            padding: '0.9rem 2.5rem',
            border: '2px solid var(--site-blue)',
            borderRadius: '50px',
            color: 'var(--site-blue)',
            fontWeight: 700,
            fontSize: '0.95rem',
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'var(--site-blue)';
            (e.currentTarget as HTMLAnchorElement).style.color = 'white';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--site-blue)';
          }}
        >
          Voir toutes les actualités →
        </Link>
      </div>

      <style>{`
        .ticker-wrapper:hover .ticker-track {
          animation-play-state: paused !important;
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
