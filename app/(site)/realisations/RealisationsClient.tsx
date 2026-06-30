'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';

interface Project {
  id: number;
  slug: string;
  titre: string;
  meta: string;
  categorie: string;
  pills: string[];
  desc: string;
  images: string[];
  client: string;
  typeEtab: string;
  annees: string;
  budget: string;
  missions: string[];
  statut?: string;
}

interface RealisationsClientProps {
  projects: Project[];
}

const CURRENT_YEAR = 2026;

function parseEndYear(annees: string): number | null {
  if (!annees) return null;
  const nums = annees.match(/\d{4}/g);
  if (!nums) return null;
  return parseInt(nums[nums.length - 1]);
}

function isEnCours(p: Project): boolean {
  // Le champ statut de l’admin est la source de vérité
  if (p.statut === 'en_cours') return true;
  if (p.statut === 'active') return false;
  // Fallback : détection par l’année de fin si statut non reconnu
  const a = (p.annees || '').toLowerCase();
  if (!a || a.includes('cours') || a.includes('depuis')) return true;
  const end = parseEndYear(p.annees);
  if (end === null) return true;
  return end >= CURRENT_YEAR;
}

function sortByEndYear(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const ay = parseEndYear(a.annees) ?? 9999;
    const by = parseEndYear(b.annees) ?? 9999;
    return by - ay;
  });
}

/* ─── Quick-share utils ─── */
function shareLinkedIn(url: string) {
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, 'li_share', 'width=700,height=600');
}

/* ─── Share buttons ─── */
function ShareButtons({ url, titre: _titre, row = false }: { url: string; titre: string; row?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const btnStyle = (bg: string, color = 'white') => ({
    width: '36px', height: '36px', borderRadius: '10px', background: bg, color, border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'transform 0.2s, box-shadow 0.2s',
    flexShrink: 0,
  } as React.CSSProperties);

  return (
    <div style={{ display: 'flex', flexDirection: row ? 'row' : 'column', gap: '8px' }}>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); shareLinkedIn(url); }}
        style={btnStyle('#0077B5')} title="Partager sur LinkedIn"
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </button>
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); copy(); }}
        style={btnStyle(copied ? '#dcfce7' : 'white', copied ? '#059669' : '#475569')} title={copied ? 'Copié !' : 'Copier le lien'}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
        {copied
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        }
      </button>
    </div>
  );
}

/* ─── Horizontal "en cours" card (news style) ─── */
function EnCoursCard({ p, onOpen }: { p: Project; onOpen: (p: Project) => void }) {
  return (
    <article className="encours-card" onClick={() => onOpen(p)}
      style={{ display: 'flex', background: 'white', borderRadius: '20px', overflow: 'hidden', border: '1px solid #e8edf5', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s', minHeight: '190px' }}>

      {/* Image left */}
      <div style={{ width: '260px', flexShrink: 0, position: 'relative', overflow: 'hidden', background: '#e2e8f0' }}>
        {p.images[0] && (
          <Image src={p.images[0]} alt={p.titre} className="encours-img" fill sizes="260px"
            style={{ objectFit: 'cover', transition: 'transform 0.6s ease' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 55%, rgba(255,255,255,0.15))' }} />

        {/* Category */}
        {p.categorie && (
          <div style={{ position: 'absolute', top: '14px', left: '14px' }}>
            <span style={{ background: 'var(--site-blue)', color: 'white', fontSize: '9px', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,74,153,0.35)' }}>
              {p.categorie}
            </span>
          </div>
        )}

        {/* Pulsing "En cours" bottom */}
        <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(14,165,92,0.9)', backdropFilter: 'blur(6px)', color: 'white', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: '6px' }}>
          <span className="pulse-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'white', display: 'inline-block' }} />
          En cours
        </div>
      </div>

      {/* Content right */}
      <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1 }}>
        <div>
          {/* Year badge */}
          {p.annees && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--site-blue)', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {p.annees}
            </span>
          )}

          <h3 className="encours-title" style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', fontWeight: 800, color: 'var(--site-blue-dark)', lineHeight: 1.25, marginBottom: '10px', transition: 'color 0.25s' }}>
            {p.titre}
          </h3>

          {p.desc && (
            <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
              {p.desc}
            </p>
          )}
        </div>

        {/* Footer row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {p.client && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--site-blue)" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {p.client}
              </span>
            )}
            {p.budget && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--site-gold)" strokeWidth="2.5"><path d="M4 10h12M4 14h12M19 6.3a9 9 0 110 11.4"/></svg>
                {p.budget}
              </span>
            )}
          </div>

          <span className="encours-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--site-blue)', fontWeight: 700, fontSize: '0.8rem', transition: 'gap 0.25s, color 0.25s', flexShrink: 0 }}>
            Voir le projet
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </span>
        </div>
      </div>
    </article>
  );
}

/* ─── Project Card (grid) ─── */
function ProjectCard({ p, onOpen }: { p: Project; onOpen: (p: Project) => void }) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/realisations/${p.slug || p.id}` : '';

  return (
    <article className="proj-card" style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', height: '100%', transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s' }}>

      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden', background: '#e2e8f0', flexShrink: 0 }}>
        {p.images[0] && (
          <Image src={p.images[0]} alt={p.titre} className="proj-card-img" fill sizes="(max-width: 768px) 100vw, 420px"
            style={{ objectFit: 'cover', transition: 'transform 0.7s ease' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.5) 0%, transparent 55%)' }} />

        {p.categorie && (
          <div style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 10 }}>
            <span style={{ background: 'var(--site-blue)', color: 'white', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,74,153,0.35)' }}>
              {p.categorie}
            </span>
          </div>
        )}

        {p.annees && (
          <div style={{ position: 'absolute', bottom: '14px', left: '16px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '5px', color: 'white', fontSize: '12px', fontWeight: 700 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {p.annees}
          </div>
        )}

        <div className="proj-card-share" style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 20, opacity: 0, transform: 'translateY(6px)', transition: 'opacity 0.3s, transform 0.3s', pointerEvents: 'none' }}>
          <ShareButtons url={shareUrl} titre={p.titre} />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '22px 22px 18px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>

        <h3 className="proj-card-title" onClick={() => onOpen(p)}
          style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.05rem', fontWeight: 800, color: 'var(--site-blue-dark)', lineHeight: 1.2, marginBottom: '8px', transition: 'color 0.3s', cursor: 'pointer' }}>
          {p.titre}
        </h3>

        {p.desc && (
          <p style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.6, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
            {p.desc}
          </p>
        )}

        {(p.client || p.typeEtab || p.budget) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
            {p.client && <Chip icon="user">{p.client}</Chip>}
            {p.typeEtab && <Chip icon="grid">{p.typeEtab}</Chip>}
            {p.budget && <Chip icon="euro">{p.budget}</Chip>}
          </div>
        )}

        {(p.missions?.length ?? 0) > 0 && (
          <div style={{ paddingTop: '12px', borderTop: '1px solid #f8fafc', marginBottom: '14px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(p.missions ?? []).slice(0, 3).map((m, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', color: '#475569', fontSize: '12px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10" fill="rgba(0,74,153,0.1)"/><polyline points="8 12 11 15 16 9" stroke="var(--site-blue)" strokeWidth="2" strokeLinecap="round"/></svg>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => onOpen(p)} className="proj-card-cta"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--site-blue)', fontWeight: 700, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'gap 0.25s, color 0.25s' }}>
            Voir le projet
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
          <button className="proj-card-share-mobile" onClick={() => { navigator.clipboard?.writeText(shareUrl); }}
            style={{ display: 'none', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Partager
          </button>
        </div>
      </div>
    </article>
  );
}

/* ─── Small badge chip ─── */
function Chip({ children, icon }: { children: React.ReactNode; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    user: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--site-blue)" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    grid: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--site-blue)" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    euro: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--site-gold)" strokeWidth="2.5"><path d="M4 10h12M4 14h12M19 6.3a9 9 0 110 11.4"/></svg>,
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f8fafc', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
      {icons[icon]}
      {children}
    </span>
  );
}

/* ─── Detail Modal ─── */
function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [activeImg, setActiveImg] = useState(project.images[0] || '');
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/realisations/${project.slug || project.id}` : '';

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '1100px', maxHeight: '92vh', borderRadius: '28px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 40px 80px rgba(0,0,0,0.3)', animation: 'projModalIn 0.35s cubic-bezier(0.22,1,0.36,1)' }}>

        {/* Hero */}
        <div style={{ position: 'relative', height: '240px', flexShrink: 0, background: '#0f172a', overflow: 'hidden' }}>
          {activeImg && <Image src={activeImg} alt={project.titre} fill sizes="(max-width: 1100px) 100vw, 1100px" style={{ objectFit: 'cover', opacity: 0.35 }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.95), rgba(15,23,42,0.25))' }} />
          <button onClick={onClose}
            style={{ position: 'absolute', top: '18px', right: '18px', width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>×</button>
          <div style={{ position: 'absolute', bottom: '24px', left: '32px', zIndex: 10 }}>
            {project.categorie && <span style={{ display: 'inline-block', background: 'var(--site-blue)', color: 'white', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '7px', marginBottom: '10px' }}>{project.categorie}</span>}
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 900, color: 'white', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{project.titre}</h2>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '14px 32px', flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
          {[{ l: 'Client', v: project.client }, { l: "Type d’établissement", v: project.typeEtab }, { l: 'Budget', v: project.budget }, { l: 'Période', v: project.annees }]
            .filter(s => s.v).map(s => (
              <div key={s.l}>
                <p style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{s.l}</p>
                <span style={{ color: 'var(--site-blue-dark)', fontWeight: 700, fontSize: '0.875rem' }}>{s.v}</span>
              </div>
            ))}
        </div>

        {/* Body */}
        <div className="modal-body-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', flexGrow: 1, overflow: 'hidden' }}>
          {/* Gallery + content */}
          <div style={{ overflowY: 'auto', padding: '28px 32px' }}>
            {project.images.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ position: 'relative', width: '100%', height: '280px', borderRadius: '16px', overflow: 'hidden', background: '#f1f5f9', marginBottom: '10px' }}>
                  <Image src={activeImg} alt={project.titre} fill sizes="(max-width: 900px) 100vw, 700px" style={{ objectFit: 'cover' }} />
                </div>
                {project.images.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {project.images.map((img, i) => (
                      <Image key={i} src={img} alt="" width={72} height={54} onClick={() => setActiveImg(img)}
                        style={{ width: '72px', height: '54px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: `2px solid ${activeImg === img ? 'var(--site-blue)' : 'transparent'}`, opacity: activeImg === img ? 1 : 0.6, transition: 'all 0.2s' }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {project.desc && (
              <div style={{ borderLeft: '4px solid var(--site-blue)', paddingLeft: '18px', marginBottom: '24px', fontStyle: 'italic', color: '#475569', fontSize: '1rem', lineHeight: 1.8 }}>
                {project.desc}
              </div>
            )}

            {project.missions.length > 0 && (
              <div>
                <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.875rem', fontWeight: 800, color: 'var(--site-blue-dark)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <span style={{ width: '32px', height: '32px', background: 'rgba(0,74,153,0.08)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--site-blue)" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                  </span>
                  Missions réalisées
                </h3>
                <ul className="missions-grid" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {project.missions.map((m, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.8125rem', fontWeight: 500 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10" fill="rgba(0,74,153,0.1)"/><polyline points="8 12 11 15 16 9" stroke="var(--site-blue)" strokeWidth="2" strokeLinecap="round"/></svg>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ background: '#f8fafc', borderLeft: '1px solid #e2e8f0', overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--site-blue-dark)', borderRadius: '20px', padding: '28px 22px', color: 'white', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-24px', right: '-24px', width: '100px', height: '100px', background: 'rgba(0,74,153,0.35)', borderRadius: '50%', filter: 'blur(30px)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: '10px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Client</p>
                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '20px' }}>{project.client || 'Confidentiel'}</p>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>Un projet similaire ?</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '18px' }}>
                  Déléguez la gestion de votre opération à nos experts pour sécuriser délais et budgets.
                </p>
                <a href="mailto:r.milardi@tenderwise.fr?subject=Étude de projet"
                  style={{ display: 'block', width: '100%', background: 'var(--site-blue)', color: 'white', textAlign: 'center', fontWeight: 700, padding: '13px', borderRadius: '10px', textDecoration: 'none', fontSize: '0.875rem', transition: 'background 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--site-gold)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--site-blue)'; }}>
                  Étudier mon projet →
                </a>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '12px' }}>Partager cette étude de cas</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <ShareButtons url={shareUrl} titre={project.titre} row />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section label ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
      <span style={{ width: '3px', height: '20px', background: 'var(--site-gold)', borderRadius: '2px', display: 'inline-block' }} />
      <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{children}</span>
    </div>
  );
}

/* ─── Main page ─── */
export default function RealisationsClient({ projects }: RealisationsClientProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(projects.map(p => p.categorie).filter(Boolean))),
    [projects],
  );

  const sorted = useMemo(() => sortByEndYear(projects), [projects]);

  const enCours = useMemo(() => sorted.filter(isEnCours), [sorted]);
  const termines = useMemo(() => sorted.filter(p => !isEnCours(p)), [sorted]);

  const filteredTermines = activeFilter === 'all'
    ? termines
    : termines.filter(p => p.categorie === activeFilter);

  const filteredEnCours = activeFilter === 'all'
    ? enCours
    : enCours.filter(p => p.categorie === activeFilter);

  const openModal = useCallback((p: Project) => setSelectedProject(p), []);
  const closeModal = useCallback(() => setSelectedProject(null), []);

  if (!projects.length) {
    return (
      <section style={{ background: '#f8fafc', padding: '100px 20px', textAlign: 'center', minHeight: '50vh' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ margin: '0 auto 20px', display: 'block' }}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', color: '#94a3b8', fontSize: '1.25rem' }}>Aucun projet trouvé.</h2>
      </section>
    );
  }

  return (
    <>
      <section style={{ background: '#f8fafc', padding: '3.5rem 0 6rem', minHeight: '70vh' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>

          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 900, color: 'var(--site-blue-dark)', marginBottom: '8px', letterSpacing: '-0.5px' }}>
              Missions & Projets
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: 500, fontStyle: 'italic' }}>
              Portfolio d&apos;expériences significatives
            </p>
            <div style={{ width: '60px', height: '4px', background: 'var(--site-blue)', marginTop: '16px', borderRadius: '100px' }} />
          </div>

          {/* Filters */}
          {categories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '3rem' }}>
              {['all', ...categories].map(cat => {
                const isActive = activeFilter === cat;
                return (
                  <button key={cat} onClick={() => setActiveFilter(cat)}
                    style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.25s', fontFamily: 'inherit', background: isActive ? 'var(--site-blue)' : 'white', color: isActive ? 'white' : '#475569', border: isActive ? 'none' : '1px solid #e2e8f0', boxShadow: isActive ? '0 8px 20px rgba(0,74,153,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                    {cat === 'all' ? 'Tous les projets' : cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Projets en cours (horizontal news cards) ── */}
          {filteredEnCours.length > 0 && (
            <div style={{ marginBottom: '3.5rem' }}>
              <SectionLabel>Projets en cours</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredEnCours.map(p => <EnCoursCard key={p.id} p={p} onOpen={openModal} />)}
              </div>
            </div>
          )}

          {/* ── Toutes les réalisations (grid) ── */}
          {filteredTermines.length > 0 && (
            <div>
              <SectionLabel>
                {filteredEnCours.length > 0 ? 'Réalisations terminées' : 'Toutes les réalisations'}
              </SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.75rem' }}>
                {filteredTermines.map(p => <ProjectCard key={p.id} p={p} onOpen={openModal} />)}
              </div>
            </div>
          )}

          {filteredEnCours.length === 0 && filteredTermines.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>
              <p>Aucun projet dans cette catégorie.</p>
            </div>
          )}
        </div>
      </section>

      {selectedProject && <ProjectModal project={selectedProject} onClose={closeModal} />}

      <style>{`
        .proj-card { cursor: default; }
        .proj-card:hover { transform: translateY(-8px) !important; box-shadow: 0 24px 60px rgba(0,0,0,0.1) !important; }
        .proj-card:hover .proj-card-img { transform: scale(1.08); }
        .proj-card:hover .proj-card-share { opacity: 1 !important; transform: translateY(0) !important; pointer-events: auto !important; }
        .proj-card:hover .proj-card-title { color: var(--site-blue) !important; }
        .proj-card-cta:hover { gap: 10px !important; color: var(--site-gold) !important; }
        .encours-card:hover { transform: translateY(-4px) !important; box-shadow: 0 16px 48px rgba(0,0,0,0.1) !important; }
        .encours-card:hover .encours-img { transform: scale(1.05) !important; }
        .encours-card:hover .encours-title { color: var(--site-blue) !important; }
        .encours-card:hover .encours-cta { gap: 9px !important; color: var(--site-gold) !important; }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
        @keyframes projModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (max-width: 768px) {
          .proj-card-share { display: none !important; }
          .proj-card-share-mobile { display: inline-flex !important; }
          .modal-body-grid { grid-template-columns: 1fr !important; }
          .missions-grid { grid-template-columns: 1fr !important; }
          .encours-card { flex-direction: column !important; min-height: unset !important; }
          .encours-card > div:first-child { width: 100% !important; height: 180px !important; }
        }
        @media (max-width: 500px) {
          div[style*="minmax(320px"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
