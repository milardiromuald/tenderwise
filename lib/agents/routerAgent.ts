import { GoogleGenAI } from '@google/genai';
import { getGeminiKey } from '../encrypt';
import { callGemini } from '../geminiCall';

/**
 * Décision de routage émise par l'agent routeur.
 * Le routeur lit le message brut de l'utilisateur et décide quel workflow déclencher.
 */
export interface RouterDecision {
  /** Workflow cible. */
  workflow:       'article' | 'linkedin_post' | 'unknown';
  /** Sujet épuré pour le workflow article. */
  subject?:       string;
  /** Texte du post LinkedIn prêt à publier (généré par l'IA). */
  linkedin_text?: string;
  /** Explication courte de la décision (pour le log). */
  reason:         string;
}

/**
 * Agent Routeur — 1er maillon du pipeline.
 *
 * Reçoit le message brut de l'utilisateur (Google Chat ou autre déclencheur)
 * et détermine intelligemment :
 *   - "article"        → générer un article de blog professionnel
 *   - "linkedin_post"  → rédiger et publier un post LinkedIn
 *   - "unknown"        → intention non reconnue, demander clarification
 *
 * Pour "linkedin_post", l'agent génère directement le texte optimisé
 * (1 200–1 500 caractères, hashtags inclus) — prêt à publier sans étape
 * supplémentaire.
 *
 * Non bloquant : en cas d'erreur, renvoie `workflow: 'unknown'`.
 */
export async function routerAgent(rawMessage: string): Promise<RouterDecision> {
  const fallback: RouterDecision = {
    workflow: 'unknown',
    reason:   'Erreur lors de l\'analyse — clarification demandée',
  };

  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) return fallback;

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Tu es le routeur intelligent de TenderWise, une application B2B spécialisée dans les marchés publics, l'immobilier d'entreprise et la conformité juridique.

Tu reçois un message brut envoyé par un utilisateur (depuis Google Chat ou un autre déclencheur). Ton rôle est d'identifier l'intention et de sélectionner le bon workflow.

═══ MESSAGE UTILISATEUR ═══
${rawMessage}
═══════════════════════════

Workflows disponibles :

1. "article" — L'utilisateur veut qu'un ARTICLE DE BLOG long et professionnel soit généré sur un sujet précis (1 000 à 2 500 mots, structure éditoriale complète, publié sur le site).
   Indices : mots-clés "article", "blog", "rédige", "génère", mention d'un sujet à développer en profondeur, question complexe nécessitant un long développement.

2. "linkedin_post" — L'utilisateur veut publier un POST COURT sur LinkedIn (1 000 à 1 500 caractères, ton direct et professionnel, hashtags).
   Indices : mots-clés "post", "LinkedIn", "publier", "actu", idée rapide à partager, annonce, retour d'expérience court, mise à jour.

3. "unknown" — L'intention n'est pas claire ou ne correspond ni à un article ni à un post LinkedIn.

━━━ INSTRUCTIONS ━━━

Si workflow = "article" :
  → Extrais et reformule proprement le sujet principal en français (sans les formules du type "génère un article sur…").
  → Champ "subject" : sujet clair et concis (ex. "Les obligations du donneur d'ordre dans le cadre du plan de prévention").

Si workflow = "linkedin_post" :
  → Rédige un post LinkedIn complet, professionnel et prêt à publier, en FRANÇAIS.
  → Longueur : 1 000 à 1 500 caractères (pas moins, pas plus).
  → Structure : accroche forte (1–2 lignes), développement (3–4 paragraphes courts, aérés), call-to-action discret, 3 à 5 hashtags pertinents en fin de post.
  → Ton : expert, direct, sans jargon inutile. Adapté à une audience B2B (DRH, responsables achats, directeurs juridiques, promoteurs immobiliers).
  → Champ "linkedin_text" : texte complet du post.

Réponds UNIQUEMENT avec un objet JSON valide.`;

    const result = await callGemini(ai, 'gemini-2.0-flash', prompt, {
      responseMimeType: 'application/json',
      maxOutputTokens:  2048,
      temperature:      0.3,
      responseSchema: {
        type: 'object',
        properties: {
          workflow:       { type: 'string', enum: ['article', 'linkedin_post', 'unknown'] },
          subject:        { type: 'string' },
          linkedin_text:  { type: 'string' },
          reason:         { type: 'string' },
        },
        required: ['workflow', 'reason'],
      },
    });

    const parsed = JSON.parse(result.text ?? '{}') as RouterDecision;
    if (!['article', 'linkedin_post', 'unknown'].includes(parsed.workflow)) return fallback;

    return parsed;
  } catch {
    return fallback;
  }
}
