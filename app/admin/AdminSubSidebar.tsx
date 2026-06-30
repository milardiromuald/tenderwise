'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface SubMenuItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
}

interface SubMenuGroup {
  /** En-tête de groupe — masqué si absent (groupe unique sans titre). */
  label?: string;
  items: SubMenuItem[];
}

interface SubMenu {
  title: string;
  mode?: 'query' | 'route';
  groups: SubMenuGroup[];
}

const SUB_MENUS: Record<string, SubMenu> = {
  '/admin/settings': {
    title: 'Paramètres du site',
    groups: [
      {
        label: 'Apparence & accueil',
        items: [
          { id: 'logo', label: 'Identité visuelle', icon: '🎨' },
          { id: 'hero', label: "Page d'accueil",    icon: '🦸' },
        ],
      },
      {
        label: 'Informations & référencement',
        items: [
          { id: 'general', label: 'Informations',  icon: '🏢' },
          { id: 'seo',     label: 'Référencement', icon: '🔍' },
        ],
      },
      {
        label: 'Pages',
        items: [
          { id: 'about',   label: 'Qui sommes-nous', icon: '👥' },
          { id: 'contact', label: 'Contact',         icon: '📬' },
          { id: 'footer',  label: 'Pied de page',    icon: '📄' },
        ],
      },
      {
        label: 'Légal & notifications',
        items: [
          { id: 'legal',         label: 'Mentions légales',    icon: '⚖️' },
          { id: 'notifications', label: 'Notifications email', icon: '🔔' },
        ],
      },
    ],
  },
  '/admin/rgpd': {
    title: 'RGPD & Cookies',
    groups: [
      {
        label: 'Cookies & consentement',
        items: [
          { id: 'banner',     label: 'Bandeau cookies',  icon: '🍪' },
          { id: 'categories', label: 'Catégories',       icon: '🗂' },
        ],
      },
      {
        label: 'Conformité & droits',
        items: [
          { id: 'dpo',      label: 'Responsable / DPO',     icon: '🛡' },
          { id: 'registre', label: 'Registre consents.',    icon: '📜' },
          { id: 'demandes', label: 'Demandes / Effacement', icon: '🔎' },
        ],
      },
    ],
  },
  '/admin/connectors': {
    title: 'Connecteurs',
    groups: [
      {
        items: [
          { id: 'workspace', label: 'Google Workspace', icon: '🏢' },
          { id: 'chat',      label: 'Google Chat',      icon: '💬' },
          { id: 'workflow',  label: 'Workflow & Test',  icon: '⚡' },
        ],
      },
    ],
  },
};

/** Tous les items d'un menu, groupes aplatis. */
function allItems(menu: SubMenu): SubMenuItem[] {
  return menu.groups.flatMap((g) => g.items);
}

function SubSidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Match exact path or prefix (for sub-routes like /admin/articles/generate)
  const menuKey = Object.keys(SUB_MENUS).find(
    (key) => pathname === key || pathname.startsWith(key + '/')
  );
  const menu = menuKey ? SUB_MENUS[menuKey] : null;
  if (!menu) return null;

  const isRouteMode = menu.mode === 'route';
  const items = allItems(menu);

  // Determine active item id
  let activeId: string;
  if (isRouteMode) {
    const match = items.find((item) => item.href === pathname);
    activeId = match?.id ?? items[0].id;
  } else {
    activeId = searchParams.get('s') || items[0].id;
  }

  return (
    <>
      <style>{`
        .admin-subsidebar {
          width: 200px;
          background: #131f35;
          min-height: 100vh;
          height: 100vh;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          overflow-y: auto;
          overflow-x: hidden;
          border-left: 1px solid rgba(255,255,255,0.06);
          position: sticky;
          top: 0;
        }
        .subsidebar-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 1rem;
          text-decoration: none;
          font-size: 0.8rem;
          transition: all 0.15s;
          border-left: 2px solid transparent;
          white-space: nowrap;
          overflow: hidden;
        }
        .subsidebar-item:hover {
          background: rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.85) !important;
        }
        @media (max-width: 768px) {
          .admin-subsidebar { display: none !important; }
        }
      `}</style>
      <aside className="admin-subsidebar">
        <div style={{
          padding: '1rem 1rem 0.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <p style={{
            fontSize: '0.58rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase',
            letterSpacing: '0.13em',
            margin: 0,
          }}>
            {menu.title}
          </p>
        </div>

        <nav style={{ flex: 1, padding: '0.4rem 0', overflowY: 'auto' }}>
          {menu.groups.map((group, gi) => (
            <div key={group.label || `g${gi}`} style={{ marginBottom: '2px' }}>
              {group.label && (
                <p style={{
                  padding: gi === 0 ? '0.35rem 1rem 0.15rem' : '0.7rem 1rem 0.15rem',
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.2)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  margin: 0,
                }}>
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = activeId === item.id;
                const href = isRouteMode && item.href
                  ? item.href
                  : `${menuKey}?s=${item.id}`;
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className="subsidebar-item"
                    style={{
                      color: active ? 'white' : 'rgba(255,255,255,0.45)',
                      background: active ? 'rgba(197,160,89,0.1)' : 'transparent',
                      borderLeftColor: active ? '#c5a059' : 'transparent',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', flexShrink: 0, lineHeight: 1 }}>
                      {item.icon}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                    {active && (
                      <span style={{
                        marginLeft: 'auto',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#c5a059',
                        flexShrink: 0,
                      }} />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default function AdminSubSidebar() {
  return (
    <Suspense fallback={null}>
      <SubSidebarInner />
    </Suspense>
  );
}
