import { GoogleGenAI } from '@google/genai';
import { getGeminiKey } from '../encrypt';
import { query } from '../db';

const GROUNDING_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

function isRetriable(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    m.includes('429') || m.includes('resource_exhausted') || m.includes('quota') ||
    /\b404\b/.test(m) || m.includes('not found') || m.includes('not supported') ||
    m.includes('503') || m.includes('unavailable') || m.includes('overloaded') ||
    m.includes('high demand')
  );
}

export interface ArticleIdea {
  titre_propose: string;
  angle_editorial: string;
  sources_trouvees: string[];
  mots_cles: string;
  categorie: string;
}

/** Renvoie le premier objet JSON équilibré { … } du texte, ou null si tronqué/absent. */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null; // jamais refermé → réponse tronquée
}

/** Récupère tous les objets { … } complets (scan conscient des chaînes). */
function salvageObjects(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  // Se positionne après «"idees": [» pour ne pas confondre l'enveloppe
  // {"idees":[…]} (souvent tronquée, jamais refermée) avec une vraie idée.
  let i = 0;
  const key = text.indexOf('"idees"');
  if (key !== -1) {
    const br = text.indexOf('[', key);
    if (br !== -1) i = br + 1;
  }
  while (i < text.length && out.length < 12) {
    const objStart = text.indexOf('{', i);
    if (objStart === -1) break;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = objStart; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) { end = j; break; }
    }
    if (end === -1) break; // dernier objet tronqué → on s'arrête
    try {
      const o = JSON.parse(text.slice(objStart, end + 1));
      if (o && typeof o === 'object' && !Array.isArray(o)) out.push(o as Record<string, unknown>);
    } catch { /* objet invalide, on continue */ }
    i = end + 1;
  }
  return out;
}

/**
 * Extrait les objets « idée » d'une réponse Gemini, même si elle est entourée de
 * texte/balises ```json, dupliquée, ou TRONQUÉE (budget épuisé) — on récupère alors
 * les idées complètes. Renvoie [] si rien d'exploitable.
 */
function extractIdeas(raw: string): Record<string, unknown>[] {
  const text = raw.replace(/```(?:json)?/gi, '');

  // 1) Cas idéal : premier objet équilibré → JSON.parse → tableau .idees
  const whole = firstBalancedObject(text);
  if (whole) {
    try {
      const obj = JSON.parse(whole) as { idees?: unknown };
      if (Array.isArray(obj.idees) && obj.idees.length) {
        return obj.idees.filter(x => x && typeof x === 'object') as Record<string, unknown>[];
      }
    } catch { /* on bascule sur le sauvetage */ }
  }

  // 2) Sauvetage : réponse tronquée/dupliquée → on récupère chaque idée complète.
  //    On ignore l'objet enveloppe {"idees":[…]} en ne gardant que les objets
  //    qui ressemblent à une idée (présence de titre_propose).
  return salvageObjects(text).filter(o => 'titre_propose' in o);
}

/**
 * Agent de veille quotidienne.
 * Recherche l'actualité immobilière + jurisprudence via Google Search grounding
 * et retourne 3 idées d'articles originales, non-redondantes avec le corpus existant.
 */
export async function generateArticleIdeas(): Promise<ArticleIdea[]> {
  const apiKey = await getGeminiKey();
  if (!apiKey) throw new Error('Clé API Gemini non configurée');

  // Titres des 100 derniers articles pour le filtre anti-doublon
  const existingRows = await query<{ titre: string }>(
    `SELECT titre FROM articles ORDER BY created_at DESC LIMIT 100`,
  );
  const existingList = existingRows.length > 0
    ? existingRows.map(a => `- ${a.titre}`).join('\n')
    : '(aucun article existant)';

  const now = new Date();
  const monthYear = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const prompt = `Tu es un expert en construction, gestion de patrimoine immobilier, assistance à maîtrise d'ouvrage (AMO), facility management et maîtrise d'œuvre en France. Nous sommes en ${monthYear}.

ARTICLES DÉJÀ PUBLIÉS (ne pas reproduire ces sujets) :
${existingList}

En effectuant des recherches Google actuelles, identifie 3 sujets d'articles DIFFÉRENTS, RÉCENTS et UTILES pour un cabinet spécialisé en AMO, maîtrise d'œuvre, facility management et gestion de patrimoine bâti en France.

Domaines prioritaires (par ordre de pertinence) :
1. Réglementation chantier & sécurité : PPSPS, plans de prévention, permis feu, coordination SPS, inspection du travail, OPPBTP, Code du travail BTP
2. Assistance à maîtrise d'ouvrage (AMO) : contrats MOA/MOE, responsabilités, OPC, conduite d'opération, gestion de programme
3. Maîtrise d'œuvre : responsabilité décennale, assurance dommages-ouvrage, réception de travaux, levée de réserves, garantie de parfait achèvement
4. Marchés privés : contrats de travaux privés, sous-traitance (loi de 1975), retenue de garantie, paiement direct, litiges et contentieux contractuels
5. Marchés publics : CCAP/CCTP, procédures de passation, avenants, réception, pénalités de retard, jurisprudence récente
6. Facility management : maintenance préventive/corrective, contrats de prestation multi-technique, carnet numérique du bâtiment, audit technique patrimoine
7. Jurisprudence récente : arrêts en responsabilité constructeur, litiges chantier, Cour de cassation, tribunaux administratifs, cours d'appel
8. Réglementation bâtiment : RE2020, accessibilité PMR, amiante, plomb, diagnostics obligatoires, normes NF/DTU

Réponds UNIQUEMENT avec ce JSON (pas de texte avant ni après) :
{
  "idees": [
    {
      "titre_propose": "Titre accrocheur et précis de l'article (sans deux-points)",
      "angle_editorial": "Pourquoi ce sujet maintenant et quelle valeur concrète pour un maître d'ouvrage, AMO ou gestionnaire de patrimoine",
      "sources_trouvees": ["https://url-source-1.fr", "https://url-source-2.fr"],
      "mots_cles": "mot-clé 1, mot-clé 2, mot-clé 3, mot-clé 4",
      "categorie": "Réglementation chantier"
    },
    { ... },
    { ... }
  ]
}

Catégories disponibles : Réglementation chantier, Sécurité BTP, AMO, Maîtrise d'œuvre, Marchés privés, Marchés publics, Facility management, Jurisprudence, Réglementation bâtiment, Actualités

Règles absolues :
- Exactement 3 idées
- Actualité de moins de 60 jours OU jurisprudence récente
- Zéro doublon sémantique avec les articles déjà publiés listés ci-dessus
- Angle concret et actionnable pour un professionnel de la construction ou du patrimoine bâti
- Pas de deux-points dans les titres proposés`;

  const ai = new GoogleGenAI({ apiKey });
  let lastErr: unknown;

  for (const model of GROUNDING_MODELS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: Record<string, any> = {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
        maxOutputTokens: 8192, // large : le JSON complet ne doit JAMAIS être tronqué
      };
      // Gemini 2.5 active le « thinking » par défaut : ces tokens de réflexion
      // consomment le budget de sortie et tronquent le JSON (cause des échecs).
      // On le désactive pour réserver tout le budget à la réponse.
      // (Non supporté sur les modèles 2.0 → on ne l'ajoute pas pour eux.)
      if (model.includes('2.5')) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }

      const res = await ai.models.generateContent({ model, contents: prompt, config });

      const raw = (res.text ?? '').trim();
      const rawIdeas = extractIdeas(raw);
      if (rawIdeas.length === 0) {
        throw new Error(`Réponse sans idée exploitable — reçu (${raw.length} cars): ${raw.slice(0, 300)}`);
      }

      // Normalisation + dédoublonnage par titre (le sauvetage peut récupérer
      // deux fois la même idée si Gemini a dupliqué sa réponse).
      const seen = new Set<string>();
      const ideas: ArticleIdea[] = [];
      for (const idea of rawIdeas) {
        const titre = String(idea.titre_propose ?? '').trim();
        if (!titre) continue;
        const key = titre.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        ideas.push({
          titre_propose:    titre,
          angle_editorial:  String(idea.angle_editorial ?? '').trim(),
          sources_trouvees: Array.isArray(idea.sources_trouvees) ? idea.sources_trouvees as string[] : [],
          mots_cles:        String(idea.mots_cles ?? '').trim(),
          categorie:        String(idea.categorie ?? 'Actualités').trim() || 'Actualités',
        });
      }
      if (ideas.length === 0) throw new Error('Aucune idée valide après normalisation');

      return ideas.slice(0, 3);
    } catch (e) {
      lastErr = e;
      if (isRetriable(e)) continue;
      throw e;
    }
  }

  throw lastErr ?? new Error('Génération d\'idées échouée sur tous les modèles');
}
