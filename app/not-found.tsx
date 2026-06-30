import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Inter, system-ui, sans-serif; }
        .nf-nav a { text-decoration: none; color: inherit; }
        .nf-nav a:hover { color: #c5a059; }
        .nf-btn-primary:hover { background: #b8923f !important; }
        .nf-btn-ghost:hover { background: rgba(255,255,255,0.08) !important; }
        .nf-link-back:hover { color: #c5a059 !important; }
        @media (max-width: 640px) {
          .nf-actions { flex-direction: column !important; }
          .nf-code { font-size: 6rem !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.97)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        height: '70px',
        display: 'flex', alignItems: 'center',
        padding: '0 2rem',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{
            fontSize: '1.5rem', fontWeight: 900,
            fontFamily: 'Montserrat, sans-serif',
            color: 'white', letterSpacing: '-0.5px',
          }}>
            Tender<span style={{ color: '#c5a059' }}>Wise</span>
          </div>
        </Link>

        <nav className="nf-nav" style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2rem',
        }}>
          {[
            { href: '/expertise', label: 'Expertise' },
            { href: '/projets', label: 'Réalisations' },
            { href: '/blog', label: 'Blog' },
            { href: '/contact', label: 'Contact' },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{
              color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem',
              fontWeight: 500, transition: 'color 0.15s',
            }}>
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '7rem 1.5rem 3rem',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(197,160,89,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ textAlign: 'center', maxWidth: '560px', position: 'relative' }}>

          {/* 404 number */}
          <div className="nf-code" style={{
            fontSize: '9rem', fontWeight: 900,
            fontFamily: 'Montserrat, sans-serif',
            color: 'transparent',
            backgroundImage: 'linear-gradient(135deg, #c5a059 0%, #e8c97a 50%, #c5a059 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            lineHeight: 1,
            marginBottom: '1.5rem',
            letterSpacing: '-4px',
          }}>
            404
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '1.75rem', fontWeight: 800,
            color: 'white', marginBottom: '1rem',
            lineHeight: 1.25,
          }}>
            Page introuvable
          </h1>

          {/* Description */}
          <p style={{
            color: 'rgba(255,255,255,0.55)', fontSize: '1rem',
            lineHeight: 1.75, marginBottom: '2.5rem',
          }}>
            La page que vous recherchez n&apos;existe pas ou a été déplacée.
            Utilisez le menu de navigation ou retournez à l&apos;accueil.
          </p>

          {/* Actions */}
          <div className="nf-actions" style={{
            display: 'flex', gap: '1rem', justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <Link href="/" className="nf-btn-primary" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '14px 28px',
              background: '#c5a059', color: '#0f172a',
              borderRadius: '8px', fontWeight: 700, fontSize: '0.925rem',
              textDecoration: 'none', transition: 'background 0.2s',
              fontFamily: 'Montserrat, sans-serif',
              whiteSpace: 'nowrap',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Retour à l&apos;accueil
            </Link>

            <Link href="/contact" className="nf-btn-ghost" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '14px 28px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.8)',
              borderRadius: '8px', fontWeight: 600, fontSize: '0.925rem',
              textDecoration: 'none', transition: 'background 0.2s',
              whiteSpace: 'nowrap',
            }}>
              Nous contacter
            </Link>
          </div>

          {/* Quick nav links */}
          <div style={{
            marginTop: '3rem', paddingTop: '2rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap',
          }}>
            {[
              { href: '/expertise', label: 'Notre expertise' },
              { href: '/projets', label: 'Réalisations' },
              { href: '/blog', label: 'Blog' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="nf-link-back" style={{
                color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem',
                textDecoration: 'none', transition: 'color 0.15s',
              }}>
                {label} →
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
