'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

const values = [
  { icon: '🛡️', title: 'Indépendance', text: 'Objectivité totale dans le choix des prestataires et la validation des solutions techniques.' },
  { icon: '🎯', title: 'Pragmatisme', text: 'Solutions opérationnelles, réalistes et maîtrisées financièrement.' },
  { icon: '🤝', title: 'Transparence', text: 'Reporting clair et régulier. Vous décidez, nous gérons la complexité.' },
];

const features = [
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    title: 'Expertise multi-sectorielle',
    desc: 'Une vision globale adaptée à vos enjeux.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
    title: 'Gestion de projet complète',
    desc: 'Pilotage de A à Z sans intermédiaire.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    title: 'Suivi personnalisé',
    desc: 'Un interlocuteur unique dédié à votre réussite.',
  },
];

export default function QuiSommesNousPage() {
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

      {/* Section 1 — Qui sommes-nous */}
      <section style={{ backgroundColor: 'var(--site-light)', padding: '5rem 0' }}>
        <div className="container-narrow">
          {/* about-hero-grid — responsive 2→1 col via globals.css */}
          <div className="about-hero-grid">
            <div className="fade-in-element">
              <Image
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=800&q=80"
                alt="L'équipe TenderWise"
                width={800}
                height={533}
                sizes="(max-width: 768px) 100vw, 560px"
                style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
              />
            </div>
            <div className="fade-in-element">
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '1rem', color: 'var(--site-blue-dark)' }}>
                Un partenaire de confiance
              </h2>
              <div style={{ width: '60px', height: '3px', background: 'var(--site-gold)', margin: '0 0 2rem 0', borderRadius: '2px' }} />
              <p style={{ color: 'var(--site-text)', marginBottom: '1rem', fontSize: '1.05rem', lineHeight: 1.7 }}>
                Fondé par des experts des grands groupes d&apos;ingénierie, TenderWise apporte une réponse{' '}
                <strong>sur-mesure</strong> aux investisseurs et propriétaires immobiliers.
              </p>
              <p style={{ color: 'var(--site-text)', marginBottom: '2rem', fontSize: '1.05rem', lineHeight: 1.7 }}>
                Nous sommes votre <strong>bras droit technique</strong>, défendant vos intérêts financiers et architecturaux de la programmation à l&apos;exploitation.
              </p>

              {/* Stats — about-stats-grid responsive via globals.css */}
              <div className="about-stats-grid">
                {[['20+', 'ans d\'expérience cumulée'], ['100%', 'd\'indépendance garantie']].map(([val, label]) => (
                  <div key={val} style={{ textAlign: 'center', padding: '1.5rem', background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--site-border)' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--site-gold)', display: 'block' }}>{val}</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--site-text)' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2.5rem' }}>
                {features.map((f) => (
                  <div
                    key={f.title}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      background: '#fff', padding: '1rem', borderRadius: '8px',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                      border: '1px solid rgba(0,0,0,0.03)',
                      transition: 'transform 0.3s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(4px)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(0)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e6f0fa', color: '#0056b3', width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0 }}>
                      {f.icon}
                    </div>
                    <div>
                      <strong style={{ fontSize: '1.05rem', color: '#2c3e50', display: 'block', marginBottom: '0.2rem' }}>{f.title}</strong>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Valeurs */}
      <section style={{ padding: '5rem 0', backgroundColor: 'var(--site-white)' }}>
        <div className="container-narrow">
          <div className="fade-in-element" style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', color: 'var(--site-blue-dark)' }}>
              Nos Valeurs Fondatrices
            </h2>
            <div style={{ width: '60px', height: '3px', background: 'var(--site-gold)', margin: '1rem auto 0', borderRadius: '2px' }} />
            <p style={{ color: 'var(--site-text)', marginTop: '1rem', fontSize: '1.1rem' }}>Les piliers de notre engagement quotidien</p>
          </div>

          {/* about-values-grid — responsive 3→2→1 col via globals.css */}
          <div className="fade-in-element about-values-grid">
            {values.map((v) => (
              <div
                key={v.title}
                style={{
                  background: 'white',
                  padding: '2rem 1.5rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid transparent',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: '0.3s',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--site-gold)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <span style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'block' }}>{v.icon}</span>
                <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.2rem', color: 'var(--site-blue-dark)', marginBottom: '0.8rem' }}>{v.title}</h3>
                <p style={{ color: 'var(--site-text)', lineHeight: 1.6 }}>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 — RSE */}
      <section style={{
        background: 'linear-gradient(135deg, var(--site-light) 0%, #dcfce7 100%)',
        padding: '5rem 0',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', fontSize: '10rem', opacity: 0.05, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', userSelect: 'none' }}>🌱</div>
        <div className="container-narrow fade-in-element" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '3rem', color: 'var(--status-green)', marginBottom: '1rem' }}>🌱</div>
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', color: 'var(--status-green)', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '1rem' }}>
            Nos Engagements RSE
          </h2>
          <div style={{ width: '60px', height: '3px', background: 'var(--status-green)', margin: '0 auto 2rem', borderRadius: '2px' }} />
          <p style={{ color: 'var(--site-text)', fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto 2rem', lineHeight: 1.7 }}>
            L&apos;immobilier est au cœur de la transition écologique. Chaque projet est une opportunité de réduire l&apos;empreinte carbone et d&apos;améliorer le confort des usagers.
          </p>
          <div style={{ fontSize: '1.1rem', color: 'var(--site-text)', lineHeight: 1.8 }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--site-dark)' }}>Nous intégrons systématiquement :</strong>
            ✓ Analyse du cycle de vie<br />
            ✓ Réemploi des matériaux<br />
            ✓ Efficacité énergétique optimale
          </div>
        </div>
      </section>
    </main>
  );
}
