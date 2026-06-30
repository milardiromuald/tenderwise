export const dynamic = 'force-dynamic';

import { queryOne } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ShareProject } from './ShareProject';

interface ProjectRow {
  id: number;
  slug: string;
  nom: string;
  sous_titre: string;
  annees: string;
  budget_fmt: string;
  client: string;
  categorie: string;
  type_etablissement: string;
  description: string;
  missions: string;
  images: string;
  statut: string;
}

async function findProject(slug: string): Promise<ProjectRow | null> {
  if (/^\d+$/.test(slug)) {
    const p = await queryOne<ProjectRow>(
      "SELECT * FROM projects WHERE id = ? AND statut != 'inactive'",
      [parseInt(slug, 10)]
    );
    return p || null;
  }
  return queryOne<ProjectRow>(
    "SELECT * FROM projects WHERE slug = ? AND statut != 'inactive'",
    [slug]
  );
}

function getBaseUrl(): string {
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
  return 'https://www.tenderwise.fr';
}

function absoluteUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

function parseImages(raw: string): string[] {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const p = await findProject(slug);
  if (!p) return {};

  const title = `${p.nom} — TenderWise`;
  const rawDesc = p.description || p.sous_titre ||
    `Projet AMO ${p.categorie ? `· ${p.categorie}` : ''}${p.client ? ` · ${p.client}` : ''} — TenderWise`;
  const description = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '…' : rawDesc;

  const images = parseImages(p.images);
  const ogImageUrl = images.length > 0 ? absoluteUrl(images[0]) : '';
  const pageSlug = p.slug || String(p.id);
  const pageUrl = `${getBaseUrl()}/realisations/${pageSlug}`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'TenderWise',
      locale: 'fr_FR',
      type: 'website',
      images: ogImageUrl
        ? [{ url: ogImageUrl, width: 1200, height: 630, alt: p.nom }]
        : [],
    },
  };
}

export default async function ProjectPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const p = await findProject(slug);
  if (!p) notFound();

  // Redirect numeric IDs to slug URL
  if (/^\d+$/.test(slug) && p.slug) redirect(`/realisations/${p.slug}`);

  const images = parseImages(p.images);
  const mainImage = images[0] || '';
  const missions = (p.missions || '')
    .split('\n')
    .map((m) => m.trim())
    .filter(Boolean);

  const stats = [
    { label: 'Client', value: p.client },
    { label: "Type d’établissement", value: p.type_etablissement },
    { label: 'Budget', value: p.budget_fmt },
    { label: 'Période', value: p.annees },
  ].filter((s) => s.value);

  const shareUrl = `${getBaseUrl()}/realisations/${p.slug || p.id}`;

  // ── Données structurées : CreativeWork (projet) + fil d'Ariane ─────────────
  const SITE = 'https://www.tenderwise.fr';
  const projectUrl = `${SITE}/realisations/${p.slug || p.id}`;
  const projectImage = mainImage
    ? (mainImage.startsWith('http') ? mainImage : `${SITE}${mainImage}`)
    : `${SITE}/og-image.png`;
  const projectSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        name: p.nom,
        description: p.description || p.sous_titre || `Projet AMO — ${p.nom}`,
        image: projectImage,
        url: projectUrl,
        creator: { '@type': 'Organization', name: 'TenderWise', url: SITE },
        ...(p.client ? { sourceOrganization: { '@type': 'Organization', name: p.client } } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Réalisations', item: `${SITE}/realisations` },
          { '@type': 'ListItem', position: 3, name: p.nom, item: projectUrl },
        ],
      },
    ],
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '80vh', paddingBottom: '5rem' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(projectSchema) }} />

      {/* Hero */}
      <div style={{ position: 'relative', height: '320px', background: '#0f172a', overflow: 'hidden' }}>
        {mainImage && (
          <Image
            src={mainImage}
            alt={p.nom}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', opacity: 0.38 }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.92), rgba(15,23,42,0.25))' }} />
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '2.5rem' }}>
          <Link href="/realisations"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none', marginBottom: '14px', letterSpacing: '0.04em' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Tous les projets
          </Link>
          {p.categorie && (
            <span style={{ display: 'inline-block', background: 'var(--site-blue)', color: 'white', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: '8px', marginBottom: '12px', width: 'fit-content' }}>
              {p.categorie}
            </span>
          )}
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: 'white', lineHeight: 1.1, letterSpacing: '-0.5px', margin: 0 }}>
            {p.nom}
          </h1>
          {p.sous_titre && (
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', marginTop: '8px', fontWeight: 500 }}>{p.sous_titre}</p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats.length > 0 && (
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 1.5rem' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {stats.map((s) => (
              <div key={s.label}>
                <p style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{s.label}</p>
                <span style={{ color: 'var(--site-blue-dark)', fontWeight: 700, fontSize: '0.875rem' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' }}>

        {/* Left: gallery + description + missions */}
        <div>
          {/* Gallery */}
          {images.length > 0 && (
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ width: '100%', borderRadius: '20px', overflow: 'hidden', background: '#e2e8f0', marginBottom: '10px' }}>
                <Image
                  src={mainImage}
                  alt={p.nom}
                  width={1100}
                  height={420}
                  sizes="(max-width: 900px) 100vw, 760px"
                  style={{ width: '100%', height: 'auto', maxHeight: '420px', objectFit: 'cover', display: 'block' }}
                />
              </div>
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <Image key={i} src={img} alt="" width={80} height={60} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: i === 0 ? '2px solid var(--site-blue)' : '2px solid transparent', opacity: i === 0 ? 1 : 0.65 }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {p.description && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px 28px', marginBottom: '2rem', borderLeft: '4px solid var(--site-blue)', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.8, fontStyle: 'italic', margin: 0 }}>{p.description}</p>
            </div>
          )}

          {/* Missions */}
          {missions.length > 0 && (
            <div style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.875rem', fontWeight: 800, color: 'var(--site-blue-dark)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '34px', height: '34px', background: 'rgba(0,74,153,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--site-blue)" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                </span>
                Missions réalisées
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }} className="proj-missions-grid">
                {missions.map((m, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.8125rem', fontWeight: 500 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <circle cx="12" cy="12" r="10" fill="rgba(0,74,153,0.1)"/>
                      <polyline points="8 12 11 15 16 9" stroke="var(--site-blue)" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* CTA */}
          <div style={{ background: 'var(--site-blue-dark)', borderRadius: '20px', padding: '28px 22px', color: 'white', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-24px', right: '-24px', width: '100px', height: '100px', background: 'rgba(0,74,153,0.35)', borderRadius: '50%', filter: 'blur(30px)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '10px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Client</p>
              <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '20px' }}>{p.client || 'Confidentiel'}</p>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>Un projet similaire ?</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '18px' }}>
                Déléguez la gestion de votre opération à nos experts pour sécuriser délais et budgets.
              </p>
              <a href="mailto:r.milardi@tenderwise.fr?subject=Étude de projet"
                style={{ display: 'block', width: '100%', background: 'var(--site-blue)', color: 'white', textAlign: 'center', fontWeight: 700, padding: '13px', borderRadius: '10px', textDecoration: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                Étudier mon projet →
              </a>
            </div>
          </div>

          {/* Share */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px', textAlign: 'center' }}>
              Partager cette étude de cas
            </p>
            <ShareProject shareUrl={shareUrl} titre={p.nom} />
          </div>

          {/* Back */}
          <Link href="/realisations"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '13px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#475569', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', textAlign: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Voir tous les projets
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 300px"] { grid-template-columns: 1fr !important; }
          .proj-missions-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

