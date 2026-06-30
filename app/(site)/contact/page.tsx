export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getAllSettings } from '@/lib/settings';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contactez TenderWise — Expert AMO à Lyon',
  description: 'Discutez de votre projet immobilier avec nos experts AMO. Formulaire de contact sécurisé et conforme RGPD. TenderWise — 54 Avenue Général Leclerc, 69100 Villeurbanne.',
  alternates: { canonical: 'https://www.tenderwise.fr/contact' },
  openGraph: {
    type: 'website',
    url: 'https://www.tenderwise.fr/contact',
    title: 'Contactez TenderWise — Expert AMO à Lyon',
    description: 'Prenez contact avec nos experts AMO à Lyon pour votre projet de construction, réhabilitation ou facility management.',
  },
};

function sanitizeRgpdHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-blocked=')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/<(?!\/?(?:a|strong|em|br)\b)[^>]+>/gi, '');
}

export default async function ContactPage() {
  const settings = await getAllSettings();

  const companyName  = settings.company_name  || 'TenderWise';
  const address      = settings.contact_address || '54 Avenue Général Leclerc, 69100 Villeurbanne';
  const phone        = settings.contact_phone  || '06 65 16 77 84';
  const email        = settings.contact_email  || 'r.milardi@tenderwise.fr';
  const linkedin     = settings.social_linkedin || '';
  const rgpdRetention = settings.contact_rgpd_retention || '3 ans';
  const rgpdText     = settings.contact_rgpd_text || '';
  const rgpdEmail    = settings.contact_rgpd_email || email;

  const hours = [
    {
      j: settings.contact_hours_1_day  || 'Lundi — Vendredi',
      h: settings.contact_hours_1_time || '9h00 — 18h00',
      dispo: (settings.contact_hours_1_open ?? '1') === '1',
    },
    {
      j: settings.contact_hours_2_day  || 'Samedi',
      h: settings.contact_hours_2_time || 'Sur rendez-vous',
      dispo: settings.contact_hours_2_open === '1',
    },
    {
      j: settings.contact_hours_3_day  || 'Dimanche',
      h: settings.contact_hours_3_time || 'Fermé',
      dispo: settings.contact_hours_3_open === '1',
    },
  ];

  const defaultRgpdText = `En soumettant ce formulaire, vous acceptez que ${companyName} collecte et traite vos données personnelles (nom, email, téléphone, société, message) dans le but de traiter votre demande et d’assurer le suivi de notre relation commerciale. À des fins de sécurité et de lutte contre le spam, votre adresse IP et votre navigateur sont également enregistrés (intérêt légitime). Base légale : consentement (Art. 6.1.a du RGPD) pour le traitement de votre demande. Vos données sont conservées ${rgpdRetention} à compter du dernier contact, puis supprimées. Elles ne sont transmises à aucun tiers à des fins commerciales. Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition. Pour exercer ces droits : <a href="mailto:${rgpdEmail}" style="color:var(--site-blue);font-weight:600;">${rgpdEmail}</a>. Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).`;

  const finalRgpdText = sanitizeRgpdHtml(rgpdText || defaultRgpdText);

  return (
    <div style={{ background: '#f8fafc', minHeight: '80vh' }}>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #003366 0%, #004a99 60%, #0060cc 100%)', padding: '5rem 1.5rem 4rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(197,160,89,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 40%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(197,160,89,0.15)', color: '#c5a059', padding: '6px 18px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '20px', border: '1px solid rgba(197,160,89,0.3)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.22 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
            Nous contacter
          </div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: 'white', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
            Parlons de votre projet
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '1.1rem', maxWidth: '580px', margin: '0 auto', lineHeight: 1.7 }}>
            Notre équipe d&apos;experts AMO est disponible pour étudier votre projet immobilier et vous accompagner à chaque étape.
          </p>
        </div>
      </div>

      {/* ── Body grid ──────────────────────────────────────────── */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3.5rem 1.5rem 5rem', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '3rem', alignItems: 'start' }} className="contact-grid">

        {/* ── Form ─────────────────────────────────────────────── */}
        <ContactForm rgpdText={finalRgpdText} companyName={companyName} />

        {/* ── Sidebar info ─────────────────────────────────────── */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Coordonnées */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', fontWeight: 800, color: 'var(--site-blue-dark)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '34px', height: '34px', background: 'rgba(0,74,153,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--site-blue)" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
              Nos coordonnées
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: '📍', label: 'Adresse', value: address, href: `https://maps.google.com/?q=${encodeURIComponent(address)}` },
                { icon: '📞', label: 'Téléphone', value: phone, href: `tel:${phone.replace(/\s/g, '')}` },
                { icon: '📧', label: 'Email', value: email, href: `mailto:${email}` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '2px' }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>{item.label}</p>
                    <a href={item.href} target={item.icon === '📍' ? '_blank' : undefined} rel="noopener noreferrer"
                      style={{ color: 'var(--site-blue-dark)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', lineHeight: 1.4, display: 'block' }}>
                      {item.value}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Horaires */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', fontWeight: 800, color: 'var(--site-blue-dark)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '34px', height: '34px', background: 'rgba(0,74,153,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--site-blue)" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              Disponibilités
            </h2>
            {hours.map(row => (
              <div key={row.j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>{row.j}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: row.dispo ? 'var(--site-blue)' : '#94a3b8' }}>{row.h}</span>
              </div>
            ))}
          </div>

          {/* Réseaux sociaux */}
          {linkedin && (
            <div style={{ background: 'white', borderRadius: '20px', padding: '22px 28px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Retrouvez-nous sur</p>
              <a href={linkedin} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#0077B5', color: 'white', padding: '11px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '0.875rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </a>
            </div>
          )}

          {/* RGPD info box */}
          <div style={{ background: '#eff6ff', borderRadius: '16px', padding: '20px', border: '1px solid #bfdbfe' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 800, color: '#004a99', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Protection des données</p>
                <p style={{ fontSize: '11.5px', color: '#1e40af', lineHeight: 1.65, margin: 0 }}>
                  Vos données sont traitées conformément au RGPD et à la loi Informatique et Libertés. Consultez notre <a href="/politique-de-confidentialite" style={{ color: '#1d4ed8', fontWeight: 600 }}>politique de confidentialité</a>.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
