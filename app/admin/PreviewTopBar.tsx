'use client';

import Link from 'next/link';
import NotificationBell from './NotificationBell';

export interface PreviewTopBarStatus {
  text: string;
  bg: string;
  color: string;
}

type Action =
  | { type: 'link'; href: string; label: string }
  | { type: 'button'; label: string; onClick: () => void; disabled?: boolean };

interface PreviewTopBarProps {
  /** Lien du bouton retour (ex: /admin/articles ou /admin/workflow) */
  backHref: string;
  /** Libellé du bouton retour (ex: « Mes articles », « Retour au workflow ») */
  backLabel: string;
  /** Titre / contexte courant affiché au centre */
  title: string;
  /** Badge de statut (Brouillon, Publié, En attente…) */
  status?: PreviewTopBarStatus | null;
  /** Action principale à droite : lien (Modifier l’article) ou bouton (Modifier le brouillon) */
  action?: Action | null;
  /** Affiche la cloche de notifications — réservée aux admins (défaut : masquée). */
  showNotifications?: boolean;
}

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const primaryActionStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  color: 'white', textDecoration: 'none',
  fontSize: '0.83rem', fontWeight: 600,
  padding: '5px 14px',
  background: '#004a99',
  borderRadius: '7px',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export default function PreviewTopBar({ backHref, backLabel, title, status, action, showNotifications = false }: PreviewTopBarProps) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: '#0f172a',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      padding: '0 1.5rem',
      height: 52,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <Link
          href={backHref}
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
          {backLabel}
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', flexShrink: 0 }}>·</span>
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {status && (
          <span style={{
            padding: '4px 11px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
            background: status.bg, color: status.color, whiteSpace: 'nowrap',
          }}>
            {status.text}
          </span>
        )}
        {action && action.type === 'link' && (
          <Link href={action.href} style={primaryActionStyle}>
            <EditIcon />
            {action.label}
          </Link>
        )}
        {action && action.type === 'button' && (
          <button type="button" onClick={action.onClick} disabled={action.disabled} style={{ ...primaryActionStyle, opacity: action.disabled ? 0.5 : 1 }}>
            <EditIcon />
            {action.label}
          </button>
        )}
        {showNotifications && <NotificationBell inline />}
      </div>
    </div>
  );
}
