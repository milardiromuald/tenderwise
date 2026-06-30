'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  settings?: Record<string, string>;
}

const navLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/qui-sommes-nous', label: 'Qui sommes-nous ?' },
  { href: '/expertise', label: 'Expertise' },
  { href: '/realisations', label: 'Projets' },
  { href: '/blog', label: 'Actualités' },
  { href: '/carriere', label: 'Carrière' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar({ settings = {} }: NavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const logoUrl = settings.logo_url;
  const siteName = settings.site_name || 'TenderWise';

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        className={`nav-overlay${menuOpen ? ' active' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <nav
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          height: 'var(--header-height)',
          width: '100%',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 9999,
          boxShadow: scrolled
            ? '0 2px 20px rgba(0,0,0,0.1)'
            : '0 1px 0 rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        <div
          style={{
            maxWidth: '1350px',
            width: '100%',
            margin: '0 auto',
            padding: '0 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Logo */}
          <Link href="/" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {logoUrl ? (
              // unoptimized : le logo peut être un SVG uploadé, que l’optimiseur d’images refuse
              <Image src={logoUrl} alt={siteName} width={160} height={46} unoptimized style={{ height: '46px', width: 'auto', display: 'block' }} />
            ) : (
              <span style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '1.25rem',
                color: 'var(--site-blue-dark)',
                letterSpacing: '-0.3px',
              }}>
                Tender<span style={{ color: 'var(--site-gold)' }}>Wise</span>
              </span>
            )}
          </Link>

          {/* Desktop nav links */}
          <ul
            className={`nav-menu${menuOpen ? ' active' : ''}`}
            style={{
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              listStyle: 'none',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            {navLinks.map((link) => {
              const active = link.href === '/'
                ? pathname === '/'
                : pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      color: active ? 'var(--site-blue)' : '#374151',
                      fontWeight: active ? 700 : 600,
                      fontSize: '0.9rem',
                      position: 'relative',
                      padding: '0.5rem 0',
                      transition: 'color 0.2s ease',
                      borderBottom: active ? '2px solid var(--site-gold)' : '2px solid transparent',
                      display: 'block',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            {/* Mobile-only buttons inside menu */}
            <li className="mobile-contact" style={{ display: 'none' }}>
              <Link
                href="/contact"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  background: 'var(--site-blue)',
                  color: 'white',
                  padding: '0.85rem 1.8rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  textAlign: 'center',
                  marginTop: '0.5rem',
                  fontSize: '0.95rem',
                }}
              >
                Nous Contacter
              </Link>
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: '1.5px solid #d1d5db',
                  color: '#6b7280',
                  padding: '0.75rem 1.8rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                  marginTop: '0.5rem',
                  fontSize: '0.88rem',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Administration
              </Link>
            </li>
          </ul>

          {/* Desktop CTA */}
          <div className="nav-cta" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <Link
              href="/contact"
              style={{
                background: 'var(--site-blue)',
                color: 'white',
                padding: '0.7rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '0.88rem',
                display: 'inline-block',
                transition: 'background 0.2s ease, transform 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--site-gold)';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--site-blue)';
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              }}
            >
              Nous Contacter
            </Link>
            {/* Admin shortcut — subtle icon button */}
            <Link
              href="/admin"
              title="Espace administration"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1.5px solid #d1d5db',
                color: '#9ca3af',
                textDecoration: 'none',
                flexShrink: 0,
                transition: 'border-color 0.2s, color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = 'var(--site-blue)';
                el.style.color = 'var(--site-blue)';
                el.style.background = 'rgba(0,74,153,0.05)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = '#d1d5db';
                el.style.color = '#9ca3af';
                el.style.background = 'transparent';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </Link>
          </div>

          {/* Hamburger button */}
          <button
            className="nav-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '32px',
              height: '24px',
              position: 'relative',
              zIndex: 10001,
              flexShrink: 0,
            }}
          >
            <span style={{
              display: 'block', width: '100%', height: '2.5px',
              background: 'var(--site-blue)',
              position: 'absolute', top: menuOpen ? '10px' : '0',
              transform: menuOpen ? 'rotate(45deg)' : 'none',
              transition: '0.3s', borderRadius: '2px',
            }} />
            <span style={{
              display: 'block', width: '100%', height: '2.5px',
              background: 'var(--site-blue)',
              position: 'absolute', top: '10px',
              opacity: menuOpen ? 0 : 1,
              transition: '0.3s', borderRadius: '2px',
            }} />
            <span style={{
              display: 'block', width: '100%', height: '2.5px',
              background: 'var(--site-blue)',
              position: 'absolute', top: menuOpen ? '10px' : '20px',
              transform: menuOpen ? 'rotate(-45deg)' : 'none',
              transition: '0.3s', borderRadius: '2px',
            }} />
          </button>
        </div>

        <style>{`
          @media (max-width: 1024px) {
            .nav-menu {
              position: fixed !important;
              top: 0;
              right: -100%;
              width: 85%;
              max-width: 340px;
              height: 100vh;
              background: #fff;
              flex-direction: column !important;
              justify-content: flex-start !important;
              padding: 6rem 2rem 2rem !important;
              gap: 0.25rem !important;
              transition: right 0.35s cubic-bezier(0.4,0,0.2,1) !important;
              box-shadow: -8px 0 32px rgba(0,0,0,0.12);
              align-items: flex-start !important;
              z-index: 10000;
              overflow-y: auto;
            }
            .nav-menu li a {
              font-size: 1rem !important;
              padding: 0.85rem 0 !important;
              display: block !important;
              width: 100%;
              border-bottom: 1px solid #f1f5f9 !important;
            }
            .nav-menu li:last-child a {
              border-bottom: none !important;
            }
            .nav-menu.active { right: 0 !important; }
            .nav-toggle { display: block !important; }
            .nav-cta { display: none !important; }
            .mobile-contact { display: block !important; width: 100%; margin-top: 0.5rem; }
          }
          @media (max-width: 1280px) and (min-width: 1025px) {
            .nav-menu { gap: 1rem !important; }
          }
        `}</style>
      </nav>
    </>
  );
}
