'use client';

import { useEffect, useState } from 'react';
import { toCsv, downloadCsv } from '@/lib/csvExport';

interface Application {
  id: number;
  job_id: number | null;
  job_title: string | null;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  message: string | null;
  cv_filename: string | null;
  cv_size: number | null;
  lm_filename: string | null;
  lm_size: number | null;
  rgpd_consent: number;
  rgpd_consent_date: string | null;
  ip_address: string | null;
  statut: string;
  created_at: string;
}

const STATUTS: Record<string, { label: string; bg: string; fg: string }> = {
  nouveau: { label: 'Nouveau', bg: '#dbeafe', fg: '#1d4ed8' },
  lu:      { label: 'Lu',      bg: '#f1f5f9', fg: '#475569' },
  traite:  { label: 'Traité',  bg: '#dcfce7', fg: '#15803d' },
  archive: { label: 'Archivé', bg: '#fef3c7', fg: '#92400e' },
};

function fmtSize(n: number | null): string {
  if (!n) return '';
  return n > 1024 * 1024 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.ceil(n / 1024)} Ko`;
}

export default function ApplicationsClient() {
  const [rows, setRows] = useState<Application[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Application | null>(null);

  const load = () => {
    fetch('/api/applications?limit=500')
      .then((r) => r.json())
      .then((d) => {
        if (d.error === 'table_absente') { setErr('table'); setRows([]); return; }
        setRows(d.rows || []); setCounts(d.counts || {});
      })
      .catch(() => setErr('reseau'));
  };
  useEffect(load, []);

  const setStatut = async (id: number, statut: string) => {
    await fetch(`/api/applications/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }) });
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, statut } : r)) || null);
    setSelected((s) => (s && s.id === id ? { ...s, statut } : s));
  };

  const remove = async (id: number) => {
    if (!confirm('Supprimer définitivement cette candidature et ses pièces jointes ? (droit à l’effacement)')) return;
    await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    setRows((prev) => prev?.filter((r) => r.id !== id) || null);
    setSelected(null);
    load();
  };

  const exportCsv = () => {
    if (!rows || rows.length === 0) return;
    const csv = toCsv(rows, [
      { key: 'created_at', label: 'Date' },
      { key: 'prenom', label: 'Prénom' },
      { key: 'nom', label: 'Nom' },
      { key: 'job_title', label: 'Poste' },
      { key: 'email', label: 'Email' },
      { key: 'telephone', label: 'Téléphone' },
      { key: 'statut', label: 'Statut' },
    ]);
    downloadCsv(`candidatures-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div style={{ padding: '2rem 2.5rem', minHeight: '100%' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.65rem', color: '#003366', margin: 0 }}>Candidatures reçues</h1>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '5px' }}>CV et lettres de motivation déposés via la page Carrière (données personnelles — accès restreint).</p>
      </div>

      {err === 'table' && (
        <div style={{ padding: '14px 18px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', color: '#0369a1', fontSize: '0.85rem', lineHeight: 1.6 }}>
          La table <code>job_applications</code> n’existe pas encore. Exécutez <code>schema-applications.sql</code> dans phpMyAdmin pour activer la réception des candidatures.
        </div>
      )}

      {!err && rows === null && <p style={{ color: '#9ca3af' }}>Chargement…</p>}

      {rows && rows.length >= 0 && !err && (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {['nouveau', 'lu', 'traite', 'archive'].map((s) => (
                <div key={s} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 18px', minWidth: '110px' }}>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, color: STATUTS[s].fg, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>{counts[s] || 0}</p>
                  <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{STATUTS[s].label}</p>
                </div>
              ))}
            </div>
            <button onClick={exportCsv} disabled={rows.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.83rem', cursor: rows.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: '1px solid #e5e7eb', background: 'white', color: rows.length === 0 ? '#cbd5e1' : '#374151' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exporter CSV
            </button>
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
              Aucune candidature reçue pour l’instant.
            </div>
          ) : (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                      {['Date', 'Candidat', 'Poste', 'Contact', 'Pièces', 'Statut', ''].map((h) => (
                        <th key={h} style={{ padding: '11px 14px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelected(r)}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>{r.created_at}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{r.prenom} {r.nom}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{r.job_title || (r.job_id ? `Offre #${r.job_id}` : 'Spontanée')}</td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>{r.email}<br /><span style={{ color: '#94a3b8' }}>{r.telephone}</span></td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <a href={`/api/applications/${r.id}?doc=cv`} style={{ color: '#004a99', fontWeight: 600, fontSize: '0.8rem' }}>CV</a>
                          {r.lm_filename && <> · <a href={`/api/applications/${r.id}?doc=lm`} style={{ color: '#004a99', fontWeight: 600, fontSize: '0.8rem' }}>LM</a></>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: STATUTS[r.statut]?.bg || '#f1f5f9', color: STATUTS[r.statut]?.fg || '#475569' }}>
                            {STATUTS[r.statut]?.label || r.statut}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => remove(r.id)} title="Effacer (RGPD)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem' }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Détail */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '28px 30px', position: 'relative' }}>
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: '18px', right: '20px', background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: '#94a3b8' }}>×</button>
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.3rem', color: '#003366', margin: '0 0 4px' }}>{selected.prenom} {selected.nom}</h2>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 20px' }}>{selected.job_title || 'Candidature spontanée'} · reçu le {selected.created_at}</p>

            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
              {[['Email', selected.email], ['Téléphone', selected.telephone], ['IP', selected.ip_address || '—'], ['Consentement', selected.rgpd_consent ? `✓ ${selected.rgpd_consent_date || ''}` : '✗']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '12px', fontSize: '0.88rem' }}>
                  <span style={{ width: '110px', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: '#334155' }}>{v}</span>
                </div>
              ))}
            </div>

            {selected.message && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Message</p>
                <div style={{ background: '#f8fafc', borderLeft: '3px solid #004a99', borderRadius: '0 8px 8px 0', padding: '12px 16px', color: '#334155', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.message}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <a href={`/api/applications/${selected.id}?doc=cv`} style={{ padding: '10px 18px', background: '#004a99', color: 'white', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>⬇ CV {fmtSize(selected.cv_size)}</a>
              {selected.lm_filename && <a href={`/api/applications/${selected.id}?doc=lm`} style={{ padding: '10px 18px', background: 'white', color: '#004a99', border: '1px solid #004a99', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>⬇ Lettre {fmtSize(selected.lm_size)}</a>}
              <a href={`mailto:${selected.email}?subject=${encodeURIComponent(`RE: ${selected.job_title || 'Votre candidature'}`)}`} style={{ padding: '10px 18px', background: 'white', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>✉ Répondre par email</a>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginRight: '4px' }}>Statut :</span>
              {Object.keys(STATUTS).map((s) => (
                <button key={s} onClick={() => setStatut(selected.id, s)} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${selected.statut === s ? STATUTS[s].fg : '#e5e7eb'}`, background: selected.statut === s ? STATUTS[s].bg : 'white', color: selected.statut === s ? STATUTS[s].fg : '#64748b', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>{STATUTS[s].label}</button>
              ))}
              <button onClick={() => remove(selected.id)} style={{ marginLeft: 'auto', padding: '8px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>🗑 Effacer (RGPD)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
