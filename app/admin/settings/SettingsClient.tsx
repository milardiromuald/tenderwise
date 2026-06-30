'use client';

import { useState, useRef } from 'react';
import ImageUpload from '../ImageUpload';

interface SettingsClientProps {
  settings: Record<string, string>;
  activeSection: string;
}

/* ─── Shared styles ─────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.925rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.15s', background: 'white',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: 600,
  fontSize: '0.78rem', color: '#374151',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
};

/* ─── Generic field ─────────────────────────────────────────────────────── */
function Field({
  label, name, value, onChange, type = 'text', hint, placeholder, rows = 3,
}: {
  label: string; name: string; value: string;
  onChange: (k: string, v: string) => void;
  type?: string; hint?: string; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          rows={rows}
          placeholder={placeholder}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
      {hint && <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
}

/* ─── Color swatch field ─────────────────────────────────────────────────── */
function ColorField({
  label, name, value, onChange,
}: {
  label: string; name: string; value: string;
  onChange: (k: string, v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const safeVal = value || '#000000';
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            width: '72px', height: '72px',
            background: safeVal,
            borderRadius: '12px',
            cursor: 'pointer',
            border: '2px solid rgba(0,0,0,0.12)',
            boxShadow: '0 3px 8px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.1)',
            flexShrink: 0,
            transition: 'transform 0.1s',
          }}
          title="Cliquer pour choisir la couleur"
        />
        <input
          ref={inputRef}
          type="color"
          value={safeVal}
          onChange={(e) => onChange(name, e.target.value)}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
          tabIndex={-1}
        />
        <div>
          <input
            type="text"
            value={safeVal}
            onChange={(e) => onChange(name, e.target.value)}
            style={{ ...inputStyle, width: '120px', fontFamily: 'monospace', fontSize: '0.9rem', textTransform: 'uppercase' }}
          />
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>Code hexadécimal</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Section heading inside content area ──────────────────────────────── */
function SectionHeading({ icon, title, description }: { icon?: string; title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '1.75rem', paddingBottom: '1.25rem', borderBottom: '2px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: description ? '6px' : 0 }}>
        {icon && <span style={{ fontSize: '1.35rem' }}>{icon}</span>}
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.2rem', fontWeight: 800, color: '#111827', margin: 0 }}>
          {title}
        </h2>
      </div>
      {description && (
        <p style={{ fontSize: '0.83rem', color: '#6b7280', margin: 0 }}>{description}</p>
      )}
    </div>
  );
}

/* ─── Sub-heading inside a section (groupe de champs) ───────────────────── */
function SubHeading({ icon, title }: { icon?: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0.25rem 0 0.85rem' }}>
      {icon && <span style={{ fontSize: '1.05rem' }}>{icon}</span>}
      <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.92rem', fontWeight: 700, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </h3>
    </div>
  );
}

/* ─── Card wrapper ──────────────────────────────────────────────────────── */
function Card({ children, cols = 'repeat(auto-fill, minmax(300px, 1fr))', gap = '1.5rem' }: {
  children: React.ReactNode; cols?: string; gap?: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb',
      padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'grid', gap, gridTemplateColumns: cols, marginBottom: '1.5rem',
    }}>
      {children}
    </div>
  );
}

const SECTION_TITLES: Record<string, { icon: string; title: string; description?: string }> = {
  logo:    { icon: '🎨', title: 'Identité visuelle', description: 'Logo, favicon et couleurs de votre marque, au même endroit.' },
  general: { icon: '🏢', title: 'Informations générales', description: 'Coordonnées et informations de base de l\'entreprise.' },
  seo:     { icon: '🔍', title: 'Référencement (SEO)', description: 'Titres, descriptions et images pour Google et les réseaux sociaux.' },
  hero:    { icon: '🦸', title: "Page d’accueil", description: 'Section Hero (accroche, titre, image) et les trois atouts mis en avant.' },
  about:   { icon: '👥', title: 'Page Qui sommes-nous', description: 'Présentation de l\'équipe, chiffres clés et photo.' },
  colors:  { icon: '🎨', title: 'Couleurs du site', description: 'Palette de couleurs utilisée sur l\'ensemble du site.' },
  footer:  { icon: '📄', title: 'Pied de page (Footer)', description: 'Description, informations légales et liens sociaux.' },
  contact: { icon: '📬', title: 'Contact — Page & Formulaire', description: 'Coordonnées et disponibilités de la page /contact, destinataire du formulaire et textes RGPD.' },
  notifications: { icon: '🔔', title: 'Notifications par email', description: 'Recevez un email automatique, via votre compte Gmail connecté, à chaque nouveau message ou candidature.' },
  legal:   { icon: '⚖️', title: 'Mentions légales & RGPD', description: 'Mentions légales et politique de confidentialité.' },
};

function SaveButton({ onSave, saving, saved, size = 'normal' }: {
  onSave: () => void; saving: boolean; saved: boolean; size?: 'normal' | 'large';
}) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      style={{
        padding: size === 'large' ? '13px 40px' : '10px 24px',
        border: 'none', borderRadius: '8px',
        fontWeight: 700,
        fontSize: size === 'large' ? '1rem' : '0.9rem',
        cursor: saving ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        fontFamily: 'Montserrat, sans-serif',
        whiteSpace: 'nowrap',
        background: saving ? '#9ca3af' : saved ? '#059669' : '#004a99',
        color: 'white',
        flexShrink: 0,
      }}
    >
      {saving ? 'Sauvegarde…' : saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
    </button>
  );
}

/* ─── Toggle switch field ────────────────────────────────────────────────── */
function ToggleField({
  label, name, checked, onChange, hint,
}: {
  label: string; name: string; checked: boolean;
  onChange: (k: string, v: string) => void; hint?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem',
      padding: '1.1rem 1.35rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb',
    }}>
      <div style={{ minWidth: 0 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.92rem', color: '#111827' }}>{label}</label>
        {hint && <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '5px 0 0', lineHeight: 1.5 }}>{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(name, checked ? '0' : '1')}
        style={{
          position: 'relative', flexShrink: 0, width: '46px', height: '26px',
          borderRadius: '13px', border: 'none', cursor: 'pointer', marginTop: '2px',
          background: checked ? '#059669' : '#cbd5e1', transition: 'background 0.18s',
        }}
      >
        <span style={{
          position: 'absolute', top: '3px', left: checked ? '23px' : '3px',
          width: '20px', height: '20px', borderRadius: '50%', background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.18s',
        }} />
      </button>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export default function SettingsClient({ settings, activeSection }: SettingsClientProps) {
  const [values, setValues] = useState<Record<string, string>>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const v = (key: string, fallback = '') => values[key] ?? fallback;

  const setAndSave = async (k: string, url: string) => {
    set(k, url);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [k]: url }),
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Onglets fusionnés : favicon/couleurs sont rendus dans « Identité visuelle »
  // (id canonique 'logo'), atouts dans « Page d'accueil » (id canonique 'hero').
  // On garde les anciens ?s= fonctionnels en les ramenant à l'id canonique.
  const SECTION_ALIASES: Record<string, string> = {
    favicon: 'logo', colors: 'logo',
    atouts: 'hero',
  };
  const sec = SECTION_ALIASES[activeSection] || activeSection;

  const meta = SECTION_TITLES[sec] || SECTION_TITLES['logo'];

  return (
    <div style={{ padding: '2rem 2.5rem', minHeight: '100%' }}>
      <style>{`
        .settings-input:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08); }
        .color-swatch:hover { transform: scale(1.05); }
        input:focus, textarea:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08) !important; outline: none !important; }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.65rem', color: '#003366', margin: 0, lineHeight: 1.2 }}>
            Paramètres du site
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '5px' }}>
            Utilisez le menu de gauche pour naviguer entre les sections
          </p>
        </div>
        <SaveButton onSave={save} saving={saving} saved={saved} />
      </div>

      {/* ── Section heading ──────────────────────────────────────────────── */}
      <SectionHeading icon={meta.icon} title={meta.title} description={meta.description} />

      {/* ══════════════════════════════════════════════════════════════════
          LOGO
      ══════════════════════════════════════════════════════════════════ */}
      {sec === 'logo' && (
        <>
        <SubHeading icon="🏷" title="Logo" />
        <Card cols="1fr">
          <div style={{ maxWidth: '560px' }}>
            <p style={{ fontSize: '0.83rem', color: '#6b7280', marginTop: 0, marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Votre logo remplace le texte &quot;TenderWise&quot; dans la barre de navigation et le pied de page.
              Laissez vide pour conserver le logo textuel par défaut.<br />
              <strong>Format recommandé :</strong> PNG ou SVG transparent, hauteur 50–60 px.
            </p>
            <ImageUpload
              value={v('logo_url')}
              onChange={(url) => setAndSave('logo_url', url)}
              label="Logo (fichier image)"
              hint="PNG transparent recommandé · Largeur libre · Hauteur 50–60 px idéalement"
              previewHeight={80}
            />
            {v('logo_url') && (
              <div style={{ marginTop: '16px', padding: '14px 18px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aperçu dans la navbar :</p>
                <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '10px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', width: 'fit-content' }}>
                  <img src={v('logo_url')} alt="Logo" style={{ height: '50px', width: 'auto', objectFit: 'contain' }} />
                </div>
              </div>
            )}
          </div>
        </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FAVICON  (fusionné dans « Identité visuelle »)
      ══════════════════════════════════════════════════════════════════ */}
      {sec === 'logo' && (
        <>
          <SubHeading icon="🌐" title="Favicon & icônes" />
          <Card cols="1fr 1fr">
            <div>
              <ImageUpload
                value={v('favicon_url')}
                onChange={(url) => setAndSave('favicon_url', url)}
                label="Favicon (onglet navigateur)"
                hint="ICO ou PNG 32×32 px recommandé"
                previewHeight={80}
                accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml"
              />
              {v('favicon_url') && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={v('favicon_url')} alt="Favicon" style={{ width: '32px', height: '32px', objectFit: 'contain', imageRendering: 'pixelated' }} />
                  <div>
                    <p style={{ fontSize: '0.73rem', fontWeight: 600, color: '#374151', margin: 0 }}>Aperçu onglet</p>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '2px 0 0' }}>Taille réelle 16–32 px</p>
                  </div>
                </div>
              )}
            </div>
            <div>
              <ImageUpload
                value={v('apple_touch_icon_url')}
                onChange={(url) => setAndSave('apple_touch_icon_url', url)}
                label="Apple Touch Icon (iOS / macOS)"
                hint="PNG 180×180 px recommandé"
                previewHeight={80}
                accept=".png,image/png"
              />
              {v('apple_touch_icon_url') && (
                <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={v('apple_touch_icon_url')} alt="Apple Touch" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} />
                  <div>
                    <p style={{ fontSize: '0.73rem', fontWeight: 600, color: '#374151', margin: 0 }}>Aperçu iOS</p>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '2px 0 0' }}>Icône écran d&apos;accueil</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
          <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', fontSize: '0.8rem', color: '#1e40af' }}>
            <strong>Info :</strong> Après sauvegarde, rechargez la page en vidant le cache (Ctrl+Shift+R) pour voir la nouvelle icône dans l&apos;onglet.
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          GENERAL
      ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'general' && (
        <Card>
          <Field label="Nom de l’entreprise" name="company_name" value={v('company_name')} onChange={set} placeholder="TenderWise" />
          <Field label="Nom du responsable" name="owner_name" value={v('owner_name')} onChange={set} placeholder="Romuald de Milardi" hint="Utilisé sur les attestations de référence PDF" />
          <Field label="Slogan" name="company_tagline" value={v('company_tagline')} onChange={set} placeholder="Expert indépendant en AMO" />
          <Field label="Email principal" name="contact_email" value={v('contact_email')} onChange={set} type="email" />
          <Field label="Téléphone" name="contact_phone" value={v('contact_phone')} onChange={set} placeholder="06 65 16 77 84" />
          <Field label="Email candidatures spontanées" name="spontaneous_email" value={v('spontaneous_email')} onChange={set} type="email" />
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Adresse postale" name="contact_address" value={v('contact_address')} onChange={set} placeholder="54 Avenue Général Leclerc, 69100 Villeurbanne" />
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SEO
      ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'seo' && (
        <Card cols="1fr">
          <Field
            label="Titre SEO par défaut"
            name="meta_title"
            value={v('meta_title')}
            onChange={set}
            placeholder="TenderWise - Assistance à Maîtrise d’Ouvrage"
            hint="50–60 caractères — utilisé si la page n’a pas son propre titre SEO"
          />
          <Field
            label="Description SEO par défaut"
            name="meta_description"
            value={v('meta_description')}
            onChange={set}
            type="textarea"
            rows={3}
            placeholder="Expertise en gestion de projet, réhabilitation et facility management."
            hint="150–160 caractères — description affichée dans Google"
          />
          <div>
            <ImageUpload
              value={v('og_image')}
              onChange={(url) => setAndSave('og_image', url)}
              label="Image de partage (LinkedIn, X, WhatsApp…)"
              hint="1200×630 px recommandé — JPEG ou PNG · Cette image apparaît quand vous partagez votre site sur les réseaux sociaux"
              previewHeight={200}
            />
            {v('og_image') && (
              <div style={{ marginTop: '12px', padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '0.78rem', color: '#0369a1' }}>
                <strong>Aperçu LinkedIn :</strong> L&apos;image ci-dessus sera affichée lors du partage. LinkedIn peut mettre jusqu&apos;à 7 jours à rafraîchir son cache — utilisez le{' '}
                <a href="https://www.linkedin.com/post-inspector/" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>Post Inspector LinkedIn</a>{' '}
                pour forcer la mise à jour.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════ */}
      {sec === 'hero' && (
        <>
        <SubHeading icon="🦸" title="Section Hero" />
        <Card cols="1fr 1fr">
          <Field label="Accroche (eyebrow)" name="hero_eyebrow" value={v('hero_eyebrow')} onChange={set} placeholder="Assistance à Maîtrise d’Ouvrage" />
          <Field label="Texte bouton principal" name="hero_btn_primary" value={v('hero_btn_primary') || v('hero_cta_primary')} onChange={set} placeholder="Démarrer un projet" />
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Titre principal" name="hero_title" value={v('hero_title')} onChange={set} placeholder="Valorisez vos actifs immobiliers avec une vision durable." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Sous-titre" name="hero_subtitle" value={v('hero_subtitle')} onChange={set} type="textarea" rows={3} placeholder="Expertise en gestion de projet, réhabilitation et facility management…" />
          </div>
          <Field label="Texte bouton secondaire" name="hero_btn_secondary" value={v('hero_btn_secondary') || v('hero_cta_secondary')} onChange={set} placeholder="Nos expertises" />
          <div style={{ gridColumn: '1 / -1' }}>
            <ImageUpload
              value={v('hero_image') || v('hero_background_image')}
              onChange={(url) => { setAndSave('hero_image', url); setAndSave('hero_background_image', url); }}
              label="Image de fond du Hero"
              hint="1920×1080 px recommandé — JPEG ou WebP"
              previewHeight={220}
            />
          </div>
        </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ATOUTS  (fusionné dans « Page d'accueil »)
      ══════════════════════════════════════════════════════════════════ */}
      {sec === 'hero' && (
        <>
        <SubHeading icon="⭐" title="Nos atouts" />
        <Card cols="1fr 1fr 1fr">
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ display: 'grid', gap: '0.75rem', padding: '1.25rem', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '0.75rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                Atout {n}
              </p>
              <Field label="Titre" name={`atout${n}_titre`} value={v(`atout${n}_titre`)} onChange={set} />
              <Field label="Description" name={`atout${n}_desc`} value={v(`atout${n}_desc`)} onChange={set} type="textarea" rows={4} />
            </div>
          ))}
        </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ABOUT
      ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'about' && (
        <Card>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Texte d’introduction" name="about_intro" value={v('about_intro')} onChange={set} type="textarea" rows={5} placeholder="Présentation de l’entreprise…" />
          </div>
          <Field label="Années d’expérience" name="about_years" value={v('about_years')} onChange={set} placeholder="10" />
          <Field label="Chiffre clé 1 — Valeur" name="about_stat1_value" value={v('about_stat1_value')} onChange={set} placeholder="150+" />
          <Field label="Chiffre clé 1 — Label" name="about_stat1_label" value={v('about_stat1_label')} onChange={set} placeholder="Projets livrés" />
          <Field label="Chiffre clé 2 — Valeur" name="about_stat2_value" value={v('about_stat2_value')} onChange={set} placeholder="50M€+" />
          <Field label="Chiffre clé 2 — Label" name="about_stat2_label" value={v('about_stat2_label')} onChange={set} placeholder="Budget géré" />
          <div style={{ gridColumn: '1 / -1' }}>
            <ImageUpload
              value={v('about_team_image')}
              onChange={(url) => setAndSave('about_team_image', url)}
              label="Photo de l’équipe / bâtiment"
              hint="1200×800 px recommandé"
              previewHeight={220}
            />
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          COLORS  (fusionné dans « Identité visuelle »)
      ══════════════════════════════════════════════════════════════════ */}
      {sec === 'logo' && (
        <>
          <SubHeading icon="🎨" title="Couleurs" />
          <Card cols="repeat(auto-fill, minmax(240px, 1fr))">
            <ColorField label="Couleur principale (bleu)" name="color_blue" value={v('color_blue', '#004a99')} onChange={set} />
            <ColorField label="Couleur foncée (marine)" name="color_blue_dark" value={v('color_blue_dark', '#003366')} onChange={set} />
            <ColorField label="Couleur accent (or)" name="color_gold" value={v('color_gold', '#c5a059')} onChange={set} />
            <ColorField label="Couleur du texte" name="color_text" value={v('color_text', '#4a5568')} onChange={set} />
          </Card>
          <div style={{ padding: '14px 18px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.8rem', color: '#92400e' }}>
            <strong>Note :</strong> Les changements de couleur s&apos;appliquent après sauvegarde et rechargement de la page du site.
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'footer' && (
        <Card>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field
              label="Description entreprise (footer)"
              name="footer_company_description"
              value={v('footer_company_description')}
              onChange={set}
              type="textarea"
              rows={3}
              placeholder="Expertise globale en Construction, Réhabilitation et Gestion d’Actifs Immobiliers."
            />
          </div>
          <Field label="SIREN" name="footer_siren" value={v('footer_siren')} onChange={set} placeholder="983 761 214" />
          <Field label="RCS" name="footer_rcs" value={v('footer_rcs')} onChange={set} placeholder="Lyon" />
          <Field label="Lien LinkedIn" name="social_linkedin" value={v('social_linkedin')} onChange={set} type="url" placeholder="https://linkedin.com/company/…" />
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          CONTACT — Page publique + Formulaire + RGPD
          (anciennement « Page Contact », fusionné ici)
      ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'contact' && (
        <>
          {/* ── Coordonnées affichées sur /contact ── */}
          <SubHeading icon="📍" title="Coordonnées (page /contact)" />
          <Card cols="1fr 1fr">
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Adresse postale" name="contact_address" value={v('contact_address')} onChange={set} placeholder="54 Avenue Général Leclerc, 69100 Villeurbanne" hint="Affichée dans le bloc coordonnées avec un lien Google Maps" />
            </div>
            <Field label="Téléphone" name="contact_phone" value={v('contact_phone')} onChange={set} placeholder="06 65 16 77 84" />
            <Field label="Email public" name="contact_email" value={v('contact_email')} onChange={set} type="email" hint="Email affiché sur la page contact" />
          </Card>

          {/* ── Disponibilités ── */}
          <SubHeading icon="🕐" title="Disponibilités" />
          <Card cols="1fr">
            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>
              Les 3 lignes affichées dans le tableau des disponibilités. Cochez « Ouvert » pour afficher l’horaire en bleu.
            </p>
            {[
              { n: 1, defaultDay: 'Lundi — Vendredi', defaultTime: '9h00 — 18h00', defaultOpen: '1' },
              { n: 2, defaultDay: 'Samedi',           defaultTime: 'Sur rendez-vous', defaultOpen: '0' },
              { n: 3, defaultDay: 'Dimanche',         defaultTime: 'Fermé',          defaultOpen: '0' },
            ].map(({ n, defaultDay, defaultTime, defaultOpen }) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end', padding: '14px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                <Field label={`Ligne ${n} — Jour`}    name={`contact_hours_${n}_day`}  value={v(`contact_hours_${n}_day`, defaultDay)}   onChange={set} placeholder={defaultDay} />
                <Field label={`Ligne ${n} — Horaire`} name={`contact_hours_${n}_time`} value={v(`contact_hours_${n}_time`, defaultTime)} onChange={set} placeholder={defaultTime} />
                <div>
                  <label style={labelStyle}>Ouvert</label>
                  <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
                    <input
                      type="checkbox"
                      checked={v(`contact_hours_${n}_open`, defaultOpen) === '1'}
                      onChange={(e) => set(`contact_hours_${n}_open`, e.target.checked ? '1' : '0')}
                      style={{ width: '20px', height: '20px', accentColor: '#004a99', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </Card>

          {/* ── Formulaire & RGPD ── */}
          <SubHeading icon="🔒" title="Formulaire & RGPD" />
          <Card cols="1fr 1fr">
            <Field label="Email destinataire des messages" name="contact_recipient_email" value={v('contact_recipient_email', v('contact_email'))} onChange={set} type="email" hint="Adresse qui reçoit les messages du formulaire (peut différer de l’email public)" />
            <Field label="Email pour les droits RGPD" name="contact_rgpd_email" value={v('contact_rgpd_email')} onChange={set} type="email" placeholder={v('contact_email') || 'dpo@exemple.fr'} hint="Adresse affichée dans la case RGPD (accès, rectification, suppression…). Si vide : email public." />
            <Field label="Durée de conservation RGPD" name="contact_rgpd_retention" value={v('contact_rgpd_retention', '3 ans')} onChange={set} placeholder="3 ans" hint="Durée affichée dans le texte de consentement RGPD" />
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Texte RGPD personnalisé (HTML accepté)" name="contact_rgpd_text" value={v('contact_rgpd_text')} onChange={set} type="textarea" rows={6} placeholder="Laisser vide pour utiliser le texte RGPD généré automatiquement" hint="Si vide : texte RGPD standard généré automatiquement. HTML basique autorisé (<a>, <strong>)." />
            </div>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          LEGAL
      ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'legal' && (
        <Card cols="1fr">
          <Field label="Mentions légales (HTML accepté)" name="mentions_legales" value={v('mentions_legales')} onChange={set} type="textarea" rows={8} />
          <Field label="Politique de confidentialité (HTML accepté)" name="politique_confidentialite" value={v('politique_confidentialite')} onChange={set} type="textarea" rows={8} />
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          NOTIFICATIONS EMAIL
      ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'notifications' && (
        <>
          <Card cols="1fr">
            <ToggleField
              label="M’alerter par email à chaque nouveau message de contact"
              name="notify_contact_enabled"
              checked={v('notify_contact_enabled', '1') !== '0'}
              onChange={set}
              hint="Un email récapitulatif (expéditeur, objet, message) est envoyé via votre compte Gmail connecté. Vous pouvez répondre directement au prospect."
            />
            <ToggleField
              label="M’alerter par email à chaque nouvelle candidature"
              name="notify_application_enabled"
              checked={v('notify_application_enabled', '1') !== '0'}
              onChange={set}
              hint="Un email avec le poste et les coordonnées du candidat est envoyé. Le CV et la lettre de motivation restent téléchargeables dans « Candidatures »."
            />
          </Card>

          <div style={{ padding: '13px 17px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.6 }}>
            <strong>ℹ️ Bon à savoir :</strong> ces emails utilisent le <strong>connecteur Google Workspace</strong> (Automatisation › Connecteurs). Si Gmail n&apos;est pas connecté, la notification est ignorée sans bloquer l&apos;enregistrement du message. L&apos;adresse destinataire est celle définie dans la section <strong>Contact</strong>.
          </div>
        </>
      )}

      {/* ── Bottom save ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', paddingBottom: '2.5rem' }}>
        <SaveButton onSave={save} saving={saving} saved={saved} size="large" />
      </div>
    </div>
  );
}
