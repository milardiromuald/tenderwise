'use client';

import { useState, useEffect } from 'react';

const ARTICLE_PLACEHOLDER = `Exemple :
Tu rédiges pour TenderWise, cabinet spécialisé dans les appels d’offres et marchés publics français.
Public cible : directeurs financiers, responsables achats et juristes d’entreprises privées.

Directives éditoriales :
- Adopte un ton expert, direct et rassurant — jamais condescendant
- Cite systématiquement des textes de référence (Code de la commande publique, décrets, circulaires)
- Structure chaque article avec une accroche chiffre ou statistique
- Termine par un encadré "À retenir" avec 3 points clés en bullet points
- Évite le jargon inutile, préfère les exemples concrets et les cas pratiques
- Les titres H2 doivent être des questions ou des affirmations fortes`;

const IMAGE_PLACEHOLDER = `Exemple :
Style visuel : photographie professionnelle haute définition, ambiance corporate française.
Palette : bleu marine profond (#003366), touches dorées, blanc cassé — identité TenderWise.
Sujets préférés : bâtiments officiels français (ministères, mairies), réunions de direction,
documents contractuels, poignées de main en contexte B2B.
Ambiance : sérieuse, institutionnelle, inspirant confiance.
Toujours en format paysage 16:9. Absolument aucun texte, lettre ou chiffre visible.`;

export default function PromptsPage() {
  const [articlePrompt, setArticlePrompt] = useState('');
  const [imagePrompt,   setImagePrompt]   = useState('');
  const [defaultArticlePrompt, setDefaultArticlePrompt] = useState('');
  const [defaultImagePrompt, setDefaultImagePrompt] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<'article' | 'image' | 'both' | null>(null);
  const [saved,    setSaved]    = useState<'article' | 'image' | 'both' | null>(null);
  const [keyTier,  setKeyTier]  = useState<'free' | 'paid' | 'unknown'>('unknown');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/prompts').then(res => res.json()),
      fetch('/api/ai/config').then(res => res.json()),
    ])
      .then(([r, cfg]) => {
        if (cancelled) return;
        setArticlePrompt(r.articlePrompt ?? '');
        setImagePrompt(r.imagePrompt ?? '');
        setDefaultArticlePrompt(r.defaultArticlePrompt ?? '');
        setDefaultImagePrompt(r.defaultImagePrompt ?? '');
        setKeyTier(cfg.keyTier ?? 'unknown');
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const isFree = keyTier === 'free';

  const save = async (target: 'article' | 'image' | 'both') => {
    setSaving(target);
    try {
      await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articlePrompt: (target === 'article' || target === 'both') ? articlePrompt : undefined,
          imagePrompt:   (target === 'image'   || target === 'both') ? imagePrompt   : undefined,
        }),
      });
      setSaved(target);
      setTimeout(() => setSaved(null), 3000);
    } catch { /* ignore */ }
    finally { setSaving(null); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ animation: 'spin 0.9s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', width: '100%', boxSizing: 'border-box', maxWidth: 1240, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .prompt-textarea {
          width: 100%; padding: 14px 16px;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          font-size: 0.875rem; font-family: Inter, system-ui, sans-serif;
          line-height: 1.65; resize: vertical; min-height: 200px;
          outline: none; box-sizing: border-box; color: #111827;
          background: white; transition: border-color .15s, box-shadow .15s;
        }
        .prompt-textarea:focus { border-color: #004a99; box-shadow: 0 0 0 3px rgba(0,74,153,.09); }
        .prompt-card {
          background: white; border-radius: 14px;
          border: 1px solid #e5e7eb; box-shadow: 0 1px 4px rgba(0,0,0,.05);
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        /* Deux prompts côte à côte, alignés en hauteur, repliés en 1 colonne sur petit écran */
        .prompt-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          align-items: stretch;
          margin-bottom: 1.5rem;
        }
        .prompt-card-body {
          padding: 1.5rem;
          display: flex; flex-direction: column; flex: 1;
        }
        @media (max-width: 880px) {
          .prompt-grid { grid-template-columns: 1fr; }
        }
        .prompt-save-btn {
          padding: 9px 20px; border: none; border-radius: 8px;
          font-weight: 700; font-size: 0.84rem; cursor: pointer;
          font-family: Montserrat, sans-serif; transition: all .15s;
          display: inline-flex; align-items: center; gap: 7px;
        }
        .prompt-save-btn:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: '#003366', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: 'linear-gradient(135deg,#004a99,#7c3aed)', borderRadius: 8, padding: 7, display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              <line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/>
            </svg>
          </span>
          Prompts IA
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
          Ces instructions s&apos;appliquent à <strong>toutes</strong> les générations — manuelles (via &quot;Générer avec l&apos;IA&quot;) et automatiques (via Google Chat / workflow).
        </p>
      </div>

      {/* Bandeau info */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: '2rem', fontSize: '0.83rem', color: '#1e40af', lineHeight: 1.6, display: 'flex', gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          Chaque prompt ci-dessous est l&apos;<strong>unique source</strong> pour son usage : la <strong>rédaction d&apos;articles</strong> à gauche, la <strong>génération d&apos;images</strong> à droite.
          Aucune autre directive n&apos;est ajoutée ailleurs dans le workflow — le sujet et les paramètres choisis à la génération viennent simplement les compléter, sans jamais les remplacer.
        </span>
      </div>

      {/* ── Deux prompts côte à côte ── */}
      <div className="prompt-grid">

      {/* ── CARTE 1 : Prompt article ── */}
      <div className="prompt-card">
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                Prompt de rédaction d&apos;articles
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>
                Instruction unique envoyée à l&apos;IA — modifiable librement.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {defaultArticlePrompt && articlePrompt.trim() !== defaultArticlePrompt.trim() ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '3px 10px', borderRadius: 20 }}>
                Personnalisé
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>
                Prompt par défaut
              </span>
            )}
          </div>
        </div>

        <div className="prompt-card-body">
          <textarea
            className="prompt-textarea"
            style={{ minHeight: 340, flex: 1 }}
            value={articlePrompt}
            onChange={e => setArticlePrompt(e.target.value)}
            placeholder={ARTICLE_PLACEHOLDER}
          />
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 13px', marginTop: 10, fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Source unique :</strong> ce prompt est la seule instruction éditoriale envoyée à l&apos;IA — aucune autre directive n&apos;est ajoutée ailleurs. Le sujet et les paramètres de « Générer avec l&apos;IA » ne font que le compléter ; seul le format de sortie JSON est ajouté techniquement.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              {articlePrompt.length} caractères · enregistré en base de données
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {defaultArticlePrompt && articlePrompt.trim() !== defaultArticlePrompt.trim() && (
                <button
                  className="prompt-save-btn"
                  style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                  onClick={() => setArticlePrompt(defaultArticlePrompt)}
                >
                  Réinitialiser au prompt par défaut
                </button>
              )}
              <button
                className="prompt-save-btn"
                style={{ background: '#004a99', color: 'white' }}
                onClick={() => save('article')}
                disabled={saving === 'article'}
              >
                {saving === 'article'
                  ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Enregistrement…</>
                  : saved === 'article' ? '✓ Enregistré' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARTE 2 : Prompt image ── */}
      <div className="prompt-card" style={{ position: 'relative' }}>
        {isFree && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(255,255,255,0.82)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, padding: '1.5rem', textAlign: 'center',
          }}>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', maxWidth: 340 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <strong style={{ fontSize: '0.82rem', color: '#92400e', fontFamily: 'Montserrat, sans-serif' }}>Clé API gratuite</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#78350f', margin: 0, lineHeight: 1.55 }}>
                La génération d&apos;images par IA nécessite une clé avec facturation activée (Imagen 4).
                Avec une clé gratuite, les en-têtes utilisent des <strong>fonds prédéfinis</strong> — ce prompt n&apos;est pas utilisé.
              </p>
            </div>
          </div>
        )}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <div>
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                Prompt de génération d&apos;images
              </h2>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>
                Style visuel, palette de couleurs, ambiance, sujets préférés…
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {defaultImagePrompt && imagePrompt.trim() !== defaultImagePrompt.trim() ? (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6d28d9', background: '#f3e8ff', padding: '3px 10px', borderRadius: 20 }}>
                Personnalisé
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>
                Prompt par défaut
              </span>
            )}
          </div>
        </div>

        <div className="prompt-card-body">
          <textarea
            className="prompt-textarea"
            style={{ minHeight: 340, flex: 1 }}
            value={imagePrompt}
            onChange={e => setImagePrompt(e.target.value)}
            placeholder={IMAGE_PLACEHOLDER}
          />
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 13px', marginTop: 10, fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Source unique :</strong> ce prompt est la seule instruction qui pilote le style et le contenu des images — aucune autre directive n&apos;est ajoutée ailleurs. Seul le cadrage paysage 16:9 est appliqué techniquement. Si vous ne voulez aucun texte dans l&apos;image, précisez-le ici.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              {imagePrompt.length} caractères · enregistré en base de données
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {defaultImagePrompt && imagePrompt.trim() !== defaultImagePrompt.trim() && (
                <button
                  className="prompt-save-btn"
                  style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                  onClick={() => setImagePrompt(defaultImagePrompt)}
                >
                  Réinitialiser au prompt par défaut
                </button>
              )}
              <button
                className="prompt-save-btn"
                style={{ background: '#7c3aed', color: 'white' }}
                onClick={() => save('image')}
                disabled={saving === 'image'}
              >
                {saving === 'image'
                  ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Enregistrement…</>
                  : saved === 'image' ? '✓ Enregistré' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      </div>{/* /.prompt-grid */}

      {/* Enregistrer les deux */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="prompt-save-btn"
          style={{ background: '#0f172a', color: 'white', padding: '11px 24px', fontSize: '0.875rem' }}
          onClick={() => isFree ? save('article') : save('both')}
          disabled={saving === 'both' || saving === 'article'}
        >
          {(saving === 'both' || saving === 'article')
            ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Enregistrement…</>
            : (saved === 'both' || saved === 'article') ? '✓ Enregistré'
            : isFree ? 'Enregistrer le prompt article'
            : 'Enregistrer les deux prompts'}
        </button>
      </div>
    </div>
  );
}
