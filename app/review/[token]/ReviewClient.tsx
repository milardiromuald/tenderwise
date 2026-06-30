'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import PreviewTopBar from '@/app/admin/PreviewTopBar';
import RichEditor, { sanitizeHtml } from '@/components/RichEditor';
import type { ReviewQuality } from '@/lib/reviewQuality';

// Konva nécessite le DOM → chargé uniquement côté client (pas de SSR).
const ImageComposer = dynamic(() => import('@/components/ImageComposer'), { ssr: false, loading: () => <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>Chargement de l&apos;éditeur d&apos;image…</div> });

interface ReviewData {
  id: number;
  article_id: number | null;
  status: string;
  subject: string;
  drive_link: string;
  image_url: string;
  is_test: number;
  titre: string | null;
  extrait: string | null;
  contenu: string | null;
  statut: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  canonical_url: string | null;
  image_title: string | null;
  image_subtitle: string | null;
}

function parseScore(detail: string): number | null {
  const m = detail.match(/Score (\d+)\/100/);
  return m ? parseInt(m[1], 10) : null;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente de validation', color: '#92400e', bg: '#fef3c7' },
  valide:     { label: 'Validé — à programmer', color: '#065f46', bg: '#d1fae5' },
  programme:  { label: 'Programmé', color: '#1e40af', bg: '#dbeafe' },
  publie:     { label: 'Publié', color: '#065f46', bg: '#d1fae5' },
  approuve:   { label: 'Validé', color: '#065f46', bg: '#d1fae5' },
  refuse:     { label: 'Refusé', color: '#991b1b', bg: '#fee2e2' },
  modifie:    { label: 'Modifié', color: '#1e40af', bg: '#dbeafe' },
};

export default function ReviewClient({ token, review, admin = false, showNotifications = false, backgrounds = [], initialAction, quality = null }: { token: string; review: ReviewData; admin?: boolean; showNotifications?: boolean; backgrounds?: { url: string; label?: string }[]; initialAction?: 'approve' | 'reject'; quality?: ReviewQuality | null }) {
  const [titre, setTitre] = useState(review.titre || '');
  const [extrait, setExtrait] = useState(review.extrait || '');
  const [contenu, setContenu] = useState(review.contenu || '');
  const [status, setStatus] = useState(review.status);
  const [imageUrl, setImageUrl] = useState(review.image_url || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [composing, setComposing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  // URL du fond brut (sans texte incrusté) utilisé pour l'ImageComposer.
  // Toujours un fond de la DB, jamais l'image composée — évite l'empilement de textes.
  const [selectedBg, setSelectedBg] = useState(backgrounds[0]?.url ?? '');
  // Brouillon HTML pendant l'édition (permet d'annuler sans toucher au contenu enregistré).
  const [draft, setDraft] = useState('');
  // Champs SEO (optimisation de l'article) — éditables dans le panneau de droite.
  const [metaTitle, setMetaTitle] = useState(review.meta_title || '');
  const [metaDesc, setMetaDesc] = useState(review.meta_description || '');
  const [metaKeywords, setMetaKeywords] = useState(review.meta_keywords || '');
  const [canonical, setCanonical] = useState(review.canonical_url || '');

  const startEditing = () => {
    setDraft(contenu);
    setEditing(true);
  };

  const act = async (action: 'approve' | 'reject' | 'save') => {
    setBusy(action);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { token, action };
      if (action === 'save') {
        // Le contenu est déjà du HTML (éditeur visuel) — on le nettoie par sécurité.
        const html = sanitizeHtml(draft);
        setContenu(html);
        body.titre = titre; body.extrait = extrait; body.contenu = html;
        body.meta_title = metaTitle; body.meta_description = metaDesc;
        body.meta_keywords = metaKeywords; body.canonical_url = canonical;
      }
      const r = await fetch('/api/review/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ type: 'err', text: d.error || 'Erreur' }); return; }
      setStatus(d.status);
      setMsg({ type: 'ok', text: d.message });
      if (action === 'save') setEditing(false);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erreur réseau' });
    } finally {
      setBusy(null);
    }
  };

  // Action transmise par l'e-mail de validation (?action=approve|reject) : on l'exécute
  // automatiquement une seule fois au chargement, tant que la décision n'est pas prise.
  // Le ref évite un double envoi (StrictMode en dev / re-render).
  const autoActionDone = useRef(false);
  useEffect(() => {
    if (autoActionDone.current) return;
    if (!initialAction) return;
    if (['en_attente', 'modifie'].includes(review.status)) {
      autoActionDone.current = true;
      // Différé hors du corps synchrone de l'effet (évite les rendus en cascade).
      queueMicrotask(() => act(initialAction));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sélectionne un fond et recompose immédiatement le preview de l'image d'en-tête.
  const selectBg = async (bgUrl: string) => {
    setSelectedBg(bgUrl);
    setPreviewLoading(true);
    try {
      const imageTitle    = titre    || review.image_title    || '';
      const imageSubtitle = extrait  || review.image_subtitle || review.subject || '';
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: imageTitle, sujet: imageSubtitle, backgroundUrl: bgUrl }),
      });
      const d = await res.json();
      if (res.ok && d.url) setImageUrl(d.url);
    } catch { /* aperçu non bloquant */ }
    finally { setPreviewLoading(false); }
  };

  // Enregistre l'image composée (fond + texte incrusté) produite par l'éditeur.
  // bgUrl reçu depuis ImageComposer pour mettre à jour le fond actif.
  const composeImage = async (dataUrl: string, bgUrl: string) => {
    if (bgUrl) setSelectedBg(bgUrl);
    setBusy('compose');
    setMsg(null);
    try {
      const r = await fetch('/api/review/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'compose_image', dataUrl }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ type: 'err', text: d.error || 'Erreur' }); return; }
      if (d.imageUrl) setImageUrl(d.imageUrl);
      setComposing(false);
      setMsg({ type: 'ok', text: d.message || 'Image composée enregistrée.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erreur réseau' });
    } finally {
      setBusy(null);
    }
  };

  // Supprime DÉFINITIVEMENT l'article et sa demande de validation (confirmation requise).
  const deleteArticle = async () => {
    if (!window.confirm('Supprimer définitivement cet article et sa demande de validation ?\nCette action est irréversible.')) return;
    setBusy('delete');
    setMsg(null);
    try {
      const r = await fetch('/api/review/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'delete' }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ type: 'err', text: d.error || 'Erreur' }); return; }
      if (admin) { window.location.href = '/admin/workflow'; return; }
      setDeleted(true);
      setMsg({ type: 'ok', text: d.message || 'Article supprimé.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erreur réseau' });
    } finally {
      setBusy(null);
    }
  };

  const st = STATUS_LABEL[status] || STATUS_LABEL.en_attente;
  const decided = !['en_attente', 'modifie'].includes(status);
  // Zone d'édition élargie pour accueillir l'éditeur (gauche) + le SEO (droite).
  const maxWidth = editing ? 1180 : 760;

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 820px) {
          .rev-edit-grid { grid-template-columns: 1fr !important; }
          .rev-seo { position: static !important; }
        }
      `}</style>
      {/* Barre d'outils admin — identique à l'aperçu d'article */}
      {admin && (
        <PreviewTopBar
          backHref="/admin/workflow"
          backLabel="Retour au workflow"
          title={titre || review.subject || 'Validation'}
          status={{ text: st.label, bg: st.bg, color: st.color }}
          action={!decided && !editing && !deleted ? { type: 'button', label: 'Modifier', onClick: startEditing } : null}
          showNotifications={showNotifications}
        />
      )}

      {composing && (
        <ImageComposer
          backgroundUrl={selectedBg || (backgrounds[0]?.url ?? '')}
          backgrounds={backgrounds}
          initialTitle={review.image_title || titre}
          initialSubtitle={review.image_subtitle || review.subject || extrait || ''}
          stateKey={token}
          saving={busy === 'compose'}
          onSave={composeImage}
          onClose={() => setComposing(false)}
        />
      )}

      <div style={{ maxWidth, margin: admin ? '32px auto' : '40px auto', padding: '0 20px', fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a', transition: 'max-width .15s' }}>
      {/* Header — masqué en mode admin (la barre porte déjà le statut) */}
      {!admin && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: 22 }}>
            Tender<span style={{ color: '#c5a059' }}>Wise</span>
          </span>
          <span style={{ background: st.bg, color: st.color, padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{st.label}</span>
        </div>
      )}

      {deleted ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🗑</div>
          <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>Article supprimé</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>L&apos;article et sa demande de validation ont été supprimés. Vous pouvez fermer cette page.</p>
        </div>
      ) : (
      <>
      {review.is_test === 1 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 18 }}>
          🧪 Article de <strong>test</strong> — aucun token Gemini utilisé.
        </div>
      )}

      {quality && (() => {
        const score = parseScore(quality.reviewDetail);
        const color = score === null ? '#6b7280' : score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626';
        const bg    = score === null ? '#f9fafb' : score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2';
        const border = score === null ? '#e5e7eb' : score >= 80 ? '#a7f3d0' : score >= 60 ? '#fde68a' : '#fecaca';
        return (
          <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ color, fontSize: 14 }}>Évaluation IA</strong>
              <span style={{ color: '#374151' }}>{quality.reviewDetail}</span>
            </div>
            {quality.linksDetail && (
              <div style={{ color: '#6b7280', marginTop: 4 }}>🔗 {quality.linksDetail}</div>
            )}
          </div>
        );
      })()}

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
        {(imageUrl || previewLoading) && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            {imageUrl && (
              <img src={imageUrl} alt="" style={{ width: '100%', borderRadius: 10, display: 'block', opacity: previewLoading ? 0.45 : 1, transition: 'opacity .2s' }} />
            )}
            {previewLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: imageUrl ? 'transparent' : '#f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '8px 14px', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2.5" style={{ animation: 'spin .8s linear infinite' }}>
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".25"/><path d="M21 12a9 9 0 00-9-9"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#004a99' }}>Composition en cours…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action image — disponible tant que la décision n'est pas prise.
            La sélection du fond et l'édition du texte se font dans l'éditeur. */}
        {!decided && review.is_test !== 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
            <button onClick={() => setComposing(true)} disabled={!!busy} style={imgBtn('#004a99', '#eff6ff', '#004a99', busy)}>
              🖼 Éditer l&apos;image
            </button>
          </div>
        )}

        {!editing ? (
          <>
            <h1 style={{ fontSize: 26, lineHeight: 1.3, margin: '0 0 12px' }}>{titre}</h1>
            <p style={{ fontStyle: 'italic', color: '#475569', borderLeft: '3px solid #c5a059', paddingLeft: 12, margin: '0 0 20px' }}>{extrait}</p>
            <div className="article-content" dangerouslySetInnerHTML={{ __html: contenu }} />
          </>
        ) : (
          <div className="rev-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
            {/* ── Colonne gauche : l'article ── */}
            <div style={{ minWidth: 0 }}>
              <label style={labelStyle}>Titre</label>
              <input value={titre} onChange={e => setTitre(e.target.value)} style={{ ...inputStyle, fontSize: 17, fontWeight: 700 }} />

              <label style={labelStyle}>Extrait</label>
              <textarea value={extrait} onChange={e => setExtrait(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />

              <label style={labelStyle}>Contenu de l&apos;article</label>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px', lineHeight: 1.6 }}>
                Édition visuelle directe (tableaux, liens et listes gérés). Basculez en « HTML » pour un contrôle fin.
              </p>
              <RichEditor value={draft} onChange={setDraft} minHeight={460} stickyTop={admin ? 56 : 0} />
            </div>

            {/* ── Colonne droite : optimisation SEO ── */}
            <SeoPanel
              titre={titre}
              metaTitle={metaTitle} setMetaTitle={setMetaTitle}
              metaDesc={metaDesc} setMetaDesc={setMetaDesc}
              metaKeywords={metaKeywords} setMetaKeywords={setMetaKeywords}
              canonical={canonical} setCanonical={setCanonical}
            />
          </div>
        )}
      </div>

      {/* Message */}
      {msg && (
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, fontWeight: 500, fontSize: 14, background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msg.type === 'ok' ? '#a7f3d0' : '#fecaca'}`, color: msg.type === 'ok' ? '#065f46' : '#991b1b' }}>
          {msg.text}
        </div>
      )}

      {/* Actions */}
      {!decided && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {!editing ? (
            <>
              <button onClick={() => act('approve')} disabled={!!busy} style={btnStyle('#059669')}>{busy === 'approve' ? '…' : '✅ Valider'}</button>
              <button onClick={startEditing} disabled={!!busy} style={btnStyle('#004a99')}>✏️ Modifier</button>
              <button onClick={() => act('reject')} disabled={!!busy} style={btnStyle('#dc2626')}>{busy === 'reject' ? '…' : '❌ Refuser'}</button>
              <div style={{ flex: 1 }} />
              {/* Suppression définitive : réservée à l'admin connecté, sauf pour
                  les articles de test (gérables depuis le lien public d'e-mail).
                  Le serveur applique la même règle (403 sinon). */}
              {(admin || review.is_test === 1) && (
                <button onClick={deleteArticle} disabled={!!busy} style={btnOutlineStyle('#dc2626')}>{busy === 'delete' ? '…' : "🗑 Supprimer l'article"}</button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => act('save')} disabled={!!busy} style={btnStyle('#004a99')}>{busy === 'save' ? '…' : '💾 Enregistrer les modifications'}</button>
              <button onClick={() => setEditing(false)} disabled={!!busy} style={btnStyle('#64748b')}>Annuler</button>
            </>
          )}
        </div>
      )}

      {decided && (
        <p style={{ marginTop: 20, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
          Décision enregistrée. Vous pouvez fermer cette page.
        </p>
      )}
      </>
      )}
      </div>
    </>
  );
}

// ── Panneau d'optimisation SEO (colonne de droite en édition) ────────────────
function SeoPanel({
  titre, metaTitle, setMetaTitle, metaDesc, setMetaDesc, metaKeywords, setMetaKeywords, canonical, setCanonical,
}: {
  titre: string;
  metaTitle: string; setMetaTitle: (v: string) => void;
  metaDesc: string; setMetaDesc: (v: string) => void;
  metaKeywords: string; setMetaKeywords: (v: string) => void;
  canonical: string; setCanonical: (v: string) => void;
}) {
  return (
    <div className="rev-seo" style={{ position: 'sticky', top: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 800, color: '#003366', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        🔍 Référencement (SEO)
      </h3>
      <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '0 0 14px' }}>Optimisation de l&apos;article pour Google et les réseaux.</p>

      <label style={labelStyle}>Meta title</label>
      <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={titre || 'Titre SEO'} style={{ ...inputStyle, margin: '4px 0 2px' }} />
      <div style={counterStyle(metaTitle.length, 60)}>{metaTitle.length} / 60</div>

      <label style={labelStyle}>Meta description</label>
      <textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} rows={3} style={{ ...inputStyle, margin: '4px 0 2px', resize: 'vertical' }} placeholder="Description affichée dans les résultats de recherche…" />
      <div style={counterStyle(metaDesc.length, 160)}>{metaDesc.length} / 160</div>

      <label style={labelStyle}>Mots-clés</label>
      <input value={metaKeywords} onChange={e => setMetaKeywords(e.target.value)} placeholder="marché public, appel d'offres" style={{ ...inputStyle, margin: '4px 0 12px' }} />

      <label style={labelStyle}>URL canonique</label>
      <input value={canonical} onChange={e => setCanonical(e.target.value)} placeholder="https://tenderwise.fr/blog/…" style={{ ...inputStyle, margin: '4px 0 14px' }} />

      {(metaTitle || titre) && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 6px' }}>Aperçu Google</div>
          <div style={{ fontSize: 12, color: '#006621' }}>tenderwise.fr › blog</div>
          <div style={{ fontSize: 15, color: '#1a0dab', fontWeight: 500, margin: '2px 0' }}>{metaTitle || titre}</div>
          <div style={{ fontSize: 12.5, color: '#4d5156', lineHeight: 1.5 }}>{metaDesc || '…'}</div>
        </div>
      )}
    </div>
  );
}

function counterStyle(len: number, max: number): React.CSSProperties {
  return { fontSize: 11, color: len > max ? '#dc2626' : '#9ca3af', textAlign: 'right', marginBottom: 12 };
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: '#374151',
  textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 2px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 15, margin: '6px 0 16px', boxSizing: 'border-box', outline: 'none', color: '#0f172a', background: 'white',
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '12px 20px', border: 'none', borderRadius: 8, background: bg, color: 'white',
    fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
  };
}

function btnOutlineStyle(color: string): React.CSSProperties {
  return {
    padding: '12px 18px', border: `1.5px solid ${color}`, borderRadius: 8, background: 'white',
    color, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
  };
}

function imgBtn(border: string, bg: string, color: string, busy: string | null): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
    border: `1.5px solid ${border}`, borderRadius: 8, background: bg, color,
    fontWeight: 700, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer',
    fontFamily: 'Montserrat, sans-serif', opacity: busy ? 0.6 : 1,
  };
}
