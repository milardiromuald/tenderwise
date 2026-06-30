'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface AdminSidebarProps {
  onClose?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType;
  exact: boolean;
  badge?: string;
  disabled?: boolean;
  /** Sous-items repliables affichés sous un item parent (ex. Statistiques, Mon compte). */
  children?: NavItem[];
  /** Affiche une pastille de compteur non-lu alimentée par /api/admin/inbox-counts. */
  countKey?: 'messages' | 'applications';
}

interface SectionDef {
  label: string;
  items: NavItem[];
}

const SECTIONS: SectionDef[] = [
  {
    label: '',
    items: [
      { href: '/admin', label: 'Tableau de bord', icon: IconDashboard, exact: true },
    ],
  },
  {
    label: 'Contenu',
    items: [
      { href: '/admin/articles',  label: 'Articles',        icon: IconArticle, exact: false },
      { href: '/admin/projects',  label: 'Réalisations',    icon: IconProject, exact: false },
      { href: '/admin/jobs',      label: "Offres d'emploi", icon: IconJob,     exact: false },
    ],
  },
  {
    label: 'Publication',
    items: [
      { href: '/admin/workflow',    label: 'Workflow articles', icon: IconWorkflow,    exact: false },
      { href: '/admin/validation',  label: 'À valider',         icon: IconInbox,       exact: false },
      { href: '/admin/backgrounds', label: "Fonds d'en-tête",   icon: IconBackgrounds, exact: false },
      { href: '/admin/linkedin',    label: 'LinkedIn',          icon: IconLinkedIn,    exact: false },
      { href: '',                   label: 'X / Twitter',       icon: IconX,           exact: true,  badge: 'Bientôt', disabled: true },
    ],
  },
  {
    label: 'IA & Automatisation',
    items: [
      { href: '/admin/ai',         label: 'Configuration IA', icon: IconConfig,     exact: false },
      { href: '/admin/prompts',    label: 'Prompts IA',       icon: IconPrompts,    exact: false },
      { href: '/admin/connectors', label: 'Connecteurs',      icon: IconConnectors, exact: false },
    ],
  },
  {
    label: 'Boîte de réception',
    items: [
      { href: '/admin/contact',      label: 'Messages reçus', icon: IconContact,     exact: false, countKey: 'messages' },
      { href: '/admin/applications', label: 'Candidatures',   icon: IconApplication, exact: false, countKey: 'applications' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admin/stats', label: 'Statistiques', icon: IconAnalytics, exact: false },
      { href: '/admin/settings',     label: 'Paramètres du site', icon: IconSettings,   exact: false },
      { href: '/admin/rgpd',         label: 'RGPD & Cookies',     icon: IconShield,     exact: false },
      {
        href: '', label: 'Mon compte', icon: IconUser, exact: false,
        children: [
          { href: '/admin/profile', label: 'Mon profil',    icon: IconUser,  exact: false },
          { href: '/admin/users',   label: 'Utilisateurs',  icon: IconUsers, exact: false },
        ],
      },
    ],
  },
];

/** Tous les items navigables, sous-items inclus — pour le calcul de l'item actif. */
function flatItems(items: NavItem[]): NavItem[] {
  return items.flatMap((it) => (it.children ? it.children : [it]));
}

/* ─── Icônes ─────────────────────────────────────────────────────────── */

function IconDashboard() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
function IconArticle() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}
function IconProject() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function IconJob() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>;
}
function IconWorkflow() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a2 2 0 012 2v7"/></svg>;
}
function IconInbox() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>;
}
function IconLinkedIn() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>;
}
function IconX() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg>;
}
function IconPrompts() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/></svg>;
}
function IconBackgrounds() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function IconConfig() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
}
function IconConnectors() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>;
}
function IconContact() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function IconApplication() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="13" r="2"/><path d="M14 19a4 4 0 00-8 0"/></svg>;
}
function IconSettings() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
}
function IconShield() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>;
}
function IconAudience() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}
function IconAnalytics() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function IconUsers() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}
function IconUser() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function IconChevron() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 6 15 12 9 18"/></svg>;
}

/* ─── Composant principal ─────────────────────────────────────────────── */

export default function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const activeHref = (() => {
    let best: string | null = null;
    for (const section of SECTIONS) {
      for (const item of flatItems(section.items)) {
        if (item.disabled || !item.href) continue;
        const matches = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
        if (matches && (best === null || item.href.length > best.length)) {
          best = item.href;
        }
      }
    }
    return best;
  })();

  const isActive = (href: string) => !!href && href === activeHref;

  /** Un parent est actif si l'un de ses sous-items l'est. */
  const isGroupActive = (item: NavItem) =>
    !!item.children && item.children.some((c) => isActive(c.href));

  // Groupes repliables : ouverts par défaut si un sous-item est actif ; l'état
  // utilisateur (clic) prend ensuite le dessus.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isGroupOpen = (item: NavItem) =>
    openGroups[item.label] ?? isGroupActive(item);
  const toggleGroup = (label: string, currentlyOpen: boolean) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !currentlyOpen }));

  // Compteurs non-lus (Messages reçus / Candidatures) — rafraîchis périodiquement.
  const [counts, setCounts] = useState<{ messages: number; applications: number }>({ messages: 0, applications: 0 });
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/admin/inbox-counts')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setCounts({ messages: d.messages || 0, applications: d.applications || 0 }); })
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const handleLinkClick = () => { onClose?.(); };

  /** Rendu d'un item navigable (feuille). `nested` = sous-item d'un groupe. */
  const renderLeaf = (item: NavItem, nested = false) => {
    const active = isActive(item.href);
    const count = item.countKey ? counts[item.countKey] : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleLinkClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: nested ? '5px 1.25rem 5px 2.45rem' : '5px 1.25rem',
          textDecoration: 'none',
          color: active ? 'white' : 'rgba(255,255,255,0.5)',
          background: active ? 'rgba(197,160,89,0.12)' : 'transparent',
          borderLeft: `3px solid ${active ? '#c5a059' : 'transparent'}`,
          fontWeight: active ? 600 : 400,
          fontSize: nested ? '0.82rem' : '0.845rem',
          transition: 'all 0.15s',
          borderRadius: '0 6px 6px 0',
          marginRight: '8px',
        }}
      >
        <span style={{
          opacity: active ? 1 : 0.7,
          color: active ? '#c5a059' : 'currentColor',
          flexShrink: 0,
        }}>
          <item.icon />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {item.label}
        </span>
        {count > 0 && (
          <span style={{
            background: '#ef4444',
            color: 'white',
            fontSize: '0.6rem',
            fontWeight: 700,
            minWidth: '17px',
            height: '17px',
            padding: '0 4px',
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
        {item.badge && !active && (
          <span style={{
            background: 'rgba(197,160,89,0.2)',
            color: '#c5a059',
            fontSize: '0.58rem',
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: '4px',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside style={{
      width: '220px',
      background: '#0f172a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '0.85rem 1.25rem 0.7rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}>
        <Link href="/admin" onClick={handleLinkClick} style={{ textDecoration: 'none', flex: 1 }}>
          <div style={{
            fontSize: '1.15rem',
            fontWeight: 900,
            fontFamily: 'Montserrat, sans-serif',
            color: 'white',
            letterSpacing: '-0.5px',
            lineHeight: 1,
          }}>
            Tender<span style={{ color: '#c5a059' }}>Wise</span>
          </div>
          <p style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '0.58rem',
            margin: '3px 0 0',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>Administration</p>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            className="sidebar-close-btn"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.3rem 0' }}>
        {SECTIONS.map((section) => (
          <div key={section.label || '__dashboard__'} style={{ marginBottom: '0.05rem' }}>
            {/* En-tête de section — masqué si label vide */}
            {section.label !== '' && (
              <p style={{
                padding: '0.55rem 1.25rem 0.15rem',
                fontSize: '0.57rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.2)',
                textTransform: 'uppercase',
                letterSpacing: '0.13em',
                margin: 0,
              }}>
                {section.label}
              </p>
            )}

            {section.items.map((item) => {
              /* ── Item désactivé (X / Twitter — à venir) ── */
              if (item.disabled) {
                return (
                  <div key={item.label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    padding: '5px 1.25rem',
                    color: 'rgba(255,255,255,0.22)',
                    fontSize: '0.845rem',
                    cursor: 'not-allowed',
                    borderRadius: '0 6px 6px 0',
                    marginRight: '8px',
                    borderLeft: '3px solid transparent',
                  }}>
                    <span style={{ opacity: 0.5, flexShrink: 0 }}>
                      <item.icon />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span style={{
                        background: 'rgba(59,130,246,0.18)',
                        color: 'rgba(96,165,250,0.85)',
                        fontSize: '0.55rem',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                );
              }

              /* ── Item parent repliable (Statistiques, Mon compte) ── */
              if (item.children) {
                const open = isGroupOpen(item);
                const groupActive = isGroupActive(item);
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.label, open)}
                      aria-expanded={open}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '9px',
                        width: 'calc(100% - 8px)',
                        padding: '5px 1.25rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: groupActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
                        borderLeft: '3px solid transparent',
                        fontWeight: groupActive ? 600 : 400,
                        fontSize: '0.845rem',
                        fontFamily: 'inherit',
                        borderRadius: '0 6px 6px 0',
                        marginRight: '8px',
                      }}
                    >
                      <span style={{
                        opacity: groupActive ? 1 : 0.7,
                        color: groupActive ? '#c5a059' : 'currentColor',
                        flexShrink: 0,
                      }}>
                        <item.icon />
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {item.label}
                      </span>
                      <span style={{
                        flexShrink: 0,
                        opacity: 0.5,
                        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s',
                        display: 'flex',
                      }}>
                        <IconChevron />
                      </span>
                    </button>
                    {open && (
                      <div>
                        {item.children.map((child) => renderLeaf(child, true))}
                      </div>
                    )}
                  </div>
                );
              }

              /* ── Item navigable normal ── */
              return renderLeaf(item);
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '0.55rem 1.25rem',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        <Link
          href="/"
          target="_blank"
          onClick={handleLinkClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'rgba(255,255,255,0.35)',
            textDecoration: 'none',
            fontSize: '0.78rem',
            padding: '4px 0',
            transition: 'color 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Voir le site
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: `${window.location.origin}/admin/login` })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'rgba(255,255,255,0.35)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.78rem',
            padding: '4px 0',
            textAlign: 'left',
            transition: 'color 0.15s',
            width: '100%',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Déconnexion
        </button>
      </div>

      <style>{`
        .sidebar-close-btn { display: none !important; }
        @media (max-width: 768px) {
          .sidebar-close-btn { display: flex !important; }
        }
      `}</style>
    </aside>
  );
}
