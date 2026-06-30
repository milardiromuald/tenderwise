'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '../ImageUpload';

interface ProjectData {
  id?: number;
  nom: string;
  slug: string;
  sous_titre: string;
  start_year: number | '';
  end_year: number | '';
  annees: string;
  budget_raw: number | '';
  budget_fmt: string;
  client: string;
  categorie: string;
  type_etablissement: string;
  description: string;
  missions: string;
  images: string;
  statut: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.925rem', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
  background: 'white',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600, fontSize: '0.78rem', color: '#374151',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
};
const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: '12px',
  border: '1px solid #e5e7eb', padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem', fontWeight: 700,
  color: '#111827', margin: '0 0 1.25rem',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem',
};

function formatBudget(raw: number | ''): string {
  if (raw === '' || isNaN(Number(raw)) || Number(raw) === 0) return '';
  const n = Number(raw);
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const fmt = m % 1 === 0 ? String(m) : m.toFixed(1).replace('.', ',');
    return `${fmt} M€`;
  }
  return `${n.toLocaleString('fr-FR')} €`;
}

function buildAnnees(start: number | '', end: number | ''): string {
  if (!start && !end) return '';
  if (start && !end) return String(start);
  if (!start && end) return String(end);
  return Number(start) === Number(end) ? String(start) : `${start} – ${end}`;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ─── Project Preview ─────────────────────────────────────────────────────────

function ProjectPreview({ data, imageUrls }: { data: ProjectData; imageUrls: string[] }) {
  const missionsList = data.missions
    ? data.missions.split('\n').filter(Boolean)
    : [];
  const mainImage = imageUrls[0] || null;

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Browser chrome */}
      <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
            <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: '4px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          tenderwise.fr/realisations/{data.slug || '…'}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '1.25rem', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
        {/* Image */}
        <div style={{ borderRadius: '10px', overflow: 'hidden', height: '180px', background: '#f3f4f6', marginBottom: '1rem', position: 'relative' }}>
          {mainImage ? (
            <>
              <img
                src={mainImage}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const next = (e.target as HTMLImageElement).nextElementSibling as HTMLElement | null;
                  if (next) next.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px', color: '#9ca3af' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Image non accessible</span>
                <span style={{ fontSize: '0.65rem', color: '#d1d5db' }}>{mainImage}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#d1d5db', flexDirection: 'column', gap: '8px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span style={{ fontSize: '0.75rem' }}>Aucune image</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {data.categorie && (
            <span style={{ background: '#004a99', color: 'white', fontSize: '0.64rem', fontWeight: 800, padding: '3px 10px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {data.categorie}
            </span>
          )}
          {data.annees && (
            <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '0.64rem', fontWeight: 700, padding: '3px 10px', borderRadius: '3px' }}>
              {data.annees}
            </span>
          )}
          {data.budget_fmt && (
            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.64rem', fontWeight: 700, padding: '3px 10px', borderRadius: '3px' }}>
              {data.budget_fmt}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.15rem', color: '#003366', margin: '0 0 0.3rem', lineHeight: 1.3, fontWeight: 800 }}>
          {data.nom || <span style={{ color: '#d1d5db', fontStyle: 'italic', fontWeight: 400, fontSize: '0.95rem' }}>Nom du projet…</span>}
        </h2>

        {data.sous_titre && (
          <p style={{ fontSize: '0.83rem', color: '#6b7280', margin: '0 0 0.6rem', fontStyle: 'italic' }}>{data.sous_titre}</p>
        )}

        {(data.client || data.type_etablissement) && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '0.75rem', fontSize: '0.78rem', color: '#374151' }}>
            {data.client && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {data.client}
              </span>
            )}
            {data.type_etablissement && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {data.type_etablissement}
              </span>
            )}
          </div>
        )}

        {data.description && (
          <p style={{ fontSize: '0.83rem', color: '#4b5563', lineHeight: 1.6, margin: '0 0 0.75rem', borderLeft: '3px solid #e5e7eb', paddingLeft: '0.75rem' }}>
            {data.description.slice(0, 220)}{data.description.length > 220 ? '…' : ''}
          </p>
        )}

        {missionsList.length > 0 && (
          <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
              Missions
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {missionsList.slice(0, 6).map((m, i) => (
                <li key={i} style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.55, paddingBottom: '3px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#c5a059', flexShrink: 0, marginTop: '1px' }}>▸</span> {m}
                </li>
              ))}
              {missionsList.length > 6 && (
                <li style={{ fontSize: '0.73rem', color: '#9ca3af', fontStyle: 'italic', paddingLeft: '14px' }}>
                  +{missionsList.length - 6} autre{missionsList.length - 6 > 1 ? 's' : ''}…
                </li>
              )}
            </ul>
          </div>
        )}

        {imageUrls.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {imageUrls.map((url, i) => (
              <div key={i} style={{ width: '40px', height: '32px', borderRadius: '4px', overflow: 'hidden', border: `1px solid ${i === 0 ? '#004a99' : '#e5e7eb'}`, background: '#f3f4f6' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            ))}
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', alignSelf: 'center', marginLeft: '4px' }}>
              {imageUrls.length} photo{imageUrls.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ComboSelect : dropdown with predefined options + free-text fallback ──────
function ComboSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const isCustom = value !== '' && !options.includes(value);
  const [mode, setMode] = useState<'select' | 'custom'>(isCustom ? 'custom' : 'select');

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === '__custom__') {
      setMode('custom');
      onChange('');
    } else {
      setMode('select');
      onChange(e.target.value);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <select
        className="proj-input"
        value={mode === 'custom' ? '__custom__' : value}
        onChange={handleSelect}
        style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
      >
        <option value="">— Sélectionner —</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value="__custom__">+ Autre (saisir manuellement)…</option>
      </select>
      {mode === 'custom' && (
        <div style={{ position: 'relative' }}>
          <input
            className="proj-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, borderColor: '#c5a059', paddingRight: '80px' }}
            placeholder={placeholder}
            autoFocus
          />
          <button
            type="button"
            onClick={() => { setMode('select'); onChange(''); }}
            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer' }}
          >
            ← liste
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main form ───────────────────────────────────────────────────────────────
export default function ProjectForm({
  initial,
  categories = [],
  typesEtablissement = [],
}: {
  initial?: Partial<ProjectData>;
  categories?: string[];
  typesEtablissement?: string[];
}) {
  const router = useRouter();

  const [data, setData] = useState<ProjectData>(() => {
    const base = {
      nom: '', slug: '', sous_titre: '', annees: '', budget_fmt: '',
      client: '', categorie: '', type_etablissement: '',
      description: '', missions: '', images: '[]', statut: 'active',
      ...initial,
    };
    return {
      ...base,
      start_year: (initial?.start_year as number | undefined) ?? '',
      end_year: (initial?.end_year as number | undefined) ?? '',
      budget_raw: (initial?.budget_raw as number | undefined) ?? '',
      slug: (initial?.slug as string | undefined) ?? '',
    };
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    try { return JSON.parse(initial?.images || '[]'); } catch { return []; }
  });
  const [missions, setMissions] = useState<string[]>(() => {
    const raw = initial?.missions || '';
    const list = raw ? raw.split('\n').filter(Boolean) : [];
    return list.length > 0 ? list : [''];
  });
  const [imageKey, setImageKey] = useState(0);

  const [slugLocked, setSlugLocked] = useState(() => !!(initial?.slug));

  const set = <K extends keyof ProjectData>(k: K, v: ProjectData[K]) =>
    setData((p) => ({ ...p, [k]: v }));

  const handleNomChange = (val: string) => {
    setData((p) => ({
      ...p,
      nom: val,
      slug: slugLocked ? p.slug : toSlug(val),
    }));
  };

  const handleYearChange = (field: 'start_year' | 'end_year', val: string) => {
    const num: number | '' = val === '' ? '' : Number(val);
    setData((p) => {
      const updated = { ...p, [field]: num };
      return {
        ...updated,
        annees: buildAnnees(
          field === 'start_year' ? num : p.start_year,
          field === 'end_year' ? num : p.end_year
        ),
      };
    });
  };

  const handleBudgetChange = (val: string) => {
    const cleaned = val.replace(/[^\d]/g, '');
    const num: number | '' = cleaned === '' ? '' : Number(cleaned);
    setData((p) => ({ ...p, budget_raw: num, budget_fmt: formatBudget(num) }));
  };

  const addMission = () => setMissions((m) => [...m, '']);
  const updateMission = (i: number, val: string) =>
    setMissions((m) => m.map((x, idx) => (idx === i ? val : x)));
  const removeMission = (i: number) =>
    setMissions((m) => m.filter((_, idx) => idx !== i));

  const addImageFromUpload = (url: string) => {
    const updated = [...imageUrls, url];
    setImageUrls(updated);
    setData((p) => ({ ...p, images: JSON.stringify(updated) }));
    setImageKey((k) => k + 1);
  };

  const removeImage = (i: number) => {
    const updated = imageUrls.filter((_, idx) => idx !== i);
    setImageUrls(updated);
    setData((p) => ({ ...p, images: JSON.stringify(updated) }));
  };

  const save = async () => {
    if (!data.nom.trim()) { setSaveError('Le nom du projet est obligatoire'); return; }
    setSaving(true);
    const payload = {
      ...data,
      missions: missions.filter(Boolean).join('\n'),
      images: JSON.stringify(imageUrls),
    };
    const url = data.id ? `/api/projects/${data.id}` : '/api/projects';
    const method = data.id ? 'PUT' : 'POST';
    await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    router.push('/admin/projects');
    router.refresh();
  };

  return (
    <>
      <style>{`
        .proj-input:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08); }
        @media (max-width: 1100px) {
          .proj-split { grid-template-columns: 1fr !important; }
          .proj-preview-col { display: none !important; }
        }
      `}</style>

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6rem', color: '#003366', margin: 0 }}>
            {data.id ? 'Modifier le projet' : 'Nouveau projet'}
          </h1>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={data.statut}
              onChange={(e) => set('statut', e.target.value)}
              style={{
                padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px',
                fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                background: data.statut === 'active' ? '#d1fae5' : data.statut === 'en_cours' ? '#fef3c7' : '#f3f4f6',
                color: data.statut === 'active' ? '#065f46' : data.statut === 'en_cours' ? '#92400e' : '#6b7280',
              }}
            >
              <option value="active">● Visible sur le site</option>
              <option value="en_cours">◐ En cours</option>
              <option value="inactive">○ Masqué</option>
            </select>
            <button
              onClick={() => router.back()}
              style={{ padding: '10px 20px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Annuler
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              {saveError && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>{saveError}</span>
              )}
              <button
                onClick={save}
                disabled={saving}
                style={{ padding: '10px 24px', background: saving ? '#9ca3af' : '#004a99', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}
              >
                {saving ? 'Sauvegarde…' : data.id ? 'Mettre à jour' : 'Créer le projet'}
              </button>
            </div>
          </div>
        </div>

        {/* ── 50 / 50 split ── */}
        <div
          className="proj-split"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}
        >
          {/* ── LEFT : Form ── */}
          <div style={{ display: 'grid', gap: '1.25rem' }}>

            {/* Informations */}
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Informations</h2>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Nom du projet *</label>
                  <input className="proj-input" type="text" value={data.nom} onChange={(e) => handleNomChange(e.target.value)} style={{ ...inputStyle, fontSize: '1rem', fontWeight: 600 }} placeholder="Ex : Réhabilitation du Gymnase Municipal" />
                </div>
                <div>
                  <label style={labelStyle}>URL du projet (slug)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>tenderwise.fr/realisations/</span>
                    <input
                      className="proj-input"
                      type="text"
                      value={data.slug}
                      onChange={(e) => {
                        setSlugLocked(true);
                        set('slug', e.target.value.replace(/[^a-z0-9-]/g, ''));
                      }}
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                      placeholder="cinema-de-saint-priest"
                    />
                  </div>
                  {!slugLocked && data.nom && (
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '4px' }}>
                      Généré automatiquement depuis le nom. Modifiez pour personnaliser.
                    </div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Sous-titre</label>
                  <input className="proj-input" type="text" value={data.sous_titre} onChange={(e) => set('sous_titre', e.target.value)} style={inputStyle} placeholder="Ex : Restructuration et rénovation énergétique" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Client</label>
                    <input className="proj-input" type="text" value={data.client} onChange={(e) => set('client', e.target.value)} style={inputStyle} placeholder="Mairie de Lyon" />
                  </div>
                  <div>
                    <label style={labelStyle}>Catégorie</label>
                    <ComboSelect
                      value={data.categorie}
                      onChange={(v) => set('categorie', v)}
                      options={categories}
                      placeholder="Ex : Conduite d’opération, AMO…"
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Type d&apos;établissement</label>
                  <ComboSelect
                    value={data.type_etablissement}
                    onChange={(v) => set('type_etablissement', v)}
                    options={typesEtablissement}
                    placeholder="Ex : Équipement sportif, Établissement de santé…"
                  />
                </div>
              </div>
            </div>

            {/* Durée & Budget */}
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Durée & Budget</h2>
              <div style={{ display: 'grid', gap: '1.25rem' }}>

                {/* Years */}
                <div>
                  <label style={labelStyle}>Années du projet</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>DÉBUT</div>
                      <input
                        className="proj-input"
                        type="number"
                        value={data.start_year}
                        onChange={(e) => handleYearChange('start_year', e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center' }}
                        placeholder="2022"
                        min="1990"
                        max="2100"
                      />
                    </div>
                    <span style={{ color: '#c5a059', fontWeight: 700, fontSize: '1.2rem', textAlign: 'center', marginTop: '18px' }}>→</span>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>FIN</div>
                      <input
                        className="proj-input"
                        type="number"
                        value={data.end_year}
                        onChange={(e) => handleYearChange('end_year', e.target.value)}
                        style={{ ...inputStyle, textAlign: 'center' }}
                        placeholder="2024"
                        min="1990"
                        max="2100"
                      />
                    </div>
                  </div>
                  {data.annees && (
                    <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '6px', fontWeight: 600 }}>
                      ✓ Affiché sur le site : <strong>{data.annees}</strong>
                    </div>
                  )}
                </div>

                {/* Budget */}
                <div>
                  <label style={labelStyle}>Budget (montant brut en €)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="proj-input"
                      type="text"
                      inputMode="numeric"
                      value={data.budget_raw === '' ? '' : String(data.budget_raw)}
                      onChange={(e) => handleBudgetChange(e.target.value)}
                      style={{ ...inputStyle, paddingRight: data.budget_fmt ? '100px' : '14px' }}
                      placeholder="1200000"
                    />
                    {data.budget_fmt && (
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                        → {data.budget_fmt}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>
                    100000 → <em>100 000 €</em> &nbsp;·&nbsp; 1200000 → <em>1,2 M€</em> &nbsp;·&nbsp; 2500000 → <em>2,5 M€</em>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Description</h2>
              <textarea
                className="proj-input"
                value={data.description}
                onChange={(e) => set('description', e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Décrivez le projet, son contexte et ses enjeux…"
              />
            </div>

            {/* Missions */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Missions
                </h2>
                <button
                  type="button"
                  onClick={addMission}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#eff6ff', color: '#004a99', border: '1px solid #bfdbfe', borderRadius: '7px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  + Ajouter une mission
                </button>
              </div>
              {missions.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.83rem', textAlign: 'center', margin: '0.5rem 0' }}>
                  Aucune mission. Cliquez sur &quot;+ Ajouter une mission&quot;.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {missions.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: '#c5a059', fontSize: '0.82rem', fontWeight: 700, minWidth: '22px', textAlign: 'center' }}>
                        {i + 1}.
                      </span>
                      <input
                        className="proj-input"
                        type="text"
                        value={m}
                        onChange={(e) => updateMission(i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMission(); } }}
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder={`Mission ${i + 1}`}
                        autoFocus={i === missions.length - 1 && missions.length > 1}
                      />
                      {missions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMission(i)}
                          style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Images */}
            <div style={cardStyle}>
              <h2 style={{ ...cardTitleStyle, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                Galerie photos
                <span style={{ fontWeight: 400, fontSize: '0.73rem', color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>
                  — La 1ère image est la vignette principale
                </span>
              </h2>

              {imageUrls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginBottom: '1.25rem' }}>
                  {imageUrls.map((url, i) => (
                    <div
                      key={i}
                      style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '16/10', border: `2px solid ${i === 0 ? '#004a99' : '#e5e7eb'}`, background: '#f3f4f6' }}
                    >
                      <img
                        src={url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const ph = img.nextElementSibling as HTMLElement | null;
                          if (ph) ph.style.display = 'flex';
                        }}
                      />
                      <div style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '3px', color: '#9ca3af', fontSize: '0.6rem', textAlign: 'center', padding: '4px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Non accessible
                      </div>
                      {i === 0 && (
                        <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#004a99', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>
                          PRINCIPALE
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(220,38,38,0.9)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <ImageUpload
                key={imageKey}
                value=""
                onChange={(url) => { if (url) addImageFromUpload(url); }}
                label={imageUrls.length === 0 ? 'Ajouter la première image' : 'Ajouter une image supplémentaire'}
                hint="JPEG, PNG, WebP — 800×600 px minimum recommandé"
                previewHeight={140}
              />
            </div>
          </div>

          {/* ── RIGHT : Preview ── */}
          <div className="proj-preview-col" style={{ position: 'sticky', top: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Aperçu en direct
              </span>
              <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            </div>
            <ProjectPreview data={data} imageUrls={imageUrls} />
          </div>
        </div>
      </div>
    </>
  );
}
