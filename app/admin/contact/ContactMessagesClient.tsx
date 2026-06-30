'use client';

import { useState } from 'react';
import { toCsv, downloadCsv } from '@/lib/csvExport';

type Statut = 'nouveau' | 'lu' | 'archive';

interface Message {
  id: number;
  nom: string;
  email: string;
  telephone: string | null;
  societe: string | null;
  objet: string;
  message_preview: string;
  statut: Statut;
  rgpd_consent: number;
  created_at: string;
}

interface Props {
  initialMessages: Message[];
  counts: Record<string, number>;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUT_LABELS: Record<Statut, string> = { nouveau: 'Nouveau', lu: 'Lu', archive: 'Archivé' };
const STATUT_COLORS: Record<Statut, { bg: string; color: string }> = {
  nouveau: { bg: '#eff6ff', color: '#1d4ed8' },
  lu:      { bg: '#f0fdf4', color: '#15803d' },
  archive: { bg: '#f3f4f6', color: '#6b7280' },
};

/* ── Détail d’un message ─────────────────────────────────────── */
function MessageDetail({ msg, onClose, onStatusChange, onDelete }: {
  msg: Message;
  onClose: () => void;
  onStatusChange: (id: number, s: Statut) => void;
  onDelete: (id: number) => void;
}) {
  const [delConfirm, setDelConfirm] = useState(false);
  const [fullMsg, setFullMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (fullMsg !== null) return;
    setLoading(true);
    const res = await fetch(`/api/contact-messages/${msg.id}`);
    const data = await res.json();
    setFullMsg(data.message?.message ?? msg.message_preview);
    setLoading(false);
  };

  // Load on mount
  if (fullMsg === null && !loading) load();

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '680px', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: STATUT_COLORS[msg.statut].bg, color: STATUT_COLORS[msg.statut].color }}>
                {STATUT_LABELS[msg.statut]}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{formatDate(msg.created_at)}</span>
            </div>
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>{msg.objet}</h2>
          </div>
          <button onClick={onClose}
            style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem', color: '#6b7280' }}>
            ×
          </button>
        </div>

        {/* Sender info */}
        <div style={{ padding: '20px 28px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { l: 'Expéditeur', v: msg.nom },
            { l: 'Email', v: msg.email, href: `mailto:${msg.email}` },
            msg.telephone ? { l: 'Téléphone', v: msg.telephone, href: `tel:${msg.telephone.replace(/\s/g, '')}` } : null,
            msg.societe ? { l: 'Société', v: msg.societe } : null,
          ].filter(Boolean).map((item) => item && (
            <div key={item.l}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>{item.l}</p>
              {item.href
                ? <a href={item.href} style={{ color: '#004a99', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>{item.v}</a>
                : <span style={{ color: '#111827', fontWeight: 600, fontSize: '0.875rem' }}>{item.v}</span>
              }
            </div>
          ))}
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>Consentement RGPD</p>
            <span style={{ color: msg.rgpd_consent ? '#059669' : '#dc2626', fontWeight: 600, fontSize: '0.875rem' }}>
              {msg.rgpd_consent ? '✓ Accepté' : '✗ Non renseigné'}
            </span>
          </div>
        </div>

        {/* Message body */}
        <div style={{ padding: '24px 28px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Message</p>
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '18px 20px', borderLeft: '4px solid #004a99' }}>
            <p style={{ color: '#334155', fontSize: '0.925rem', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
              {loading ? 'Chargement…' : (fullMsg ?? msg.message_preview)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a href={`mailto:${msg.email}?subject=RE: ${encodeURIComponent(msg.objet)}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#004a99', color: 'white', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '0.875rem' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Répondre par email
          </a>

          {(['lu', 'archive', 'nouveau'] as Statut[]).filter(s => s !== msg.statut).map(s => (
            <button key={s} onClick={() => onStatusChange(msg.id, s)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', color: '#374151', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', fontFamily: 'inherit' }}>
              {s === 'lu' ? '✓ Marquer comme lu' : s === 'archive' ? '📁 Archiver' : '↩ Remettre en nouveau'}
            </button>
          ))}

          {!delConfirm
            ? <button onClick={() => setDelConfirm(true)}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', fontFamily: 'inherit' }}>
                🗑 Supprimer
              </button>
            : <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>Confirmer ?</span>
                <button onClick={() => onDelete(msg.id)}
                  style={{ background: '#dc2626', color: 'white', padding: '9px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit' }}>Oui</button>
                <button onClick={() => setDelConfirm(false)}
                  style={{ background: '#f3f4f6', color: '#374151', padding: '9px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit' }}>Non</button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function ContactMessagesClient({ initialMessages, counts }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Message | null>(null);

  const total   = Object.values(counts).reduce((a, b) => a + b, 0);
  const nouveau = counts['nouveau'] || 0;
  const lu      = counts['lu']      || 0;
  const archive = counts['archive'] || 0;

  const filtered = filter === 'all' ? messages : messages.filter(m => m.statut === filter);

  const handleStatusChange = async (id: number, statut: Statut) => {
    await fetch(`/api/contact-messages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, statut } : m));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/contact-messages/${id}`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== id));
    setSelected(null);
  };

  const handleExport = () => {
    const csv = toCsv(filtered, [
      { key: 'nom', label: 'Nom' },
      { key: 'email', label: 'Email' },
      { key: 'telephone', label: 'Téléphone' },
      { key: 'societe', label: 'Société' },
      { key: 'objet', label: 'Objet' },
      { key: 'message_preview', label: 'Message' },
      { key: 'statut', label: 'Statut' },
      { key: 'created_at', label: 'Reçu le' },
    ]);
    downloadCsv(`messages-contact-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>
          Messages de contact
        </h1>
        <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '0.88rem' }}>
          Tous les messages reçus via le formulaire de contact du site
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginBottom: '2rem' }}>
        {[
          { label: 'Total', value: total, color: '#003366', bg: '#eff6ff' },
          { label: 'Nouveaux', value: nouveau, color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'Lus', value: lu, color: '#15803d', bg: '#dcfce7' },
          { label: 'Archivés', value: archive, color: '#6b7280', bg: '#f3f4f6' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, fontFamily: 'Montserrat, sans-serif', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `Tous (${total})` },
            { key: 'nouveau', label: `Nouveaux (${nouveau})` },
            { key: 'lu', label: `Lus (${lu})` },
            { key: 'archive', label: `Archivés (${archive})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '8px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'all 0.15s', background: filter === f.key ? '#004a99' : 'white', color: filter === f.key ? 'white' : '#475569', boxShadow: filter === f.key ? '0 4px 12px rgba(0,74,153,0.2)' : '0 1px 3px rgba(0,0,0,0.06)', outline: filter !== f.key ? '1px solid #e5e7eb' : 'none' }}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={handleExport} disabled={filtered.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.83rem', cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: '1px solid #e5e7eb', background: 'white', color: filtered.length === 0 ? '#cbd5e1' : '#374151' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exporter CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Aucun message {filter !== 'all' ? `avec le statut "${STATUT_LABELS[filter as Statut]}"` : 'reçu pour le moment'}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Expéditeur', 'Objet', 'Statut', 'Reçu le', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setSelected(m)}>
                  <td style={{ padding: '13px 16px', maxWidth: '220px' }}>
                    <div style={{ fontWeight: m.statut === 'nouveau' ? 700 : 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nom}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                    {m.societe && <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '2px' }}>{m.societe}</div>}
                  </td>
                  <td style={{ padding: '13px 16px', maxWidth: '280px' }}>
                    <div style={{ fontWeight: m.statut === 'nouveau' ? 700 : 500, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.objet}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message_preview}…</div>
                  </td>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: STATUT_COLORS[m.statut].bg, color: STATUT_COLORS[m.statut].color }}>
                      {m.statut === 'nouveau' && <span style={{ marginRight: '4px' }}>●</span>}
                      {STATUT_LABELS[m.statut]}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#6b7280' }}>
                    {formatDate(m.created_at)}
                  </td>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={e => { e.stopPropagation(); setSelected(m); }}
                        style={{ padding: '5px 12px', background: '#eff6ff', color: '#004a99', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'inherit' }}>
                        Voir
                      </button>
                      {m.statut === 'nouveau' && (
                        <button onClick={e => { e.stopPropagation(); handleStatusChange(m.id, 'lu'); }}
                          style={{ padding: '5px 10px', background: '#f0fdf4', color: '#15803d', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'inherit' }}>
                          ✓ Lu
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); handleDelete(m.id); }}
                        style={{ padding: '5px 10px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'inherit' }}>
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* RGPD reminder */}
      <div style={{ marginTop: '20px', background: '#eff6ff', borderRadius: '12px', padding: '14px 18px', border: '1px solid #bfdbfe', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <p style={{ fontSize: '0.78rem', color: '#1e40af', margin: 0, lineHeight: 1.6 }}>
          <strong>RGPD :</strong> Ces données personnelles doivent être supprimées conformément à la durée de conservation définie dans vos paramètres (configurée dans Paramètres du site → Contact &amp; SMTP). Tous les expéditeurs ont consenti au traitement de leurs données via le formulaire.
        </p>
      </div>

      {/* Detail modal */}
      {selected && (
        <MessageDetail
          msg={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
