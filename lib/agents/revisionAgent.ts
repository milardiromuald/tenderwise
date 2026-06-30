import { GoogleGenAI } from '@google/genai';
import { getGeminiKey } from '../encrypt';
import { getSetting } from '../settings';
import { callGemini } from '../geminiCall';
import type { GeneratedArticle } from '../articleGen';
import type { AgentContext, ArticleScore } from './context';

// Seuil d'approbation (sur 100). En dessous, l'article repart en réécriture
// (jusqu'à maxRetries), puis est approuvé de force avec une alerte qualité.
const APPROVAL_THRESHOLD = 70;

export async function revisionAgent(ctx: AgentContext): Promise<void> {
  const start   = Date.now();
  const attempt = ctx.retryCount + 1;

  if (!ctx.articleBrut) {
    ctx.steps.push({ agent: 'reviseur', ok: false, attempt, durationMs: 0, detail: 'Aucun article à réviser' });
    return;
  }

  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) throw new Error('Clé API non configurée');

    // Modèle : réglage spécifique de l'agent > modèle global (Configuration IA) > défaut.
    const [perAgent, globalModel] = await Promise.all([
      getSetting('ai_reviseur_model', ''),
      getSetting('ai_article_model',  ''),
    ]);
    const modelId = perAgent || globalModel || 'gemini-2.5-flash';
    const ai      = new GoogleGenAI({ apiKey });

    // Rapport de liens formaté pour le prompt
    const linksSection = (() => {
      if (!ctx.linksReport || ctx.linksReport.length === 0) return 'Aucun lien dans l\'article.';
      return ctx.linksReport.map(l => {
        let status: string;
        if (l.status === 'broken') {
          status = `❌ HTTP ${l.httpCode ?? '?'} — lien cassé`;
        } else if (l.status === 'unverifiable') {
          status = '⚠️ Non vérifiable (timeout ou accès bloqué) — à conserver tel quel';
        } else if (!l.foundInPage) {
          status = '❌ Page accessible mais référence introuvable dans le contenu';
        } else {
          status = '✅ Confirmé';
        }
        return `• [${l.anchor}](${l.url}) → ${status}`;
      }).join('\n');
    })();

    // Lecture INTÉGRALE de l'article (la fin était auparavant tronquée à 8 000 car.,
    // ce qui laissait passer des secondes moitiés faibles). Borne haute de sécurité
    // très large pour couvrir tout article réaliste sans risque de débordement.
    const FULL_REVIEW_CAP = 24000;
    const contentPreview = ctx.articleBrut.contenu.slice(0, FULL_REVIEW_CAP);

    const prompt = `Tu es un réviseur expert. Ta mission : évaluer et corriger cet article en restant STRICTEMENT FIDÈLE aux directives éditoriales qui ont guidé sa rédaction.

════ DIRECTIVES ÉDITORIALES — RÉFÉRENCE ABSOLUE ════
${ctx.masterPrompt}
════════════════════════════════════════════════════
Ces directives sont la loi. Tes corrections ne doivent JAMAIS aller à leur encontre.
Si l'article applique une directive (ton, structure, style, appel à l'action…), conserve-la — ne la "corrige" pas.

═══════ ARTICLE À RÉVISER ═══════
Titre : ${ctx.articleBrut.titre}
Extrait : ${ctx.articleBrut.extrait}
Meta title : ${ctx.articleBrut.meta_title}
Meta description : ${ctx.articleBrut.meta_description}
Mots-clés : ${ctx.articleBrut.meta_keywords}

Contenu (Markdown) :
${contentPreview}
${ctx.articleBrut.contenu.length > FULL_REVIEW_CAP ? '\n[... fin du contenu tronquée (article exceptionnellement long) ...]' : ''}

═══════ RAPPORT DES LIENS ═══════
${linksSection}

═══════ GRILLE D'ÉVALUATION ═══════
Note chaque critère de 0 à 20 avec exigence. Le total sera ramené à /100.

1. RESPECT DU PROMPT SYSTÈME /20 (critère prioritaire)
   - L'article applique le ton, le style, l'audience et la structure définis dans les directives
   - Les éléments demandés dans les directives sont présents (ex. appel à l'action, clause de responsabilité si requis, profondeur demandée…)
   - Aucun élément imposé par les directives n'a été omis ou contredit
   - Note 20/20 si toutes les directives sont respectées ; descends si des éléments explicites sont manquants ou contredits

2. MISE EN FORME /20
   - Titres H2 (##) et H3 (###) présents et pertinents
   - Paragraphes courts et aérés (max 4-5 lignes), séparés par une ligne vide
   - Listes à puces avec « - » (tiret simple) uniquement — jamais de tiret cadratin « — » comme puce ou séparateur
   - Aucun bloc de texte monolithique (plus de 6 lignes sans séparation)
   - Mise en gras des termes clés

3. COHÉRENCE /20
   - Introduction pose clairement le problème et annonce le plan
   - Développement logique et progressif, transitions entre les parties
   - Conclusion synthétise et ouvre une perspective
   - Aucune contradiction interne

4. LIENS /20
   - Tous les liens ❌ doivent être retirés (garde le texte d'ancre en **gras**)
   - Les liens ⚠️ sont conservés tels quels ; les liens ✅ sont conservés
   - Si aucun lien : note maximale si le sujet n'exige pas de références externes

5. SEO /20
   - meta_title : 50-60 caractères, mot-clé principal en début
   - meta_description : 150-160 caractères, incite au clic, inclut le mot-clé principal
   - Mots-clés naturellement intégrés dans le contenu (pas de bourrage)

6. COMPLÉTUDE & TRAME « SAUVETAGE » /20
   - L'accroche valide la douleur du lecteur et casse un mythe ; le cadre légal, les conséquences réelles, la solution pas-à-pas, l'erreur à éviter et la réassurance sont tous présents et s'enchaînent
   - Sujet traité en profondeur, faits/chiffres concrets et sourcés
   - L'appel à l'action et la mention informative finale sont présents
   - Toutes les questions implicites du lecteur trouvent une réponse

═══════ INSTRUCTIONS DE CORRECTION ═══════
• PRIORITÉ ABSOLUE : tes corrections doivent renforcer le respect des directives éditoriales, jamais le diminuer
• Ne change PAS ce qui était intentionnel selon les directives (ton, structure demandée, appel à l'action, clause de responsabilité…)
• Liens : remplace TOUS les liens ❌ par **Texte d'ancre** (sans URL). Ne fabrique jamais d'URL d'article précis ; en cas de doute, cite la référence en **gras** sans lien. (Un nettoyage automatique retirera de toute façon les liens non vérifiés — privilégie donc le gras.)
• Références légales : toute citation doit nommer son code ou sa source. Corrige les numéros nus : « article 221-6 » → « **article 221-6 du Code pénal** », « article R4511-1 » → « **article R4511-1 du Code du travail** ».
• Corrige la mise en forme : ajoute des ## si absents, aère les paragraphes, remplace les tirets cadratins « — » comme puces par « - »
• Améliore la meta_title (50-60 car.) et meta_description (150-160 car.) si les longueurs ne sont pas respectées
• image_title : 2-4 mots en MAJUSCULES qui NOMMENT le sujet précis (jamais un mot générique seul comme « CONFORMITÉ » ou « SÉCURITÉ »). image_subtitle : 4-7 mots accrocheurs posant l'enjeu, sans ponctuation finale. Corrige-les s'ils sont génériques.
• L'appel à l'action final : un paragraphe professionnel (2 à 3 phrases) rappelant le bénéfice + invitant à contacter « TenderWise » (un seul mot) pour une analyse personnalisée, avec urgence douce et réassurance (« sans engagement »). Sobre, pas de liste, jamais grandiloquent.
• Mention informative : vérifie qu'UNE phrase, juste après le CTA, précise que l'article est informatif et ne remplace pas un conseil juridique adapté. Ajoute-la si elle manque ; ne la transforme pas en section.
• Le contenu corrigé doit rester en MARKDOWN (pas de HTML)

Réponds UNIQUEMENT avec un objet JSON valide.`;

    const result = await callGemini(ai, modelId, prompt, {
        responseMimeType: 'application/json',
        maxOutputTokens: 16384,
        responseSchema: {
          type: 'object',
          properties: {
            promptRespect: { type: 'integer' },
            misEnForme:    { type: 'integer' },
            coherence:     { type: 'integer' },
            liens:         { type: 'integer' },
            seo:           { type: 'integer' },
            completude:    { type: 'integer' },
            feedback:      { type: 'string' },
            corrections:   { type: 'array', items: { type: 'string' } },
            article_corrige: {
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
          },
          required: ['promptRespect', 'misEnForme', 'coherence', 'liens', 'seo', 'completude',
                     'feedback', 'corrections', 'article_corrige'],
        },
    }, 'reviseur');

    const tIn  = result.usageMetadata?.promptTokenCount     ?? 0;
    const tOut = result.usageMetadata?.candidatesTokenCount ?? 0;
    ctx.tokensIn  += tIn;
    ctx.tokensOut += tOut;

    const parsed = JSON.parse(result.text ?? '{}');

    const clamp = (v: unknown) => Math.min(20, Math.max(0, (v as number) ?? 0));
    const promptRespect = clamp(parsed.promptRespect);
    const misEnForme    = clamp(parsed.misEnForme);
    const coherence     = clamp(parsed.coherence);
    const liens         = clamp(parsed.liens);
    const seo           = clamp(parsed.seo);
    const completude    = clamp(parsed.completude);
    // 6 critères /20 → moyenne × 5 = total /100
    const total = Math.round((promptRespect + misEnForme + coherence + liens + seo + completude) / 6 * 5);

    const isLastAttempt = ctx.retryCount >= ctx.maxRetries;
    const verdict: ArticleScore['verdict'] =
      total >= APPROVAL_THRESHOLD ? 'approuve' : isLastAttempt ? 'force_approuve' : 'retry';

    ctx.finalScore = {
      promptRespect, misEnForme, coherence, liens, seo, completude, total,
      verdict,
      feedback:    parsed.feedback    ?? '',
      corrections: parsed.corrections ?? [],
    };

    // Article corrigé (encore en Markdown — converti en HTML par l'orchestrateur)
    ctx.articleFinal = parsed.article_corrige as GeneratedArticle;

    // Prépare le feedback pour la prochaine tentative si retry
    if (verdict === 'retry') {
      const scoreDetails =
        `Score global : ${total}/100\n` +
        `• Respect du prompt système : ${promptRespect}/20\n` +
        `• Mise en forme : ${misEnForme}/20\n` +
        `• Cohérence : ${coherence}/20\n` +
        `• Liens : ${liens}/20\n` +
        `• SEO : ${seo}/20\n` +
        `• Complétude : ${completude}/20\n\n` +
        `Problèmes identifiés :\n${parsed.feedback}\n\n` +
        `Corrections obligatoires (sans contredire les directives éditoriales) :\n${(parsed.corrections as string[] ?? []).map((c: string) => `→ ${c}`).join('\n')}`;
      ctx.revisionFeedbacks.push(scoreDetails);
    }

    ctx.steps.push({
      agent:      'reviseur',
      ok:         true,
      attempt,
      durationMs: Date.now() - start,
      tokensUsed: tIn + tOut,
      detail: verdict === 'approuve'
        ? `Score ${total}/100 — approuvé ✅`
        : verdict === 'force_approuve'
          ? `Score ${total}/100 — forcé après ${attempt} tentative(s) ⚠️`
          : `Score ${total}/100 — retry requis`,
    });

  } catch (e) {
    // En cas d'erreur du réviseur : on utilise l'article brut tel quel ET on pose un
    // verdict terminal. Sans cela, finalScore resterait absent et la boucle du pipeline
    // pourrait tourner indéfiniment (verdict jamais « approuve »/« force_approuve »).
    ctx.articleFinal = ctx.articleBrut;
    ctx.finalScore = {
      promptRespect: 0, misEnForme: 0, coherence: 0, liens: 0, seo: 0, completude: 0, total: 0,
      verdict: 'force_approuve',
      feedback: `Révision indisponible (erreur technique) : ${e instanceof Error ? e.message : String(e)}. Article conservé tel quel — à vérifier avant publication.`,
      corrections: [],
    };
    ctx.steps.push({
      agent:      'reviseur',
      ok:         false,
      attempt,
      durationMs: Date.now() - start,
      detail:     e instanceof Error ? e.message : String(e),
    });
  }
}
