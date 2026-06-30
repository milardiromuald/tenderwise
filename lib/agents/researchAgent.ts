import { GoogleGenAI } from '@google/genai';
import { getGeminiKey } from '../encrypt';
import { getSetting } from '../settings';
import type { AgentContext, ResearchSource } from './context';

// Modèles compatibles « Ancrage de recherche Google » (Search grounding), par
// préférence décroissante. NB : sur le tier gratuit, le grounding n'est disponible
// que sur les modèles 2.x (≈1500 req/jour) — PAS sur les modèles 3.x. On n'utilise
// donc pas la chaîne de fallback générique (qui contient des modèles 3.x).
const GROUNDING_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

function isRetriable(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return m.includes('429') || m.includes('resource_exhausted') || m.includes('quota')
    || /\b404\b/.test(m) || m.includes('not found') || m.includes('not supported');
}

/** Résout au mieux une URL de redirection grounding vers son URL finale réelle. */
async function resolveUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    return res.url || url;
  } catch {
    return url;
  }
}

/**
 * Agent de RECHERCHE ANCRÉE (Google Search grounding).
 * Collecte des faits réels, chiffrés et sourcés sur le sujet, ainsi que les URLs
 * réelles des sources. Ces éléments alimentent le Rédacteur : il s'appuie sur des
 * faits vérifiés (au lieu d'halluciner) et ne peut lier que vers ces sources.
 *
 * Non bloquant : en cas d'échec (quota, grounding indisponible…), la rédaction
 * continue sans recherche, comme avant.
 */
export async function researchAgent(ctx: AgentContext): Promise<void> {
  const start = Date.now();
  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) throw new Error('Clé API non configurée');

    const configured = await getSetting('ai_research_model', '');
    const chain = configured
      ? [configured, ...GROUNDING_MODELS.filter(m => m !== configured)]
      : GROUNDING_MODELS;

    const { sujet, categorie, motsCles } = ctx.input;
    const prompt = `Tu es un documentaliste juridique B2B (droit, marchés publics, conformité). À l'aide de la recherche Google, rassemble des informations FACTUELLES, ACTUELLES et VÉRIFIABLES sur le sujet ci-dessous.

Sujet : "${sujet}"
${categorie ? `Domaine : ${categorie}` : ''}
${motsCles ? `Mots-clés : ${motsCles}` : ''}

Restitue un BRIEF FACTUEL concis, en puces, contenant UNIQUEMENT des éléments réels et sourcés :
- Textes applicables avec leur référence EXACTE et leur code (ex. « article 221-6 du Code pénal », « article R4511-1 du Code du travail », « décret n° 92-158 »).
- Chiffres clés réels : montants d'amendes, peines, seuils, dates d'entrée en vigueur (avec l'année).
- Statistiques officielles utiles (accidents, coûts, fréquence) — sources type INRS, Dares, Eurostat, Carsat, OPPBTP.
- Jurisprudence pertinente : juridiction, date, n° de pourvoi.
- Faits de contexte récents et chiffrés.

N'invente RIEN. Si une information n'est pas trouvée, ne l'inclus pas. Pas d'introduction ni de conclusion, juste les faits.`;

    const ai = new GoogleGenAI({ apiKey });

    let lastErr: unknown;
    let text = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chunks: any[] = [];
    for (const model of chain) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        });
        text = res.text ?? '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chunks = (res.candidates?.[0] as any)?.groundingMetadata?.groundingChunks ?? [];
        ctx.tokensIn  += res.usageMetadata?.promptTokenCount     ?? 0;
        ctx.tokensOut += res.usageMetadata?.candidatesTokenCount ?? 0;
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        if (isRetriable(e)) continue; // quota/404 → modèle suivant
        throw e;
      }
    }
    if (lastErr) throw lastErr;
    if (!text.trim()) throw new Error('Recherche sans résultat exploitable');

    // ── Extraction + résolution des sources réelles (URLs de grounding) ──
    const rawSources = chunks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({ title: (c?.web?.title || '').trim(), uri: (c?.web?.uri || '').trim() }))
      .filter(s => s.uri)
      .slice(0, 8);

    const resolved = await Promise.all(
      rawSources.map(async s => ({ title: s.title || 'Source', url: await resolveUrl(s.uri) })),
    );

    // Dédoublonnage par URL finale
    const seen = new Set<string>();
    const sources: ResearchSource[] = [];
    for (const s of resolved) {
      if (s.url && !seen.has(s.url)) { seen.add(s.url); sources.push(s); }
    }

    ctx.research = { brief: text.trim(), sources };

    ctx.steps.push({
      agent:      'recherche',
      ok:         true,
      durationMs: Date.now() - start,
      detail:     `Brief factuel + ${sources.length} source(s) vérifiée(s)`,
    });
  } catch (e) {
    // Non bloquant : la rédaction continue sans recherche ancrée.
    ctx.steps.push({
      agent:      'recherche',
      ok:         false,
      durationMs: Date.now() - start,
      detail:     e instanceof Error ? e.message : String(e),
    });
  }
}
