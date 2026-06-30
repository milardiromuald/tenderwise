'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import NotificationBell from './NotificationBell';

interface AdminTopBarProps {
  /** Ouverture de la sidebar mobile (hamburger) — état détenu par AdminShell. */
  onOpenSidebar?: () => void;
  /** Rôle de l’utilisateur connecté — la cloche de notifications est réservée aux admins. */
  role?: string;
}

/**
 * Résolution du titre de page par route. Ordre = du plus spécifique au plus
 * général ; le premier motif qui matche gagne. Les libellés reprennent ceux
 * de la sidebar (AdminSidebar / AdminSubSidebar).
 */
function resolveTitle(pathname: string): string {
  const exact: Record<string, string> = {
    '/admin': 'Tableau de bord',
    '/admin/articles': 'Mes articles',
    '/admin/articles/new': 'Rédiger un article',
    '/admin/articles/generate': "Générer avec l’IA",
    '/admin/workflow': 'Workflow',
    '/admin/connectors': 'Connecteurs',
    '/admin/prompts': 'Prompts IA',
    '/admin/ai': 'Configuration IA',
    '/admin/settings': 'Paramètres du site',
    '/admin/users': 'Comptes utilisateurs',
    '/admin/profile': 'Mon profil',
  };
  if (exact[pathname]) return exact[pathname];

  // Édition d’un article : /admin/articles/{id}
  if (/^\/admin\/articles\/\d+$/.test(pathname)) return "Modifier l’article";

  // Repli : préfixe le plus long parmi les routes connues
  let best = '';
  let title = 'Administration';
  for (const [route, label] of Object.entries(exact)) {
    if (route !== '/admin' && pathname.startsWith(route + '/') && route.length > best.length) {
      best = route;
      title = label;
    }
  }
  return title;
}

function TopBarInner({ onOpenSidebar, role }: AdminTopBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Routes qui rendent déjà leur propre PreviewTopBar → pas de doublon.
  if (/^\/admin\/articles\/\d+\/preview$/.test(pathname) || pathname.startsWith('/admin/workflow/review/')) {
    return null;
  }

  const isDashboard = pathname === '/admin';
  const fromWorkflow = searchParams.get('from') === 'workflow';

  const back = fromWorkflow
    ? { href: '/admin/workflow', label: 'Retour au workflow' }
    : { href: '/admin', label: 'Tableau de bord' };

  const title = resolveTitle(pathname);

  return (
    <>
      <style>{`
        .admin-topbar-hamburger { display: none; }
        @media (max-width: 768px) {
          .admin-topbar-hamburger { display: flex; }
        }
      `}</style>
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: '#0f172a',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 1.5rem',
        height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {/* Hamburger — mobile uniquement */}
          <button
            type="button"
            className="admin-topbar-hamburger"
            onClick={onOpenSidebar}
            aria-label="Ouvrir le menu"
            style={{
              alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, flexShrink: 0,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7,
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Bouton retour — masqué sur le Tableau de bord */}
          {!isDashboard && (
            <Link
              href={back.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
                fontSize: '0.83rem', fontWeight: 500,
                padding: '5px 11px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '7px',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {back.label}
            </Link>
          )}

          {!isDashboard && (
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', flexShrink: 0 }}>·</span>
          )}

          <span style={{
            fontSize: isDashboard ? '0.9rem' : '0.78rem',
            fontWeight: isDashboard ? 600 : 400,
            color: isDashboard ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {role === 'admin' && <NotificationBell inline />}
        </div>
      </div>
    </>
  );
}

export default function AdminTopBar({ onOpenSidebar, role }: AdminTopBarProps) {
  return (
    <Suspense fallback={null}>
      <TopBarInner onOpenSidebar={onOpenSidebar} role={role} />
    </Suspense>
  );
}
