'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface AtoutsSectionProps {
  settings?: Record<string, string>;
}

const iconBoxes = [
  { icon: '📐', title: 'Études & Faisabilité', text: 'Programmation architecturale et technique, estimations financières.' },
  { icon: '🏗️', title: 'Conduite d\'Opération', text: 'Pilotage global : gestion administrative, suivi de chantier et réception.' },
  { icon: '⚙️', title: 'Facility Management', text: 'Pilotage des contrats de maintenance et contrôles réglementaires.' },
];

const featureRows = [
  {
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=600&q=80',
    alt: 'Études et Programmation',
    title: 'Programmation & Faisabilité',
    text: 'Avant de lancer une opération, nous sécurisons votre investissement par des études de faisabilité précises. Nous définissons avec vous le programme technique et fonctionnel.',
    items: ['Faisabilité technique & architecturale', 'Estimations financières prévisionnelles', 'Définition des besoins utilisateurs'],
    reverse: false,
    link: null,
  },
  {
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    alt: 'Conduite d\'Opération',
    title: 'Conduite d\'Opération (AMO)',
    text: 'Nous assurons le pilotage intégral de l\'opération pour le compte du Maître d\'Ouvrage, garantissant le respect des coûts, de la qualité et des délais.',
    items: ['Sélection des intervenants (MOE, Entreprises)', 'Suivi administratif et financier', 'Coordination et réception des travaux'],
    reverse: true,
    link: { href: '/realisations', label: 'Voir nos projets' },
  },
  {
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
    alt: 'Facility Management',
    title: 'Facility Management & Exploitation',
    text: 'Nous vous accompagnons dans la gestion technique et réglementaire de vos bâtiments via le pilotage des contrats de Facility Management.',
    items: ['Maintenance Standard : Suivi des contrats multitechniques.', 'Maintenance Réglementaire : Gestion des obligations.', 'Contrôles Réglementaires : Suivi des vérifications périodiques.'],
    reverse: false,
    link: null,
  },
];

export default function AtotsSection({ settings = {} }: AtoutsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  const sectionTitle = settings.atouts_title || 'Une expertise globale du cycle de vie immobilier';
  const sectionSubtitle = settings.atouts_subtitle || 'De la programmation initiale jusqu\'au pilotage de l\'exploitation, nous sécurisons vos actifs à chaque étape.';

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    const elements = sectionRef.current?.querySelectorAll('.fade-in-element');
    elements?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{ backgroundColor: 'var(--site-light)', padding: '5rem 0', overflow: 'hidden' }}
    >
      <div className="container">
        {/* Header */}
        <div className="fade-in-element" style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto 4rem auto', padding: '0 1rem' }}>
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', color: 'var(--site-blue-dark)', marginBottom: '1rem' }}>
            {sectionTitle}
          </h2>
          <p style={{ color: 'var(--site-text)', fontSize: '1.1rem', lineHeight: 1.6 }}>{sectionSubtitle}</p>
        </div>

        {/* 3 Icons — uses .atouts-icons-grid from globals.css */}
        <div className="fade-in-element atouts-icons-grid">
          {iconBoxes.map((box) => (
            <div
              key={box.title}
              style={{
                padding: '2rem 1.5rem',
                background: '#fff',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
              }}
            >
              <div style={{ width: '80px', height: '80px', background: '#fff', border: '2px solid var(--site-gold)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', fontSize: '2rem', boxShadow: 'var(--shadow-sm)' }}>
                {box.icon}
              </div>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.8rem', color: 'var(--site-blue-dark)' }}>{box.title}</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--site-text)', lineHeight: 1.5, textAlign: 'center' }}>{box.text}</p>
            </div>
          ))}
        </div>

        {/* Feature Rows — uses .feature-row and .feature-row.reverse from globals.css */}
        {featureRows.map((row) => (
          <div
            key={row.title}
            className={`fade-in-element feature-row${row.reverse ? ' reverse' : ''}`}
          >
            {/* Image */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <Image
                src={row.image}
                alt={row.alt}
                width={380}
                height={380}
                sizes="(max-width: 768px) 90vw, 380px"
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  aspectRatio: '1/1',
                  objectFit: 'cover',
                  borderRadius: '50%',
                  border: '8px solid #fff',
                  boxShadow: 'var(--shadow-lg)',
                  transition: 'transform 0.5s ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
              />
            </div>

            {/* Text */}
            <div className="feature-row-text" style={{ flex: 1 }}>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', color: 'var(--site-blue-dark)', marginBottom: '1rem', position: 'relative', paddingBottom: '1rem' }}>
                {row.title}
                <span style={{ position: 'absolute', bottom: 0, left: 0, width: '60px', height: '3px', background: 'var(--site-gold)', display: 'block', borderRadius: '2px' }} />
              </h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--site-text)', lineHeight: 1.7, marginBottom: '1.5rem' }}>{row.text}</p>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
                {row.items.map((item) => (
                  <li key={item} style={{ position: 'relative', paddingLeft: '1.5rem', marginBottom: '0.5rem', color: 'var(--site-text)', fontSize: '1rem' }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--site-gold)', fontWeight: 'bold', fontSize: '1.2rem', lineHeight: 1 }}>•</span>
                    {item}
                  </li>
                ))}
              </ul>
              {row.link && (
                <Link
                  href={row.link.href}
                  style={{
                    display: 'inline-block',
                    padding: '0.7rem 2rem',
                    border: '2px solid var(--site-blue)',
                    borderRadius: '50px',
                    color: 'var(--site-blue)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'var(--site-blue)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                    (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--site-blue)';
                    (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                  }}
                >
                  {row.link.label}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
