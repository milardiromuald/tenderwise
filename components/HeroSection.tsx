'use client';

import Link from 'next/link';

interface HeroSectionProps {
  settings?: Record<string, string>;
}

export default function HeroSection({ settings = {} }: HeroSectionProps) {
  const heroImage = settings.hero_image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80';
  const eyebrow = settings.hero_eyebrow || 'Assistance à Maîtrise d\'Ouvrage';
  const title = settings.hero_title || 'Valorisez vos actifs immobiliers avec une vision durable.';
  const subtitle = settings.hero_subtitle || 'Expertise en gestion de projet, réhabilitation et facility management.';
  const btnPrimary = settings.hero_btn_primary || 'Démarrer un projet';
  const btnSecondary = settings.hero_btn_secondary || 'Nos expertises';

  return (
    <>
      <section
        style={{
          position: 'relative',
          height: '100vh',
          minHeight: '650px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          backgroundImage: `url('${heroImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          marginTop: 'calc(var(--header-height) * -1)',
          paddingTop: 'var(--header-height)',
          overflow: 'hidden',
        }}
      >
        {/* Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(1px)',
          zIndex: 1,
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '950px', padding: '2rem', width: '100%' }}>
          <span
            style={{
              display: 'inline-block',
              fontFamily: "'Open Sans', sans-serif",
              fontSize: '0.9rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: 'var(--site-blue)',
              marginBottom: '1rem',
              animation: 'fadeInUp 0.8s ease forwards 0.2s',
              opacity: 0,
            }}
          >
            {eyebrow}
            <span style={{ display: 'block', width: '40px', height: '2px', background: 'var(--site-gold)', margin: '8px auto 0' }} />
          </span>

          <h1
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: 'clamp(2.5rem, 5.5vw, 4.2rem)',
              fontWeight: 800,
              marginBottom: '1.5rem',
              lineHeight: 1.15,
              color: '#1e293b',
              letterSpacing: '-1px',
              animation: 'fadeInUp 0.8s ease forwards 0.4s',
              opacity: 0,
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontFamily: "'Open Sans', sans-serif",
              fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
              marginBottom: '3rem',
              lineHeight: 1.6,
              color: '#475569',
              maxWidth: '700px',
              marginInline: 'auto',
              animation: 'fadeInUp 0.8s ease forwards 0.6s',
              opacity: 0,
            }}
          >
            {subtitle}
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              flexWrap: 'wrap',
              animation: 'fadeInUp 0.8s ease forwards 0.8s',
              opacity: 0,
            }}
          >
            <Link
              href="/contact"
              style={{
                padding: '1rem 2.2rem',
                borderRadius: '6px',
                fontWeight: 700,
                background: 'var(--site-blue)',
                color: 'white',
                border: '2px solid var(--site-blue)',
                boxShadow: '0 10px 20px rgba(15, 76, 129, 0.2)',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                fontFamily: "'Open Sans', sans-serif",
                textDecoration: 'none',
                display: 'inline-block',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLAnchorElement).style.background = '#0b3d6b';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = '#0b3d6b';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--site-blue)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--site-blue)';
              }}
            >
              {btnPrimary}
            </Link>

            <Link
              href="/expertise"
              style={{
                padding: '1rem 2.2rem',
                borderRadius: '6px',
                fontWeight: 700,
                border: '2px solid #1e293b',
                color: '#1e293b',
                background: 'transparent',
                fontSize: '1rem',
                transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                display: 'inline-block',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = '#1e293b';
                (e.currentTarget as HTMLAnchorElement).style.color = 'white';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.color = '#1e293b';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              }}
            >
              {btnSecondary}
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            animation: 'fadeIn 1s ease forwards 1.5s',
            opacity: 0,
          }}
        >
          <div style={{ width: '26px', height: '42px', border: '2px solid #1e293b', borderRadius: '20px', position: 'relative' }}>
            <div style={{
              width: '4px', height: '8px', background: '#1e293b',
              position: 'absolute', top: '6px', left: '50%',
              transform: 'translateX(-50%)', borderRadius: '2px',
              animation: 'scrollWheel 2s infinite',
            }} />
          </div>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 0.7; }
          }
          @keyframes scrollWheel {
            0% { top: 6px; opacity: 1; }
            100% { top: 20px; opacity: 0; }
          }
          @media (max-width: 768px) {
            section { height: auto !important; min-height: 500px !important; padding: 6rem 1rem 4rem !important; }
          }
        `}</style>
      </section>

    </>
  );
}
