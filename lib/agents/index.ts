import { articleContentToHtml } from '../markdown';
import { incrementSetting, setSetting, getSetting } from '../settings';
import { DEFAULT_ARTICLE_PROMPT } from '../defaultPrompts';
import type { ArticleInput } from '../articleGen';
import { createContext, type AgentContext } from './context';
import { researchAgent }  from './researchAgent';
import { analyseAgent }   from './analyseAgent';
import { redactionAgent } from './redactionAgent';
import { checkLinks }     from './linkChecker';
import { revisionAgent }  from './revisionAgent';

export type { AgentContext };
export type { ArticleScore, LinkReport, AgentStep } from './context';

const CATEGORY_DEFAULTS = ['Marchés publics', 'Actualités', 'Réglementation', 'Conseils pratiques', 'Veille juridique'];

/**
 * Garde-fou déterministe anti-lien-cassé : ne conserve QUE les liens que le
 * vérificateur HTTP a confirmés (status `ok` ET référence trouvée dans la page).
 * Tout autre lien Markdown (cassé, non vérifiable, ajouté par le Réviseur et donc
 * non vérifié, ou URL d'article hallucinée) est transformé en simple gras **ancre**.
 * On ne se repose pas sur l'IA pour ce nettoyage : il est désormais garanti.
 */
function stripUnverifiedLinks(
  markdown: string,
  report?: { url: string; status: string; foundInPage: boolean }[],
  trusted?: Set<string>,
): string {
  const byUrl = new Map((report ?? []).map(r => [r.url.trim(), r]));
  const trustedSet = trusted ?? new Set<string>();
  return markdown.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_m, anchor: string, url: string) => {
      const u = url.trim();
      const r = byUrl.get(u);
      // On garde un lien si le vérificateur l'a confirmé joignable (status ok) ET que
      // soit la référence a été retrouvée dans la page, soit l'URL provient d'une
      // source réelle de la recherche ancrée (de confiance). Tout le reste → gras.
      const keep = !!r && r.status === 'ok' && (r.foundInPage || trustedSet.has(u));
      return keep ? `[${anchor}](${u})` : `**${anchor.trim()}**`;
    },
  );
}

/**
 * Pipeline multi-agents :
 *   Agent 1 (Analyste) → Agent 2 (Rédacteur) → Vérificateur liens → Agent 3 (Réviseur)
 * Le cycle Rédacteur → Liens → Réviseur se répète jusqu'à 3 fois si le score est < 70/100.
 */
export async function runAgentPipeline(input: ArticleInput): Promise<AgentContext> {
  const ctx = createContext(input);

  // ── Chargement du prompt éditorial et des catégories (une seule fois) ──
  try {
    const [storedPrompt, rawCategories] = await Promise.all([
      getSetting('ai_article_prompt', ''),
      getSetting('article_categories', ''),
    ]);
    ctx.masterPrompt        = storedPrompt.trim() || DEFAULT_ARTICLE_PROMPT;
    ctx.availableCategories = rawCategories ? (JSON.parse(rawCategories) as string[]) : CATEGORY_DEFAULTS;
  } catch {
    ctx.masterPrompt        = DEFAULT_ARTICLE_PROMPT;
    ctx.availableCategories = CATEGORY_DEFAULTS;
  }

  // ── Recherche ancrée (Google Search) + Analyse — une seule fois, non bloquants ──
  // La recherche fournit des faits réels et des sources vérifiées ; l'analyse
  // structure l'angle éditorial. Les deux alimentent la rédaction.
  await researchAgent(ctx);
  await analyseAgent(ctx);

  // ── Boucle : Rédaction → Liens → Révision ──
  let approved = false;

  while (!approved) {
    // Agent 2 : Rédaction (reçoit le feedback de révision à partir de la 2ème tentative)
    await redactionAgent(ctx);

    // Vérificateur de liens HTTP (pas d'IA, 0 token)
    await checkLinks(ctx);

    // Agent 3 : Révision & notation
    await revisionAgent(ctx);

    const verdict = ctx.finalScore?.verdict;
    if (verdict === 'approuve' || verdict === 'force_approuve') {
      approved = true;
    } else if (ctx.retryCount >= ctx.maxRetries) {
      // Garde-fou anti-boucle : si le Réviseur n'a pas rendu de verdict d'approbation
      // (ex. erreur technique → finalScore absent, ou retry au-delà du maximum), on
      // arrête après maxRetries tentatives. L'article courant (articleFinal, posé même
      // en cas d'erreur du Réviseur) est conservé. Termine en au plus maxRetries+1 tours.
      approved = true;
    } else {
      ctx.retryCount++;
    }
  }

  // ── Consolidation des catégories ──
  // Si l'agent a retourné un tableau de catégories, on les fusionne en une chaîne
  // séparée par des virgules dans le champ `categorie` (backward-compat avec la DB).
  if (ctx.articleFinal) {
    const cats = ctx.articleFinal.categories;
    if (Array.isArray(cats) && cats.length > 0) {
      // Filtre : on ne garde que celles présentes dans la liste officielle
      const valid = cats
        .map(c => c.trim())
        .filter(c => ctx.availableCategories.some(a => a.toLowerCase() === c.toLowerCase()));
      if (valid.length > 0) ctx.articleFinal.categorie = valid.join(', ');
    }
  }

  // ── Nettoyage déterministe des liens, PUIS conversion Markdown → HTML ──
  if (ctx.articleFinal?.contenu) {
    const trusted = new Set((ctx.research?.sources ?? []).map(s => s.url.trim()));
    ctx.articleFinal.contenu = stripUnverifiedLinks(ctx.articleFinal.contenu, ctx.linksReport, trusted);
    ctx.articleFinal.contenu = articleContentToHtml(ctx.articleFinal.contenu);
  }

  // ── Mise à jour des compteurs d'usage ──
  await Promise.all([
    incrementSetting('ai_articles_count', 1),
    incrementSetting('ai_tokens_in',  ctx.tokensIn),
    incrementSetting('ai_tokens_out', ctx.tokensOut),
    setSetting('ai_last_generation', new Date().toISOString()),
  ]);

  return ctx;
}
