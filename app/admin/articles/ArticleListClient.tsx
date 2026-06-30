'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';

function DeleteRowButton({ id }: { id: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setLoading(true);
    await fetch(`/api/articles/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
      disabled={loading}
      style={{ padding: '6px 12px', background: confirming ? '#dc2626' : '#fef2f2', color: confirming ? 'white' : '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
    >
      {loading ? '…' : confirming ? 'Confirmer' : 'Supprimer'}
    </button>
  );
}

interface Article {
  id: number; titre: string; slug: string; categorie: string;
  statut: string; date_publication: string; meta_title: string;
  meta_description: string; temps_lecture: number; is_featured: number;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return String(dateStr).split(' ')[0]; }
}

export default function ArticleListClient({ articles }: { articles: Article[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError]   = useState('');
  const lastClickedRef = useRef<number | null>(null);

  const currentQ = searchParams.get('q') ?? '';

  function setSearch(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set('q', q); else params.delete('q');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function toggleAll() {
    if (selected.size === articles.length) setSelected(new Set());
    else setSelected(new Set(articles.map((a) => a.id)));
  }

  function toggleOne(id: number, shiftKey = false) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedRef.current !== null) {
        const ids = articles.map((a) => a.id);
        const lastIdx = ids.indexOf(lastClickedRef.current);
        const curIdx = ids.indexOf(id);
        const from = Math.min(lastIdx, curIdx);
        const to = Math.max(lastIdx, curIdx);
        for (let i = from; i <= to; i++) next.add(ids[i]);
      } else {
        if (next.has(id)) next.delete(id); else next.add(id);
      }
      return next;
    });
    lastClickedRef.current = id;
  }

  async function bulkAction(action: 'delete' | 'publie' | 'brouillon') {
    if (selected.size === 0) return;
    const ids = [...selected];
    const label = action === 'delete' ? `Supprimer ${ids.length} article(s) ?` : null;
    if (label && !confirm(label)) return;

    setBulkLoading(true);
    setBulkError('');
    try {
      await Promise.all(
        ids.map((id) =>
          action === 'delete'
            ? fetch(`/api/articles/${id}`, { method: 'DELETE' })
            : fetch(`/api/articles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statut: action }),
              }),
        ),
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      setBulkError('Une erreur est survenue. Rechargez la page et réessayez.');
    } finally {
      setBulkLoading(false);
    }
  }

  const allChecked  = articles.length > 0 && selected.size === articles.length;
  const someChecked = selected.size > 0;

  return (
    <>
      {/* Search bar */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Rechercher un article…"
            defaultValue={currentQ}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 14px 9px 36px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {currentQ && (
          <button onClick={() => setSearch('')} style={{ fontSize: '0.8rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            Effacer
          </button>
        )}
      </div>

      {/* Bulk action bar — always in DOM to avoid layout shift, shown via opacity+height */}
      <div style={{
        overflow: 'hidden',
        maxHeight: someChecked ? '60px' : '0',
        opacity: someChecked ? 1 : 0,
        transition: 'max-height 0.2s ease, opacity 0.15s ease',
        marginBottom: someChecked ? '1rem' : '0',
      }}>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1d4ed8' }}>
            {selected.size} article{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => bulkAction('publie')} disabled={bulkLoading} style={{ padding: '6px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              ● Publier
            </button>
            <button onClick={() => bulkAction('brouillon')} disabled={bulkLoading} style={{ padding: '6px 14px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              ○ Brouillon
            </button>
            <button onClick={() => bulkAction('delete')} disabled={bulkLoading} style={{ padding: '6px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              Supprimer
            </button>
          </div>
          {bulkError && <span style={{ fontSize: '0.78rem', color: '#dc2626' }}>{bulkError}</span>}
          {bulkLoading && <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>En cours…</span>}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {articles.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
            {currentQ ? `Aucun article pour « ${currentQ} »` : 'Aucun article.'}{' '}
            {!currentQ && <Link href="/admin/articles/new" style={{ color: '#004a99', fontWeight: 600 }}>Créer le premier →</Link>}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem', width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    title="Tout sélectionner"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                {['Article', 'Catégorie', 'Statut', 'SEO', 'Date', ''].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {articles.map((a, i) => {
                const seoOk = Boolean(a.meta_title && a.meta_description);
                const seoPartial = Boolean(a.meta_title || a.meta_description);
                const statusLabel =
                  a.statut === 'publie'    ? { text: '● Publié',     bg: '#d1fae5', color: '#065f46' } :
                  a.statut === 'programme' ? { text: '⏰ Programmé', bg: '#fef3c7', color: '#92400e' } :
                  { text: '○ Brouillon', bg: '#f3f4f6', color: '#6b7280' };
                const isSelected = selected.has(a.id);

                return (
                  <tr
                    key={a.id}
                    style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: isSelected ? '#f0f7ff' : undefined, transition: 'background 0.1s' }}
                  >
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => toggleOne(a.id, e.shiftKey)}
                        title="Shift+clic pour sélectionner une plage"
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', maxWidth: '320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {a.is_featured ? <span title="À la une" style={{ fontSize: '0.85rem' }}>📌</span> : null}
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titre}</div>
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '2px', paddingLeft: a.is_featured ? '22px' : '0' }}>
                        /blog/{a.slug}{a.temps_lecture > 0 && <span style={{ marginLeft: '8px' }}>· {a.temps_lecture} min</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      {a.categorie ? <span style={{ padding: '3px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{a.categorie}</span> : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: statusLabel.bg, color: statusLabel.color }}>
                        {statusLabel.text}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700, background: seoOk ? '#d1fae5' : seoPartial ? '#fef3c7' : '#f3f4f6', color: seoOk ? '#065f46' : seoPartial ? '#92400e' : '#9ca3af' }}>
                        {seoOk ? '✓ OK' : seoPartial ? '⚠ Partiel' : '✗ Vide'}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.83rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {a.statut === 'programme'
                        ? <span style={{ color: '#d97706', fontWeight: 600 }}>{formatDateShort(a.date_publication)}</span>
                        : formatDateShort(a.date_publication)
                      }
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <Link href={`/admin/articles/${a.id}/preview`} style={{ padding: '6px 12px', background: '#f0fdf4', color: '#059669', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>Aperçu</Link>
                        <Link href={`/admin/articles/${a.id}`} style={{ padding: '6px 12px', background: '#eff6ff', color: '#004a99', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>Modifier</Link>
                        <DeleteRowButton id={a.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {articles.length > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#9ca3af', textAlign: 'right' }}>
          {articles.length} article{articles.length > 1 ? 's' : ''}{currentQ ? ` trouvé${articles.length > 1 ? 's' : ''}` : ''}
        </div>
      )}
    </>
  );
}
