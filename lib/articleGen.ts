export interface ArticleInput {
  sujet: string;
  categorie?: string;
  ton?: string;
  longueur?: string;
  langue?: string;
  motsCles?: string;
}

export interface GeneratedArticle {
  titre: string;
  extrait: string;
  contenu: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  temps_lecture: number;
  categorie: string;
  /** Catégories supplémentaires (secondaires) issues de la liste disponible. */
  categories?: string[];
  /** Titre court et accrocheur destiné à être incrusté sur l’image d’en-tête. */
  image_title: string;
  /** Sous-titre court destiné à l’image d’en-tête. */
  image_subtitle: string;
}

export function parseGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const statusMatch = raw.match(/\[(\d{3})\s/);
  const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
  const retryMatch = raw.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  const retry = retryMatch ? parseInt(retryMatch[1]) : null;
  if (status === 429) {
    if (raw.includes('limit: 0')) return 'Quota = 0 : activez "Generative Language API" sur console.cloud.google.com ou créez une nouvelle clé sur aistudio.google.com';
    return `Quota dépassé${retry ? ` — réessayez dans ${retry}s` : ''}. Vérifiez vos limites sur aistudio.google.com`;
  }
  if (status === 404) return 'Modèle non disponible — vérifiez le modèle sélectionné dans Configuration IA';
  if (status === 403) return 'Clé API invalide ou révoquée';
  return raw.replace(/\[\{[\s\S]*?\}\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'Erreur Gemini inconnue';
}

