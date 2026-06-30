'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface JobData {
  id?: number;
  titre: string;
  contrat: string;
  lieu: string;
  email: string;
  sujet_email: string;
  description: string;
  competences: string;
  avantages: string;
  statut: string;
  nouveau: boolean;
  urgence: boolean;
  date_publication: string;
  date_expiration: string;
}

const inputStyle = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.925rem', outline: 'none',
  boxSizing: 'border-box' as const, transition: '0.15s',
};
const labelStyle = {
  display: 'block' as const,
  fontWeight: 600, fontSize: '0.8rem', color: '#374151',
  marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px',
};

export default function JobForm({ initial }: { initial?: Partial<JobData> }) {
  const router = useRouter();
  const [data, setData] = useState<JobData>({
    titre: '', contrat: 'CDI', lieu: '', email: '',
    sujet_email: '', description: '', competences: '', avantages: '',
    statut: 'active',
    date_publication: new Date().toISOString().split('T')[0],
    date_expiration: '',
    ...initial,
    nouveau: initial ? Boolean(initial.nouveau) : false,
    urgence: initial ? Boolean(initial.urgence) : false,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof JobData>(k: K, v: JobData[K]) => setData((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = { ...data };
    if (data.id) {
      await fetch(`/api/job-offers/${data.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/job-offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    router.push('/admin/jobs');
    router.refresh();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>
          {data.id ? "Modifier l’offre" : "Nouvelle offre d’emploi"}
        </h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => router.back()} style={{ padding: '10px 20px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#6b7280' : '#004a99', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}>
            {saving ? 'Sauvegarde...' : data.id ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* Infos principales */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 1.25rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>Informations</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Titre du poste *</label>
              <input type="text" value={data.titre} onChange={(e) => set('titre', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Type de contrat</label>
              <select value={data.contrat} onChange={(e) => set('contrat', e.target.value)} style={inputStyle}>
                {['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Temps partiel'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lieu</label>
              <input type="text" value={data.lieu} onChange={(e) => set('lieu', e.target.value)} style={inputStyle} placeholder="Paris, France" />
            </div>
            <div>
              <label style={labelStyle}>Email de candidature</label>
              <input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Sujet email par défaut</label>
              <input type="text" value={data.sujet_email} onChange={(e) => set('sujet_email', e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Période de diffusion + Statut */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
            Diffusion & Visibilité
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.5rem 0 1.25rem' }}>
            Définissez quand l&apos;offre est visible sur le site. Elle peut être activée/désactivée manuellement ou automatiquement à expiration.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Date de début de diffusion</label>
              <input type="date" value={data.date_publication} onChange={(e) => set('date_publication', e.target.value)} style={inputStyle} />
              <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>À partir de quand l&apos;offre est visible</p>
            </div>
            <div>
              <label style={labelStyle}>Date de fin de diffusion <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optionnel)</span></label>
              <input type="date" value={data.date_expiration} onChange={(e) => set('date_expiration', e.target.value)} style={inputStyle} />
              <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>Laissez vide si pas de date limite</p>
            </div>
            <div>
              <label style={labelStyle}>Statut</label>
              <select value={data.statut} onChange={(e) => set('statut', e.target.value)} style={{ ...inputStyle, background: data.statut === 'active' ? '#d1fae5' : '#f3f4f6', color: data.statut === 'active' ? '#065f46' : '#6b7280', fontWeight: 700 }}>
                <option value="active">✓ Active — visible sur le site</option>
                <option value="inactive">✗ Inactive — masquée</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', paddingTop: '1.5rem' }}>
              {([
                { key: 'nouveau' as const, label: 'Badge "Nouveau"', color: '#1e40af', bg: '#dbeafe' },
                { key: 'urgence' as const, label: 'Badge "Urgent"', color: '#b91c1c', bg: '#fee2e2' },
              ] as { key: 'nouveau' | 'urgence'; label: string; color: string; bg: string }[]).map(({ key, label, color, bg }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={data[key] as boolean}
                    onChange={(e) => set(key, e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ padding: '2px 8px', background: bg, color, borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 1.25rem', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>Contenu</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Description du poste</label>
              <textarea value={data.description} onChange={(e) => set('description', e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <label style={labelStyle}>Compétences requises (une par ligne)</label>
              <textarea value={data.competences} onChange={(e) => set('competences', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Compétence 1&#10;Compétence 2" />
            </div>
            <div>
              <label style={labelStyle}>Avantages (un par ligne)</label>
              <textarea value={data.avantages} onChange={(e) => set('avantages', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Avantage 1&#10;Avantage 2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
