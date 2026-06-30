export interface StepLog { name: string; ok: boolean; detail?: string }

export interface ReviewQuality { reviewDetail: string; reviewOk: boolean; linksDetail: string }

/**
 * Extrait le verdict du Réviseur IA (score /100) et le résumé du vérificateur
 * de liens depuis steps_log, pour les afficher au relecteur humain — jusqu'ici
 * calculés par le pipeline mais invisibles sur les pages de validation.
 */
export function extractQuality(stepsLogRaw: string | null): ReviewQuality | null {
  if (!stepsLogRaw) return null;
  try {
    const steps = JSON.parse(stepsLogRaw) as StepLog[];
    if (!Array.isArray(steps) || steps.length === 0) return null;
    // En cas de plusieurs tentatives (retry), on prend la dernière occurrence de chaque étape.
    const reviewStep = [...steps].reverse().find((s) => s.name === 'reviseur');
    const linksStep  = [...steps].reverse().find((s) => s.name === 'link-checker');
    if (!reviewStep?.detail) return null;
    return { reviewDetail: reviewStep.detail, reviewOk: reviewStep.ok, linksDetail: linksStep?.detail || '' };
  } catch { return null; }
}
