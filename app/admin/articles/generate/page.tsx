'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GeneratedArticle {
  titre: string;
  extrait: string;
  contenu: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  temps_lecture: number;
  categorie: string;
}

type Phase = 'idle' | 'generating' | 'result';

const LOADING_STEPS = [
  'Analyse du sujet en cours…',
  "Structuration de l’article…",
  'Rédaction du contenu…',
  'Optimisation SEO…',
  "Génération des métadonnées…",
  'Finalisation…',
];

export default function GenerateArticlePage() {
  const router = useRouter();

  // Form
  const [sujet, setSujet] = useState('');
  const [categorie, setCategorie] = useState('');
  const [ton, setTon] = useState('professionnel');
  const [longueur, setLongueur] = useState('moyen');
  const [langue, setLangue] = useState('fr');
  const [motsCles, setMotsCles] = useState('');

  // Result (editable)
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [editTitre, setEditTitre] = useState('');
  const [editExtrait, setEditExtrait] = useState('');
  const [editMetaTitle, setEditMetaTitle] = useState('');
  const [editMetaDesc, setEditMetaDesc] = useState('');
  const [editMetaKeywords, setEditMetaKeywords] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // UI
  const [phase, setPhase] = useState<Phase>('idle');
  const [stepIdx, setStepIdx] = useState(0);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (phase !== 'generating') return;
    const id = setInterval(() => setStepIdx(i => (i + 1) % LOADING_STEPS.length), 2200);
    return () => clearInterval(id);
  }, [phase]);

  // Génère l’image d’en-tête et la télécharge côté serveur (/uploads).
  // silent=true → échec non bloquant (pas d’alerte), utilisé lors de la
  // génération automatique juste après l’article.
  const generateImage = async (
    titreArg: string,
    sujetArg: string,
    categorieArg: string,
    silent = false,
  ) => {
    setGeneratingImage(true);
    setImageError('');
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: titreArg, sujet: sujetArg, categorie: categorieArg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de génération d’image");
      setImageUrl(data.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de génération d’image";
      setImageError(msg);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateImage = () => {
    if (!article) return;
    void generateImage(editTitre || article.titre, sujet, categorie || article.categorie);
  };

  const handleGenerate = async () => {
    if (!sujet.trim()) return;
    setPhase('generating');
    setError('');
    setImageError('');
    setImageUrl('');
    setStepIdx(0);

    try {
      const res = await fetch('/api/generate/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujet, categorie, ton, longueur, langue, motsCles }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de génération');

      const gen: GeneratedArticle = data.article;
      setArticle(gen);
      setEditTitre(gen.titre);
      setEditExtrait(gen.extrait);
      setEditMetaTitle(gen.meta_title);
      setEditMetaDesc(gen.meta_description);
      setEditMetaKeywords(gen.meta_keywords || motsCles);
      setPhase('result');

      // Génération automatique de l’image d’en-tête (non bloquante) :
      // l’image apparaît dès qu’elle est prête et sera enregistrée avec l’article.
      void generateImage(gen.titre, sujet, categorie || gen.categorie, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setPhase('idle');
    }
  };

  const handleSave = async (statut: 'brouillon' | 'publie') => {
    if (!article) return;
    setSaving(statut);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: editTitre || article.titre,
          contenu: article.contenu,
          extrait: editExtrait || article.extrait,
          categorie: categorie || article.categorie,
          image: imageUrl || '',
          statut,
          meta_title: editMetaTitle || article.meta_title,
          meta_description: editMetaDesc || article.meta_description,
          meta_keywords: editMetaKeywords || article.meta_keywords,
          temps_lecture: article.temps_lecture,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur de sauvegarde');
      }
      const data = await res.json();
      router.push(`/admin/articles/${data.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
      setSaving(null);
    }
  };

  return (
    <div style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .gen-input {
          width: 100%; padding: 10px 14px;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 0.9rem; font-family: Inter, system-ui, sans-serif;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box; background: white; color: #111827;
        }
        .gen-input:focus { border-color: #004a99; box-shadow: 0 0 0 3px rgba(0,74,153,0.1); }
        .gen-select {
          width: 100%; padding: 10px 36px 10px 14px;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-size: 0.9rem; font-family: Inter, system-ui, sans-serif;
          outline: none; background: white; cursor: pointer;
          transition: border-color 0.15s; box-sizing: border-box;
          appearance: none; color: #111827;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
        }
        .gen-select:focus { border-color: #004a99; box-shadow: 0 0 0 3px rgba(0,74,153,0.1); }
        .gen-label { display: block; font-size: 0.76rem; font-weight: 700; color: #374151; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
        .gen-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .gen-btn { padding: 10px 20px; border: none; border-radius: 8px; font-weight: 700; font-size: 0.875rem; cursor: pointer; font-family: Montserrat, sans-serif; transition: all 0.15s; display: inline-flex; align-items: center; gap: 8px; }
        .gen-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .gen-btn-primary { background: #004a99; color: white; }
        .gen-btn-primary:hover:not(:disabled) { background: #003a80; transform: translateY(-1px); }
        .gen-btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
        .gen-btn-secondary:hover:not(:disabled) { background: #e5e7eb; }
        .gen-btn-gold { background: #c5a059; color: #0f172a; }
        .gen-btn-gold:hover:not(:disabled) { background: #b8913e; transform: translateY(-1px); }
        .gen-btn-green { background: #059669; color: white; }
        .gen-btn-green:hover:not(:disabled) { background: #047857; transform: translateY(-1px); }
        .article-content h2 { font-family: Montserrat, sans-serif; font-size: 1.1rem; font-weight: 700; color: #003366; margin: 1.4rem 0 0.5rem; }
        .article-content h3 { font-family: Montserrat, sans-serif; font-size: 0.95rem; font-weight: 700; color: #1a1a1a; margin: 1.1rem 0 0.4rem; }
        .article-content p { color: #374151; line-height: 1.7; margin: 0 0 0.75rem; font-size: 0.875rem; }
        .article-content ul, .article-content ol { color: #374151; padding-left: 1.5rem; margin: 0 0 0.75rem; }
        .article-content li { margin-bottom: 4px; font-size: 0.875rem; line-height: 1.6; }
        .article-content strong { font-weight: 700; color: #111827; }
        .article-content blockquote { border-left: 3px solid #c5a059; padding-left: 1rem; margin: 1rem 0; color: #6b7280; font-style: italic; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .gen-result-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 1.5rem; }
        @media (max-width: 860px) { .gen-result-grid { grid-template-columns: 1fr !important; } .gen-params-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 520px) { .gen-params-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Title */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: '#003366', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'linear-gradient(135deg, #004a99, #0369a1)', borderRadius: '8px', padding: '7px', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </span>
          Générer un article avec Gemini AI
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          Décrivez votre idée — Gemini rédige l&apos;article complet avec SEO optimisé
        </p>
      </div>

      {/* ── IDLE: Form ───────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="gen-card" style={{ maxWidth: '700px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#dc2626', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <strong>Erreur :</strong> {error}
                {error.toLowerCase().includes('gemini_api_key') || error.toLowerCase().includes('configurée') ? (
                  <div style={{ marginTop: '6px', fontSize: '0.78rem', opacity: 0.85 }}>
                    Ajoutez <code style={{ background: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>GEMINI_API_KEY=votre_clé</code> dans <code>.env.local</code><br />
                    Obtenez une clé gratuite sur <strong>aistudio.google.com</strong> → &ldquo;Get API key&rdquo;
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="gen-label">
              Décrivez votre article <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className="gen-input"
              style={{ height: '110px', resize: 'vertical' }}
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Ex : L'impact de l’IA sur l’immobilier d’entreprise en 2025 — comment les asset managers doivent adapter leur stratégie face aux nouveaux outils de valorisation automatisée…"
            />
            <p style={{ color: '#9ca3af', fontSize: '0.73rem', marginTop: '4px', margin: '4px 0 0' }}>
              Plus vous êtes précis (angle éditorial, cible, contexte), meilleur sera le résultat.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label className="gen-label">Catégorie</label>
              <input type="text" className="gen-input" value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Immobilier, Stratégie, Tech…" />
            </div>
            <div>
              <label className="gen-label">Mots-clés SEO cibles</label>
              <input type="text" className="gen-input" value={motsCles} onChange={(e) => setMotsCles(e.target.value)} placeholder="mot1, mot2, mot3…" />
            </div>
          </div>

          <div className="gen-params-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label className="gen-label">Ton éditorial</label>
              <select className="gen-select" value={ton} onChange={(e) => setTon(e.target.value)}>
                <option value="professionnel">Professionnel</option>
                <option value="pedagogique">Pédagogique</option>
                <option value="informatif">Informatif</option>
                <option value="technique">Technique</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
            <div>
              <label className="gen-label">Longueur</label>
              <select className="gen-select" value={longueur} onChange={(e) => setLongueur(e.target.value)}>
                <option value="court">Court (~500 mots)</option>
                <option value="moyen">Moyen (~1000 mots)</option>
                <option value="long">Long (~2000 mots)</option>
              </select>
            </div>
            <div>
              <label className="gen-label">Langue</label>
              <select className="gen-select" value={langue} onChange={(e) => setLangue(e.target.value)}>
                <option value="fr">Français</option>
                <option value="en">Anglais</option>
              </select>
            </div>
          </div>

          <button
            className="gen-btn gen-btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '0.95rem' }}
            onClick={handleGenerate}
            disabled={!sujet.trim()}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Générer l&apos;article avec Gemini
          </button>
        </div>
      )}

      {/* ── GENERATING: Loading ──────────────────────────────────────── */}
      {phase === 'generating' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '420px', gap: '2rem' }}>
          {/* Animated ring */}
          <div style={{ position: 'relative', width: '90px', height: '90px' }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '4px solid #e5e7eb',
              borderTopColor: '#004a99',
              animation: 'spin 0.9s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '12px',
              borderRadius: '50%',
              border: '3px solid #f3f4f6',
              borderTopColor: '#c5a059',
              animation: 'spin 1.4s linear infinite reverse',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="1.5" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.15rem', fontWeight: 700, color: '#003366', margin: '0 0 10px' }}>
              Gemini génère votre article…
            </p>
            <p
              key={stepIdx}
              style={{ color: '#6b7280', fontSize: '0.88rem', animation: 'fadeUp 0.4s ease both', margin: 0 }}
            >
              {LOADING_STEPS[stepIdx]}
            </p>
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '7px' }}>
            {LOADING_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: i === stepIdx ? '#004a99' : '#e5e7eb',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── RESULT ───────────────────────────────────────────────────── */}
      {phase === 'result' && article && (
        <div>
          {saveError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', fontSize: '0.85rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <strong>Erreur de sauvegarde :</strong> {saveError}
            </div>
          )}
          {/* Actions bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '10px', flexWrap: 'wrap' }}>
            <button className="gen-btn gen-btn-secondary" onClick={() => { setPhase('idle'); setImageUrl(''); }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Modifier les paramètres
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="gen-btn gen-btn-secondary" onClick={handleGenerate} disabled={saving !== null}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                Régénérer
              </button>
              <button className="gen-btn gen-btn-secondary" onClick={() => handleSave('brouillon')} disabled={saving !== null}>
                {saving === 'brouillon' ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Sauvegarde…</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13"/><polyline points="7 3 7 8 15 8"/></svg>Brouillon</>
                )}
              </button>
              <button className="gen-btn gen-btn-green" onClick={() => handleSave('publie')} disabled={saving !== null}>
                {saving === 'publie' ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Publication…</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>Publier</>
                )}
              </button>
            </div>
          </div>

          <div className="gen-result-grid">
            {/* ── Left: Content ────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Title */}
              <div className="gen-card">
                <label className="gen-label">Titre de l&apos;article</label>
                <input
                  type="text"
                  className="gen-input"
                  value={editTitre}
                  onChange={(e) => setEditTitre(e.target.value)}
                  style={{ fontSize: '1rem', fontWeight: 600 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                    Catégorie : <strong style={{ color: '#0369a1' }}>{categorie || article.categorie}</strong>
                    {article.temps_lecture > 0 && (
                      <> &nbsp;·&nbsp; <strong style={{ color: '#6b7280' }}>{article.temps_lecture} min de lecture</strong></>
                    )}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: editTitre.length > 70 ? '#ef4444' : '#9ca3af' }}>
                    {editTitre.length}/70
                  </span>
                </div>
              </div>

              {/* Excerpt */}
              <div className="gen-card">
                <label className="gen-label">Résumé / Extrait</label>
                <textarea
                  className="gen-input"
                  value={editExtrait}
                  onChange={(e) => setEditExtrait(e.target.value)}
                  style={{ height: '75px', resize: 'vertical' }}
                />
              </div>

              {/* Content preview */}
              <div className="gen-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label className="gen-label" style={{ margin: 0 }}>Contenu généré</label>
                  <span style={{ fontSize: '0.72rem', color: '#6b7280', background: '#f3f4f6', padding: '3px 9px', borderRadius: '6px', fontWeight: 600 }}>
                    Aperçu lecture seule
                  </span>
                </div>
                <div
                  className="article-content"
                  style={{
                    maxHeight: '480px',
                    overflowY: 'auto',
                    padding: '1.25rem',
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #f3f4f6',
                  }}
                  dangerouslySetInnerHTML={{ __html: article.contenu }}
                />
                <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '8px 0 0' }}>
                  Sauvegardez l&apos;article pour accéder à l&apos;éditeur complet et modifier le contenu en détail.
                </p>
              </div>

              {/* SEO */}
              <div className="gen-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SEO &amp; Métadonnées
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="gen-label">
                      Meta Title
                      <span style={{ fontWeight: 400, color: editMetaTitle.length > 60 ? '#ef4444' : '#9ca3af', marginLeft: '8px', textTransform: 'none' }}>{editMetaTitle.length}/60</span>
                    </label>
                    <input type="text" className="gen-input" value={editMetaTitle} onChange={(e) => setEditMetaTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="gen-label">
                      Meta Description
                      <span style={{ fontWeight: 400, color: editMetaDesc.length > 160 ? '#ef4444' : '#9ca3af', marginLeft: '8px', textTransform: 'none' }}>{editMetaDesc.length}/160</span>
                    </label>
                    <textarea className="gen-input" value={editMetaDesc} onChange={(e) => setEditMetaDesc(e.target.value)} style={{ height: '65px', resize: 'vertical' }} />
                  </div>
                  <div>
                    <label className="gen-label">Mots-clés</label>
                    <input type="text" className="gen-input" value={editMetaKeywords} onChange={(e) => setEditMetaKeywords(e.target.value)} placeholder="mot1, mot2, mot3" />
                  </div>
                </div>

                {/* SERP preview */}
                {(editMetaTitle || editTitre) && (
                  <div style={{ marginTop: '1.25rem', padding: '14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Aperçu Google</p>
                    <div style={{ fontSize: '0.92rem', color: '#1558d6', fontWeight: 500, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editMetaTitle || editTitre}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#006621', marginBottom: '3px' }}>tenderwise.fr › blog</div>
                    <div style={{ fontSize: '0.8rem', color: '#545454', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                      {editMetaDesc || editExtrait}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: Image + Info ───────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Image generation */}
              <div className="gen-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Image d&apos;en-tête
                  </span>
                </div>

                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt="Image générée"
                      style={{ width: '100%', borderRadius: '8px', display: 'block', marginBottom: '0.75rem', aspectRatio: '16/9', objectFit: 'cover' }}
                    />
                    <button
                      className="gen-btn gen-btn-secondary"
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}
                      onClick={handleGenerateImage}
                      disabled={generatingImage || saving !== null}
                    >
                      {generatingImage ? (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Génération…</>
                      ) : 'Régénérer l\'image'}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{
                      aspectRatio: '16/9',
                      background: generatingImage ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : 'linear-gradient(135deg, #f9fafb, #f0f4ff)',
                      borderRadius: '8px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      marginBottom: '0.75rem',
                      border: '2px dashed',
                      borderColor: generatingImage ? '#93c5fd' : '#e5e7eb',
                      transition: 'all 0.3s',
                    }}>
                      {generatingImage ? (
                        <>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="1.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>
                          <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>Génération en cours…</span>
                        </>
                      ) : (
                        <>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Aucune image générée</span>
                        </>
                      )}
                    </div>
                    <button
                      className="gen-btn gen-btn-gold"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={handleGenerateImage}
                      disabled={generatingImage || saving !== null}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      Générer une image avec l&apos;IA
                    </button>
                    {imageError && (
                      <p style={{ fontSize: '0.73rem', color: '#dc2626', margin: '8px 0 0', lineHeight: 1.4 }}>
                        {imageError}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Article info */}
              <div className="gen-card">
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.875rem' }}>
                  Paramètres utilisés
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { l: 'Catégorie', v: categorie || article.categorie },
                    { l: 'Langue', v: langue === 'fr' ? 'Français' : 'Anglais' },
                    { l: 'Ton', v: { professionnel: 'Professionnel', pedagogique: 'Pédagogique', informatif: 'Informatif', technique: 'Technique', marketing: 'Marketing' }[ton] || ton },
                    { l: 'Longueur', v: { court: 'Court (~500 mots)', moyen: 'Moyen (~1000 mots)', long: 'Long (~2000 mots)' }[longueur] || longueur },
                    { l: 'Temps de lecture', v: `~${article.temps_lecture} min` },
                  ].map((info) => (
                    <div key={info.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#9ca3af' }}>{info.l}</span>
                      <span style={{ fontWeight: 600, color: '#374151', maxWidth: '55%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick tip */}
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p style={{ fontSize: '0.78rem', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                    Sauvegardez en brouillon pour modifier le contenu dans l&apos;éditeur complet avant publication.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
