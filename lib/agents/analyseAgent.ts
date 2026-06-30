import { GoogleGenAI } from '@google/genai';
import { getGeminiKey } from '../encrypt';
import { getSetting } from '../settings';
import { callGemini } from '../geminiCall';
import type { AgentContext, AnalyseResult } from './context';

export async function analyseAgent(ctx: AgentContext): Promise<void> {
  const start = Date.now();
  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) throw new Error('Clé API non configurée');

    // Modèle : réglage spécifique de l'agent > modèle global (Configuration IA) > défaut.
    const [perAgent, globalModel] = await Promise.all([
      getSetting('ai_analyste_model', ''),
      getSetting('ai_article_model', ''),
    ]);
    const modelId = perAgent || globalModel || 'gemini-3.1-flash-lite';
    const ai = new GoogleGenAI({ apiKey });

    const { sujet, categorie, motsCles } = ctx.input;

    const prompt = `Tu es un stratège éditorial B2B. Ton rôle est de préparer une analyse qui guidera la rédaction d'un article CONFORME aux directives éditoriales ci-dessous.

════ DIRECTIVES ÉDITORIALES (source de vérité) ════
${ctx.masterPrompt}
════════════════════════════════════════════════════

Sujet à analyser : "${sujet}"
${categorie ? `Catégorie : ${categorie}` : ''}
${motsCles  ? `Mots-clés fournis : ${motsCles}` : ''}

ÉTAPE 1 — CHOISIS LE REGISTRE éditorial le plus juste pour CE sujet. Règle d'or : n'oriente JAMAIS un article vers la responsabilité pénale du dirigeant si le sujet ne l'exige pas réellement. La peur n'est jamais un angle par défaut.
• "informatif" : expliquer une nouveauté réglementaire, un dispositif, des chiffres, une tendance. Ton neutre et utile. → REGISTRE PAR DÉFAUT (dans le doute, choisis-le).
• "pratique" : guider sur une méthode ou des bonnes pratiques (comment faire, étapes, leviers). Centré solution.
• "enjeu_juridique" : RÉSERVÉ aux sujets dont le cœur EST réellement la responsabilité, une sanction ou une jurisprudence marquante. À n'utiliser QUE si le risque juridique est le sujet lui-même, pas un prétexte ajouté.

ÉTAPE 2 — produis l'analyse cohérente avec le registre choisi :
1. registre : "informatif" | "pratique" | "enjeu_juridique" (le choix de l'étape 1)
2. angle : l'angle éditorial le plus pertinent POUR CE REGISTRE (informe ou aide concrètement ; n'invente pas un risque pénal absent du sujet)
3. points_cles : les 5 points clés à couvrir en priorité
4. lois_a_citer : les références légales pertinentes — textuelles uniquement, sans inventer d'URLs (peut être vide si le sujet n'est pas juridique)
5. mots_cles_seo : 6 mots-clés SEO prioritaires (longue traîne incluse)
6. public_cible : le public cible global
7. persona : QUI est précisément le lecteur (fonction, contexte)
8. situation : sa situation concrète typique
9. enjeux : 2 à 4 enjeux ou bénéfices CONCRETS pour le lecteur. Ne mentionne des conséquences pénales / sanctions QUE si registre = "enjeu_juridique" ET qu'elles sont réellement centrales ; sinon, enjeux opérationnels, financiers, techniques ou de qualité.
10. idee_recue : UNE idée reçue à nuancer SI elle existe vraiment pour ce sujet, sinon chaîne vide. N'invente pas de mythe pour avoir un « ennemi ».
11. besoin_reel : son besoin profond (comprendre, décider, agir, sécuriser selon le cas)

Réponds UNIQUEMENT avec un objet JSON valide.`;

    const result = await callGemini(ai, modelId, prompt, {
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
        responseSchema: {
          type: 'object',
          properties: {
            registre:      { type: 'string', enum: ['informatif', 'pratique', 'enjeu_juridique'] },
            angle:         { type: 'string' },
            points_cles:   { type: 'array', items: { type: 'string' } },
            lois_a_citer:  { type: 'array', items: { type: 'string' } },
            mots_cles_seo: { type: 'array', items: { type: 'string' } },
            public_cible:  { type: 'string' },
            persona:       { type: 'string' },
            situation:     { type: 'string' },
            enjeux:        { type: 'array', items: { type: 'string' } },
            idee_recue:    { type: 'string' },
            besoin_reel:   { type: 'string' },
          },
          required: ['registre', 'angle', 'points_cles', 'lois_a_citer', 'mots_cles_seo', 'public_cible',
                     'persona', 'situation', 'enjeux', 'idee_recue', 'besoin_reel'],
        },
    });

    const tIn  = result.usageMetadata?.promptTokenCount     ?? 0;
    const tOut = result.usageMetadata?.candidatesTokenCount ?? 0;
    ctx.tokensIn  += tIn;
    ctx.tokensOut += tOut;

    ctx.analyse = JSON.parse(result.text ?? '{}') as AnalyseResult;

    ctx.steps.push({
      agent:      'analyste',
      ok:         true,
      durationMs: Date.now() - start,
      tokensUsed: tIn + tOut,
      detail:     `Angle : ${ctx.analyse.angle.slice(0, 80)}`,
    });
  } catch (e) {
    // Non bloquant : la rédaction continue sans analyse préalable
    ctx.steps.push({
      agent:      'analyste',
      ok:         false,
      durationMs: Date.now() - start,
      detail:     e instanceof Error ? e.message : String(e),
    });
  }
}
