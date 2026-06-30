import { GoogleGenAI } from '@google/genai';

/**
 * Modèles gratuits Gemini, par ordre de préférence décroissante.
 * Quand un modèle retourne 429 (quota dépassé), on passe automatiquement au suivant.
 */
const FREE_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',   // meilleur quota gratuit (500 RPD)
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
];

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

/**
 * Modèle invalide, décommissionné, inaccessible ou temporairement surchargé.
 * On bascule sur le modèle suivant plutôt que d'échouer durement.
 * Couvre : 404 (not found), 503 (unavailable / high demand / overloaded).
 */
function isModelUnavailableError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /\b404\b/.test(msg) || msg.includes('not_found') || msg.includes('not found')
    || msg.includes('is not supported') || msg.includes('not supported')
    || msg.includes('does not exist')
    || /\b503\b/.test(msg) || msg.includes('unavailable') || msg.includes('overloaded')
    || msg.includes('high demand');
}

/**
 * Appelle Gemini avec fallback automatique sur les modèles gratuits.
 * Le modèle principal (depuis les réglages) est essayé en premier ; s'il est en
 * quota épuisé (429) OU invalide/indisponible (404), on tente les suivants dans
 * FREE_MODEL_CHAIN. Toute autre erreur est remontée immédiatement.
 */
export async function callGemini(
  ai: GoogleGenAI,
  primaryModel: string,
  contents: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>,
) {
  // Chaîne : modèle principal d'abord, puis fallbacks (sans doublon)
  const chain = [primaryModel, ...FREE_MODEL_CHAIN.filter(m => m !== primaryModel)];

  let lastErr: unknown;
  for (const model of chain) {
    try {
      return await ai.models.generateContent({ model, contents, config });
    } catch (err) {
      if (isQuotaError(err) || isModelUnavailableError(err)) {
        lastErr = err;
        // Quota épuisé ou modèle indisponible → on tente le suivant
        continue;
      }
      throw err; // Toute autre erreur est remontée immédiatement
    }
  }

  // Tous les modèles de la chaîne ont échoué (quota épuisé ou indisponibles)
  throw lastErr;
}
