import { GoogleGenAI } from '@google/genai';
import { getGeminiKey } from '../encrypt';
import { getSetting } from '../settings';
import { callGemini } from '../geminiCall';
import type { GeneratedArticle } from '../articleGen';
import type { AgentContext } from './context';

const longueurMap: Record<string, string> = {
  court: 'court (400 à 600 mots)',
  moyen: 'moyen (800 à 1200 mots)',
  long:  'long (1500 à 2500 mots)',
};

const tonMap: Record<string, string> = {
  professionnel: 'professionnel et expert',
  pedagogique:   'pédagogique et accessible',
  informatif:    'informatif et factuel',
  technique:     'technique et détaillé',
  marketing:     'engageant et orienté conversion',
};

export async function redactionAgent(ctx: AgentContext): Promise<void> {
  const start   = Date.now();
  const attempt = ctx.retryCount + 1;

  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) throw new Error('Clé API non configurée');

    // Modèle : réglage spécifique de l'agent > modèle global (Configuration IA) > défaut.
    const [perAgent, globalModel, maxOutputTokensRaw] = await Promise.all([
      getSetting('ai_redacteur_model',   ''),
      getSetting('ai_article_model',     ''),
      getSetting('ai_max_output_tokens', '32768'),
    ]);
    const modelId = perAgent || globalModel || 'gemini-2.5-flash';

    const maxOutputTokens = Math.min(65536, Math.max(4096, parseInt(maxOutputTokensRaw, 10) || 32768));
    // Le prompt est chargé une seule fois par le pipeline et stocké dans ctx.masterPrompt.
    const masterPrompt = ctx.masterPrompt;

    const { sujet, categorie, motsCles, ton, longueur, langue } = ctx.input;
    const langueLabel   = langue   === 'en' ? 'anglais' : 'français';
    const longueurLabel = longueurMap[longueur ?? ''] || longueurMap.moyen;
    const tonLabel      = tonMap[ton ?? '']           || tonMap.professionnel;

    // Liste des catégories disponibles sur le site
    const categoriesSection = ctx.availableCategories.length > 0
      ? `\nCatégories disponibles (choisis UNIQUEMENT parmi cette liste) :\n${ctx.availableCategories.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`
      : '';

    const runtimeContext = [
      `Sujet : ${sujet}`,
      categorie ? `Catégorie forcée : ${categorie}` : '',
      motsCles  ? `Mots-clés prioritaires : ${motsCles}` : '',
      ton       ? `Ton : ${tonLabel}` : '',
      longueur  ? `Longueur : ${longueurLabel}` : '',
      `Langue : ${langueLabel}`,
      categoriesSection,
    ].filter(Boolean).join('\n');

    // Recherche ancrée (faits réels + sources vérifiées) — prioritaire pour le factuel
    const researchSection = ctx.research?.brief ? `
────────
RECHERCHE FACTUELLE (faits réels vérifiés par recherche Google — APPUIE-TOI dessus, ne les contredis pas, ne les complète pas par des chiffres inventés) :
${ctx.research.brief}

SOURCES AUTORISÉES POUR LES LIENS — tu ne peux insérer un lien Markdown QUE vers l'une de ces URLs, copiée EXACTEMENT. Toute autre URL est interdite (cite alors la référence en **gras** sans lien). Utilise un libellé de lien descriptif (le nom de la source), pas un numéro d'article.
${ctx.research.sources.length > 0
  ? ctx.research.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join('\n')
  : 'Aucune source vérifiée : n\'insère AUCUN lien, cite tout en gras.'}` : '';

    // Registre éditorial : calibre le ton pour ne pas tout orienter vers le pénal.
    const registreConsignes: Record<string, string> = {
      informatif: "INFORMATIF — explique clairement et utilement (ton neutre, posé). N'introduis AUCUNE section sur les sanctions/peines pénales, aucune dramatisation, aucune accroche anxiogène. Objectif : le lecteur comprend et retient l'essentiel, et te perçoit comme un expert fiable.",
      pratique:   "PRATIQUE — guide le lecteur (méthode, étapes, bonnes pratiques, leviers). Centré solution. Mentionne les enjeux de façon sobre et factuelle, sans en faire un argument de peur.",
      enjeu_juridique: "ENJEU JURIDIQUE — ici la responsabilité ou la sanction est réellement le cœur du sujet : tu peux développer le cadre légal et les conséquences, mais de manière FACTUELLE et mesurée. Jamais sur le registre « éviter la prison » ou la menace personnelle.",
    };
    const registre = ctx.analyse?.registre || 'informatif';

    // Contexte enrichi par l'Agent 1 (si disponible)
    const analyseSection = ctx.analyse ? `
────────
Analyse préalable — utilise-la pour orienter la rédaction :
• REGISTRE ÉDITORIAL (impératif) : ${registreConsignes[registre] || registreConsignes.informatif}
• Angle éditorial : ${ctx.analyse.angle}
• Persona (à qui tu écris) : ${ctx.analyse.persona || ctx.analyse.public_cible}
• Sa situation concrète : ${ctx.analyse.situation || '—'}
• Enjeux / bénéfices à adresser : ${(ctx.analyse.enjeux || []).join(' | ') || '—'}
• Idée reçue à nuancer (seulement si réellement pertinente) : ${ctx.analyse.idee_recue || '—'}
• Son besoin profond (à combler avant le CTA) : ${ctx.analyse.besoin_reel || '—'}
• Points clés à couvrir : ${ctx.analyse.points_cles.join(' | ')}
• Références légales pertinentes : ${ctx.analyse.lois_a_citer.join(', ') || 'aucune identifiée'}
• Mots-clés SEO : ${ctx.analyse.mots_cles_seo.join(', ')}` : '';

    // Feedback de révision si tentative > 1
    const feedbackSection = ctx.revisionFeedbacks.length > 0 ? `
────────
⚠️ CORRECTIONS OBLIGATOIRES — TENTATIVE ${attempt} :
L'article précédent a été rejeté (score insuffisant). Corrige IMPÉRATIVEMENT les points suivants :
${ctx.revisionFeedbacks[ctx.revisionFeedbacks.length - 1]}` : '';

    const prompt = `${masterPrompt}
${researchSection}
${analyseSection}
────────
Paramètres de cette génération :
${runtimeContext}
${feedbackSection}
────────
FORMAT DE SORTIE TECHNIQUE — réponds UNIQUEMENT avec un objet JSON valide (respecte strictement les directives éditoriales ci-dessus pour le contenu) :
{
  "titre": "RÈGLE ABSOLUE : ce titre NE DOIT PAS contenir de deux-points. Ni un seul. Si votre titre contient ':', recommencez. Le format interdit ressemble à 'Le Plan de Prévention : pourquoi...', 'Les sanctions : quand...', 'Décret 92 : comment...'. Ces formulations sont REFUSÉES. Écrivez plutôt une phrase directe affirmative ou interrogative ADAPTÉE AU REGISTRE. N'oriente pas le titre vers la peur ou la prison si le registre n'est pas « enjeu juridique ». Exemples selon le registre : informatif → 'Ce que la RE2020 change pour les bâtiments tertiaires', pratique → 'Comment organiser un chantier pendant une canicule', enjeu juridique → 'Ce que le donneur d'ordre reste tenu de vérifier'.",
  "extrait": "Résumé court, 1-2 phrases, max 200 caractères",
  "contenu": "Corps complet de l'article en Markdown. ADAPTE LA STRUCTURE AU REGISTRE ÉDITORIAL indiqué dans l'analyse : en registre 'informatif' ou 'pratique', NE consacre AUCUNE section aux sanctions/peines pénales et n'adopte JAMAIS un ton anxiogène — structure : accroche concrète et utile → explication claire (cadre, dispositif, chiffres) → application pratique ou méthode pas-à-pas → un point de vigilance utile → appel à l'action → mention informative. En registre 'enjeu juridique' UNIQUEMENT, tu peux développer le cadre légal puis les conséquences (peines, amendes, responsabilité) de façon factuelle et mesurée. Dans tous les cas : empathique, réaliste, jamais alarmiste. RÈGLE ABSOLUE : aucun titre ## ou ### ne doit contenir de deux-points ; si un titre en contient, reformulez. N'écris pas les intitulés des étapes, ne numérote pas. Ne répète pas le titre principal. RÉFÉRENCES LÉGALES — chaque article, décret ou loi cité doit être IDENTIFIÉ COMPLÈTEMENT avec son code ou sa source, ex. 'article 221-6 du Code pénal', 'article R4511-1 du Code du travail', 'décret n° 92-158 du 20 février 1992'. JAMAIS un numéro nu comme 'article 221-6' sans préciser de quel code il relève ; mets ces références en **gras**. LIENS — ne fabrique JAMAIS l'URL d'un article précis (elles sont presque toujours fausses et créent des liens cassés) ; n'ajoute un lien que vers une source réelle vérifiée des SOURCES AUTORISÉES fournies, sinon pas de lien, la référence en gras suffit. APPEL À L'ACTION — un paragraphe professionnel (2 à 3 phrases) : bénéfice concret + invitation à contacter 'TenderWise' (toujours en un seul mot, jamais 'Tender Wise') pour une analyse personnalisée, urgence douce et réassurance ('sans engagement') ; sobre, pas de liste, pas de formule grandiloquente. MENTION INFORMATIVE — juste après le CTA, UNE seule phrase précisant que l'article est informatif et ne remplace pas un conseil juridique adapté (pas de section dédiée).",
  "meta_title": "50-60 caractères, mot-clé principal au début",
  "meta_description": "150-160 caractères, incite au clic",
  "meta_keywords": "mot1, mot2, mot3, mot4, mot5",
  "temps_lecture": 5,
  "categorie": "Catégorie principale — exactement l'une des catégories de la liste fournie (respecte la casse).",
  "categories": ["catégorie principale", "catégorie secondaire si pertinente"] — 1 à 2 catégories de la liste fournie uniquement.,
  "image_title": "2 à 4 mots, 30 caractères MAX, en MAJUSCULES. Doit NOMMER PRÉCISÉMENT le sujet de l'article (le dispositif, le texte ou la notion concrète), ex. 'PLAN DE PRÉVENTION', 'DÉCRET 92-158', 'HOMICIDE INVOLONTAIRE'. INTERDIT : un mot générique seul qui ne dit pas de quoi parle l'article, comme 'CONFORMITÉ', 'SÉCURITÉ', 'RÉGLEMENTATION' ou 'JURIDIQUE'.",
  "image_subtitle": "4 à 7 mots, 55 caractères MAX, sans ponctuation finale. Accrocheur : pose l'enjeu ou le risque concret pour le lecteur, ex. 'Qui est responsable en cas d'accident', 'Ce que le dirigeant ne peut plus ignorer'. Complète le titre sans le répéter."
}`;

    const ai = new GoogleGenAI({ apiKey });
    const result = await callGemini(ai, modelId, prompt, {
        responseMimeType: 'application/json',
        maxOutputTokens,
        temperature: 0.75,
        responseSchema: {
          type: 'object',
          properties: {
            titre:            { type: 'string' },
            extrait:          { type: 'string' },
            contenu:          { type: 'string' },
            meta_title:       { type: 'string' },
            meta_description: { type: 'string' },
            meta_keywords:    { type: 'string' },
            temps_lecture:    { type: 'integer' },
            categorie:        { type: 'string' },
            categories:       { type: 'array', items: { type: 'string' } },
            image_title:      { type: 'string' },
            image_subtitle:   { type: 'string' },
          },
          required: ['titre', 'extrait', 'contenu', 'meta_title', 'meta_description',
                     'meta_keywords', 'temps_lecture', 'categorie', 'categories',
                     'image_title', 'image_subtitle'],
        },
    }, 'redacteur');

    const finishReason = result.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      throw new Error(`Article incomplet (${finishReason}) — réessayez ou ajustez la longueur`);
    }

    const tIn  = result.usageMetadata?.promptTokenCount     ?? 0;
    const tOut = result.usageMetadata?.candidatesTokenCount ?? 0;
    ctx.tokensIn  += tIn;
    ctx.tokensOut += tOut;

    // Contenu conservé en Markdown — la conversion HTML se fait à la fin du pipeline
    ctx.articleBrut = JSON.parse(result.text ?? '{}') as GeneratedArticle;

    ctx.steps.push({
      agent:      'redacteur',
      ok:         true,
      attempt,
      durationMs: Date.now() - start,
      tokensUsed: tIn + tOut,
      detail:     attempt > 1 ? `Réécriture (tentative ${attempt})` : undefined,
    });
  } catch (e) {
    ctx.steps.push({
      agent:      'redacteur',
      ok:         false,
      attempt,
      durationMs: Date.now() - start,
      detail:     e instanceof Error ? e.message : String(e),
    });
    throw e; // Bloquant : pas d'article = impossible de continuer
  }
}
