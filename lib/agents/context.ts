import type { ArticleInput, GeneratedArticle } from '../articleGen';

export type { ArticleInput, GeneratedArticle };

export interface LinkReport {
  url:         string;
  anchor:      string;
  status:      'ok' | 'broken' | 'unverifiable';
  httpCode?:   number;
  foundInPage: boolean;
}

export interface ArticleScore {
  misEnForme:   number;  // /20
  coherence:    number;  // /20
  liens:        number;  // /20
  seo:          number;  // /20
  completude:   number;  // /20
  promptRespect: number; // /20 — respect des directives du prompt système
  total:        number;  // /100 (moyenne des 6 critères × 5)
  verdict:    'approuve' | 'retry' | 'force_approuve';
  feedback:   string;
  corrections: string[];
}

export interface AgentStep {
  agent:       string;
  ok:          boolean;
  attempt?:    number;
  durationMs:  number;
  tokensUsed?: number;
  detail?:     string;
}

/**
 * Registre éditorial choisi par l'analyste selon ce que le sujet appelle vraiment.
 * Évite d'orienter SYSTÉMATIQUEMENT chaque article vers la responsabilité pénale.
 *  - informatif : expliquer une nouveauté, un dispositif, des chiffres (défaut)
 *  - pratique   : guider sur une méthode / des bonnes pratiques
 *  - enjeu_juridique : RÉSERVÉ aux sujets dont le cœur est la responsabilité / une sanction / une jurisprudence
 */
export type RegistreEditorial = 'informatif' | 'pratique' | 'enjeu_juridique';

export interface AnalyseResult {
  registre:      RegistreEditorial; // calibre le ton (neutre vs. mise en garde)
  angle:         string;
  points_cles:   string[];
  lois_a_citer:  string[];
  mots_cles_seo: string[];
  public_cible:  string;
  persona:       string;    // qui est précisément le lecteur cible
  situation:     string;    // sa situation concrète typique
  enjeux:        string[];  // enjeux/bénéfices concrets (pénal UNIQUEMENT si registre=enjeu_juridique)
  idee_recue:    string;    // idée reçue à nuancer SI elle existe vraiment, sinon ''
  besoin_reel:   string;    // son besoin profond, non exprimé
}

export interface ResearchSource {
  title: string;
  url:   string;
}

export interface ResearchResult {
  /** Brief factuel sourcé (chiffres, textes de loi, jurisprudence) issu de la recherche Google. */
  brief:   string;
  /** Sources réelles vérifiées : seules URLs que le Rédacteur est autorisé à lier. */
  sources: ResearchSource[];
}

export interface AgentContext {
  // Entrée
  input: ArticleInput;

  // Prompt éditorial chargé une seule fois et partagé entre tous les agents
  masterPrompt: string;

  // Catégories disponibles sur le site (chargées depuis la DB avant le pipeline)
  availableCategories: string[];

  // Résultats enrichis étape par étape
  research?:     ResearchResult;    // faits réels + sources vérifiées (recherche Google ancrée)
  analyse?:      AnalyseResult;
  articleBrut?:  GeneratedArticle;  // contenu en Markdown (pas encore converti HTML)
  linksReport?:  LinkReport[];
  articleFinal?: GeneratedArticle;  // contenu converti en HTML après révision

  // Boucle de retry
  retryCount:         number;
  maxRetries:         number;
  revisionFeedbacks:  string[];
  finalScore?:        ArticleScore;

  // Suivi
  steps:       AgentStep[];
  tokensIn:    number;
  tokensOut:   number;
}

export function createContext(input: ArticleInput): AgentContext {
  return {
    input,
    masterPrompt:        '',
    availableCategories: [],
    retryCount:          0,
    maxRetries:          2,
    revisionFeedbacks:   [],
    steps:               [],
    tokensIn:            0,
    tokensOut:           0,
  };
}
