'use client';

import { useEffect, useState } from 'react';

interface RgpdClientProps {
  settings: Record<string, string>;
  activeSection: string;
}

/* ─── Styles partagés (alignés sur SettingsClient) ──────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.925rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.78rem', color: '#374151',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
};

function Field({ label, name, value, onChange, type = 'text', hint, placeholder, rows = 3 }: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void;
  type?: string; hint?: string; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {type === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(name, e.target.value)} rows={rows} placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical' }} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
      {hint && <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', margin: 0 }}>{label}</p>
        {hint && <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '3px 0 0' }}>{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} style={{
        flexShrink: 0, width: '46px', height: '26px', borderRadius: '999px', border: 'none', position: 'relative',
        cursor: 'pointer', background: checked ? '#004a99' : '#cbd5e1', transition: 'background 0.2s', marginTop: '2px',
      }}>
        <span style={{ position: 'absolute', top: '3px', left: checked ? '23px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

function SectionHeading({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '1.75rem', paddingBottom: '1.25rem', borderBottom: '2px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: description ? '6px' : 0 }}>
        <span style={{ fontSize: '1.35rem' }}>{icon}</span>
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: '#111827', margin: 0 }}>{title}</h2>
      </div>
      {description && <p style={{ fontSize: '0.83rem', color: '#6b7280', margin: 0 }}>{description}</p>}
    </div>
  );
}

function Card({ children, cols = '1fr', gap = '1.5rem' }: { children: React.ReactNode; cols?: string; gap?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'grid', gap, gridTemplateColumns: cols, marginBottom: '1.5rem' }}>
      {children}
    </div>
  );
}

const SECTION_META: Record<string, { icon: string; title: string; description: string }> = {
  banner:     { icon: '🍪', title: 'Bandeau de consentement', description: 'Activation, textes et libellés du bandeau cookies affiché aux visiteurs.' },
  categories: { icon: '🗂', title: 'Catégories de cookies', description: 'Définissez les familles de cookies proposées dans le panneau « Personnaliser ».' },
  dpo:        { icon: '🛡', title: 'Responsable de traitement / DPO', description: 'Coordonnées du responsable et durées de conservation (politique de confidentialité).' },
  registre:   { icon: '📜', title: 'Registre des consentements', description: "Preuve horodatée de chaque choix (exigée par l'article 7.1 du RGPD)." },
  demandes:   { icon: '🔎', title: 'Demandes RGPD — Accès & Effacement', description: "Retrouver et supprimer les données d'une personne (droits d'accès, portabilité et effacement, art. 15/17/20)." },
};

interface ConsentRow {
  id: number; consent_id: string; necessary: number; analytics: number; marketing: number;
  action: string; policy_version: string | null; ip_address: string | null;
  user_agent: string | null; page_url: string | null; created_at: string;
}

export default function RgpdClient({ settings, activeSection }: RgpdClientProps) {
  const [values, setValues] = useState<Record<string, string>>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const v = (k: string, fb = '') => values[k] ?? fb;
  const bool = (k: string, def: boolean) => (values[k] ?? (def ? '1' : '0')) !== '0';
  const setBool = (k: string, val: boolean) => set(k, val ? '1' : '0');

  const save = async () => {
    setSaving(true); setSaved(false);
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const meta = SECTION_META[activeSection] || SECTION_META.banner;

  return (
    <div style={{ padding: '2rem 2.5rem', minHeight: '100%' }}>
      <style>{`input:focus, textarea:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08) !important; outline: none !important; }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.65rem', color: '#003366', margin: 0, lineHeight: 1.2 }}>RGPD &amp; Cookies</h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '5px' }}>Conformité CNIL — bandeau, consentements et données personnelles</p>
        </div>
        {activeSection !== 'registre' && activeSection !== 'demandes' && (
          <button onClick={save} disabled={saving} style={{
            padding: '10px 24px', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem',
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap',
            background: saving ? '#9ca3af' : saved ? '#059669' : '#004a99', color: 'white',
          }}>
            {saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
          </button>
        )}
      </div>

      <SectionHeading icon={meta.icon} title={meta.title} description={meta.description} />

      {/* ── BANDEAU ──────────────────────────────────────────────────────── */}
      {activeSection === 'banner' && (
        <>
          <Card>
            <Toggle label="Afficher le bandeau cookies" hint="Désactivez uniquement si aucun cookie non essentiel n'est utilisé." checked={bool('cookie_banner_enabled', true)} onChange={(val) => setBool('cookie_banner_enabled', val)} />
          </Card>
          <Card cols="repeat(auto-fill, minmax(300px, 1fr))">
            <Field label="Titre du bandeau" name="cookie_banner_title" value={v('cookie_banner_title', 'Nous respectons votre vie privée')} onChange={set} />
            <Field label="Version de la politique" name="cookie_policy_version" value={v('cookie_policy_version', '1')} onChange={set} hint="Incrémentez (1 → 2) pour redemander le consentement à tous les visiteurs." />
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Texte du bandeau" name="cookie_banner_text" type="textarea" rows={3} value={v('cookie_banner_text')} onChange={set} hint="Doit indiquer clairement la finalité (mesure d'audience) et la possibilité de refuser." />
            </div>
            <Field label="Libellé « Accepter »" name="cookie_accept_label" value={v('cookie_accept_label', 'Tout accepter')} onChange={set} />
            <Field label="Libellé « Refuser »" name="cookie_reject_label" value={v('cookie_reject_label', 'Tout refuser')} onChange={set} />
            <Field label="Libellé « Personnaliser »" name="cookie_customize_label" value={v('cookie_customize_label', 'Personnaliser')} onChange={set} />
          </Card>
          <InfoBox tone="info">
            « Accepter » et « Refuser » sont volontairement présentés au même niveau (exigence CNIL : refuser doit être aussi simple qu'accepter). Tant qu'aucun choix n'est fait, Google Analytics reste bloqué (Consent Mode v2 « denied »).
          </InfoBox>
        </>
      )}

      {/* ── CATÉGORIES ───────────────────────────────────────────────────── */}
      {activeSection === 'categories' && (
        <>
          <Card cols="1fr">
            <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <p style={{ fontWeight: 700, fontSize: '0.88rem', color: '#003366', margin: '0 0 3px' }}>🔒 Cookies strictement nécessaires</p>
              <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0 }}>Toujours actifs — non désactivables (session admin, sécurité, mémorisation du choix cookies). Aucun consentement requis (CNIL).</p>
            </div>
          </Card>
          <Card>
            <Toggle label="Proposer la catégorie « Mesure d'audience »" hint="Active la mesure d'audience 1ʳᵉ partie dans le panneau Personnaliser." checked={bool('cookie_cat_analytics_enabled', true)} onChange={(val) => setBool('cookie_cat_analytics_enabled', val)} />
            <Field label="Description affichée au visiteur" name="cookie_cat_analytics_desc" type="textarea" rows={2} value={v('cookie_cat_analytics_desc')} onChange={set} />
          </Card>
          <Card>
            <Toggle label="Proposer la catégorie « Marketing / réseaux sociaux »" hint="N'activez que si vous déposez réellement des cookies publicitaires." checked={bool('cookie_cat_marketing_enabled', false)} onChange={(val) => setBool('cookie_cat_marketing_enabled', val)} />
            <Field label="Description affichée au visiteur" name="cookie_cat_marketing_desc" type="textarea" rows={2} value={v('cookie_cat_marketing_desc')} onChange={set} />
          </Card>
        </>
      )}

      {/* ── DPO ──────────────────────────────────────────────────────────── */}
      {activeSection === 'dpo' && (
        <Card cols="repeat(auto-fill, minmax(300px, 1fr))">
          <Field label="Responsable de traitement / DPO" name="rgpd_dpo_name" value={v('rgpd_dpo_name')} onChange={set} placeholder="Nom et prénom (facultatif)" hint="Personne à contacter pour l'exercice des droits." />
          <Field label="Email de contact RGPD" name="rgpd_dpo_email" type="email" value={v('rgpd_dpo_email', 'r.milardi@tenderwise.fr')} onChange={set} />
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Adresse postale" name="rgpd_dpo_address" value={v('rgpd_dpo_address')} onChange={set} placeholder="54 Avenue Général Leclerc, 69100 Villeurbanne" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Durées de conservation" name="rgpd_retention" type="textarea" rows={2} value={v('rgpd_retention', '13 mois (cookies) / 3 ans (prospects)')} onChange={set} hint="Affiché dans la politique de confidentialité." />
          </div>
        </Card>
      )}

      {/* ── REGISTRE ─────────────────────────────────────────────────────── */}
      {activeSection === 'registre' && <ConsentRegistry />}

      {/* ── DEMANDES / EFFACEMENT ────────────────────────────────────────── */}
      {activeSection === 'demandes' && <RgpdRequests dpoEmail={v('rgpd_dpo_email', 'r.milardi@tenderwise.fr')} />}
    </div>
  );
}

function InfoBox({ children, tone }: { children: React.ReactNode; tone: 'info' | 'ok' }) {
  const c = tone === 'ok'
    ? { bg: '#f0fdf4', bd: '#bbf7d0', fg: '#15803d' }
    : { bg: '#f0f9ff', bd: '#bae6fd', fg: '#0369a1' };
  return (
    <div style={{ padding: '12px 16px', background: c.bg, border: `1px solid ${c.bd}`, borderRadius: '10px', fontSize: '0.8rem', color: c.fg, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

/* ─── Registre des consentements ────────────────────────────────────────── */
function ConsentRegistry() {
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const reload = () => {
    fetch('/api/consent?limit=500')
      .then((r) => r.json())
      .then((d) => {
        if (d.error === 'table_absente') { setErr('table'); setRows([]); return; }
        setRows(d.rows || []);
        setCounts(d.counts || {});
        setSelected(new Set());
      })
      .catch(() => setErr('reseau'));
  };
  useEffect(reload, []);

  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((prev) => (prev.size === rows?.length ? new Set() : new Set(rows?.map((r) => r.id))));

  const del = async (payload: Record<string, unknown>, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await fetch('/api/consent', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      reload();
    } finally { setBusy(false); }
  };
  const delOne = (id: number) => del({ id }, 'Supprimer cette preuve de consentement ?');
  const delSelected = () => del({ ids: [...selected] }, `Supprimer les ${selected.size} preuve(s) sélectionnée(s) ?`);
  const delAll = () => del({ all: true }, '⚠️ Supprimer TOUT le registre ?\n\nVous perdrez la preuve des consentements (exigée par la CNIL en cas de contrôle). Action irréversible.');

  const exportCsv = () => {
    if (!rows) return;
    const head = ['id', 'date', 'action', 'analytics', 'marketing', 'version', 'ip', 'page', 'user_agent', 'consent_id'];
    const lines = rows.map((r) => [
      r.id, r.created_at, r.action, r.analytics ? 'oui' : 'non', r.marketing ? 'oui' : 'non',
      r.policy_version || '', r.ip_address || '', r.page_url || '',
      (r.user_agent || '').replace(/"/g, "'"), r.consent_id,
    ].map((c) => `"${String(c)}"`).join(';'));
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `consentements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (err === 'table') {
    return (
      <InfoBox tone="info">
        La table <code>cookie_consents</code> n'existe pas encore. Exécutez le fichier <code>schema-rgpd.sql</code> dans phpMyAdmin pour activer le registre. Le bandeau fonctionne déjà sans cela (les choix sont appliqués côté visiteur), mais la preuve en base ne sera pas archivée.
      </InfoBox>
    );
  }
  if (rows === null && !err) return <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Chargement…</p>;
  if (err) return <InfoBox tone="info">Impossible de charger le registre pour le moment.</InfoBox>;

  const badge = (label: string, n: number, color: string) => (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 18px', minWidth: '120px' }}>
      <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: 0, fontFamily: 'Montserrat, sans-serif' }}>{n}</p>
      <p style={{ fontSize: '0.73rem', color: '#6b7280', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        {badge('Tout accepté', counts.accept_all || 0, '#059669')}
        {badge('Tout refusé', counts.reject_all || 0, '#dc2626')}
        {badge('Personnalisé', counts.custom || 0, '#0369a1')}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={exportCsv} disabled={!rows?.length} style={{ padding: '10px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: rows?.length ? 'pointer' : 'not-allowed' }}>⬇ Exporter CSV</button>
          {selected.size > 0 && (
            <button onClick={delSelected} disabled={busy} style={{ padding: '10px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>🗑 Supprimer la sélection ({selected.size})</button>
          )}
          <button onClick={delAll} disabled={busy || !rows?.length} style={{ padding: '10px 18px', background: 'white', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: rows?.length ? 'pointer' : 'not-allowed' }}>Tout supprimer</button>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb' }}>
                  <input type="checkbox" checked={!!rows?.length && selected.size === rows?.length} onChange={toggleAll} style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#004a99' }} />
                </th>
                {['Date', 'Choix', 'Audience', 'Marketing', 'IP', 'Page', 'Version', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows?.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>Aucun consentement enregistré pour l'instant.</td></tr>
              )}
              {rows?.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: selected.has(r.id) ? '#f0f9ff' : 'transparent' }}>
                  <td style={{ padding: '9px 14px' }}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#004a99' }} />
                  </td>
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: '#475569' }}>{r.created_at}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                      background: r.action === 'accept_all' ? '#dcfce7' : r.action === 'reject_all' ? '#fee2e2' : '#e0f2fe',
                      color: r.action === 'accept_all' ? '#15803d' : r.action === 'reject_all' ? '#b91c1c' : '#0369a1',
                    }}>
                      {r.action === 'accept_all' ? 'Tout accepté' : r.action === 'reject_all' ? 'Tout refusé' : 'Personnalisé'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px' }}>{r.analytics ? '✅' : '—'}</td>
                  <td style={{ padding: '9px 14px' }}>{r.marketing ? '✅' : '—'}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#64748b' }}>{r.ip_address || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.page_url || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b' }}>{r.policy_version || '—'}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <button onClick={() => delOne(r.id)} disabled={busy} title="Supprimer cette preuve" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.95rem' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '10px' }}>
        500 derniers consentements. Conservez ces preuves pendant toute la durée de validité du consentement (CNIL : preuve exigée par l'article 7.1 du RGPD).
      </p>
    </>
  );
}

/* ─── Demandes RGPD : recherche, export, effacement ─────────────────────── */
interface LookupResult {
  contact_messages: Record<string, unknown>[];
  job_applications: Record<string, unknown>[];
  cookie_consents: Record<string, unknown>[];
  site_visits: Record<string, unknown>[];
  login_audit: Record<string, unknown>[];
}

function RgpdRequests({ dpoEmail }: { dpoEmail: string }) {
  const [email, setEmail] = useState('');
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const TABLE_LABELS: Record<keyof LookupResult, string> = {
    contact_messages: 'Messages de contact',
    job_applications: 'Candidatures (carrière)',
    cookie_consents: 'Consentements cookies',
    site_visits: 'Statistiques de visite',
    login_audit: 'Journaux de connexion',
  };

  const post = async (op: 'search' | 'erase') => {
    if (!email.trim() && !ip.trim()) { setMsg({ type: 'err', text: 'Indiquez au moins un email ou une IP.' }); return; }
    setLoading(true); setMsg(null);
    try {
      const res = await fetch('/api/rgpd', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, email: email.trim(), ip: ip.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg({ type: 'err', text: json.error || 'Erreur.' }); return json; }
      return json;
    } finally { setLoading(false); }
  };

  const search = async () => {
    const json = await post('search');
    if (json?.ok) {
      setResult(json.found);
      setTotal(json.total);
      if (json.total === 0) setMsg({ type: 'ok', text: 'Aucune donnée trouvée pour ces critères.' });
    }
  };

  const erase = async () => {
    if (!confirm(`Supprimer DÉFINITIVEMENT toutes les données liées à ${email || ip} ?\n\nCette action est irréversible. Effectuez d'abord un export si nécessaire.`)) return;
    const json = await post('erase');
    if (json?.ok) {
      setMsg({ type: 'ok', text: `${json.total} enregistrement(s) supprimé(s) — contact: ${json.counts.contact_messages}, candidatures: ${json.counts.job_applications}, cookies: ${json.counts.cookie_consents}, visites: ${json.counts.site_visits}, connexions: ${json.counts.login_audit}.` });
      setResult(null); setTotal(0);
    }
  };

  const exportJson = () => {
    if (!result) return;
    const payload = {
      demande: { email: email.trim() || null, ip: ip.trim() || null, exporte_le: new Date().toISOString() },
      donnees: result,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `donnees-personnelles-${(email.trim() || ip.trim() || 'export').replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <Card cols="1fr">
        <div>
          <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
            Lorsqu'une personne exerce son droit d'accès ou d'effacement, recherchez ici toutes ses données.
            L'<strong>email</strong> est l'identifiant principal (formulaire de contact). L'<strong>IP</strong> est
            facultative et ne sert qu'aux journaux techniques (cookies, connexions).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Email de la personne</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@exemple.fr" style={inputStyle} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} />
            </div>
            <div>
              <label style={labelStyle}>Adresse IP (facultatif)</label>
              <input type="text" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.0.2.10" style={{ ...inputStyle, fontFamily: 'monospace' }} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} />
            </div>
            <button onClick={search} disabled={loading} style={{ padding: '10px 22px', background: loading ? '#9ca3af' : '#004a99', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer', height: '42px' }}>
              {loading ? '…' : '🔎 Rechercher'}
            </button>
          </div>
        </div>
      </Card>

      {msg && (
        <div style={{ marginBottom: '1.5rem', padding: '12px 16px', background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, borderRadius: '10px', color: msg.type === 'ok' ? '#15803d' : '#dc2626', fontSize: '0.84rem', fontWeight: 600 }}>
          {msg.type === 'ok' ? '✓' : '⚠'} {msg.text}
        </div>
      )}

      {result && total > 0 && (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
            <p style={{ fontWeight: 700, color: '#003366', margin: 0, fontSize: '0.95rem' }}>{total} enregistrement(s) trouvé(s)</p>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
              <button onClick={exportJson} style={{ padding: '9px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>⬇ Exporter (JSON)</button>
              <button onClick={erase} disabled={loading} style={{ padding: '9px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer' }}>🗑 Effacer définitivement</button>
            </div>
          </div>

          {(Object.keys(result) as (keyof LookupResult)[]).map((tbl) => (
            result[tbl].length > 0 && (
              <div key={tbl} style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  {TABLE_LABELS[tbl]} <span style={{ color: '#9ca3af' }}>({result[tbl].length})</span>
                </p>
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                          {Object.keys(result[tbl][0]).map((c) => (
                            <th key={c} style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result[tbl].map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            {Object.values(row).map((val, j) => (
                              <td key={j} style={{ padding: '7px 12px', color: '#475569', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(val ?? '')}>
                                {val === null || val === undefined || val === '' ? '—' : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ))}
        </>
      )}

      <InfoBox tone="info">
        <strong>Procédure recommandée :</strong> vérifiez l'identité du demandeur, exportez les données (droit d'accès / portabilité), puis effacez‑les. Répondez sous <strong>1 mois</strong> (art. 12 RGPD). Les demandes peuvent arriver à <a href={`mailto:${dpoEmail}`} style={{ color: '#0369a1', fontWeight: 600 }}>{dpoEmail}</a>.
      </InfoBox>
    </>
  );
}


