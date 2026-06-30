import Link from 'next/link';
import { buildLandingSchema, type LandingContent } from '@/lib/landings';

const h2Style: React.CSSProperties = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
  color: 'var(--site-blue-dark)',
  marginBottom: '1rem',
};

/**
 * Template unique des landing pages du cluster SEO (voir lib/landings.ts).
 * Server component : le JSON-LD est rendu côté serveur, lisible par Google et les IA.
 */
export default function LandingPage({ data }: { data: LandingContent }) {
  const schema = buildLandingSchema(data);

  return (
    <main style={{ backgroundColor: 'var(--site-white)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #003366, #00284f)', padding: '6rem 0 4rem' }}>
        <div className="container">
          <nav style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.8)' }}>Accueil</Link>
            <span style={{ margin: '0 0.5rem' }}>›</span>
            <Link href="/expertise" style={{ color: 'rgba(255,255,255,0.8)' }}>Expertise</Link>
            <span style={{ margin: '0 0.5rem' }}>›</span>
            <span>{data.breadcrumbLabel}</span>
          </nav>
          <span style={{ color: 'var(--site-gold)', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 700, fontSize: '0.85rem' }}>
            {data.eyebrow}
          </span>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(1.9rem, 4.5vw, 2.8rem)', color: '#fff', margin: '1rem 0', lineHeight: 1.2 }}>
            {data.h1}
          </h1>
          <p
            style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.15rem', lineHeight: 1.7, maxWidth: '780px' }}
            dangerouslySetInnerHTML={{ __html: data.heroIntro }}
          />
          <Link href="/contact" style={{ display: 'inline-block', marginTop: '2rem', background: 'var(--site-gold)', color: '#003366', fontWeight: 800, padding: '0.9rem 2rem', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>
            {data.ctaLabel}
          </Link>
        </div>
      </section>

      {/* Sections de contenu */}
      {data.sections.map((s, i) => (
        <section key={s.h2} style={{ padding: i % 2 === 0 ? '4rem 0' : '2rem 0 4rem', background: i % 2 === 0 ? 'var(--site-white)' : 'var(--site-light)' }}>
          <div className="container" style={{ maxWidth: '820px' }}>
            <h2 style={h2Style}>{s.h2}</h2>
            <div style={{ width: '60px', height: '3px', background: 'var(--site-gold)', margin: '0 0 2rem', borderRadius: '2px' }} />
            <div
              style={{ color: 'var(--site-text)', lineHeight: 1.8, fontSize: '1.05rem' }}
              dangerouslySetInnerHTML={{ __html: s.body }}
            />
          </div>
        </section>
      ))}

      {/* FAQ */}
      <section style={{ padding: '4rem 0', background: 'var(--site-white)' }}>
        <div className="container" style={{ maxWidth: '820px' }}>
          <h2 style={{ ...h2Style, textAlign: 'center', marginBottom: '2.5rem' }}>Questions fréquentes</h2>
          {data.faqs.map((f) => (
            <details key={f.q} style={{ borderBottom: '1px solid #e2e8f0', padding: '1.25rem 0' }}>
              <summary style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: 'var(--site-blue-dark)', cursor: 'pointer', fontSize: '1.05rem' }}>
                {f.q}
              </summary>
              <p style={{ color: 'var(--site-text)', lineHeight: 1.8, marginTop: '1rem', fontSize: '1rem' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Maillage interne + CTA */}
      <section style={{ padding: '2rem 0 5rem', background: 'var(--site-light)' }}>
        <div className="container" style={{ maxWidth: '820px', textAlign: 'center' }}>
          {data.related.length > 0 && (
            <>
              <h2 style={{ ...h2Style, marginBottom: '1.5rem' }}>À explorer aussi</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '3rem' }}>
                {data.related.map((r) => (
                  <Link key={r.href} href={r.href} style={{ background: '#fff', border: '1px solid var(--site-gold)', color: 'var(--site-blue)', fontWeight: 700, padding: '0.7rem 1.4rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                    {r.label}
                  </Link>
                ))}
              </div>
            </>
          )}
          <Link href="/contact" style={{ display: 'inline-block', background: 'var(--site-blue)', color: '#fff', fontWeight: 800, padding: '0.9rem 2.2rem', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>
            Demander un échange gratuit
          </Link>
        </div>
      </section>
    </main>
  );
}
