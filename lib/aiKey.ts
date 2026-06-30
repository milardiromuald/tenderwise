import { GoogleGenAI } from '@google/genai';

// Détection automatique des capacités d’une clé Gemini à l’enregistrement :
//  • quels modèles d’article sont réellement accessibles,
//  • s’agit-il d’une clé GRATUITE ou PAYANTE (facturation activée).
// Permet d’adapter l’interface Configuration IA en conséquence.

export const ARTICLE_MODEL_CANDIDATES = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export type KeyTier = 'free' | 'paid' | 'unknown';

export interface KeyDetection {
  valid: boolean;
  tier: KeyTier;
  models: string[];   // modèles d’article accessibles avec cette clé
  error?: string;
}

function cleanErr(raw: string): string {
  return raw
    .replace(/\[\{[\s\S]*?\}\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'Clé invalide ou inaccessible';
}

/**
 * Sonde une clé : modèles texte accessibles + tier (gratuit/payant).
 * Le tier est déduit de l’accès à Imagen (facturation requise) : sur une clé
 * gratuite l’appel échoue AVANT toute génération (aucun coût) ; sur une clé
 * payante une petite image est générée une seule fois (coût négligeable).
 */
export async function detectKeyTier(apiKey: string): Promise<KeyDetection> {
  if (!apiKey?.trim()) return { valid: false, tier: 'unknown', models: [] };
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  // 1) Modèles d’article réellement accessibles (petites sondes).
  const models: string[] = [];
  let firstError = '';
  for (const m of ARTICLE_MODEL_CANDIDATES) {
    try {
      await ai.models.generateContent({ model: m, contents: 'OK' });
      models.push(m);
    } catch (e) {
      if (!firstError) firstError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!models.length) return { valid: false, tier: 'unknown', models: [], error: cleanErr(firstError) };

  // 2) Tier : tentative Imagen (payant). Échec → gratuit (sans coût).
  let tier: KeyTier = 'free';
  try {
    const res = await ai.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt: 'a small blue dot on white background',
      config: { numberOfImages: 1 },
    });
    tier = (res?.generatedImages?.length ?? 0) > 0 ? 'paid' : 'free';
  } catch {
    tier = 'free';
  }

  return { valid: true, tier, models };
}
