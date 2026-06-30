'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const expertises = [
  {
    icon: '📐',
    title: 'Études & Faisabilité',
    benefit: 'Sécuriser vos décisions',
    text: 'Nous validons le potentiel de vos projets avant tout engagement pour transformer vos idées en programmes viables.',
    list: ['Audits techniques et architecturaux', 'Analyses de faisabilité immobilière', 'Estimations budgétaires fiables', 'Programmation technique complète'],
  },
  {
    icon: '🏗️',
    title: 'Conduite d\'Opération',
    benefit: 'Maîtriser vos chantiers',
    text: 'En tant qu\'AMO, nous pilotons vos opérations de construction ou de rénovation avec une exigence de résultat totale.',
    list: ['Pilotage de la Maîtrise d\'Œuvre', 'Gestion des dossiers administratifs', 'Suivi rigoureux des budgets/planning', 'Réception et levée des réserves'],
  },
  {
    icon: '⚙️',
    title: 'Gestion de Patrimoine',
    benefit: 'Pérenniser vos actifs',
    text: 'Nous assurons l\'interface entre vos besoins de propriétaire et la réalité technique de l\'exploitation de vos bâtiments.',
    list: ['Audits d\'exploitation & maintenance', 'Stratégies de réduction des charges', 'Plans pluriannuels de travaux (PPT)', 'Suivi de la conformité réglementaire'],
  },
];

const tags = ['Valorisation d\'Actif', 'Décret Tertiaire', 'Audit Énergétique', 'Conseil RSE'];

export default function ExpertisePage() {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 }
    );
    mainRef.current?.querySelectorAll('.fade-in-element').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main ref={mainRef} style={{ backgroundColor: 'var(--site-white)' }}>
      <div style={{ padding: '8rem 0', backgroundColor: 'var(--site-white)' }}>
        <div className="container">

          {/* Header */}
          <div className="fade-in-element" style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto 6rem auto' }}>
            <span style={{ color: 'var(--site-gold)', textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 700, display: 'block', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Nos Domaines d&apos;Intervention
            </span>
            <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: 'var(--site-blue-dark)', marginBottom: '1rem' }}>
              Une Expertise Globale pour vos Actifs Immobiliers
            </h1>
            <div style={{ width: '60px', height: '3px', background: 'var(--site-gold)', margin: '0 auto 2.5rem auto', borderRadius: '2px' }} />
            <p style={{ color: 'var(--site-text)', fontSize: '1.1rem', lineHeight: 1.7 }}>
              Nous agissons comme votre partenaire stratégique pour <strong>sécuriser vos investissements</strong>, optimiser vos coûts de gestion et garantir la conformité de votre patrimoine.
            </p>
          </div>

          {/* Expertise Cards */}
          <div className="fade-in-element expertise-cards-grid">
            {expertises.map((exp) => (
              <div
                key={exp.title}
                style={{
                  background: '#ffffff',
                  borderRadius: '15px',
                  padding: '4rem 2.5rem',
                  transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  border: '1px solid #f0f0f0',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(-15px)';
                  el.style.boxShadow = '0 30px 60px rgba(0,0,0,0.08)';
                  el.style.borderColor = 'var(--site-gold)';
                  const circle = el.querySelector('.exp-icon-circle') as HTMLDivElement;
                  if (circle) { circle.style.background = 'var(--site-blue)'; circle.style.borderColor = 'var(--site-gold)'; circle.style.transform = 'scale(1.1)'; }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.03)';
                  el.style.borderColor = '#f0f0f0';
                  const circle = el.querySelector('.exp-icon-circle') as HTMLDivElement;
                  if (circle) { circle.style.background = 'var(--site-light)'; circle.style.borderColor = '#f0f0f0'; circle.style.transform = 'scale(1)'; }
                }}
              >
                <div
                  className="exp-icon-circle"
                  style={{
                    width: '100px', height: '100px', borderRadius: '50%',
                    background: 'var(--site-light)', border: '2px solid #f0f0f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '2.5rem', fontSize: '2.5rem',
                    transition: 'all 0.4s ease',
                  }}
                >
                  {exp.icon}
                </div>

                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.4rem', color: 'var(--site-blue-dark)', marginBottom: '0.5rem' }}>{exp.title}</h2>
                <span style={{ display: 'inline-block', background: 'var(--site-blue-light)', color: 'var(--site-blue)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1rem' }}>
                  {exp.benefit}
                </span>
                <p style={{ color: 'var(--site-text)', lineHeight: 1.7, marginBottom: '1.5rem' }}>{exp.text}</p>

                <ul style={{ textAlign: 'left', width: '100%', borderTop: '1px solid #eee', paddingTop: '2rem', marginTop: 'auto', listStyle: 'none', padding: '2rem 0 0' }}>
                  {exp.list.map((item) => (
                    <li key={item} style={{ position: 'relative', paddingLeft: '2rem', marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--site-text)' }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--site-gold)', fontWeight: 900 }}>→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Strategy Banner */}
          <div className="fade-in-element expertise-strategy-grid" style={{ background: '#fafafa', borderRadius: '30px', padding: '5rem', border: '1px solid #eee' }}>
            <div>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '2rem', color: 'var(--site-blue-dark)', marginBottom: '1.5rem' }}>
                Conseil Stratégique & Performance
              </h3>
              <p style={{ color: 'var(--site-text)', lineHeight: 1.8, marginBottom: '2rem', fontSize: '1.05rem' }}>
                Parce que le marché immobilier évolue, nous vous accompagnons dans la{' '}
                <strong>valorisation de vos actifs</strong>. De l&apos;audit énergétique à la mise en conformité face au{' '}
                <strong>Décret Tertiaire</strong>, nous définissons des plans d&apos;actions concrets pour maintenir l&apos;attractivité et la rentabilité de votre parc immobilier.
              </p>
              <p style={{ color: 'var(--site-text)', lineHeight: 1.8, marginBottom: '2rem', fontSize: '1.05rem' }}>
                Un projet à Lyon&nbsp;? Découvrez notre{' '}
                <Link href="/amo-lyon" style={{ color: 'var(--site-blue)', fontWeight: 700 }}>mission d&apos;AMO à Lyon</Link>. Ailleurs en France&nbsp;? Nous pilotons aussi vos opérations{' '}
                <Link href="/amo-france" style={{ color: 'var(--site-blue)', fontWeight: 700 }}>partout sur le territoire</Link>.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {tags.map((tag) => (
                  <span key={tag} style={{ background: '#ffffff', padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 700, color: 'var(--site-blue)', fontSize: '0.8rem', border: '1px solid var(--site-gold)', textTransform: 'uppercase' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <Image
                src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80"
                alt="Conseil stratégique immobilier"
                width={1200}
                height={500}
                sizes="(max-width: 768px) 100vw, 560px"
                style={{ height: '500px', objectFit: 'cover', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>

    </main>
  );
}
