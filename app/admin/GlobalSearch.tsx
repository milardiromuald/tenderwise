'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface SearchResult {
  type: 'article' | 'message' | 'application' | 'project';
  id: number;
  title: string;
  sub: string;
  href: string;
}

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  article: 'Article', message: 'Message', application: 'Candidature', project: 'Réalisation',
};
const TYPE_COLOR: Record<SearchResult['type'], string> = {
  article: '#004a99', message: '#0369a1', application: '#7c3aed', project: '#0f766e',
};

/**
 * Recherche globale admin (articles, messages, candidatures, réalisations).
 * Chaque section avait déjà sa propre recherche locale (articles uniquement) —
 * rien ne permettait de chercher à travers tout le contenu en une fois.
 */
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, search]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={toggle}
        aria-label="Recherche globale"
        style={{
          width: 38, height: 38, borderRadius: 9, cursor: 'pointer',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)', transition: 'background .15s, color .15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0, width: 360, maxWidth: '90vw',
          background: 'white', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          border: '1px solid #e5e7eb', zIndex: 200, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher articles, messages, candidatures, réalisations…"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {q.trim().length < 2 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>
                Tapez au moins 2 caractères…
              </div>
            ) : loading ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>
                Recherche…
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>
                Aucun résultat pour « {q} »
              </div>
            ) : (
              results.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  href={r.href}
                  onClick={() => setOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', textDecoration: 'none', borderBottom: '1px solid #f8fafc' }}
                >
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                    background: `${TYPE_COLOR[r.type]}1a`, color: TYPE_COLOR[r.type], whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {TYPE_LABEL[r.type]}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
