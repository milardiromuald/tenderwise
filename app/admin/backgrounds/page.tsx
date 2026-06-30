'use client';

import { useEffect, useState } from 'react';
import ImageUpload from '../ImageUpload';

interface Background { id: number; url: string; label: string; sort_order: number; active: number }

/** Style commun des boutons-icônes carrés du pied de carte. */
function iconBtn(color: string, border: string): React.CSSProperties {
  return {
    width: 30, height: 30, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'white', color, border: `1.5px solid ${border}`,
    borderRadius: 7, cursor: 'pointer', padding: 0,
  };
}

export default function BackgroundsPage() {
  const [list, setList] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState('');     // URL téléversée en attente d’ajout
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/backgrounds')
      .then((r) => r.json())
      .then((d) => setList(d.backgrounds || []))
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!pending) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/backgrounds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pending, label }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erreur'); return; }
      setList(d.backgrounds || []);
      setPending(''); setLabel('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur réseau'); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Supprimer ce fond ?')) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/backgrounds?id=${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erreur'); return; }
      setList(d.backgrounds || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur réseau'); }
    finally { setBusy(false); }
  };

  // ── Renommage en ligne ────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const startEdit = (b: Background) => { setEditingId(b.id); setEditLabel(b.label || ''); setError(''); };
  const cancelEdit = () => { setEditingId(null); setEditLabel(''); };

  const patch = async (id: number, body: { label?: string; active?: boolean }) => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/backgrounds', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erreur'); return; }
      setList(d.backgrounds || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur réseau'); }
    finally { setBusy(false); }
  };

  const saveRename = async (id: number) => { await patch(id, { label: editLabel.trim() }); cancelEdit(); };
  const toggleActive = (b: Background) => patch(b.id, { active: !b.active });

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: '#003366', margin: '0 0 6px' }}>
        Fonds d’en-tête
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
        Images de fond prédéfinies utilisées pour les en-têtes d’articles (à la place de la génération IA).
        Un fond est choisi <strong>au hasard</strong> à chaque article, puis le <strong>titre et le sous-titre</strong> y sont incrustés automatiquement (modifiables ensuite dans l’éditeur de validation).
        Prévoyez idéalement <strong>3 images</strong> au format paysage 16:9 (1200×675 px minimum).
      </p>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Ajout */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Ajouter un fond</h2>
        <ImageUpload value={pending} onChange={setPending} label="Image (16:9)" hint="JPEG/PNG/WebP — 1200×675 px minimum" previewHeight={150} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom (optionnel, ex. « Bleu institutionnel »)"
            style={{ flex: 1, minWidth: 200, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }} />
          <button onClick={add} disabled={!pending || busy}
            style={{ padding: '10px 18px', background: pending && !busy ? '#004a99' : '#9ca3af', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: pending && !busy ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif' }}>
            {busy ? '…' : 'Ajouter ce fond'}
          </button>
        </div>
      </div>

      {/* Liste */}
      <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
        Fonds actuels ({list.length})
      </h2>
      {loading ? (
        <p style={{ color: '#9ca3af' }}>Chargement…</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 14, padding: 20, border: '1px dashed #cbd5e1', borderRadius: 10, textAlign: 'center' }}>
          Aucun fond configuré. Ajoutez-en au moins un ci-dessus (sinon les nouveaux articles n’auront pas d’image).
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {list.map((b) => {
            const inactive = !b.active;
            const editing = editingId === b.id;
            return (
            <div key={b.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', opacity: inactive ? 0.55 : 1 }}>
              <div style={{ position: 'relative' }}>
                <img src={b.url} alt={b.label} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', background: '#f3f4f6', filter: inactive ? 'grayscale(0.6)' : 'none' }} />
                {inactive && (
                  <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(17,24,39,0.78)', color: 'white', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6, letterSpacing: '0.03em' }}>
                    Inactif
                  </span>
                )}
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                {editing ? (
                  <>
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(b.id); if (e.key === 'Escape') cancelEdit(); }}
                      autoFocus
                      placeholder={`Fond #${b.id}`}
                      style={{ flex: 1, minWidth: 0, padding: '5px 8px', border: '1px solid #93c5fd', borderRadius: 6, fontSize: 13, outline: 'none' }}
                    />
                    <button onClick={() => saveRename(b.id)} disabled={busy} aria-label="Enregistrer le nom" title="Enregistrer"
                      style={iconBtn('#059669', '#a7f3d0')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button onClick={cancelEdit} disabled={busy} aria-label="Annuler" title="Annuler"
                      style={iconBtn('#6b7280', '#e5e7eb')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.label || `Fond #${b.id}`}
                    </span>
                    <button onClick={() => toggleActive(b)} disabled={busy} aria-label={inactive ? 'Activer' : 'Désactiver'} title={inactive ? 'Activer (réintègre le tirage au sort)' : 'Désactiver (exclu du tirage)'}
                      style={iconBtn(inactive ? '#9ca3af' : '#0369a1', inactive ? '#e5e7eb' : '#bae6fd')}>
                      {inactive ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                    <button onClick={() => startEdit(b)} disabled={busy} aria-label="Renommer" title="Renommer"
                      style={iconBtn('#004a99', '#bfdbfe')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => remove(b.id)} disabled={busy} aria-label="Supprimer" title="Supprimer"
                      style={iconBtn('#dc2626', '#fecaca')}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
