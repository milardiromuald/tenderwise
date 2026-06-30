'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Notif {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string;
  is_read: number;
  created_at: string;
}

interface Toast {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string;
}

// ── Helpers ──────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  success: '#059669', warning: '#d97706', error: '#dc2626', info: '#3b82f6',
};
const TYPE_BG: Record<string, string> = {
  success: '#ecfdf5', warning: '#fffbeb', error: '#fef2f2', info: '#eff6ff',
};

function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.replace(' ', 'T')).getTime();
  const min = Math.floor(diff / 60000);
  const h   = Math.floor(diff / 3600000);
  const d   = Math.floor(diff / 86400000);
  if (min < 1)  return 'A l instant';
  if (min < 60) return 'Il y a ' + min + 'min';
  if (h < 24)   return 'Il y a ' + h + 'h';
  if (d === 1)  return 'Hier';
  if (d < 7)    return 'Il y a ' + d + ' jours';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function TypeIcon({ type, size = 15 }: { type: string; size?: number }) {
  const color = TYPE_COLOR[type] || TYPE_COLOR.info;
  const bg    = TYPE_BG[type]    || TYPE_BG.info;
  const paths: Record<string, React.ReactNode> = {
    success: <polyline points="20 6 9 17 4 12" />,
    warning: <><line x1="12" y1="9" x2="12" y2="13" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></>,
    error:   <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    info:    <><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="3" strokeLinecap="round" /></>,
  };
  return (
    <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, border: '1.5px solid ' + color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {paths[type] ?? paths.info}
      </svg>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
// `inline` : rend le bouton dans le flux (pour la top barre admin) plutôt
// qu’en pastille flottante fixe. Le panneau et les toasts restent en
// position:fixed et fonctionnent à l’identique dans les deux cas.
export default function NotificationBell({ inline = false }: { inline?: boolean } = {}) {
  const [items,      setItems]      = useState<Notif[]>([]);
  const [unread,     setUnread]     = useState(0);
  const [open,       setOpen]       = useState(false);
  const [tab,        setTab]        = useState<'all' | 'unread'>('all');
  const [toasts,     setToasts]     = useState<Toast[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearing,   setClearing]   = useState(false);
  const prevIds  = useRef<Set<number>>(new Set());
  const initialized = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await fetch('/api/notifications').then(r => r.json());
      const newItems: Notif[] = d.items  || [];
      const newUnread: number = d.unread || 0;

      // Première charge (montage OU rafraîchissement de page) : on établit la
      // référence des notifications déjà présentes SANS afficher de toast.
      // Sans ce garde-fou, chaque actualisation re-déclencherait un toast pour
      // toutes les notifications non lues existantes.
      if (!initialized.current) {
        newItems.forEach(n => prevIds.current.add(n.id));
        initialized.current = true;
      } else {
        // Toasts uniquement pour les notifications réellement nouvelles
        // (arrivées pendant que la page est ouverte).
        const fresh = newItems.filter(n => !n.is_read && !prevIds.current.has(n.id));
        if (fresh.length > 0) {
          const newest = fresh[0];
          const tid = newest.id;
          setToasts(prev => prev.some(t => t.id === tid) ? prev : [
            ...prev,
            { id: tid, type: newest.type, title: newest.title, message: newest.message, link: newest.link },
          ]);
          setTimeout(() => dismissToast(tid), 6000);
        }
        newItems.forEach(n => prevIds.current.add(n.id));
      }

      setItems(newItems);
      setUnread(newUnread);
    } catch { /* silencieux */ }
  }, [dismissToast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  // Fermer au clic exterieur
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = () => {
    setOpen(o => !o);
    setTab('all');
  };

  // Marquer une notification comme lue
  const markOneRead = async (id: number) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnread(prev => Math.max(0, prev - 1));
    await fetch('/api/notifications/read', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  // Marquer tout comme lu
  const markAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnread(0);
    await fetch('/api/notifications/read', { method: 'POST' }).catch(() => {});
  };

  // Supprimer une notification
  const deleteOne = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    setItems(prev => prev.filter(n => n.id !== id));
    setUnread(prev => {
      const wasUnread = items.find(n => n.id === id)?.is_read === 0;
      return wasUnread ? Math.max(0, prev - 1) : prev;
    });
    await fetch('/api/notifications', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setDeletingId(null);
  };

  // Tout supprimer
  const deleteAll = async () => {
    if (!window.confirm('Vider toutes les notifications ?')) return;
    setClearing(true);
    setItems([]);
    setUnread(0);
    await fetch('/api/notifications', { method: 'DELETE' }).catch(() => {});
    setClearing(false);
  };

  const displayed = tab === 'unread' ? items.filter(n => !n.is_read) : items;
  const unreadCount = items.filter(n => !n.is_read).length;

  return (
    <>
      <style>{`
        @keyframes notif-panel-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes notif-backdrop-in { from{opacity:0} to{opacity:1} }
        @keyframes toast-in {
          from { transform: translateX(calc(100% + 24px)); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes notif-fade-out {
          from { opacity:1; transform:scaleY(1); max-height:120px; }
          to   { opacity:0; transform:scaleY(0); max-height:0; padding:0; }
        }
        .notif-bell-btn {
          position:relative; width:40px; height:40px; border-radius:10px; cursor:pointer;
          background:white; border:1px solid #e2e8f0;
          box-shadow:0 1px 4px rgba(0,0,0,.07);
          display:flex; align-items:center; justify-content:center;
          color:#475569; transition:background .15s,box-shadow .15s,border-color .15s;
        }
        .notif-bell-btn:hover { background:#f8fafc; border-color:#cbd5e1; box-shadow:0 3px 10px rgba(0,0,0,.11); }
        .notif-bell-btn:active { transform:scale(0.95); }
        .notif-bell-btn--dark {
          width:38px; height:38px; border-radius:9px;
          background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
          box-shadow:none; color:rgba(255,255,255,0.7);
        }
        .notif-bell-btn--dark:hover { background:rgba(255,255,255,0.14); border-color:rgba(255,255,255,0.2); box-shadow:none; color:#fff; }
        .notif-panel {
          position:fixed; top:0; right:0; bottom:0; width:400px;
          background:#ffffff; box-shadow:-6px 0 40px rgba(15,23,42,.14),-1px 0 0 rgba(15,23,42,.06);
          z-index:9999; display:flex; flex-direction:column;
          animation:notif-panel-in 0.3s cubic-bezier(0.32,0.72,0,1); will-change:transform;
        }
        @media(max-width:440px){ .notif-panel{width:100vw;} }
        .notif-backdrop {
          position:fixed; inset:0; background:rgba(15,23,42,.25);
          backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px);
          z-index:9998; animation:notif-backdrop-in .22s ease;
        }
        .notif-row {
          display:flex; gap:12px; padding:12px 18px;
          border-bottom:1px solid #f1f5f9;
          transition:background .12s; cursor:pointer; position:relative;
        }
        .notif-row:hover { background:#f8fafc; }
        .notif-row:last-child { border-bottom:none; }
        .notif-del-btn {
          opacity:0; position:absolute; right:12px; top:50%; transform:translateY(-50%);
          width:24px; height:24px; border-radius:6px; border:none; cursor:pointer;
          background:#fef2f2; color:#ef4444;
          display:flex; align-items:center; justify-content:center;
          transition:opacity .15s, background .15s;
          flex-shrink:0;
        }
        .notif-row:hover .notif-del-btn { opacity:1; }
        .notif-del-btn:hover { background:#fee2e2; }
        .notif-tab {
          padding:5px 12px; border-radius:7px; border:none; cursor:pointer;
          font-size:12px; font-weight:600; font-family:Inter,sans-serif;
          transition:background .15s, color .15s;
        }
        .notif-action-btn {
          padding:5px 10px; border-radius:7px; border:none; cursor:pointer;
          font-size:11px; font-weight:600; font-family:Inter,sans-serif;
          display:inline-flex; align-items:center; gap:5px;
          transition:background .15s, color .15s;
        }
        .toast-card {
          width:320px; background:white; border-radius:13px;
          box-shadow:0 8px 32px rgba(0,0,0,.14),0 2px 8px rgba(0,0,0,.07);
          display:flex; align-items:flex-start; gap:11px; padding:13px 15px;
          pointer-events:all; animation:toast-in 0.35s cubic-bezier(0.32,0.72,0,1);
          position:relative; overflow:hidden;
        }
        .toast-close {
          background:none; border:none; cursor:pointer; color:#94a3b8; padding:3px;
          display:flex; align-items:center; justify-content:center;
          border-radius:5px; flex-shrink:0;
          transition:color .15s,background .15s;
        }
        .toast-close:hover { color:#475569; background:#f1f5f9; }
      `}</style>

      {/* ── Cloche ── */}
      <div style={inline
        ? { position: 'relative', display: 'flex', alignItems: 'center' }
        : { position: 'fixed', top: 12, right: 16, zIndex: 9990, pointerEvents: 'all' }}>
        <button onClick={toggle} aria-label="Notifications" className={`notif-bell-btn${inline ? ' notif-bell-btn--dark' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -5,
              minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9,
              background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, sans-serif', border: '2px solid white',
              boxShadow: '0 1px 4px rgba(239,68,68,.4)',
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>

      {/* ── Panneau ── */}
      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="notif-panel" ref={panelRef} aria-label="Centre de notifications">

            {/* En-tete */}
            <div style={{ background: '#0f172a', padding: '16px 18px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'white' }}>
                    Notifications
                    {unreadCount > 0 && (
                      <span style={{ marginLeft: 8, background: '#3b82f6', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                        {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.38)', marginTop: 2 }}>
                    {items.length === 0 ? 'Aucune notification' : items.length + ' au total'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="notif-action-btn" style={{ background: 'rgba(59,130,246,.18)', color: '#93c5fd' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Tout lire
                    </button>
                  )}
                  {items.length > 0 && (
                    <button onClick={deleteAll} disabled={clearing} className="notif-action-btn" style={{ background: 'rgba(239,68,68,.15)', color: '#fca5a5' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      Vider
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} aria-label="Fermer" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.65)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              {/* Onglets */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0 }}>
                {(['all', 'unread'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} className="notif-tab" style={{
                    background: tab === t ? 'rgba(255,255,255,.12)' : 'transparent',
                    color: tab === t ? 'white' : 'rgba(255,255,255,.45)',
                    borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
                    borderRadius: '7px 7px 0 0', marginBottom: -1,
                  }}>
                    {t === 'all' ? 'Toutes' : 'Non lues'}
                    {t === 'unread' && unreadCount > 0 && (
                      <span style={{ marginLeft: 6, background: '#ef4444', color: 'white', fontSize: 9, fontWeight: 800, padding: '0 5px', borderRadius: 8 }}>{unreadCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {displayed.length === 0 ? (
                <div style={{ padding: '64px 20px', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                    {tab === 'unread' ? 'Tout est lu' : 'Aucune notification'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>
                    {tab === 'unread' ? 'Pas de nouvelle notification' : 'Rien pour le moment'}
                  </div>
                </div>
              ) : (
                displayed.map(n => {
                  const color  = TYPE_COLOR[n.type] || TYPE_COLOR.info;
                  const isNew  = !n.is_read;
                  const isDel  = deletingId === n.id;

                  const rowContent = (
                    <div
                      className="notif-row"
                      onClick={() => { if (isNew) markOneRead(n.id); if (n.link) setOpen(false); }}
                      style={{
                        background: isDel ? '#fef2f2' : isNew ? '#f0f7ff' : 'white',
                        opacity: isDel ? 0.4 : 1,
                        transition: 'opacity .2s, background .12s',
                        paddingRight: 44, // place pour le bouton delete
                      }}
                    >
                      <TypeIcon type={n.type} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: isNew ? 700 : 400, color: '#0f172a', lineHeight: 1.4 }}>
                          {isNew && (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />
                          )}
                          {n.title}
                        </div>
                        {n.message && (
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {n.message}
                          </div>
                        )}
                        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5 }}>
                          {relTime(n.created_at)}
                        </div>
                      </div>

                      {/* Bouton supprimer (visible au survol) */}
                      <button
                        className="notif-del-btn"
                        onClick={(e) => deleteOne(e, n.id)}
                        aria-label="Supprimer"
                        title="Supprimer"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  );

                  return n.link
                    ? <Link key={n.id} href={n.link} style={{ textDecoration: 'none', display: 'block' }}>{rowContent}</Link>
                    : <div key={n.id}>{rowContent}</div>;
                })
              )}
            </div>

            {/* Pied de panneau */}
            {items.length > 5 && (
              <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', textAlign: 'center', flexShrink: 0 }}>
                {items.length} notification{items.length > 1 ? 's' : ''} au total
              </div>
            )}
          </aside>
        </>
      )}

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', bottom: 22, right: 20, zIndex: 10000, display: 'flex', flexDirection: 'column-reverse', gap: 10, pointerEvents: 'none' }}>
        {toasts.map(toast => {
          const color = TYPE_COLOR[toast.type] || TYPE_COLOR.info;
          const content = (
            <div className="toast-card" style={{ borderLeft: '4px solid ' + color }}>
              <TypeIcon type={toast.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>{toast.title}</div>
                {toast.message && (
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{toast.message}</div>
                )}
              </div>
              <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Fermer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          );
          return (
            <div key={toast.id} style={{ pointerEvents: 'all' }}>
              {toast.link ? <Link href={toast.link} style={{ textDecoration: 'none', display: 'block' }}>{content}</Link> : content}
            </div>
          );
        })}
      </div>
    </>
  );
}
