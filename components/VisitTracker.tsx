'use client';

/**
 * Mesure d'audience 1ʳᵉ partie — envoie une « vue de page » à /api/track
 * et la durée de lecture à /api/track-duration.
 *
 * RGPD : n'envoie RIEN tant que le visiteur n'a pas accepté la « Mesure
 * d'audience » dans le bandeau cookies (lecture du cookie tw_consent).
 * Aucune donnée n'est collectée pour un visiteur qui a refusé.
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

function analyticsConsented(): boolean {
  if (typeof document === 'undefined') return false;
  const m = document.cookie.match(/(?:^|; )tw_consent=([^;]+)/);
  if (!m) return false;
  try { return JSON.parse(decodeURIComponent(m[1])).analytics === true; }
  catch { return false; }
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('tw_sid');
    if (!id) {
      id = (crypto?.randomUUID?.() || 's-' + Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 40);
      sessionStorage.setItem('tw_sid', id);
    }
    return id;
  } catch { return ''; }
}

export default function VisitTracker() {
  const pathname = usePathname();
  const last      = useRef<string | null>(null);
  const visitId   = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  const flushDuration = useCallback(() => {
    if (!visitId.current || !startTime.current) return;
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    if (elapsed < 2 || elapsed > 7200) { visitId.current = null; startTime.current = 0; return; }

    const payload = JSON.stringify({ visit_id: visitId.current, duration_seconds: elapsed });
    visitId.current  = null;
    startTime.current = 0;

    // sendBeacon : garanti même si la page se ferme
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track-duration', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track-duration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }
  }, []);

  // Envoi à la fermeture / changement d'onglet
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushDuration(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', flushDuration);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', flushDuration);
    };
  }, [flushDuration]);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith('/admin') || pathname.startsWith('/review')) return;
    if (!analyticsConsented()) return;

    // Navigation SPA : envoie la durée de la page précédente avant d'enregistrer la nouvelle
    flushDuration();

    if (last.current === pathname) return; // évite le double-envoi (StrictMode / re-render)
    last.current    = pathname;
    startTime.current = Date.now();

    const payload = JSON.stringify({
      path: pathname + (typeof location !== 'undefined' ? location.search : ''),
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      session_id: sessionId(),
    });

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean; visit_id?: number }) => {
        if (data.visit_id) visitId.current = data.visit_id;
      })
      .catch(() => { /* silencieux */ });
  }, [pathname, flushDuration]);

  return null;
}
