'use client';

/**
 * Bandeau de consentement aux cookies — conforme RGPD / lignes directrices CNIL.
 *
 * Principes appliqués :
 *  - Aucun cookie de mesure d’audience n’est déposé avant un choix explicite
 *    (Google Consent Mode v2 démarre en « denied » — voir app/layout.tsx).
 *  - « Accepter » et « Refuser » sont au même niveau (pas de dark pattern).
 *  - Le choix est rejouable à tout moment (lien « Gérer les cookies » du footer
 *    → window.openCookieSettings()).
 *  - Chaque choix est horodaté et archivé en base (preuve de consentement).
 *  - Durée de validité du consentement : 6 mois (recommandation CNIL).
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface CookieConsentProps {
  settings?: Record<string, string>;
}

interface Consent {
  v: string;            // version de politique
  cid: string;          // identifiant aléatoire (corrélation des mises à jour)
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  date: string;         // ISO
}

const COOKIE_NAME = 'tw_consent';
const COOKIE_DAYS = 180; // 6 mois

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { openCookieSettings?: () => void; gtag?: (...args: any[]) => void; dataLayer?: any[]; } }

function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )tw_consent=([^;]+)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch { return null; }
}

function writeConsent(c: Consent) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(c))}; path=/; expires=${expires}; SameSite=Lax${secure}`;
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* noop */ }
  return 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function CookieConsent({ settings = {} }: CookieConsentProps) {
  const pathname = usePathname();
  // Pas de bandeau dans l’administration ni les pages de validation par token.
  const hideOnPath = pathname?.startsWith('/admin') || pathname?.startsWith('/review');

  const enabled       = (settings.cookie_banner_enabled ?? '1') !== '0' && !hideOnPath;
  const version       = settings.cookie_policy_version || '1';
  const showAnalytics = (settings.cookie_cat_analytics_enabled ?? '1') !== '0';
  const showMarketing = (settings.cookie_cat_marketing_enabled ?? '0') !== '0';

  const title       = settings.cookie_banner_title    || 'Nous respectons votre vie privée';
  const text        = settings.cookie_banner_text     || 'Nous utilisons des cookies pour assurer le bon fonctionnement du site et, avec votre accord, pour mesurer notre audience.';
  const acceptLabel = settings.cookie_accept_label    || 'Tout accepter';
  const rejectLabel = settings.cookie_reject_label    || 'Tout refuser';
  const custLabel   = settings.cookie_customize_label || 'Personnaliser';
  const analyticsDesc = settings.cookie_cat_analytics_desc || "Mesure d’audience 1ère partie : pages visitées, provenance (dont LinkedIn), temps de lecture et parcours de navigation. Données pseudonymisées via un identifiant de session temporaire, sans identification personnelle.";
  const marketingDesc = settings.cookie_cat_marketing_desc || 'Cookies publicitaires et de réseaux sociaux pour personnaliser les contenus.';

  const [visible, setVisible]   = useState(false); // bandeau bas
  const [panel, setPanel]       = useState(false); // panneau « Personnaliser »
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // À l’ouverture : décide d’afficher le bandeau si aucun consentement valide.
  // Le cookie n’existe pas au rendu serveur → cette synchronisation avec un
  // système externe (document.cookie) doit se faire dans un effet client.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!enabled) return;
    const existing = readConsent();
    if (existing && existing.v === version) {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
      return; // choix déjà fait pour cette version → rien à afficher
    }
    setVisible(true);
  }, [enabled, version]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Permet la réouverture depuis le footer (« Gérer les cookies »).
  useEffect(() => {
    window.openCookieSettings = () => {
      const c = readConsent();
      setAnalytics(c?.analytics ?? false);
      setMarketing(c?.marketing ?? false);
      setPanel(true);
      setVisible(true);
    };
    return () => { delete window.openCookieSettings; };
  }, []);

  const persist = (an: boolean, mk: boolean, action: 'accept_all' | 'reject_all' | 'custom') => {
    const existing = readConsent();
    const consent: Consent = {
      v: version,
      cid: existing?.cid || randomId(),
      necessary: true,
      analytics: an,
      marketing: mk,
      date: new Date().toISOString(),
    };
    writeConsent(consent);
    setVisible(false);
    setPanel(false);

    // Archive la preuve de consentement (best-effort, ne bloque pas l’UI).
    fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_id: consent.cid,
        analytics: an,
        marketing: mk,
        action,
        policy_version: version,
        page_url: typeof location !== 'undefined' ? location.pathname : '',
      }),
      keepalive: true,
    }).catch(() => { /* silencieux : ne pas dégrader l’expérience */ });
  };

  const acceptAll = () => persist(true, true, 'accept_all');
  const rejectAll = () => persist(false, false, 'reject_all');
  const saveCustom = () => persist(showAnalytics && analytics, showMarketing && marketing, 'custom');

  if (!enabled || !visible) return null;

  return (
    <>
      <div role="dialog" aria-modal="false" aria-label="Gestion des cookies" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2147483600,
        display: 'flex', justifyContent: 'center', padding: '0 16px 16px',
        animation: 'twcc-slide 0.35s ease',
      }}>
        <div style={{
          width: '100%', maxWidth: '1100px',
          background: 'var(--site-white, #fff)',
          border: '1px solid var(--site-border, #e2e8f0)',
          borderTop: '4px solid var(--site-gold, #c5a059)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
          padding: '22px 26px',
        }}>
          {!panel ? (
            /* ── Bandeau simple ───────────────────────────────────────── */
            <div style={{ display: 'flex', gap: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 420px', minWidth: 0 }}>
                <h3 style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 800,
                  fontSize: '1.05rem', color: 'var(--site-blue-dark, #003366)', margin: '0 0 6px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span aria-hidden style={{ fontSize: '1.1rem' }}>🍪</span> {title}
                </h3>
                <p style={{ fontSize: '0.86rem', lineHeight: 1.6, color: 'var(--site-text, #475569)', margin: 0 }}>
                  {text}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flexShrink: 0 }}>
                <button onClick={() => setPanel(true)} style={btnGhost}>{custLabel}</button>
                <button onClick={rejectAll} style={btnSecondary}>{rejectLabel}</button>
                <button onClick={acceptAll} style={btnPrimary}>{acceptLabel}</button>
              </div>
            </div>
          ) : (
            /* ── Panneau « Personnaliser » ────────────────────────────── */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '1.05rem', color: 'var(--site-blue-dark, #003366)', margin: 0 }}>
                  Paramétrer vos cookies
                </h3>
                <button onClick={() => setPanel(false)} aria-label="Fermer" style={{ background: 'none', border: 'none', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', color: '#94a3b8' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '46vh', overflowY: 'auto', marginBottom: '18px' }}>
                <CategoryRow
                  title="Cookies strictement nécessaires"
                  desc="Indispensables au fonctionnement du site (sécurité, session d’administration, mémorisation de vos choix de cookies). Toujours actifs."
                  checked
                  locked
                />
                {showAnalytics && (
                  <CategoryRow
                    title="Mesure d’audience"
                    desc={analyticsDesc}
                    checked={analytics}
                    onChange={setAnalytics}
                  />
                )}
                {showMarketing && (
                  <CategoryRow
                    title="Marketing & réseaux sociaux"
                    desc={marketingDesc}
                    checked={marketing}
                    onChange={setMarketing}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={rejectAll} style={btnSecondary}>{rejectLabel}</button>
                <button onClick={saveCustom} style={btnGhost}>Enregistrer mes choix</button>
                <button onClick={acceptAll} style={btnPrimary}>{acceptLabel}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes twcc-slide { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}

/* ── Ligne de catégorie avec interrupteur ───────────────────────────────── */
function CategoryRow({
  title, desc, checked, onChange, locked,
}: {
  title: string; desc: string; checked: boolean;
  onChange?: (v: boolean) => void; locked?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', gap: '14px', alignItems: 'flex-start',
      padding: '14px 16px', background: 'var(--site-light, #f8fafc)',
      border: '1px solid var(--site-border, #e2e8f0)', borderRadius: '10px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--site-blue-dark, #003366)', margin: '0 0 3px' }}>{title}</p>
        <p style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'var(--site-text, #475569)', margin: 0 }}>{desc}</p>
      </div>
      <Switch checked={checked} locked={locked} onChange={onChange} />
    </div>
  );
}

function Switch({ checked, locked, onChange }: { checked: boolean; locked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={locked}
      onClick={() => !locked && onChange?.(!checked)}
      style={{
        flexShrink: 0, width: '44px', height: '24px', borderRadius: '999px', border: 'none',
        position: 'relative', cursor: locked ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--site-blue, #004a99)' : '#cbd5e1',
        opacity: locked ? 0.6 : 1, transition: 'background 0.2s', marginTop: '2px',
      }}
    >
      <span style={{
        position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
        width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

/* ── Styles des boutons (alignés sur la charte) ─────────────────────────── */
const btnBase: React.CSSProperties = {
  padding: '10px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem',
  cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", whiteSpace: 'nowrap',
  transition: 'all 0.15s',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--site-blue, #004a99)', color: '#fff', border: '1px solid var(--site-blue, #004a99)' };
const btnSecondary: React.CSSProperties = { ...btnBase, background: '#fff', color: 'var(--site-blue-dark, #003366)', border: '1px solid var(--site-border, #cbd5e1)' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--site-gold-light, #f5f0e6)', color: '#8a6d2f', border: '1px solid var(--site-gold, #c5a059)' };
