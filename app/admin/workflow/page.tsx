'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────
interface WorkflowStep { name: string; ok: boolean; detail?: string; attempt?: number }

interface Item {
  id: number;
  article_id: number | null;
  token: string;
  subject: string;
  status: string;
  drive_link: string;
  image_url: string;
  is_test: number;
  source: string;
  scheduled_at: string | null;
  created_at: string;
  titre: string | null;
  article_statut: string | null;
  steps_log: string | null;
}
type Groups = Record<string, Item[]>;

interface NodeState { active: boolean; error: boolean; errorDetail?: string }
interface PNode {
  key: string; label: string; sub: string; color: string;
  icon: ReactNode; desc: string; badge?: string;
  modelKey?: string;
  promptStatic?: string;
}

interface Idea {
  id: number;
  titre_propose: string;
  angle_editorial: string;
  sources_trouvees: string[];
  mots_cles: string;
  categorie: string;
  statut: string;
  date_generee: string;
}

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (s?: string | null) =>
  s ? new Date(s.replace(' ', 'T')).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtTime = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ── Labels étapes (pour pills & log) ────────────────────────────────
const STEP_LABELS: Record<string, string> = {
  recherche:      'Recherche',
  analyste:       'Analyse',
  redacteur:      'Rédaction',
  'link-checker': 'Liens',
  reviseur:       'Révision',
  qualite:        'Qualité',
  article:        'Rédaction',
  image:          'Image',
  brouillon:      'Sauvegarde',
  drive:          'Drive',
  review:         'Validation',
  email:          'E-mail',
  chat:           'Chat',
};

const STEP_KEYS_ORDERED = [
  'recherche', 'analyste', 'redacteur', 'link-checker', 'reviseur',
  'image', 'brouillon', 'drive', 'review', 'email', 'chat',
];

const STEP_TO_NODE: Record<string, string> = {
  recherche:      'recherche',
  analyste:       'analyste',
  redacteur:      'redacteur',
  'link-checker': 'link-checker',
  reviseur:       'reviseur',
  qualite:        'reviseur',
  article:        'redacteur',
  image:          'image',
  brouillon:      'image',
  drive:          'image',
  review:         'email',
  email:          'email',
  chat:           'email',
};

// ── Définitions des nodes pipeline (sans le déclencheur, rendu séparément) ──
const AI_NODES: PNode[] = [
  {
    key: 'recherche', label: 'Recherche', sub: 'Google Search', color: '#0d9488', badge: 'WEB',
    modelKey: 'ai_research_model',
    desc: 'Recherche web ancrée (Google Search grounding) : collecte des faits réels, chiffrés et sourcés (textes de loi avec leur code, montants, peines, dates, jurisprudence) ET les URLs réelles des sources. Ces faits alimentent le Rédacteur (il s\'appuie sur du vérifié au lieu d\'halluciner) et les liens de l\'article ne peuvent pointer que vers ces sources vérifiées. Étape non bloquante : si le grounding est indisponible (quota épuisé, clé sans accès), la rédaction continue sans recherche.',
    promptStatic: `Rôle : Documentaliste juridique B2B, avec accès à la recherche Google (grounding).

Mission : rassembler des informations FACTUELLES, ACTUELLES et VÉRIFIABLES sur le sujet, sans rien inventer.

Restitue un brief factuel en puces :
  • Textes applicables + référence exacte + code (ex. « article 221-6 du Code pénal »)
  • Chiffres réels : amendes, peines, seuils, dates d'entrée en vigueur (avec l'année)
  • Jurisprudence : juridiction, date, n° de pourvoi

Sortie technique : brief texte + liste des URLs sources réelles (extraites des métadonnées de grounding, résolues vers l'URL finale).

Note : grounding disponible uniquement sur les modèles 2.x du tier gratuit (≈1500/jour), pas sur les 3.x.`,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  },
  {
    key: 'analyste', label: 'Analyste', sub: 'Agent IA', color: '#7c3aed', badge: 'IA',
    modelKey: 'ai_analyste_model',
    desc: 'Analyse le sujet et produit une feuille de route pour la rédaction : angle éditorial, 5 points clés à couvrir, références légales probablement pertinentes (sans inventer d\'URLs), mots-clés SEO prioritaires et public cible.',
    promptStatic: `Rôle : Tu es un stratège éditorial.

Mission : produire une analyse qui guidera la rédaction d'un article conforme aux directives éditoriales (prompt maître injecté automatiquement).

1. Identifier l'angle éditorial le plus pertinent (conforme au ton et à l'audience)
2. Lister les 5 points clés à couvrir en priorité
3. Identifier les références légales probablement pertinentes — textuelles uniquement, sans inventer d'URLs
4. Proposer 6 mots-clés SEO prioritaires (longue traîne incluse)
5. Définir précisément le public cible

Sortie : objet JSON { angle, points_cles[], lois_a_citer[], mots_cles_seo[], public_cible }

Note : en cas d'échec de cet agent, la rédaction continue sans analyse préalable (non bloquant).`,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>,
  },
  {
    key: 'redacteur', label: 'Rédacteur', sub: 'Agent IA', color: '#7c3aed', badge: 'IA',
    modelKey: 'ai_redacteur_model',
    desc: 'Rédige l\'article complet en Markdown, guidé par l\'analyse de l\'Agent Analyste. Lors d\'un retry, intègre les corrections détaillées du Réviseur. Pour les lois : si l\'URL n\'est pas certaine, cite la référence en gras sans lien.',
    promptStatic: `Rôle : Tu es un journaliste B2B senior (identité définie dans le prompt maître).

Contexte injecté automatiquement :
  • Prompt maître éditorial (Admin → Prompts IA) — source de vérité absolue
  • Analyse de l'Analyste (angle, points clés, lois, mots-clés, public cible)
  • Paramètres : sujet, catégorie, ton, longueur, langue, mots-clés
  • Liste des catégories disponibles sur le site
  • Feedback du Réviseur + article précédent (si retry)

Sortie : objet JSON complet { titre, extrait, contenu (Markdown), meta_title, meta_description, meta_keywords, temps_lecture, categorie, categories[], image_title, image_subtitle }

Règles absolues (rappelées aussi dans le format de sortie) :
  • Aucun deux-points dans le titre ni dans les titres ## ou ###
  • Aucune clause de non-responsabilité juridique
  • Appel à l'action final mentionne "TenderWise" (un seul mot)`,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  },
  {
    key: 'link-checker', label: 'Vérificateur', sub: 'Liens HTTP', color: '#0891b2', badge: 'HTTP',
    desc: 'Vérifie chaque lien Markdown de l\'article via requête HTTP (sans IA, 0 token). Détecte : erreurs 404, soft-404 légifrance ("texte introuvable"), et vérifie que le numéro d\'article (ex: L. 1234-5) est bien présent dans la page. Max 20 liens, délai 400ms entre requêtes.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  },
  {
    key: 'reviseur', label: 'Réviseur', sub: 'Agent IA', color: '#7c3aed', badge: 'IA',
    modelKey: 'ai_reviseur_model',
    desc: 'Note l\'article sur 6 critères /20 : Respect du prompt, Mise en forme, Cohérence, Liens, SEO, Complétude. Score ≥ 70/100 → article approuvé. Score < 70 → feedback détaillé + retry vers Rédacteur. Maximum 2 retries.',
    promptStatic: `Rôle : Tu es un réviseur expert. Les directives éditoriales (prompt maître) sont ta référence absolue — tes corrections ne doivent jamais les contredire.

Grille d'évaluation — chaque critère noté /20 (total ramené à /100) :

1. Respect du prompt système /20 — ton, style, audience, structure, éléments demandés
2. Mise en forme /20 — H2/H3 présents, paragraphes courts, listes en "- ", gras sur termes clés
3. Cohérence /20 — intro → développement → conclusion logiques et enchaînés
4. Liens /20 — liens ❌ retirés (ancre en gras), liens ⚠️ et ✅ conservés
5. SEO /20 — meta_title 50-60 car., meta_description 150-160 car., mots-clés intégrés naturellement
6. Complétude /20 — sujet traité en profondeur, longueur cohérente, questions du lecteur répondues

Seuil : score ≥ 70 → approbation. Score < 70 → feedback détaillé + article corrigé → retry vers Rédacteur.
Maximum 2 retries, puis approbation forcée avec alerte ⚠️.

Sortie : objet JSON { promptRespect, misEnForme, coherence, liens, seo, completude, feedback, corrections[], article_corrige{...} }`,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  },
];

const PUB_NODES: PNode[] = [
  {
    key: 'image', label: 'Image', sub: 'Composition', color: '#9333ea', badge: 'AUTO',
    desc: 'Compose l\'image d\'en-tête en incrustant le titre et le sous-titre sur un fond préenregistré (Admin → Fonds d\'en-tête). Aucune IA ni génération externe — traitement local uniquement.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  },
  {
    key: 'email', label: 'E-mail', sub: 'Validation', color: '#c5a059', badge: 'GMAIL',
    desc: 'Envoie un e-mail de validation à l\'adresse configurée via l\'API Gmail. L\'e-mail contient l\'aperçu de l\'article, un lien Drive, et trois boutons d\'action : Approuver, Modifier, Refuser.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 5L2 7"/></svg>,
  },
  {
    key: 'en_attente', label: 'À valider', sub: 'Décision', color: '#d97706', badge: 'HUMAIN',
    desc: 'L\'éditeur examine l\'article depuis l\'e-mail de validation ou depuis cette page. Il peut approuver, modifier ou refuser. En cas de modification, l\'article repasse en attente.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    key: 'valide', label: 'Validé', sub: 'À programmer', color: '#059669', badge: 'OK',
    desc: 'Article approuvé par l\'éditeur. Deux options : programmer une date/heure de publication automatique, ou publier immédiatement.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  },
  {
    key: 'programme', label: 'Programmé', sub: 'Date fixée', color: '#1e40af', badge: 'CRON',
    desc: 'La publication se déclenchera automatiquement à la date et heure définies. Le système vérifie les articles programmés à chaque chargement de la page workflow.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    key: 'publie', label: 'Publié', sub: 'En ligne', color: '#0f766e', badge: 'LIVE',
    desc: 'L\'article est visible sur le site et indexable par les moteurs de recherche. Il peut encore être modifié depuis Admin → Articles.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/><path d="M16.24 7.76a6 6 0 010 8.49M7.76 16.24a6 6 0 010-8.49"/></svg>,
  },
];

// ── Déclencheur double (branche Chat + Idées) ───────────────────────
function DualTrigger({ chatActive, ideaActive }: { chatActive: boolean; ideaActive: boolean }) {
  const card = (
    active: boolean, color: string, icon: ReactNode,
    label: string, sub: string,
  ) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 10px', borderRadius: '10px',
      border: `1.5px solid ${active ? color : '#e5e7eb'}`,
      background: active ? color + '10' : '#fafafa',
      transition: 'all .2s', minWidth: 0,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white',
        boxShadow: active ? `0 3px 10px ${color}55` : 'none',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: active ? '#111827' : '#6b7280', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: '0.63rem', color: active ? color : '#9ca3af', fontWeight: active ? 600 : 400 }}>{active ? 'En cours…' : sub}</div>
      </div>
      {active && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"
          style={{ animation: 'wf-spin .8s linear infinite', flexShrink: 0, marginLeft: 'auto' }}>
          <path d="M21 12a9 9 0 00-9-9"/>
        </svg>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      {/* Deux cartes déclencheur */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {card(chatActive, '#1a73e8',
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
          'Google Chat', 'Manuel',
        )}
        {card(ideaActive, '#004a99',
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
          'Idées du jour', 'Auto · 4h00',
        )}
      </div>

      {/* Branche SVG : deux lignes fusionnant vers la droite */}
      <svg width="28" height="72" viewBox="0 0 28 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M0 18 Q14 18 14 36" stroke="#cbd5e1" strokeWidth="1.5" fill="none"/>
        <path d="M0 54 Q14 54 14 36" stroke="#cbd5e1" strokeWidth="1.5" fill="none"/>
        <line x1="14" y1="36" x2="26" y2="36" stroke="#cbd5e1" strokeWidth="1.5"/>
        <polyline points="22,32 26,36 22,40" stroke="#cbd5e1" strokeWidth="1.5" fill="none"/>
      </svg>
    </div>
  );
}

// ── Composant node pipeline ──────────────────────────────────────────
function PipelineNode({
  node, state, count, selected, onSelect, stepNum,
}: {
  node: PNode; state: NodeState; count?: number;
  selected: boolean; onSelect: () => void; stepNum: number;
}) {
  const isActive = state.active;
  const isError  = state.error;

  return (
    <button
      onClick={onSelect}
      className="pl-node"
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        borderRadius: '14px',
        border: `2px solid ${selected ? node.color : isError ? '#fca5a5' : isActive ? node.color + '88' : '#e5e7eb'}`,
        background: selected ? node.color + '0e' : isError ? '#fff8f8' : isActive ? node.color + '07' : 'white',
        boxShadow: selected
          ? `0 0 0 4px ${node.color}18, 0 4px 20px rgba(0,0,0,.09)`
          : isActive ? `0 2px 14px ${node.color}28` : '0 1px 3px rgba(0,0,0,.05)',
        transition: 'all .2s',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <div style={{
        height: 4,
        background: isError ? '#dc2626' : isActive
          ? `linear-gradient(90deg,${node.color},${node.color}aa)`
          : selected ? node.color : node.color + '30',
        transition: 'background .2s',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 4px', gap: '6px' }}>
        <span style={{
          fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.06em',
          color: selected || isActive ? node.color : '#9ca3af',
          background: (selected || isActive) ? node.color + '18' : '#f3f4f6',
          borderRadius: '5px', padding: '2px 7px',
        }}>
          {String(stepNum).padStart(2, '0')}
        </span>
        {node.badge && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.07em',
            color: 'white',
            background: isError ? '#dc2626' : node.color,
            borderRadius: '5px', padding: '3px 8px',
          }}>
            {node.badge}
          </span>
        )}
      </div>

      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 46, height: 46, borderRadius: '12px',
            background: isError ? '#ef4444' : node.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
            boxShadow: isActive && !isError ? `0 4px 18px ${node.color}55` : 'none',
          }}>
            {node.icon}
          </div>
          {isActive && (
            <div style={{
              position: 'absolute', bottom: -5, right: -5,
              width: 20, height: 20, background: 'white', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 2.5px ${node.color}, 0 2px 8px rgba(0,0,0,.15)`,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={node.color} strokeWidth="3"
                style={{ animation: 'wf-spin .8s linear infinite' }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".2"/>
                <path d="M21 12a9 9 0 00-9-9"/>
              </svg>
            </div>
          )}
          {!isActive && isError && (
            <div style={{
              position: 'absolute', bottom: -5, right: -5,
              width: 18, height: 18, background: '#dc2626', borderRadius: '50%',
              boxShadow: '0 0 0 2px white, 0 1px 5px rgba(220,38,38,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="none">
                <rect x="10.5" y="5" width="3" height="9" rx="1.5"/>
                <circle cx="12" cy="18.5" r="2"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '2px 14px 14px', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isError ? '#991b1b' : '#111827', lineHeight: 1.25 }}>
          {node.label}
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: isActive ? 600 : 400, color: isError ? '#dc2626' : isActive ? node.color : '#9ca3af' }}>
          {isError ? 'Erreur — cliquer pour détails' : isActive ? 'En cours…' : node.sub}
        </span>
        {count != null && count > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            background: node.color, color: 'white',
            fontSize: '0.65rem', fontWeight: 800,
            padding: '3px 10px', borderRadius: '10px',
            marginTop: '6px', alignSelf: 'flex-start',
          }}>
            {count} article{count > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Connecteur flèche ────────────────────────────────────────────────
function Arrow() {
  return (
    <div className="pl-arrow">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

const AGENT_MODELS = [
  { id: 'gemini-3.1-flash-lite',  label: 'Gemini 3.1 Flash Lite  — rapide, plus gros quota (recommandé)' },
  { id: 'gemini-2.5-flash-lite',  label: 'Gemini 2.5 Flash Lite  — bonne qualité gratuite' },
  { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash       — meilleur raisonnement' },
  { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash        — génération précédente' },
  { id: 'gemini-2.0-flash-lite',  label: 'Gemini 2.0 Flash Lite   — léger' },
];

// ── Panneau détail node ──────────────────────────────────────────────
function NodeDetail({
  node, onClose, agentModels, onModelChange,
}: {
  node: PNode;
  onClose: () => void;
  agentModels: Record<string, string>;
  onModelChange: (key: string, model: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const currentModel = node.modelKey ? (agentModels[node.modelKey] ?? '') : '';

  const handleModelChange = async (model: string) => {
    if (!node.modelKey) return;
    onModelChange(node.modelKey, model);
    setSaving(true); setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [node.modelKey]: model }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      marginTop: '12px', borderRadius: '12px', overflow: 'hidden',
      border: `1.5px solid ${node.color}33`,
    }}>
      <div style={{
        background: `linear-gradient(135deg,${node.color}18,${node.color}08)`,
        borderBottom: `1px solid ${node.color}22`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '10px', background: node.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
        }}>
          {node.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.9rem', color: '#111827' }}>{node.label}</strong>
            {node.badge && (
              <span style={{ background: node.color, color: 'white', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>
                {node.badge}
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{node.sub}</span>
        </div>
        <button onClick={onClose} style={{
          all: 'unset', cursor: 'pointer', color: '#9ca3af', padding: '4px',
          fontSize: '1.1rem', lineHeight: 1, flexShrink: 0,
        }}>✕</button>
      </div>

      <div style={{ padding: '14px 16px', background: 'white', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151', lineHeight: 1.7 }}>{node.desc}</p>

        {node.modelKey && (
          <div style={{ padding: '12px 14px', background: '#f5f3ff', borderRadius: '10px', border: '1px solid #ede9fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9' }}>Modèle IA utilisé</span>
              {saving && <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>Enregistrement…</span>}
              {saved  && <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600 }}>✓ Enregistré</span>}
            </div>
            <select
              value={currentModel}
              onChange={e => handleModelChange(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: '8px',
                border: '1.5px solid #c4b5fd', background: 'white',
                fontSize: '0.78rem', color: '#111827', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {AGENT_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p style={{ margin: '6px 0 0', fontSize: '0.68rem', color: '#7c3aed' }}>
              Le fallback automatique s&apos;applique : si ce modèle est en quota (429) ou indisponible (404), les suivants sont essayés automatiquement.
            </p>
          </div>
        )}

        {node.promptStatic && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Instructions de cet agent
              </span>
            </div>
            <pre style={{
              margin: 0, padding: '12px 14px',
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px',
              fontSize: '0.75rem', color: '#374151', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'ui-monospace, monospace',
              maxHeight: '280px', overflowY: 'auto',
            }}>
              {node.promptStatic}
            </pre>
            {node.key !== 'trigger' && node.key !== 'link-checker' && (
              <p style={{ margin: '6px 0 0', fontSize: '0.68rem', color: '#9ca3af' }}>
                Le prompt maître éditorial (Admin → Prompts IA) est injecté automatiquement avant ces instructions.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Paramètres de génération d'idées ─────────────────────────────────
function IdeaParams() {
  const DOMAINS = [
    { label: 'Réglementation chantier', desc: 'PPSPS, permis feu, plans de prévention, coordination SPS' },
    { label: 'AMO', desc: 'Contrats MOA/MOE, conduite d\'opération, gestion de programme' },
    { label: 'Maîtrise d\'œuvre', desc: 'Responsabilité décennale, DO, réception, levée de réserves' },
    { label: 'Marchés privés', desc: 'Contrats travaux privés, sous-traitance, retenue de garantie' },
    { label: 'Marchés publics', desc: 'CCAP/CCTP, passation, avenants, pénalités, jurisprudence' },
    { label: 'Facility management', desc: 'Maintenance, contrats multi-technique, audit patrimoine' },
    { label: 'Jurisprudence', desc: 'Arrêts récents, responsabilité constructeur, litiges chantier' },
    { label: 'Réglementation bâtiment', desc: 'RE2020, PMR, amiante, plomb, diagnostics, normes NF/DTU' },
  ];

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      <div style={{ background: '#0f172a', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <span style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: '0.8rem', color: 'white' }}>
          Paramètres du prompt IA
        </span>
      </div>

      <div style={{ padding: '12px' }}>
        {/* Réglages fixes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            { icon: '💡', label: 'Idées / jour', value: '3' },
            { icon: '⏰', label: 'Génération', value: '4h00' },
            { icon: '📅', label: 'Fraîcheur', value: '60 jours' },
            { icon: '🤖', label: 'Modèle', value: 'Gemini 2.5' },
          ].map(p => (
            <div key={p.label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 10px' }}>
              <div style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>{p.icon} {p.label}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827' }}>{p.value}</div>
            </div>
          ))}
        </div>

        {/* Domaines couverts */}
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
          Domaines surveillés
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {DOMAINS.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.58rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4, flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </span>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#111827' }}>{d.label}</div>
                <div style={{ fontSize: '0.64rem', color: '#9ca3af', lineHeight: 1.4 }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Anti-doublon */}
        <div style={{ marginTop: 12, padding: '7px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.7rem', color: '#15803d' }}>
          <strong>Anti-doublon :</strong> les 100 derniers titres d&apos;articles publiés sont exclus automatiquement du prompt.
        </div>
      </div>
    </div>
  );
}

// ── Panneau Idées du jour ────────────────────────────────────────────
function IdeasPanel({ onIdeaLaunched }: { onIdeaLaunched: () => void }) {
  const [ideas, setIdeas]           = useState<Idea[]>([]);
  const [loading, setLoading]       = useState(true);
  const [regenerating, setRegen]    = useState(false);
  const [actionId, setActionId]     = useState<number | null>(null);
  const [error, setError]           = useState('');

  const loadIdeas = useCallback(async () => {
    try {
      const data = await fetch('/api/ideas').then(r => r.json()) as { ideas?: Idea[] };
      setIdeas(data.ideas ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadIdeas(); }, [loadIdeas]);

  const handleAction = async (id: number, action: 'accept' | 'refuse') => {
    setActionId(id);
    setError('');
    try {
      const res = await fetch(`/api/ideas/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) { setError(data.error ?? 'Erreur'); return; }

      setIdeas(prev => prev.filter(i => i.id !== id));
      if (action === 'accept') onIdeaLaunched();
    } catch { setError('Erreur réseau'); }
    finally { setActionId(null); }
  };

  const handleRegenerate = async () => {
    setRegen(true);
    setError('');
    try {
      const res = await fetch('/api/cron/ideas?force=1');
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) { setError(data.error ?? 'Erreur'); return; }
      await loadIdeas();
    } catch { setError('Erreur réseau'); }
    finally { setRegen(false); }
  };

  const dateGenerated = ideas[0]?.date_generee
    ? new Date(ideas[0].date_generee.replace(' ', 'T')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px',
      boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden',
    }}>
      {/* En-tête compact */}
      <div style={{
        background: 'linear-gradient(135deg,#004a99,#1a73e8)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          <span style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: '0.82rem', color: 'white' }}>
            Idées du jour
          </span>
          {dateGenerated && (
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,.65)' }}>· {dateGenerated}</span>
          )}
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          title="Régénérer"
          style={{
            all: 'unset', cursor: regenerating ? 'not-allowed' : 'pointer',
            background: 'rgba(255,255,255,.15)', borderRadius: '6px',
            padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '0.68rem', color: 'white', fontWeight: 600,
            opacity: regenerating ? 0.6 : 1,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ animation: regenerating ? 'wf-spin 0.9s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          {regenerating ? '…' : 'Régénérer'}
        </button>
      </div>

      {/* Corps */}
      <div style={{ padding: '12px' }}>
        {error && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.75rem', color: '#b91c1c', marginBottom: '10px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '10px', color: '#9ca3af', fontSize: '0.82rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ animation: 'wf-spin 0.9s linear infinite' }}>
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
            </svg>
            Chargement…
          </div>
        ) : ideas.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '10px', lineHeight: 1.5 }}>
              Générées automatiquement à 4h. Cliquez pour en obtenir maintenant.
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                all: 'unset', cursor: regenerating ? 'not-allowed' : 'pointer',
                background: '#004a99', color: 'white', borderRadius: '8px',
                padding: '7px 14px', fontSize: '0.76rem', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                opacity: regenerating ? 0.6 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ animation: regenerating ? 'wf-spin 0.9s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              {regenerating ? 'Génération…' : 'Générer les idées du jour'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ideas.map((idea, idx) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                index={idx + 1}
                busy={actionId === idea.id}
                onAccept={() => handleAction(idea.id, 'accept')}
                onRefuse={() => handleAction(idea.id, 'refuse')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Carte idée individuelle ──────────────────────────────────────────
function IdeaCard({
  idea, index, busy, onAccept, onRefuse,
}: {
  idea: Idea; index: number; busy: boolean;
  onAccept: () => void; onRefuse: () => void;
}) {
  const CAT_COLORS: Record<string, string> = {
    'Réglementation chantier': '#92400e',
    'Sécurité BTP':            '#991b1b',
    'AMO':                     '#1e40af',
    "Maîtrise d'œuvre":        '#5b21b6',
    'Marchés privés':          '#065f46',
    'Marchés publics':         '#14532d',
    'Facility management':     '#9d174d',
    'Jurisprudence':           '#713f12',
    'Réglementation bâtiment': '#0c4a6e',
    'Actualités':              '#374151',
  };
  const catColor = CAT_COLORS[idea.categorie] ?? '#374151';

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden',
      background: '#fafafa', opacity: busy ? 0.6 : 1, transition: 'opacity .15s',
    }}>
      <div style={{ height: 2, background: 'linear-gradient(90deg,#004a99,#1a73e8)' }} />
      <div style={{ padding: '10px' }}>

        {/* Numéro + catégorie */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 800, background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', padding: '1px 6px' }}>#{index}</span>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: catColor, background: catColor + '18', borderRadius: '4px', padding: '1px 6px' }}>
            {idea.categorie}
          </span>
        </div>

        {/* Titre */}
        <p style={{ margin: '0 0 7px', fontSize: '0.79rem', fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
          {idea.titre_propose}
        </p>

        {/* Angle éditorial — toujours visible */}
        <p style={{ margin: '0 0 6px', fontSize: '0.72rem', color: '#374151', lineHeight: 1.55, background: '#f0f9ff', border: '1px solid #e0f2fe', borderRadius: '6px', padding: '6px 8px' }}>
          {idea.angle_editorial}
        </p>

        {/* Mots-clés */}
        {idea.mots_cles && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '8px' }}>
            {idea.mots_cles.split(',').map((k, i) => (
              <span key={i} style={{ fontSize: '0.6rem', background: '#f3f4f6', color: '#6b7280', borderRadius: '4px', padding: '1px 6px', border: '1px solid #e5e7eb' }}>
                {k.trim()}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={onAccept} disabled={busy} style={{
            all: 'unset', cursor: busy ? 'not-allowed' : 'pointer',
            flex: 1, background: '#004a99', color: 'white',
            borderRadius: '7px', padding: '6px 8px',
            fontSize: '0.72rem', fontWeight: 700, textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}>
            {busy ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'wf-spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 00-9-9"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
            {busy ? 'Lancement…' : 'Générer'}
          </button>
          <button onClick={onRefuse} disabled={busy} title="Refuser" style={{
            all: 'unset', cursor: busy ? 'not-allowed' : 'pointer',
            background: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af',
            borderRadius: '7px', padding: '6px 9px',
            fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ── En cours card ────────────────────────────────────────────────────
function EnCoursRow({ it }: { it: Item }) {
  const steps: WorkflowStep[] = (() => {
    try { return it.steps_log ? JSON.parse(it.steps_log) as WorkflowStep[] : []; } catch { return []; }
  })();

  const latestByName: Record<string, WorkflowStep> = {};
  for (const s of steps) { latestByName[s.name] = s; }

  const completedOk = new Set(steps.filter(s => s.ok).map(s => s.name));
  const currentKey  = STEP_KEYS_ORDERED.find(k => !completedOk.has(k)) ?? null;

  const redactAttempts = steps.filter(s => s.name === 'redacteur').length;

  return (
    <div className="wf-card en-cours-card"
      style={{ padding: '16px', background: '#faf5ff', border: '2px solid #c4b5fd' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"
            style={{ animation: 'wf-spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".2"/><path d="M21 12a9 9 0 00-9-9"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.87rem', fontWeight: 700, color: '#4c1d95', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.subject || 'Génération en cours…'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '10px' }}>
            <span>Démarré {fmt(it.created_at)}</span>
            {it.is_test === 1 && <span style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700, padding: '1px 6px', borderRadius: '8px' }}>TEST</span>}
            {it.source === 'idea' && <span style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 700, padding: '1px 6px', borderRadius: '8px' }}>IDÉE AUTO</span>}
            {redactAttempts > 1 && <span style={{ background: '#ede9fe', color: '#6d28d9', fontWeight: 700, padding: '1px 6px', borderRadius: '8px' }}>↩ Tentative {redactAttempts}</span>}
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {STEP_KEYS_ORDERED.map(key => {
              const s = latestByName[key];
              const isCurrent = !completedOk.has(key) && key === currentKey;
              return (
                <span key={key} title={s?.detail ?? ''} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  padding: '3px 8px', borderRadius: '20px', fontSize: '0.67rem', fontWeight: 600,
                  background: s ? (s.ok ? '#dcfce7' : '#fef2f2') : isCurrent ? '#f3e8ff' : '#f3f4f6',
                  color: s ? (s.ok ? '#15803d' : '#b91c1c') : isCurrent ? '#7c3aed' : '#9ca3af',
                  border: isCurrent ? '1px solid #c4b5fd' : '1px solid transparent',
                }}>
                  {s ? (s.ok ? '✓' : '✗') : isCurrent
                    ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'wf-spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 00-9-9"/></svg>
                    : '·'}
                  {' '}{STEP_LABELS[key] ?? key}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────
export default function WorkflowPage() {
  const [groups, setGroups]         = useState<Groups>({});
  const [counts, setCounts]         = useState<Record<string, number>>({});
  const [loading, setLoading]       = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aiSelected, setAiSelected]   = useState<string | null>(null);
  const [pubSelected, setPubSelected] = useState<string | null>(null);
  const [agentModels, setAgentModels] = useState<Record<string, string>>({
    ai_research_model:  'gemini-2.5-flash',
    ai_analyste_model:  'gemini-3.1-flash-lite',
    ai_redacteur_model: 'gemini-2.5-flash',
    ai_reviseur_model:  'gemini-2.5-flash',
  });

  const load = useCallback(async (manual?: boolean) => {
    if (manual) setRefreshing(true);
    try {
      const d = await fetch('/api/workflow').then(r => r.json());
      setGroups(d.groups || {});
      setCounts(d.counts || {});
      setNeedsMigration(!!d.needsMigration);
      setLastRefresh(new Date());
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { queueMicrotask(load); }, [load]);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        setAgentModels(prev => ({
          ...prev,
          ...(s.ai_research_model  ? { ai_research_model:  s.ai_research_model  } : {}),
          ...(s.ai_analyste_model  ? { ai_analyste_model:  s.ai_analyste_model  } : {}),
          ...(s.ai_redacteur_model ? { ai_redacteur_model: s.ai_redacteur_model } : {}),
          ...(s.ai_reviseur_model  ? { ai_reviseur_model:  s.ai_reviseur_model  } : {}),
        }));
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      try {
        es = new EventSource('/api/workflow/stream');
        es.onmessage = e => { if (e.data === 'update') load(); };
        es.onerror = () => { es?.close(); es = null; timer = setTimeout(connect, 3000); };
      } catch { /* ignore */ }
    };
    connect();
    return () => { if (timer) clearTimeout(timer); es?.close(); };
  }, [load]);

  useEffect(() => {
    if (loading) return;
    const enCours = groups['en_cours'] ?? [];
    const delay = enCours.length > 0 ? 3000 : 30000;
    const id = setInterval(() => load(), delay);
    return () => clearInterval(id);
  }, [load, loading, groups]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ animation: 'wf-spin 0.9s linear infinite' }}>
          <style>{`@keyframes wf-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Chargement…</span>
      </div>
    );
  }

  const g = (k: string) => groups[k] || [];
  const enCours = g('en_cours');

  const nodeStates: Record<string, NodeState> = {};
  let chatTriggerActive = false;
  let ideaTriggerActive = false;

  for (const item of enCours) {
    let steps: WorkflowStep[] = [];
    try { steps = item.steps_log ? JSON.parse(item.steps_log) as WorkflowStep[] : []; } catch { /* ignore */ }

    if (steps.length === 0) {
      if (item.source === 'idea') ideaTriggerActive = true;
      else chatTriggerActive = true;
      continue;
    }

    for (const s of steps) {
      if (!s.ok) {
        const nk = STEP_TO_NODE[s.name] ?? s.name;
        if (!nodeStates[nk]) nodeStates[nk] = { active: false, error: true, errorDetail: s.detail };
        else { nodeStates[nk].error = true; nodeStates[nk].errorDetail = s.detail; }
      }
    }

    const completedOk = new Set(steps.filter(s => s.ok).map(s => s.name));
    const currentKey  = STEP_KEYS_ORDERED.find(k => !completedOk.has(k)) ?? null;
    if (currentKey) {
      const nk = STEP_TO_NODE[currentKey] ?? currentKey;
      if (!nodeStates[nk]) nodeStates[nk] = { active: true, error: false };
      else nodeStates[nk].active = true;
    }
  }

  const aiDetail  = aiSelected  ? AI_NODES.find(n => n.key === aiSelected)   : null;
  const pubDetail = pubSelected ? PUB_NODES.find(n => n.key === pubSelected) : null;

  return (
    <div style={{ padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes wf-spin  { from{transform:rotate(0)}to{transform:rotate(360deg)} }
        @keyframes wf-pulse { 0%,100%{border-color:#c4b5fd}50%{border-color:#7c3aed} }
        .wf-card  { background:white; border:1px solid #e5e7eb; border-radius:14px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .wf-btn   { padding:7px 13px; border:none; border-radius:8px; font-weight:700; font-size:0.78rem; cursor:pointer; font-family:Montserrat,sans-serif; display:inline-flex; align-items:center; gap:6px; transition:opacity .15s; }
        .wf-btn:disabled { opacity:.5; cursor:not-allowed; }
        .wf-input { padding:7px 10px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:0.8rem; outline:none; color:#111827; background:white; }
        .en-cours-card { animation:wf-pulse 2s ease-in-out infinite; }
        .pl-row   { display:flex; align-items:stretch; gap:8px; }
        .pl-node  { flex:1 1 110px; min-width:100px; }
        .pl-arrow { display:flex; align-items:center; flex-shrink:0; opacity:.5; }
        @media(max-width:680px){
          .pl-row   { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
          .pl-node  { flex:none; min-width:0; }
          .pl-arrow { display:none; }
        }
        .wf-layout { display:flex; gap:1.25rem; align-items:flex-start; }
        .wf-main   { flex:1; min-width:0; }
        .wf-aside  { width:32%; min-width:260px; flex-shrink:0; display:flex; flex-direction:column; gap:1rem; }
        @media(max-width:1100px){
          .wf-layout { flex-direction:column; }
          .wf-aside  { width:100%; min-width:0; }
        }
      `}</style>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1.4rem', fontWeight: 800, color: '#003366', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: 'linear-gradient(135deg,#004a99,#7c3aed)', borderRadius: '9px', padding: '7px', display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>
                <path d="M9 6h6a2 2 0 012 2v7"/>
              </svg>
            </span>
            Workflow de publication
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
            Pipeline multi-agents IA → Vérification → Publication
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px', flexWrap: 'wrap' }}>
          {lastRefresh && (
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              {fmtTime(lastRefresh)}
              {enCours.length > 0 && <span style={{ color: '#7c3aed', fontWeight: 600 }}> · temps réel</span>}
            </span>
          )}
          <button onClick={() => load(true)} disabled={refreshing} className="wf-btn"
            style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', padding: '6px 10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: refreshing ? 'wf-spin 0.9s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Rafraîchir
          </button>
        </div>
      </div>

      {needsMigration && (
        <div style={{ marginBottom: '1.5rem', padding: '12px 16px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.85rem' }}>
          ⚠️ Tables du workflow non créées — exécutez le script SQL dans phpMyAdmin.
        </div>
      )}

      {/* ── Layout 2 colonnes ── */}
      <div className="wf-layout">

        {/* ── Colonne principale ── */}
        <div className="wf-main">

          {/* ══ Pipeline IA ══ */}
          <div className="wf-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
              <span style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#111827' }}>
                Pipeline IA — Génération d&apos;article
              </span>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: 'auto' }}>
                Cliquez sur un agent pour voir sa description
              </span>
            </div>

            {/* Déclencheur double + pipeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              <DualTrigger chatActive={chatTriggerActive} ideaActive={ideaTriggerActive} />
              <div className="pl-row" style={{ flex: 1 }}>
                {AI_NODES.flatMap((node, i) => [
                  <PipelineNode
                    key={node.key}
                    node={node}
                    stepNum={i + 1}
                    state={nodeStates[node.key] || { active: false, error: false }}
                    selected={aiSelected === node.key}
                    onSelect={() => setAiSelected(aiSelected === node.key ? null : node.key)}
                  />,
                  i < AI_NODES.length - 1 ? <Arrow key={`a${i}`} /> : null,
                ])}
              </div>
            </div>

            <div style={{
              marginTop: '10px', padding: '6px 12px',
              background: '#faf5ff', border: '1px dashed #c4b5fd', borderRadius: '8px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M3 12a9 9 0 019-9 9 9 0 016.72 3.06L21 9"/><path d="M21 3v6h-6"/>
                <path d="M21 12a9 9 0 01-9 9 9 9 0 01-6.72-3.06L3 15"/><path d="M3 21v-6h6"/>
              </svg>
              <span style={{ fontSize: '0.72rem', color: '#7c3aed' }}>
                <strong>Boucle retry</strong> — score Réviseur &lt; 70/100 → renvoi au Rédacteur avec feedback · max 2 retries
              </span>
            </div>

            {aiDetail && (
              <NodeDetail
                node={aiDetail}
                onClose={() => setAiSelected(null)}
                agentModels={agentModels}
                onModelChange={(key, model) => setAgentModels(prev => ({ ...prev, [key]: model }))}
              />
            )}
          </div>

          {/* ══ Pipeline Publication ══ */}
          <div className="wf-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.75rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c5a059' }} />
              <span style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#111827' }}>
                Pipeline Publication
              </span>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: 'auto' }}>
                Cliquez sur une étape pour voir sa description
              </span>
            </div>

            <div className="pl-row">
              {PUB_NODES.flatMap((node, i) => [
                <PipelineNode
                  key={node.key}
                  node={node}
                  stepNum={i + 1}
                  state={nodeStates[node.key] || { active: false, error: false }}
                  count={counts[node.key]}
                  selected={pubSelected === node.key}
                  onSelect={() => setPubSelected(pubSelected === node.key ? null : node.key)}
                />,
                i < PUB_NODES.length - 1 ? <Arrow key={`b${i}`} /> : null,
              ])}
            </div>

            {pubDetail && (
              <NodeDetail
                node={pubDetail}
                onClose={() => setPubSelected(null)}
                agentModels={agentModels}
                onModelChange={(key, model) => setAgentModels(prev => ({ ...prev, [key]: model }))}
              />
            )}
          </div>

          {/* ══ En cours de génération ══ */}
          {enCours.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5"
                  style={{ animation: 'wf-spin 1s linear infinite', flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
                </svg>
                <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#7c3aed', margin: 0 }}>
                  En cours de génération
                </h2>
                <span style={{ background: '#f3e8ff', color: '#7c3aed', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: '10px' }}>
                  {enCours.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {enCours.map(it => <EnCoursRow key={it.id} it={it} />)}
              </div>
            </div>
          )}

          {/* ══ Renvoi vers « À valider » ══ */}
          <div className="wf-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#fafafa' }}>
            <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
              {(() => {
                const n = g('en_attente').length + g('modifie').length;
                return n === 0
                  ? 'Aucun contenu en attente de votre décision.'
                  : `${n} contenu${n > 1 ? 's' : ''} en attente de votre décision.`;
              })()}
            </span>
            <Link className="wf-btn" href="/admin/validation"
              style={{ background: '#004a99', color: 'white', textDecoration: 'none' }}>
              Aller à « À valider » →
            </Link>
          </div>

        </div>

        {/* ── Colonne idées ── */}
        <div className="wf-aside">
          <IdeasPanel onIdeaLaunched={() => load()} />
          <IdeaParams />
        </div>

      </div>
    </div>
  );
}
