'use client';

import { useState } from 'react';

interface ContactPageClientProps {
  settings: Record<string, string>;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.925rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.15s', background: 'white',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600,
  fontSize: '0.78rem', color: '#374151',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
};

function Field({
  label, name, value, onChange, type = 'text', hint, placeholder,
}: {
  label: string; name: string; value: string;
  onChange: (k: string, v: string) => void;
  type?: string; hint?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {hint && <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
}

function Section({
  title, icon, children, cols = 'repeat(auto-fill, minmax(280px, 1fr))',
}: {
  title: string; icon?: string; children: React.ReactNode; cols?: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb',
      overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon && <span style={{ fontSize: '1.1rem' }}>{icon}</span>}
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.92rem', fontWeight: 700, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem', gridTemplateColumns: cols }}>
        {children}
      </div>
    </div>
  );
}

export default function ContactPageClient({ settings }: ContactPageClientProps) {
  const [values, setValues] = useState<Record<string, string>>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const v = (key: string, fallback = '') => values[key] ?? fallback;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px' }}>
      <style>{`.cp-input:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08); }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>
            Page Contact
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '4px' }}>
            Coordonnées, disponibilités et paramètres RGPD affichés sur la page /contact
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a
            href="/contact"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: '10px 20px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem', color: '#374151', textDecoration: 'none', background: 'white' }}
          >
            Voir la page ↗
          </a>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '12px 28px', border: 'none', borderRadius: '8px',
              fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap',
              background: saving ? '#9ca3af' : saved ? '#059669' : '#004a99', color: 'white',
            }}
          >
            {saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Coordonnées */}
      <Section title="Nos coordonnées" icon="📍">
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Adresse postale" name="contact_address" value={v('contact_address')} onChange={set} placeholder="54 Avenue Général Leclerc, 69100 Villeurbanne" hint="Affichée dans le bloc coordonnées avec un lien Google Maps" />
        </div>
        <Field label="Téléphone" name="contact_phone" value={v('contact_phone')} onChange={set} placeholder="06 65 16 77 84" />
        <Field label="Email public" name="contact_email" value={v('contact_email')} onChange={set} type="email" hint="Email affiché sur la page contact" />
      </Section>

      {/* Disponibilités */}
      <Section title="Disponibilités" icon="🕐" cols="1fr">
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '4px' }}>
          Configurez les 3 lignes affichées dans le tableau des disponibilités. Cochez &quot;Ouvert&quot; pour afficher l&apos;horaire en bleu.
        </div>

        {[
          { n: 1, defaultDay: 'Lundi — Vendredi', defaultTime: '9h00 — 18h00', defaultOpen: '1' },
          { n: 2, defaultDay: 'Samedi', defaultTime: 'Sur rendez-vous', defaultOpen: '0' },
          { n: 3, defaultDay: 'Dimanche', defaultTime: 'Fermé', defaultOpen: '0' },
        ].map(({ n, defaultDay, defaultTime, defaultOpen }) => (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end', padding: '14px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <Field
              label={`Ligne ${n} — Jour`}
              name={`contact_hours_${n}_day`}
              value={v(`contact_hours_${n}_day`, defaultDay)}
              onChange={set}
              placeholder={defaultDay}
            />
            <Field
              label={`Ligne ${n} — Horaire`}
              name={`contact_hours_${n}_time`}
              value={v(`contact_hours_${n}_time`, defaultTime)}
              onChange={set}
              placeholder={defaultTime}
            />
            <div>
              <label style={labelStyle}>Ouvert</label>
              <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                <input
                  type="checkbox"
                  checked={(v(`contact_hours_${n}_open`, defaultOpen)) === '1'}
                  onChange={(e) => set(`contact_hours_${n}_open`, e.target.checked ? '1' : '0')}
                  style={{ width: '20px', height: '20px', accentColor: '#004a99', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* RGPD */}
      <Section title="Emails RGPD" icon="🔒">
        <Field
          label="Email destinataire des messages"
          name="contact_recipient_email"
          value={v('contact_recipient_email', v('contact_email'))}
          onChange={set}
          type="email"
          hint="Adresse qui reçoit les messages du formulaire (peut différer de l’email public)"
        />
        <Field
          label="Email pour les droits RGPD"
          name="contact_rgpd_email"
          value={v('contact_rgpd_email')}
          onChange={set}
          type="email"
          placeholder={v('contact_email') || 'dpo@exemple.fr'}
          hint="Adresse affichée dans la case à cocher RGPD pour l’exercice des droits (accès, rectification, suppression…). Si vide : utilise l’email public."
        />
        <Field
          label="Durée de conservation RGPD"
          name="contact_rgpd_retention"
          value={v('contact_rgpd_retention', '3 ans')}
          onChange={set}
          placeholder="3 ans"
          hint="Durée affichée dans le texte de consentement RGPD"
        />
      </Section>

      {/* Bottom save */}
      <div style={{ textAlign: 'right', paddingTop: '0.5rem', paddingBottom: '2rem' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '14px 40px', border: 'none', borderRadius: '8px',
            fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s', fontFamily: 'Montserrat, sans-serif',
            background: saving ? '#9ca3af' : saved ? '#059669' : '#004a99', color: 'white',
          }}
        >
          {saving ? 'Sauvegarde…' : saved ? '✓ Tout est sauvegardé !' : 'Sauvegarder tous les paramètres'}
        </button>
      </div>
    </div>
  );
}
