'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '../ImageUpload';

interface ArticleData {
  id?: number;
  titre: string;
  slug: string;
  extrait: string;
  contenu: string;
  categorie: string;
  image: string;
  statut: string;
  auteur: string;
  author_username?: string;
  date_publication: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_image: string;
  canonical_url: string;
  temps_lecture: number;
  is_featured: number;
}

interface AuthorProfile {
  username: string;
  displayName: string;
  avatarUrl: string;
  bioTitle: string;
  bio: string;
  linkedinUrl: string;
}

const ARTICLE_TEMPLATE = `<h2>Introduction</h2>
<p>Rédigez ici votre introduction. Présentez le sujet de manière concise et engageante pour capter l'attention de vos lecteurs.</p>

<h2>Contexte et enjeux</h2>
<p>Développez ici le contexte de votre article. Expliquez pourquoi ce sujet est important pour vos lecteurs professionnels des marchés publics.</p>
<ul>
  <li>Point clé numéro 1</li>
  <li>Point clé numéro 2</li>
  <li>Point clé numéro 3</li>
</ul>

<h2>Notre analyse</h2>
<p>Détaillez votre analyse du sujet. Appuyez-vous sur votre expertise TenderWise pour apporter une valeur ajoutée concrète.</p>

<blockquote>Citation importante ou mise en avant d'un point essentiel qui mérite d'être mis en valeur.</blockquote>

<h2>Recommandations pratiques</h2>
<p>Proposez des recommandations concrètes et actionnables pour vos lecteurs.</p>
<ol>
  <li>Première étape ou recommandation</li>
  <li>Deuxième étape ou recommandation</li>
  <li>Troisième étape ou recommandation</li>
</ol>

<h2>Conclusion</h2>
<p>Résumez les points principaux et invitez le lecteur à vous contacter pour bénéficier d'un accompagnement personnalisé.</p>`;

function generateSlug(titre: string): string {
  return titre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function calcReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function countSeoScore(data: ArticleData): number {
  let score = 0;
  if (data.meta_title) score++;
  if (data.meta_description) score++;
  if (data.meta_keywords) score++;
  if (data.og_image || data.image) score++;
  if (data.extrait) score++;
  return score;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.925rem', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
  background: 'white',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600, fontSize: '0.78rem', color: '#374151',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
};
const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: '12px',
  border: '1px solid #e5e7eb', padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem', fontWeight: 700,
  color: '#111827', margin: '0 0 1.25rem',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem',
};

// ─── Toolbar helpers ────────────────────────────────────────────────────────
function wrapSelection(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  before: string,
  after: string,
  onChange: (v: string) => void
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;
  const selected = value.slice(start, end);
  const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
  onChange(newValue);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + before.length, start + before.length + selected.length);
  });
}

function insertBlock(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  block: string,
  onChange: (v: string) => void
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart;
  const value = el.value;
  const newline = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
  const newValue = value.slice(0, start) + newline + block + '\n' + value.slice(start);
  onChange(newValue);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + newline.length + block.length + 1;
    el.setSelectionRange(pos, pos);
  });
}

// ─── Rich Toolbar ────────────────────────────────────────────────────────────
function RichToolbar({
  textareaRef,
  onChange,
  onTemplate,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  onTemplate: () => void;
}) {
  const btn = (label: string, title: string, action: () => void, gold?: boolean) => (
    <button
      key={label}
      type="button"
      title={title}
      onClick={action}
      style={{
        padding: '5px 10px', background: gold ? '#c5a059' : '#f3f4f6',
        color: gold ? 'white' : '#374151', border: '1px solid #e5e7eb',
        borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem',
        fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
      {btn('G', 'Gras', () => wrapSelection(textareaRef, '<strong>', '</strong>', onChange))}
      {btn('I', 'Italique', () => wrapSelection(textareaRef, '<em>', '</em>', onChange))}
      <div style={{ width: '1px', background: '#e5e7eb', margin: '0 2px' }} />
      {btn('H2', 'Titre H2', () => insertBlock(textareaRef, '<h2>Titre de section</h2>', onChange))}
      {btn('H3', 'Titre H3', () => insertBlock(textareaRef, '<h3>Sous-titre</h3>', onChange))}
      <div style={{ width: '1px', background: '#e5e7eb', margin: '0 2px' }} />
      {btn('• Liste', 'Liste à puces', () => insertBlock(textareaRef, '<ul>\n  <li>Élément 1</li>\n  <li>Élément 2</li>\n</ul>', onChange))}
      {btn('1. Liste', 'Liste numérotée', () => insertBlock(textareaRef, '<ol>\n  <li>Étape 1</li>\n  <li>Étape 2</li>\n</ol>', onChange))}
      {btn('❝ Citation', 'Bloc citation', () => insertBlock(textareaRef, '<blockquote>Votre citation ici.</blockquote>', onChange))}
      {btn('¶ Para', 'Paragraphe', () => insertBlock(textareaRef, '<p>Votre texte ici.</p>', onChange))}
      {btn('🔗 Lien', 'Lien hypertexte', () => wrapSelection(textareaRef, '<a href="https://">', '</a>', onChange))}
      <div style={{ flex: 1 }} />
      {btn('📋 Template', 'Pré-remplir avec le template standard', onTemplate, true)}
    </div>
  );
}

// ─── SEO Score ───────────────────────────────────────────────────────────────
function SeoScore({ score }: { score: number }) {
  const max = 5;
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626';
  const label = pct >= 80 ? 'Excellent' : pct >= 40 ? 'Moyen' : 'Faible';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color, minWidth: '65px' }}>{label} ({score}/{max})</span>
    </div>
  );
}

// ─── Category Combobox ───────────────────────────────────────────────────────
function CategoryCombobox({
  value,
  onChange,
  categories,
  onCategoriesChange,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  onCategoriesChange: (cats: string[]) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);

  const addCategory = async () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setSaving(true);
    const updated = [...categories, trimmed];
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: updated }),
    });
    onCategoriesChange(updated);
    onChange(trimmed);
    setShowNew(false);
    setNewCat('');
    setSaving(false);
  };

  return (
    <div>
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            setShowNew(true);
          } else {
            onChange(e.target.value);
            setShowNew(false);
          }
        }}
        style={{ ...inputStyle, cursor: 'pointer' }}
        className="art-input"
      >
        <option value="">— Aucune catégorie —</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
        <option value="__new__">+ Nouvelle catégorie…</option>
      </select>
      {showNew && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
            placeholder="Nom de la nouvelle catégorie"
            style={{ ...inputStyle, flex: 1 }}
            className="art-input"
            autoFocus
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={saving || !newCat.trim()}
            style={{ padding: '10px 16px', background: '#004a99', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: saving || !newCat.trim() ? 'not-allowed' : 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            {saving ? '…' : 'Ajouter'}
          </button>
          <button
            type="button"
            onClick={() => { setShowNew(false); setNewCat(''); }}
            style={{ padding: '10px 14px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80';

function LivePreview({ data }: { data: ArticleData }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Browser chrome simulation */}
      <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
        </div>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: '4px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          tenderwise.fr/blog/{data.slug || 'votre-article'}
        </span>
      </div>

      {/* Preview content */}
      <div style={{ padding: '1.25rem', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
        {/* Featured image */}
        <div style={{ marginBottom: '1rem', borderRadius: '10px', overflow: 'hidden', height: '180px', background: '#f3f4f6' }}>
          <img
            src={data.image || FALLBACK_IMG}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
          />
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {data.categorie && (
            <span style={{ background: '#004a99', color: 'white', fontSize: '0.64rem', fontWeight: 800, padding: '3px 10px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              {data.categorie}
            </span>
          )}
          {data.is_featured === 1 && (
            <span style={{ background: '#c5a059', color: 'white', fontSize: '0.64rem', fontWeight: 800, padding: '3px 10px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              À la une
            </span>
          )}
          {data.contenu && (
            <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '0.64rem', fontWeight: 700, padding: '3px 10px', borderRadius: '3px' }}>
              {calcReadTime(data.contenu)} min
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.25rem', color: '#003366', margin: '0 0 0.6rem', lineHeight: 1.3, fontWeight: 800 }}>
          {data.titre || <span style={{ color: '#d1d5db', fontStyle: 'italic', fontWeight: 400, fontSize: '1rem' }}>Titre de l&apos;article…</span>}
        </h1>

        {/* Meta bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.75rem', color: '#94a3b8', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
          {data.date_publication && <span>{formatDate(data.date_publication)}</span>}
          {data.auteur && <span>Par {data.auteur}</span>}
        </div>

        {/* Extrait */}
        {data.extrait && (
          <p style={{ fontStyle: 'italic', color: '#4b5563', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.25rem', borderLeft: '3px solid #c5a059', paddingLeft: '1rem', margin: '0 0 1.25rem' }}>
            {data.extrait}
          </p>
        )}

        {/* Full content */}
        {data.contenu ? (
          <div
            className="art-preview"
            dangerouslySetInnerHTML={{ __html: data.contenu }}
          />
        ) : (
          <p style={{ color: '#d1d5db', fontStyle: 'italic', fontSize: '0.85rem', margin: 0 }}>
            Le contenu s&apos;affichera ici au fur et à mesure que vous rédigez…
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main form ───────────────────────────────────────────────────────────────
export default function ArticleForm({ initial, authorProfile }: { initial?: Partial<ArticleData>; authorProfile?: AuthorProfile }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [data, setData] = useState<ArticleData>({
    titre: '', slug: '', extrait: '', contenu: '',
    categorie: '', image: '', statut: 'brouillon',
    auteur: authorProfile?.displayName || '',
    meta_title: '', meta_description: '', meta_keywords: '',
    og_image: '', canonical_url: '',
    temps_lecture: 0,
    ...initial,
    is_featured: initial?.is_featured ? 1 : 0,
    date_publication: initial?.date_publication
      ? String(initial.date_publication).split('T')[0].split(' ')[0]
      : new Date().toISOString().split('T')[0],
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [seoOpen, setSeoOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [timePublication, setTimePublication] = useState<string>(() => {
    const raw = String(initial?.date_publication ?? '');
    const timePart = raw.includes('T') ? raw.split('T')[1] : raw.split(' ')[1];
    return timePart ? timePart.slice(0, 5) : '09:00';
  });

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then(({ categories: cats }) => setCategories(cats))
      .catch(() => {});
  }, []);

  const set = useCallback(<K extends keyof ArticleData>(k: K, v: ArticleData[K]) => {
    setData((p) => ({ ...p, [k]: v }));
  }, []);

  const handleContenuChange = useCallback((v: string) => {
    setData((p) => ({ ...p, contenu: v, temps_lecture: calcReadTime(v) }));
  }, []);

  const handleTitreChange = (v: string) => {
    setData((p) => ({
      ...p,
      titre: v,
      slug: slugEdited ? p.slug : generateSlug(v),
      meta_title: p.meta_title || v,
    }));
  };

  const handleExtraitChange = (v: string) => {
    setData((p) => ({
      ...p,
      extrait: v,
      meta_description: p.meta_description || v.slice(0, 160),
    }));
  };

  const applyTemplate = () => handleContenuChange(ARTICLE_TEMPLATE);

  const missingImage = data.statut === 'publie' && !data.image.trim();

  const save = async () => {
    if (!data.titre.trim()) { setSaveError('Le titre est obligatoire'); return; }
    if (missingImage) {
      const go = window.confirm(
        '⚠ Aucune image à la une définie.\n\n' +
        'Sans image 1 200 × 630 px, LinkedIn affichera une petite vignette au lieu de la grande bannière.\n\n' +
        'Publier quand même ?'
      );
      if (!go) return;
    }
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    const dateForSave = data.statut === 'programme'
      ? `${data.date_publication} ${timePublication}:00`
      : data.date_publication;
    const payload = {
      ...data,
      date_publication: dateForSave,
      temps_lecture: calcReadTime(data.contenu),
      ...(authorProfile ? { author_username: authorProfile.username } : {}),
    };
    try {
      let res: Response;
      if (data.id) {
        res = await fetch(`/api/articles/${data.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/articles', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSaveError((errData as { error?: string }).error || `Erreur ${res.status} lors de la sauvegarde`);
        setSaving(false);
        return;
      }
      setSaving(false);
      setSaveSuccess(true);
      // Navigation dure : bypasse tous les caches Next.js côté client
      // pour garantir que la nouvelle image est chargée depuis la DB.
      window.location.href = '/admin/articles';
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur réseau lors de la sauvegarde');
      setSaving(false);
    }
  };

  const seoScore = countSeoScore(data);

  const statusConfig = {
    brouillon: { label: 'Brouillon', activeColor: '#6b7280', activeBg: '#f3f4f6' },
    programme: { label: 'Programmé', activeColor: '#92400e', activeBg: '#fef3c7' },
    publie:    { label: 'Publié',     activeColor: '#065f46', activeBg: '#d1fae5' },
  } as const;

  const saveLabel =
    saving      ? 'Sauvegarde…' :
    saveSuccess ? '✓ Enregistré' :
    data.statut === 'publie'    ? (data.id ? 'Mettre à jour' : 'Publier') :
    data.statut === 'programme' ? 'Programmer' :
    'Enregistrer le brouillon';

  const saveBg =
    saveSuccess ? '#059669' :
    data.statut === 'publie'    ? '#059669' :
    data.statut === 'programme' ? '#d97706' :
    '#004a99';

  return (
    <>
      <style>{`
        .art-input:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08); }
        .art-btn-cancel:hover { background: #f3f4f6 !important; }
        .art-btn-save:hover:not(:disabled) { filter: brightness(0.9); }
        .art-preview h2 { font-family: Montserrat,sans-serif; font-size:1.15rem; color:#003366; margin:1.25rem 0 0.4rem; }
        .art-preview h3 { font-family: Montserrat,sans-serif; font-size:0.98rem; color:#004a99; margin:1rem 0 0.3rem; }
        .art-preview p  { color:#374151; line-height:1.7; margin:0.4rem 0; font-size:0.88rem; }
        .art-preview ul,.art-preview ol { color:#374151; padding-left:1.4rem; margin:0.4rem 0; line-height:1.7; font-size:0.88rem; }
        .art-preview blockquote { border-left:4px solid #c5a059; padding:0.6rem 1rem; background:#fffbf0; color:#6b4c12; margin:0.75rem 0; border-radius:0 8px 8px 0; font-style:italic; font-size:0.88rem; }
        .art-preview a { color:#004a99; }
        .art-preview strong { color:#111827; }
        .stat-btn { border-radius:7px; padding:7px 13px; cursor:pointer; font-size:0.8rem; font-weight:700; transition:all 0.15s; border:2px solid transparent; background:transparent; color:#9ca3af; }
        .stat-btn:hover { color:#6b7280; }
        @media (max-width: 1100px) {
          .art-split { grid-template-columns: 1fr !important; }
          .art-preview-col { display: none !important; }
        }
      `}</style>

      <div style={{ padding: '1.5rem 2rem' }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.6rem', color: '#003366', margin: 0 }}>
              {data.id ? "Modifier l'article" : 'Nouvel article'}
            </h1>
            {data.contenu && (
              <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '3px', marginBottom: 0 }}>
                Temps de lecture estimé : <strong>{calcReadTime(data.contenu)} min</strong>
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Pin button */}
            <button
              type="button"
              onClick={() => set('is_featured', data.is_featured ? 0 : 1)}
              title={data.is_featured ? 'Retirer de la une' : 'Épingler à la une'}
              style={{
                padding: '8px 16px',
                border: `2px solid ${data.is_featured ? '#c5a059' : '#d1d5db'}`,
                borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                background: data.is_featured ? '#fffbf0' : 'white',
                color: data.is_featured ? '#c5a059' : '#9ca3af',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              📌 {data.is_featured ? 'À la une' : 'Épingler'}
            </button>

            {/* Status selector */}
            <div style={{ display: 'flex', gap: '3px', background: '#f3f4f6', borderRadius: '10px', padding: '4px' }}>
              {(['brouillon', 'programme', 'publie'] as const).map((s) => {
                const cfg = statusConfig[s];
                const active = data.statut === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('statut', s)}
                    className="stat-btn"
                    style={active ? { background: cfg.activeBg, color: cfg.activeColor, border: `2px solid ${cfg.activeColor}` } : {}}
                  >
                    {s === 'brouillon' ? '○' : s === 'programme' ? '⏰' : '●'} {cfg.label}
                  </button>
                );
              })}
            </div>

            {data.id && (
              <a
                href={`/admin/articles/${data.id}/preview`}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '10px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'none', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Prévisualiser
              </a>
            )}
            <button
              className="art-btn-cancel"
              onClick={() => router.back()}
              style={{ padding: '10px 18px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Annuler
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              {saveError && (
                <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>{saveError}</span>
              )}
              {missingImage && (
                <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠️ Image manquante
                </span>
              )}
              <button
                className="art-btn-save"
                onClick={save}
                disabled={saving || saveSuccess}
                style={{
                  padding: '10px 24px',
                  background: (saving || saveSuccess) ? (saveSuccess ? '#059669' : '#9ca3af') : saveBg,
                  color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700,
                  cursor: (saving || saveSuccess) ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
                  fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap', transition: 'background 0.2s',
                  outline: missingImage ? '2px solid #f59e0b' : 'none',
                }}
              >
                {saveLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled date banner */}
        {data.statut === 'programme' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
              ⏰ Publication programmée le :
            </span>
            <input
              type="date"
              value={data.date_publication}
              onChange={(e) => set('date_publication', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ ...inputStyle, width: 'auto', padding: '6px 12px', fontWeight: 600, color: '#92400e' }}
              className="art-input"
            />
            <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>à</span>
            <input
              type="time"
              value={timePublication}
              onChange={(e) => setTimePublication(e.target.value)}
              style={{ ...inputStyle, width: 'auto', padding: '6px 12px', fontWeight: 600, color: '#92400e' }}
              className="art-input"
            />
            <span style={{ fontSize: '0.78rem', color: '#b45309' }}>
              L&apos;article sera automatiquement visible sur le site à cette date et heure.
            </span>
          </div>
        )}

        {/* ── Two-column split ──────────────────────────────────────────── */}
        <div
          className="art-split"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}
        >
          {/* ── LEFT: Form fields ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gap: '1.25rem' }}>

            {/* Informations */}
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Informations</h2>
              <div style={{ display: 'grid', gap: '1rem' }}>

                <div>
                  <label style={labelStyle}>Titre de l&apos;article *</label>
                  <input
                    className="art-input"
                    type="text"
                    value={data.titre}
                    onChange={(e) => handleTitreChange(e.target.value)}
                    style={{ ...inputStyle, fontSize: '1rem', fontWeight: 600 }}
                    placeholder="Ex : Les nouvelles règles des marchés publics 2025"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Slug (URL)</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                    <span style={{ padding: '10px 12px', background: '#f9fafb', color: '#9ca3af', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRight: '1px solid #d1d5db' }}>/blog/</span>
                    <input
                      className="art-input"
                      type="text"
                      value={data.slug}
                      onChange={(e) => { setSlugEdited(true); set('slug', e.target.value); }}
                      style={{ ...inputStyle, border: 'none', borderRadius: 0, flex: 1 }}
                      placeholder="mon-article-de-blog"
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Catégorie</label>
                  <CategoryCombobox
                    value={data.categorie}
                    onChange={(v) => set('categorie', v)}
                    categories={categories}
                    onCategoriesChange={setCategories}
                  />
                </div>

                {data.statut !== 'programme' && (
                  <div>
                    <label style={labelStyle}>
                      {data.statut === 'publie' ? 'Date de publication' : 'Date'}
                    </label>
                    <input className="art-input" type="date" value={data.date_publication} onChange={(e) => set('date_publication', e.target.value)} style={inputStyle} />
                  </div>
                )}

                <div>
                  <ImageUpload
                    value={data.image}
                    onChange={(url) => set('image', url)}
                    label={
                      missingImage
                        ? '🔺 Éditeur d\'images — OBLIGATOIRE pour publication'
                        : 'Éditeur d\'images — Image à la une'
                    }
                    hint="1 200 × 630 px minimum — obligatoire pour le format grande bannière LinkedIn"
                    previewHeight={160}
                  />
                  {missingImage && (
                    <div style={{
                      marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px',
                      padding: '10px 12px', background: '#fffbeb',
                      border: '1px solid #f59e0b', borderRadius: '8px',
                    }}>
                      <span style={{ fontSize: '1rem', lineHeight: 1.2, flexShrink: 0 }}>⚠️</span>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>
                          Image requise pour le format bannière LinkedIn
                        </p>
                        <p style={{ margin: 0, fontSize: '0.73rem', color: '#b45309' }}>
                          Sans image 1 200 × 630 px, le partage LinkedIn affichera une petite vignette au lieu d&apos;une grande bannière. Ajoutez une image avant de publier.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Extrait / Résumé <span style={{ fontWeight: 400, color: '#9ca3af' }}>(affiché en liste)</span></label>
                  <textarea
                    className="art-input"
                    value={data.extrait}
                    onChange={(e) => handleExtraitChange(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder="Courte description de l'article, 1-2 phrases percutantes…"
                  />
                  <div style={{ fontSize: '0.75rem', color: data.extrait.length > 200 ? '#d97706' : '#9ca3af', textAlign: 'right', marginTop: '4px' }}>
                    {data.extrait.length} / 200 caractères recommandés
                  </div>
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div style={cardStyle}>
              <h2 style={cardTitleStyle}>Contenu de l&apos;article</h2>
              <RichToolbar
                textareaRef={textareaRef}
                onChange={handleContenuChange}
                onTemplate={applyTemplate}
              />
              <textarea
                ref={textareaRef}
                value={data.contenu}
                onChange={(e) => handleContenuChange(e.target.value)}
                rows={28}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  fontFamily: '"Courier New", monospace',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  borderRadius: '0 0 8px 8px',
                  borderTop: '1px solid #e5e7eb',
                }}
                placeholder="<p>Commencez à rédiger ou cliquez sur « Template » pour pré-remplir la structure…</p>"
                spellCheck={false}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                  HTML : &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;blockquote&gt;, &lt;a&gt;
                </p>
                {data.contenu && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    ≈ {calcReadTime(data.contenu)} min de lecture
                  </span>
                )}
              </div>
            </div>

            {/* SEO */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setSeoOpen((v) => !v)}
                style={{ width: '100%', padding: '1.25rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔍 Référencement (SEO)
                  </span>
                  <div style={{ flex: 1, maxWidth: '200px' }}>
                    <SeoScore score={seoScore} />
                  </div>
                </div>
                <span style={{ fontSize: '1.1rem', color: '#6b7280', transform: seoOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
              </button>

              {seoOpen && (
                <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Meta Title <span style={{ fontWeight: 400, color: '#9ca3af' }}>(50–60 caract.)</span></label>
                      <input className="art-input" type="text" value={data.meta_title} onChange={(e) => set('meta_title', e.target.value)} style={inputStyle} placeholder={data.titre || 'Titre SEO'} />
                      <div style={{ fontSize: '0.75rem', color: data.meta_title.length > 60 ? '#dc2626' : '#9ca3af', textAlign: 'right', marginTop: '4px' }}>{data.meta_title.length} / 60</div>
                    </div>
                    <div>
                      <label style={labelStyle}>Meta Description <span style={{ fontWeight: 400, color: '#9ca3af' }}>(150–160 caract.)</span></label>
                      <textarea className="art-input" value={data.meta_description} onChange={(e) => set('meta_description', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder={data.extrait?.slice(0, 160) || 'Description affichée dans les résultats de recherche…'} />
                      <div style={{ fontSize: '0.75rem', color: data.meta_description.length > 160 ? '#dc2626' : '#9ca3af', textAlign: 'right', marginTop: '4px' }}>{data.meta_description.length} / 160</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={labelStyle}>Mots-clés <span style={{ fontWeight: 400, color: '#9ca3af' }}>(séparés par virgules)</span></label>
                        <input className="art-input" type="text" value={data.meta_keywords} onChange={(e) => set('meta_keywords', e.target.value)} style={inputStyle} placeholder="marché public, appel d'offres" />
                      </div>
                      <div>
                        <label style={labelStyle}>URL canonique <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optionnel)</span></label>
                        <input className="art-input" type="url" value={data.canonical_url} onChange={(e) => set('canonical_url', e.target.value)} style={inputStyle} placeholder="https://tenderwise.fr/blog/…" />
                      </div>
                    </div>
                    <ImageUpload
                      value={data.og_image}
                      onChange={(url) => set('og_image', url)}
                      label="Image Open Graph (og:image) — partagée sur les réseaux sociaux"
                      hint="1200×630 px · Laissez vide pour utiliser l'image à la une"
                      previewHeight={110}
                    />
                    {(data.meta_title || data.titre) && (
                      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Aperçu dans Google</p>
                        <div style={{ fontSize: '0.72rem', color: '#006621', marginBottom: '2px' }}>tenderwise.fr › blog › {data.slug || 'votre-article'}</div>
                        <div style={{ fontSize: '1.05rem', color: '#1a0dab', fontWeight: 500, marginBottom: '4px', textDecoration: 'underline', cursor: 'default' }}>{data.meta_title || data.titre}</div>
                        <div style={{ fontSize: '0.82rem', color: '#4d5156', lineHeight: 1.5 }}>{data.meta_description || data.extrait?.slice(0, 160) || '…'}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Live preview ─────────────────────────────────────── */}
          <div className="art-preview-col" style={{ position: 'sticky', top: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Aperçu en direct
              </span>
              <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            </div>
            <LivePreview data={data} />
          </div>
        </div>
      </div>
    </>
  );
}
