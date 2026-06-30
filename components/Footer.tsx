'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FooterProps {
  settings?: Record<string, string>;
}

type ModalType = 'contact' | 'legal' | 'privacy' | 'sitemap' | null;

/* Styles de la politique de confidentialité (modale) */
const ppH3: React.CSSProperties = { fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', color: 'var(--site-blue-dark)', margin: '20px 0 8px' };
const ppP: React.CSSProperties = { margin: '0 0 10px' };
const ppUl: React.CSSProperties = { listStyle: 'disc', paddingLeft: '20px', margin: '0 0 10px' };
const ppA: React.CSSProperties = { color: 'var(--site-blue)', fontWeight: 600 };

export default function Footer({ settings = {} }: FooterProps) {
  const [modal, setModal] = useState<ModalType>(null);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  const siteName = settings.site_name || 'TenderWise';
  const siteSubtitle = settings.site_subtitle || 'Expert indépendant en AMO';
  const description = settings.footer_company_description || 'Expertise globale en Construction, Réhabilitation et Gestion d\'Actifs Immobiliers.';
  const address = settings.contact_address || '54 Avenue Général Leclerc, 69100 Villeurbanne, France';
  const email = settings.contact_email || 'contact@tenderwise.fr';
  const phone = settings.contact_phone || '04 78 00 00 00';
  const siren = settings.footer_siren || '983 761 214';
  const rcs = settings.footer_rcs || 'Lyon';
  // ── Données RGPD (paramétrables dans Admin → RGPD & Cookies) ──────────────
  const rgpdEmail = settings.rgpd_dpo_email || email;
  const rgpdName = settings.rgpd_dpo_name || '';
  const rgpdAddress = settings.rgpd_dpo_address || address;
  const rgpdRetention = settings.rgpd_retention || '13 mois (cookies) / 3 ans (prospects)';

  const openModal = (type: ModalType) => {
    setModal(type);
    setEmailRevealed(false);
    setPhoneRevealed(false);
  };
  const closeModal = () => setModal(null);

  // Bloque le scroll de la page tant qu’une modale est ouverte
  useEffect(() => {
    document.body.style.overflow = modal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  return (
    <>
      <footer style={{
        backgroundColor: 'var(--site-light)',
        color: 'var(--site-dark)',
        padding: '4rem 0 2rem 0',
        borderTop: '1px solid var(--site-border)',
        fontFamily: "'Open Sans', sans-serif",
        position: 'relative',
        zIndex: 10,
      }}>
        <div className="footer-grid" style={{ maxWidth: '1300px', margin: '0 auto', padding: '0 1.5rem' }}>
          {/* Col 1 - Company */}
          <div>
            <h4 style={{ color: 'var(--site-blue)', fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.5rem', position: 'relative', paddingBottom: '12px', fontWeight: 700 }}>
              {siteName} <span style={{ fontSize: '0.65em', textTransform: 'none', color: '#666', fontWeight: 400 }}>
                <br />{siteSubtitle}
              </span>
              <span style={{ position: 'absolute', left: 0, bottom: 0, width: '40px', height: '3px', background: 'var(--site-gold)', borderRadius: '2px' }} />
            </h4>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#4a4a4a', marginBottom: '1rem' }}>{description}</p>
            <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
              <p><strong>📍 Siège Social :</strong><br />{address}</p>
            </div>
          </div>

          {/* Col 2 - Expertises */}
          <nav>
            <h4 style={{ color: 'var(--site-blue)', fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1.5rem', position: 'relative', paddingBottom: '12px', fontWeight: 700 }}>
              Nos Expertises
              <span style={{ position: 'absolute', left: 0, bottom: 0, width: '40px', height: '3px', background: 'var(--site-gold)', borderRadius: '2px' }} />
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {[
                ['Construction & Réhabilitation', '/expertise'],
                ['Gestion & Maintenance', '/expertise'],
                ['Pilotage d\'Exploitation', '/expertise'],
                ['Facility Management', '/expertise'],
                ['Gestion des Risques', '/expertise'],
              ].map(([label, href]) => (
                <li key={label} style={{ marginBottom: '0.8rem', paddingLeft: '18px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--site-gold)', fontWeight: 'bold', fontSize: '1.2rem', lineHeight: 1 }}>•</span>
                  <Link href={href} style={{ textDecoration: 'none', color: '#333', fontSize: '0.95rem', transition: 'all 0.3s ease' }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Col 3 - Legal */}
          <nav>
            <h4 style={{ color: 'var(--site-blue)', fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1.5rem', position: 'relative', paddingBottom: '12px', fontWeight: 700 }}>
              Informations
              <span style={{ position: 'absolute', left: 0, bottom: 0, width: '40px', height: '3px', background: 'var(--site-gold)', borderRadius: '2px' }} />
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {[
                ['Mentions Légales', 'legal'],
                ['Politique de Confidentialité', 'privacy'],
                ['Gérer les cookies', 'cookies'],
                ['Plan du site', 'sitemap'],
                ['Nous contacter', 'contact'],
              ].map(([label, type]) => (
                <li key={label} style={{ marginBottom: '0.8rem', paddingLeft: '18px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--site-gold)', fontWeight: 'bold', fontSize: '1.2rem', lineHeight: 1 }}>•</span>
                  <button
                    onClick={() => {
                      if (type === 'cookies') {
                        // Rouvre le bandeau de gestion des cookies (CookieConsent)
                        (window as unknown as { openCookieSettings?: () => void }).openCookieSettings?.();
                      } else {
                        openModal(type as ModalType);
                      }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#333', fontSize: '0.95rem', padding: 0, transition: 'all 0.3s ease' }}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Col 4 - Group */}
          <div>
            <h4 style={{ color: 'var(--site-blue)', fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '1.5rem', position: 'relative', paddingBottom: '12px', fontWeight: 700 }}>
              Le Groupe
              <span style={{ position: 'absolute', left: 0, bottom: 0, width: '40px', height: '3px', background: 'var(--site-gold)', borderRadius: '2px' }} />
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {[
                ['Actualités', '/blog'],
                ['Carrière & Recrutement', '/carriere'],
              ].map(([label, href]) => (
                <li key={label} style={{ marginBottom: '0.8rem', paddingLeft: '18px', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color: 'var(--site-gold)', fontWeight: 'bold', fontSize: '1.2rem', lineHeight: 1 }}>•</span>
                  <Link href={href} style={{ textDecoration: 'none', color: '#333', fontSize: '0.95rem' }}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ margin: '3.5rem auto 0', padding: '1.5rem 1.5rem 0', borderTop: '1px solid #dcdcdc', maxWidth: '1300px', textAlign: 'center', fontSize: '0.85rem', color: '#666' }}>
          <p>© {new Date().getFullYear()} <strong>{siteName}</strong> ({siteSubtitle}). Tous droits réservés.</p>
          <p>SAS au capital de 1 000 € | SIREN : {siren} | RCS {rcs} | TVA Intracom. : FRXX{siren.replace(/\s/g, '')}</p>
        </div>

      </footer>

      {/* Modals */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)', zIndex: 9999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{
            background: '#fff', width: '90%', maxWidth: '600px',
            maxHeight: '90vh', overflowY: 'auto',
            padding: '40px', borderRadius: '8px',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            animation: 'slideInUp 0.3s ease',
          }}>
            <button
              onClick={closeModal}
              style={{ position: 'absolute', top: '15px', right: '20px', fontSize: '28px', fontWeight: 'bold', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}
            >×</button>

            {modal === 'contact' && (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '2rem', marginBottom: '30px', textTransform: 'uppercase', letterSpacing: '1px' }}>CONTACT</h2>
                <p style={{ color: '#666', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                  Vous souhaitez échanger sur un projet ?<br />Nos experts sont à votre écoute.
                </p>
                <div style={{ marginBottom: '25px' }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#333', marginBottom: '10px' }}>PAR EMAIL</span>
                  {emailRevealed ? (
                    <a href={`mailto:${email}`} style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--site-blue)' }}>{email}</a>
                  ) : (
                    <button onClick={() => setEmailRevealed(true)} style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 25px', background: '#f2f2f2', borderRadius: '50px', border: '1px solid #e0e0e0', cursor: 'pointer', fontSize: '1rem', minWidth: '220px', justifyContent: 'center' }}>👁️ <span style={{ marginLeft: '8px' }}>Afficher l&apos;email</span></button>
                  )}
                </div>
                <div style={{ marginBottom: '35px' }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#333', marginBottom: '10px' }}>PAR TÉLÉPHONE</span>
                  {phoneRevealed ? (
                    <a href={`tel:${phone.replace(/\s/g, '')}`} style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--site-blue)' }}>{phone}</a>
                  ) : (
                    <button onClick={() => setPhoneRevealed(true)} style={{ display: 'inline-flex', alignItems: 'center', padding: '12px 25px', background: '#f2f2f2', borderRadius: '50px', border: '1px solid #e0e0e0', cursor: 'pointer', fontSize: '1rem', minWidth: '220px', justifyContent: 'center' }}>📱 <span style={{ marginLeft: '8px' }}>Afficher le numéro</span></button>
                  )}
                </div>
                <button onClick={() => { window.location.href = `mailto:${email}`; }} style={{ background: 'var(--site-blue)', color: 'white', fontWeight: 700, textTransform: 'uppercase', padding: '15px 30px', border: 'none', borderRadius: '4px', fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '1px', width: '100%', maxWidth: '300px' }}>ENVOYER UN MESSAGE</button>
              </div>
            )}

            {modal === 'legal' && (
              <div>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.8rem', marginBottom: '20px', borderBottom: '2px solid var(--site-gold)', paddingBottom: '10px', color: 'var(--site-blue)' }}>Mentions Légales</h2>
                <h3 style={{ marginTop: '20px', color: '#333' }}>1. Éditeur du site</h3>
                <p style={{ textAlign: 'left', marginBottom: '10px' }}><strong>TENDER WISE</strong> SAS au capital de 1 000 €<br />54 Avenue Général Leclerc, 69100 Villeurbanne<br />SIREN : {siren} RCS {rcs}</p>
                <h3 style={{ marginTop: '20px', color: '#333' }}>2. Hébergement</h3>
                <p style={{ textAlign: 'left', marginBottom: '10px' }}><strong>Vercel Inc.</strong> / <strong>o2switch</strong><br />222-224 Boulevard Gustave Flaubert, 63000 Clermont-Ferrand</p>
                <h3 style={{ marginTop: '20px', color: '#333' }}>3. Propriété intellectuelle</h3>
                <p style={{ textAlign: 'left' }}>L&apos;ensemble de ce site relève de la législation française et internationale sur le droit d&apos;auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés.</p>
              </div>
            )}

            {modal === 'privacy' && (
              <div style={{ textAlign: 'left', fontSize: '0.92rem', lineHeight: 1.65, color: '#374151' }}>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.8rem', marginBottom: '8px', borderBottom: '2px solid var(--site-gold)', paddingBottom: '10px', color: 'var(--site-blue)' }}>Politique de Confidentialité</h2>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '18px' }}>Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>

                <h3 style={ppH3}>1. Responsable du traitement</h3>
                <p style={ppP}><strong>{siteName} SAS</strong>, {rgpdAddress}.{rgpdName ? <> Référent données personnelles : {rgpdName}.</> : null} Contact : <a href={`mailto:${rgpdEmail}`} style={ppA}>{rgpdEmail}</a>.</p>

                <h3 style={ppH3}>2. Données collectées, finalités et bases légales</h3>
                <ul style={ppUl}>
                  <li><strong>Formulaire de contact</strong> — nom, email, téléphone, société, message. <em>Finalité :</em> répondre à votre demande et en assurer le suivi. <em>Base légale :</em> votre consentement (art. 6.1.a).</li>
                  <li><strong>Données techniques</strong> — adresse IP et navigateur, enregistrés lors de l’envoi d’un formulaire (contact, candidature) ou d’un choix de cookies. <em>Finalité :</em> sécurité, lutte anti-spam et preuve de consentement. <em>Base légale :</em> intérêt légitime (art. 6.1.f).</li>
                  <li><strong>Mesure d’audience</strong> — après votre accord uniquement : pages vues, source de provenance (moteur de recherche, réseau social, site référent), type d’appareil, navigateur, et localisation approximative (pays/ville). <em>Base légale :</em> consentement (art. 6.1.a).</li>
                  <li><strong>Candidatures (carrière)</strong> — nom, prénom, email, téléphone, CV et lettre de motivation. <em>Finalité :</em> étude de votre candidature. <em>Base légale :</em> votre consentement. Pièces et données accessibles aux seuls recruteurs, conservées {settings.application_retention || '2 ans'} puis supprimées.</li>
                  <li><strong>Journaux de connexion à l’administration</strong> — identifiant, IP, navigateur (utilisateurs internes uniquement). <em>Base légale :</em> intérêt légitime (sécurité).</li>
                </ul>

                <h3 style={ppH3}>3. Destinataires</h3>
                <p style={ppP}>Vos données ne sont ni vendues ni transmises à des tiers à des fins commerciales. Elles peuvent être traitées par nos sous-traitants techniques : l’hébergeur du site (<strong>o2switch</strong>, France), le prestataire d’envoi d’emails, et, pour la localisation approximative de nos statistiques de visite, <strong>ipapi.co</strong>.</p>

                <h3 style={ppH3}>4. Durées de conservation</h3>
                <p style={ppP}>{rgpdRetention}. Les messages de contact sont supprimés à l’issue de la durée applicable ; les preuves de consentement sont conservées le temps requis pour démontrer la conformité.</p>

                <h3 style={ppH3}>5. Vos droits</h3>
                <p style={ppP}>Vous disposez des droits d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition, ainsi que du droit de retirer votre consentement à tout moment. Pour les exercer, écrivez à <a href={`mailto:${rgpdEmail}`} style={ppA}>{rgpdEmail}</a> (réponse sous 1 mois). En cas de désaccord, vous pouvez saisir la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={ppA}>CNIL</a>.</p>

                <h3 style={ppH3}>6. Gestion des cookies</h3>
                <p style={ppP}>Vous pouvez modifier vos choix à tout moment via le lien <button onClick={() => { closeModal(); (window as unknown as { openCookieSettings?: () => void }).openCookieSettings?.(); }} style={{ ...ppA, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>« Gérer les cookies »</button>.</p>
              </div>
            )}

            {modal === 'sitemap' && (
              <div>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '1.8rem', marginBottom: '20px' }}>Plan du Site</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', textAlign: 'left' }}>
                  <div>
                    <h3 style={{ color: '#333', marginBottom: '10px' }}>Principal</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {[['Accueil', '/'], ['Qui sommes-nous ?', '/qui-sommes-nous'], ['Expertise', '/expertise'], ['Réalisations', '/realisations']].map(([l, h]) => (
                        <li key={h} style={{ marginBottom: '8px' }}><a href={h} onClick={closeModal} style={{ color: 'var(--site-blue)', textDecoration: 'none' }}>{l}</a></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ color: '#333', marginBottom: '10px' }}>Le Groupe</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {[['Actualités', '/blog'], ['Carrières', '/carriere']].map(([l, h]) => (
                        <li key={h} style={{ marginBottom: '8px' }}><a href={h} onClick={closeModal} style={{ color: 'var(--site-blue)', textDecoration: 'none' }}>{l}</a></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
