'use client';

import { useState, useId } from 'react';

const SUBJECTS = [
  'Étude de projet AMO',
  'Réhabilitation immobilière',
  'Facility management',
  'Demande de devis',
  'Partenariat',
  'Recrutement / Candidature',
  'Autre demande',
];

interface ContactFormProps {
  rgpdText: string;
  companyName: string;
}

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function ContactForm({ rgpdText, companyName }: ContactFormProps) {
  const id = useId();
  const [form, setForm] = useState({
    nom: '', email: '', telephone: '', societe: '', objet: '', message: '', _hp: '',
    rgpd_consent: false,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%', padding: '12px 16px', border: `1.5px solid ${fieldErrors[field] ? '#ef4444' : '#d1d5db'}`,
    borderRadius: '10px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', background: 'white', transition: 'border-color 0.15s',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontWeight: 700, fontSize: '0.8rem', color: '#374151',
    marginBottom: '7px', letterSpacing: '0.03em',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setFieldErrors({});

    /* Client-side validation */
    const fe: Record<string, string> = {};
    if (!form.nom.trim()) fe.nom = 'Le nom est requis.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) fe.email = 'Email invalide.';
    if (!form.objet) fe.objet = 'Veuillez choisir un objet.';
    if (!form.message.trim() || form.message.trim().length < 10) fe.message = 'Message trop court (min. 10 caractères).';
    if (!form.rgpd_consent) fe.rgpd_consent = 'Le consentement est requis pour traiter votre demande.';

    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rgpd_consent: form.rgpd_consent }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
      } else {
        setErrors(data.errors || ['Une erreur est survenue.']);
        setStatus('error');
      }
    } catch {
      setErrors(['Impossible de contacter le serveur. Vérifiez votre connexion.']);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div style={{ background: 'white', borderRadius: '24px', padding: '3.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <div style={{ width: '72px', height: '72px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5rem', fontWeight: 900, color: 'var(--site-blue-dark)', marginBottom: '12px' }}>
          Message envoyé !
        </h2>
        <p style={{ color: '#475569', lineHeight: 1.7, fontSize: '1rem', marginBottom: '28px' }}>
          Merci pour votre message. L&apos;équipe {companyName} vous répondra dans les plus brefs délais, généralement sous 24–48h ouvrées.
        </p>
        <button
          onClick={() => { setStatus('idle'); setForm({ nom: '', email: '', telephone: '', societe: '', objet: '', message: '', _hp: '', rgpd_consent: false }); }}
          style={{ background: 'var(--site-blue)', color: 'white', padding: '12px 28px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit' }}
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ background: 'white', borderRadius: '24px', padding: '2.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
      <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.35rem', fontWeight: 900, color: 'var(--site-blue-dark)', marginBottom: '6px' }}>
        Formulaire de contact
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '2rem', lineHeight: 1.6 }}>
        Les champs marqués <span style={{ color: '#ef4444' }}>*</span> sont obligatoires.
      </p>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
          {errors.map((e, i) => <p key={i} style={{ color: '#dc2626', fontSize: '0.875rem', margin: '2px 0', fontWeight: 500 }}>• {e}</p>)}
        </div>
      )}

      {/* Honeypot (anti-spam, hidden) */}
      <input type="text" name="_hp" value={form._hp} onChange={e => set('_hp', e.target.value)} style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />

      {/* Row 1: nom + email */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }} className="form-row">
        <div>
          <label htmlFor={`${id}-nom`} style={labelStyle}>Nom complet <span style={{ color: '#ef4444' }}>*</span></label>
          <input id={`${id}-nom`} type="text" value={form.nom} onChange={e => set('nom', e.target.value)}
            placeholder="Jean Dupont" autoComplete="name" style={inputStyle('nom')} />
          {fieldErrors.nom && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', fontWeight: 600 }}>{fieldErrors.nom}</p>}
        </div>
        <div>
          <label htmlFor={`${id}-email`} style={labelStyle}>Email professionnel <span style={{ color: '#ef4444' }}>*</span></label>
          <input id={`${id}-email`} type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="j.dupont@entreprise.fr" autoComplete="email" style={inputStyle('email')} />
          {fieldErrors.email && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', fontWeight: 600 }}>{fieldErrors.email}</p>}
        </div>
      </div>

      {/* Row 2: téléphone + société */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }} className="form-row">
        <div>
          <label htmlFor={`${id}-tel`} style={labelStyle}>Téléphone</label>
          <input id={`${id}-tel`} type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)}
            placeholder="06 xx xx xx xx" autoComplete="tel" style={inputStyle('telephone')} />
        </div>
        <div>
          <label htmlFor={`${id}-societe`} style={labelStyle}>Société / Organisation</label>
          <input id={`${id}-societe`} type="text" value={form.societe} onChange={e => set('societe', e.target.value)}
            placeholder="Nom de votre structure" autoComplete="organization" style={inputStyle('societe')} />
        </div>
      </div>

      {/* Objet */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor={`${id}-objet`} style={labelStyle}>Objet de votre demande <span style={{ color: '#ef4444' }}>*</span></label>
        <select id={`${id}-objet`} value={form.objet} onChange={e => set('objet', e.target.value)}
          style={{ ...inputStyle('objet'), cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', paddingRight: '42px' }}>
          <option value="">— Sélectionnez un objet —</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {fieldErrors.objet && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', fontWeight: 600 }}>{fieldErrors.objet}</p>}
      </div>

      {/* Message */}
      <div style={{ marginBottom: '24px' }}>
        <label htmlFor={`${id}-msg`} style={labelStyle}>
          Message <span style={{ color: '#ef4444' }}>*</span>
          <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem', marginLeft: '8px', textTransform: 'none' }}>
            ({form.message.length} caractère{form.message.length !== 1 ? 's' : ''})
          </span>
        </label>
        <textarea id={`${id}-msg`} value={form.message} onChange={e => set('message', e.target.value)}
          placeholder="Décrivez votre projet, vos besoins et vos éventuelles contraintes…"
          rows={6}
          style={{ ...inputStyle('message'), resize: 'vertical', lineHeight: 1.65 }} />
        {fieldErrors.message && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '5px', fontWeight: 600 }}>{fieldErrors.message}</p>}
      </div>

      {/* RGPD Consent */}
      <div style={{ background: fieldErrors.rgpd_consent ? '#fef2f2' : '#f8fafc', border: `1.5px solid ${fieldErrors.rgpd_consent ? '#fecaca' : '#e2e8f0'}`, borderRadius: '12px', padding: '18px', marginBottom: '24px' }}>
        <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.rgpd_consent} onChange={e => set('rgpd_consent', e.target.checked)}
            style={{ width: '18px', height: '18px', marginTop: '3px', flexShrink: 0, accentColor: 'var(--site-blue)', cursor: 'pointer' }} />
          <span
            style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.65 }}
            dangerouslySetInnerHTML={{ __html: rgpdText }}
          />
        </label>
        {fieldErrors.rgpd_consent && (
          <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {fieldErrors.rgpd_consent}
          </p>
        )}
      </div>

      {/* Submit */}
      <button type="submit" disabled={status === 'sending'}
        style={{ width: '100%', padding: '15px 24px', background: status === 'sending' ? '#93c5fd' : 'var(--site-blue)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: status === 'sending' ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'background 0.2s' }}>
        {status === 'sending' ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
            Envoi en cours…
          </>
        ) : (
          <>
            Envoyer mon message
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </>
        )}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '14px', lineHeight: 1.5 }}>
        🔒 Ce formulaire est sécurisé. Vos données ne sont jamais vendues ni partagées avec des tiers.
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 580px) { .form-row { grid-template-columns: 1fr !important; } }
        input:focus, select:focus, textarea:focus {
          border-color: var(--site-blue) !important;
          box-shadow: 0 0 0 3px rgba(0,74,153,0.1);
        }
      `}</style>
    </form>
  );
}
