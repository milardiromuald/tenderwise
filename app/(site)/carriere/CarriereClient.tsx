'use client';

import { useState, useRef } from 'react';

interface JobOffer {
  id: number;
  titre: string;
  contrat: string;
  lieu: string;
  email: string;
  sujet_email: string;
  description: string;
  competences: string[];
  avantages: string[];
  isNew: boolean;
  isUrgent: boolean;
  hasRemote: boolean;
  datePublication: string;
  dateExpiration: string;
  isSpontaneous: boolean;
}

interface RgpdInfo { email: string; retention: string; companyName: string; }

interface CarriereClientProps {
  offers: JobOffer[];
  rgpd: RgpdInfo;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CarriereClient({ offers, rgpd }: CarriereClientProps) {
  const [selectedJob, setSelectedJob] = useState<JobOffer | null>(null);
  const [applyJob, setApplyJob] = useState<JobOffer | null>(null);

  return (
    <>
      <div style={{ backgroundColor: 'var(--site-light)', padding: '80px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.8rem, 5vw, 3rem)', color: 'var(--site-blue-dark)', marginBottom: '1rem' }}>
              Carrière chez TenderWise
            </h1>
            <div style={{ width: '60px', height: '3px', background: 'var(--site-gold)', margin: '0 auto 1.5rem', borderRadius: '2px' }} />
            <p style={{ color: 'var(--site-text)', fontSize: '1.1rem' }}>
              Rejoignez notre équipe d&apos;experts et participez à la transformation durable de l&apos;immobilier
            </p>
          </div>

          {/* Job Grid */}
          {offers.length > 0 ? (
            <div className="jobs-grid">
              {offers.map((job, index) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  style={{
                    background: job.isSpontaneous
                      ? 'linear-gradient(135deg, #fffdf8 0%, #fdf6e9 100%)'
                      : 'white',
                    borderRadius: 'var(--radius-lg)', padding: '24px',
                    boxShadow: 'var(--shadow-sm)',
                    border: job.isSpontaneous ? '1.5px solid var(--site-gold)' : '1px solid var(--site-border)',
                    transition: '0.2s', cursor: 'pointer',
                    animation: `slideInUp 0.3s ease ${index * 0.1}s both`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = job.isSpontaneous ? 'var(--site-gold)' : 'var(--site-blue)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = job.isSpontaneous ? 'var(--site-gold)' : 'var(--site-border)';
                  }}
                >
                  {/* Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {job.isNew &&<span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', background: 'var(--status-green-light)', color: 'var(--status-green)' }}>Nouveau</span>}
                      {job.isUrgent && <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', background: '#fef3c7', color: '#92400e' }}>Urgent</span>}
                      {job.hasRemote && !job.isSpontaneous && <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', background: 'var(--site-blue-light)', color: 'var(--site-blue)' }}>Télétravail</span>}
                    </div>
                    {job.datePublication && <span style={{ fontSize: '12px', color: 'var(--site-text)' }}>Publié le {formatDate(job.datePublication)}</span>}
                  </div>

                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.2rem', color: 'var(--site-blue-dark)', marginBottom: '12px' }}>{job.titre}</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--site-text)', fontSize: '14px' }}>
                      <span>📄</span><span>{job.contrat}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--site-text)', fontSize: '14px' }}>
                      <span>📍</span><span>{job.lieu}</span>
                    </div>
                  </div>

                  {job.description && (
                    <p style={{ color: 'var(--site-text)', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                      {job.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setApplyJob(job); }}
                      style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--site-blue)', color: 'white', border: 'none' }}
                    >
                      Postuler
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                      style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'white', color: 'var(--site-blue)', border: '1px solid var(--site-blue)' }}
                    >
                      Voir détails
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: 'var(--radius-lg)', marginBottom: '60px' }}>
              <p style={{ fontSize: '1.1rem', color: 'var(--site-text)' }}>Aucune offre d&apos;emploi disponible pour le moment.</p>
            </div>
          )}
        </div>
      </div>

      {/* Job Modal */}
      {selectedJob && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '20px', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedJob(null); }}
        >
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', animation: 'slideInUp 0.3s ease' }}>
            {/* Modal Header */}
            <div style={{ padding: '32px', borderBottom: '1px solid var(--site-border)', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <button
                onClick={() => setSelectedJob(null)}
                style={{ position: 'absolute', top: '24px', right: '24px', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--site-light)', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >×</button>
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6rem', color: 'var(--site-blue-dark)', marginBottom: '12px' }}>{selectedJob.titre}</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, background: 'var(--site-blue-light)', color: 'var(--site-blue)' }}>{selectedJob.contrat}</span>
                <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, background: 'var(--site-light)', color: 'var(--site-text)' }}>{selectedJob.lieu}</span>
                {selectedJob.isNew && <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, background: 'var(--status-green-light)', color: 'var(--status-green)' }}>Nouveau</span>}
                {selectedJob.isUrgent && <span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>Urgent</span>}
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px' }}>
              {selectedJob.description && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', color: 'var(--site-gold)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>Description du poste</h3>
                  <p style={{ color: 'var(--site-text)', lineHeight: 1.7 }}>{selectedJob.description}</p>
                </div>
              )}

              {selectedJob.competences.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', color: 'var(--site-gold)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>Compétences requises</h3>
                  <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
                    {selectedJob.competences.map((c, i) => <li key={i} style={{ color: 'var(--site-text)', marginBottom: '6px', lineHeight: 1.5 }}>{c}</li>)}
                  </ul>
                </div>
              )}

              {selectedJob.avantages.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', color: 'var(--site-gold)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>Avantages</h3>
                  <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
                    {selectedJob.avantages.map((a, i) => <li key={i} style={{ color: 'var(--site-text)', marginBottom: '6px', lineHeight: 1.5 }}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '24px', background: 'var(--site-light)', borderTop: '1px solid var(--site-border)', textAlign: 'center' }}>
              <button
                onClick={() => { const j = selectedJob; setSelectedJob(null); setApplyJob(j); }}
                style={{ display: 'inline-block', padding: '1rem 3rem', background: 'var(--site-blue)', color: 'white', borderRadius: '6px', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '1rem' }}
              >
                Postuler pour ce poste →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Modal */}
      {applyJob && (
        <ApplyModal job={applyJob} rgpd={rgpd} onClose={() => setApplyJob(null)} />
      )}

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/* ─── Modale de candidature (CV + lettre + RGPD) ─────────────────────────── */
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const fieldStyle: React.CSSProperties = { width: '100%', padding: '11px 14px', border: '1px solid var(--site-border)', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };
const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.82rem', color: 'var(--site-blue-dark)', marginBottom: '5px' };

function FilePicker({ label, file, onPick, inputRef, required }: { label: string; file: File | null; onPick: (f: File | null) => void; inputRef: React.RefObject<HTMLInputElement | null>; required?: boolean }) {
  return (
    <div>
      <label style={labelStyle}>{label} {required && <span style={{ color: '#dc2626' }}>*</span>}</label>
      <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => onPick(e.target.files?.[0] || null)} />
      <div onClick={() => inputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', border: `1.5px dashed ${file ? 'var(--site-blue)' : 'var(--site-border)'}`, borderRadius: '8px', cursor: 'pointer', background: file ? 'var(--site-blue-light)' : 'var(--site-light)' }}>
        <span style={{ fontSize: '1.1rem' }}>{file ? '📄' : '📎'}</span>
        <span style={{ fontSize: '0.88rem', color: file ? 'var(--site-blue-dark)' : 'var(--site-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {file ? file.name : 'Choisir un fichier (PDF, DOC, DOCX — max 8 Mo)'}
        </span>
        {file && <button onClick={(e) => { e.stopPropagation(); onPick(null); if (inputRef.current) inputRef.current.value = ''; }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.1rem' }}>×</button>}
      </div>
    </div>
  );
}

function ApplyModal({ job, rgpd, onClose }: { job: JobOffer; rgpd: RgpdInfo; onClose: () => void }) {
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', telephone: '', message: '', rgpd: false, _hp: '' });
  const [cv, setCv] = useState<File | null>(null);
  const [lm, setLm] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const cvRef = useRef<HTMLInputElement>(null);
  const lmRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const errs: string[] = [];
    if (form.nom.trim().length < 2) errs.push('Le nom est obligatoire.');
    if (form.prenom.trim().length < 2) errs.push('Le prénom est obligatoire.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.push('Un email valide est obligatoire.');
    if (form.telephone.replace(/[^\d+]/g, '').length < 8) errs.push('Un téléphone valide est obligatoire.');
    if (!cv) errs.push('Le CV est obligatoire.');
    if (!form.rgpd) errs.push('Le consentement est obligatoire.');
    if (errs.length) { setErrors(errs); return; }

    setStatus('sending'); setErrors([]);
    const fd = new FormData();
    fd.append('nom', form.nom.trim());
    fd.append('prenom', form.prenom.trim());
    fd.append('email', form.email.trim());
    fd.append('telephone', form.telephone.trim());
    fd.append('message', form.message.trim());
    fd.append('rgpd_consent', 'true');
    fd.append('_hp', form._hp);
    if (!job.isSpontaneous && job.id > 0) fd.append('job_id', String(job.id));
    fd.append('job_title', job.titre);
    if (cv) fd.append('cv', cv);
    if (lm) fd.append('lm', lm);

    try {
      const res = await fetch('/api/applications', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok && json.success) { setStatus('success'); }
      else { setStatus('error'); setErrors(json.errors || ['Une erreur est survenue.']); }
    } catch {
      setStatus('error'); setErrors(['Erreur réseau. Veuillez réessayer.']);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100000, padding: '20px', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', position: 'relative', animation: 'slideInUp 0.3s ease' }}>
        {/* Header */}
        <div style={{ padding: '26px 30px', borderBottom: '1px solid var(--site-border)', position: 'sticky', top: 0, background: 'white', zIndex: 2 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', width: '34px', height: '34px', borderRadius: '50%', background: 'var(--site-light)', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
          <p style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--site-gold)', margin: '0 0 4px' }}>Postuler</p>
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.35rem', color: 'var(--site-blue-dark)', margin: 0 }}>{job.titre}</h2>
        </div>

        {status === 'success' ? (
          <div style={{ padding: '48px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
            <h3 style={{ fontFamily: 'Montserrat, sans-serif', color: 'var(--site-blue-dark)', marginBottom: '10px' }}>Candidature envoyée !</h3>
            <p style={{ color: 'var(--site-text)', lineHeight: 1.6, marginBottom: '24px' }}>Merci {form.prenom}. Nous avons bien reçu votre candidature et reviendrons vers vous rapidement.</p>
            <button onClick={onClose} style={{ padding: '12px 32px', background: 'var(--site-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
          </div>
        ) : (
          <div style={{ padding: '24px 30px 30px' }}>
            {errors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px' }}>
                {errors.map((e, i) => <p key={i} style={{ color: '#dc2626', fontSize: '0.84rem', fontWeight: 600, margin: i ? '4px 0 0' : 0 }}>⚠ {e}</p>)}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Prénom <span style={{ color: '#dc2626' }}>*</span></label>
                <input value={form.prenom} onChange={(e) => set('prenom', e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nom <span style={{ color: '#dc2626' }}>*</span></label>
                <input value={form.nom} onChange={(e) => set('nom', e.target.value)} style={fieldStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Email <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Téléphone <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} style={fieldStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: '14px', marginBottom: '14px' }}>
              <FilePicker label="CV" file={cv} onPick={setCv} inputRef={cvRef} required />
              <FilePicker label="Lettre de motivation" file={lm} onPick={setLm} inputRef={lmRef} />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Message (facultatif)</label>
              <textarea value={form.message} onChange={(e) => set('message', e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Quelques mots sur votre motivation…" />
            </div>

            {/* Honeypot */}
            <input type="text" value={form._hp} onChange={(e) => set('_hp', e.target.value)} style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }} tabIndex={-1} autoComplete="off" aria-hidden />

            {/* RGPD */}
            <div style={{ background: form.rgpd ? 'var(--site-light)' : '#f8fafc', border: '1px solid var(--site-border)', borderRadius: '10px', padding: '14px 16px', marginBottom: '18px' }}>
              <label style={{ display: 'flex', gap: '10px', cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={form.rgpd} onChange={(e) => set('rgpd', e.target.checked)} style={{ marginTop: '3px', flexShrink: 0, width: '16px', height: '16px', accentColor: 'var(--site-blue)' }} />
                <span style={{ fontSize: '0.76rem', color: 'var(--site-text)', lineHeight: 1.55 }}>
                  J&apos;accepte que {rgpd.companyName} collecte et conserve mon nom, prénom, email, téléphone, CV et lettre de motivation
                  afin d&apos;étudier ma candidature. Ces données (et pièces jointes) sont conservées <strong>{rgpd.retention}</strong> puis supprimées,
                  ne sont pas transmises à des tiers, et restent accessibles aux seuls recruteurs. Je peux exercer mes droits d&apos;accès,
                  rectification et effacement à <a href={`mailto:${rgpd.email}`} style={{ color: 'var(--site-blue)', fontWeight: 600 }}>{rgpd.email}</a>.
                </span>
              </label>
            </div>

            <button
              onClick={submit}
              disabled={status === 'sending'}
              style={{ width: '100%', padding: '14px', background: status === 'sending' ? '#9ca3af' : 'var(--site-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: status === 'sending' ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif' }}
            >
              {status === 'sending' ? 'Envoi en cours…' : 'Envoyer ma candidature'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
