import type { NextRequest } from 'next/server';
import { appendFileSync } from 'fs';
import path from 'path';
import { getSetting, setSetting } from './settings';
import { encrypt, decrypt, looksEncrypted } from './encrypt';

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  DEUX connexions LinkedIn indépendantes
 * ────────────────────────────────────────────────────────────────────────────
 *  Chaque connexion = UNE application LinkedIn Developer + SON propre jeton OAuth
 *  (un jeton OAuth appartient toujours à une seule app — impossible de fusionner
 *  les permissions de deux apps dans un même jeton).
 *
 *   • 'person'        → app « Automatisation Tender Wise »
 *                       scopes : openid profile email w_member_social
 *                       publie sur le PROFIL personnel.
 *
 *   • 'organization'  → app « Tender Wise - Page entreprise » (Community Management API)
 *                       scopes : r_organization_social w_organization_social
 *                       publie sur la PAGE entreprise.
 *
 *  Les deux peuvent être connectées en même temps ; la publication est routée
 *  vers le bon jeton selon la cible (`opts.as`).
 */

export type LinkedInTarget = 'person' | 'organization';

/** Scopes du compte personnel (« Sign In » + « Share on LinkedIn »). */
export const LINKEDIN_SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

/**
 * Scopes de la Page entreprise (produit « Community Management API »).
 *   r_organization_social → lister les Pages dont le compte est administrateur
 *   w_organization_social → publier au nom de la Page (+ upload d'images)
 */
export const LINKEDIN_ORG_SCOPES = ['r_organization_social', 'w_organization_social'];

const LI_API = 'https://api.linkedin.com';
const LI_VERSION = '202506';

/** Clés `settings` propres à chaque connexion. */
const KEYS = {
  person: {
    clientId:     'linkedin_client_id',
    clientSecret: 'linkedin_client_secret',
    token:        'linkedin_access_token',
    expiresAt:    'linkedin_token_expires_at',
  },
  organization: {
    clientId:     'linkedin_org_client_id',
    clientSecret: 'linkedin_org_client_secret',
    token:        'linkedin_org_access_token',
    expiresAt:    'linkedin_org_token_expires_at',
  },
} as const;

/**
 * Renvoie la liste des scopes à demander selon la connexion ciblée.
 * (asynchrone pour stabilité de signature — les scopes sont aujourd'hui statiques.)
 */
export async function getLinkedInScopes(which: LinkedInTarget = 'person'): Promise<string[]> {
  return which === 'organization' ? [...LINKEDIN_ORG_SCOPES] : [...LINKEDIN_SCOPES];
}

/**
 * Journalise un évènement OAuth/API LinkedIn dans app_error.log (même fichier
 * que le serveur Passenger) afin de capturer la cause réelle des échecs de
 * connexion — statut HTTP + corps renvoyé par LinkedIn. Best-effort.
 */
export function logLinkedIn(label: string, detail?: unknown): void {
  const ts  = new Date().toISOString();
  const txt = detail === undefined
    ? ''
    : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  const line = `[${ts}] [linkedin] ${label}${txt}\n`;
  try { appendFileSync(path.join(process.cwd(), 'app_error.log'), line); } catch { /* best-effort */ }
  console.error(line.trimEnd());
}

export function getBaseUrl(req: NextRequest): string {
  if (process.env.GOOGLE_OAUTH_BASE_URL) return process.env.GOOGLE_OAUTH_BASE_URL.replace(/\/$/, '');
  const fwdProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const fwdHost  = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host     = fwdHost || req.headers.get('host') || req.nextUrl.host;
  const proto    = fwdProto || req.nextUrl.protocol.replace(':', '') || 'https';
  return `${proto}://${host}`;
}

/**
 * URI de redirection OAuth — IDENTIQUE pour les deux apps. À ajouter dans
 * « Auth → Authorized redirect URLs » de CHAQUE app LinkedIn. La connexion en
 * cours (perso/Page) est distinguée par le cookie `li_oauth_target`.
 */
export function getRedirectUri(req: NextRequest): string {
  return `${getBaseUrl(req)}/api/connectors/linkedin/callback`;
}

async function readSecret(key: string): Promise<string> {
  const v = await getSetting(key, '');
  if (!v) return '';
  try { return looksEncrypted(v) ? decrypt(v) : v; } catch { return ''; }
}

export async function getLinkedInCredentials(
  which: LinkedInTarget = 'person',
): Promise<{ clientId: string; clientSecret: string }> {
  const k = KEYS[which];
  const clientId     = await getSetting(k.clientId, '');
  const clientSecret = await readSecret(k.clientSecret);
  return { clientId, clientSecret };
}

export async function getLinkedInToken(which: LinkedInTarget = 'person'): Promise<string> {
  return readSecret(KEYS[which].token);
}

export interface LinkedInOrg { urn: string; name: string }

/** État d'une connexion (app + jeton). */
export interface LinkedInConnection {
  hasClientId:     boolean;
  hasClientSecret: boolean;
  connected:       boolean;
  expired:         boolean;
  name:            string;   // identité (perso) — vide pour la connexion Page
  email:           string;
  expiresAt:       string;
}

export interface LinkedInStatus {
  redirectUri: string;

  /** Connexion compte personnel (app « Automatisation Tender Wise »). */
  person: LinkedInConnection & { personUrn: string };

  /** Connexion Page entreprise (app Community Management). */
  organization: LinkedInConnection & {
    orgUrn:  string;        // Page sélectionnée (urn:li:organization:…)
    orgName: string;        // nom lisible de la Page sélectionnée
    orgs:    LinkedInOrg[]; // Pages dont le compte est administrateur
  };

  // ── Champs « à plat » de compatibilité (UI existante : validation, onglets) ──
  hasClientId:     boolean;
  hasClientSecret: boolean;
  connected:       boolean;
  expired:         boolean;
  personUrn:       string;
  email:           string;
  name:            string;
  personName:      string;   // alias de `name` (corrige l'aperçu de validation)
  expiresAt:       string;
  orgEnabled:      boolean;   // « Page utilisable » : connectée + Page sélectionnée
  orgUrn:          string;
  orgName:         string;
  orgs:            LinkedInOrg[];
}

/** Liste des Pages entreprise administrables (mise en cache dans les settings). */
export async function getLinkedInOrgs(): Promise<LinkedInOrg[]> {
  try {
    const raw = await getSetting('linkedin_orgs', '');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((o) => o && o.urn) : [];
  } catch { return []; }
}

/** URN de la Page entreprise sélectionnée pour la publication (vide si aucune). */
export async function getLinkedInOrgUrn(): Promise<string> {
  return getSetting('linkedin_org_urn', '');
}

/**
 * Normalise une saisie utilisateur en URN d'organisation LinkedIn.
 * Accepte : un URN complet (`urn:li:organization:1234`), un ID numérique
 * (`1234`), ou une URL d'admin de Page contenant l'ID numérique
 * (`https://www.linkedin.com/company/1234/admin/`). Renvoie '' si non reconnu.
 * Les URLs à nom de vanité (`/company/tenderwise/`) ne contiennent pas l'ID et
 * ne peuvent pas être résolues ici → l'utilisateur doit fournir l'ID numérique.
 */
export function normalizeOrgUrn(input: string): string {
  const s = (input || '').trim();
  if (!s) return '';
  if (/^urn:li:organization:\d+$/.test(s)) return s;
  if (/^\d+$/.test(s)) return `urn:li:organization:${s}`;
  const m = s.match(/\/company\/(\d+)/);
  if (m) return `urn:li:organization:${m[1]}`;
  return '';
}

/** Nom lisible d'une Page (best-effort). Repli : « Page {id} ». */
export async function fetchOrganizationName(token: string, urn: string): Promise<string> {
  const id = urn.split(':').pop() || '';
  if (!id) return urn;
  try {
    const res = await fetch(
      `${LI_API}/rest/organizations/${id}?projection=(id,localizedName,vanityName,name)`,
      { headers: liHeaders(token) },
    );
    if (res.ok) {
      const o = await res.json();
      const loc = o?.name?.localized;
      return o?.localizedName || o?.vanityName || (loc && loc[Object.keys(loc)[0]]) || `Page ${id}`;
    }
  } catch { /* best-effort */ }
  return `Page ${id}`;
}

/**
 * Avertissements pour les jetons LinkedIn proches de l'expiration (≤ 7 jours)
 * ou déjà expirés. Aucun refresh token n'est fourni par LinkedIn par défaut :
 * sans cette alerte proactive, l'expiration passe inaperçue jusqu'à un échec
 * de publication. Utilisé par le cron quotidien des idées (déjà planifié).
 */
export async function getLinkedInExpiryWarnings(): Promise<string[]> {
  const WARN_DAYS = 7;
  const [pToken, pExpiresAt, oToken, oExpiresAt] = await Promise.all([
    getSetting(KEYS.person.token, ''),
    getSetting(KEYS.person.expiresAt, ''),
    getSetting(KEYS.organization.token, ''),
    getSetting(KEYS.organization.expiresAt, ''),
  ]);
  const daysLeft = (iso: string) => (new Date(iso).getTime() - Date.now()) / 86_400_000;
  const warnings: string[] = [];
  if (pToken && pExpiresAt && daysLeft(pExpiresAt) <= WARN_DAYS) {
    const days = Math.ceil(daysLeft(pExpiresAt));
    warnings.push(days <= 0 ? 'compte personnel LinkedIn — jeton expiré' : `compte personnel LinkedIn — expire dans ${days} j`);
  }
  if (oToken && oExpiresAt && daysLeft(oExpiresAt) <= WARN_DAYS) {
    const days = Math.ceil(daysLeft(oExpiresAt));
    warnings.push(days <= 0 ? 'Page entreprise LinkedIn — jeton expiré' : `Page entreprise LinkedIn — expire dans ${days} j`);
  }
  return warnings;
}

export async function getLinkedInStatus(req: NextRequest): Promise<LinkedInStatus> {
  // Les secrets sont lus via readSecret (déchiffrement) : un secret stocké mais
  // indéchiffrable (clé changée / valeur corrompue) apparaît comme « non
  // configuré » pour inviter à le ressaisir, au lieu d'échouer au callback.
  const [
    pClientId, pSecret, pToken, personUrn, pEmail, pName, pExpiresAt,
    oClientId, oSecret, oToken, oExpiresAt, orgUrn, orgName, orgs,
  ] = await Promise.all([
    getSetting(KEYS.person.clientId, ''),
    readSecret(KEYS.person.clientSecret),
    getSetting(KEYS.person.token, ''),
    getSetting('linkedin_person_urn', ''),
    getSetting('linkedin_email', ''),
    getSetting('linkedin_name', ''),
    getSetting(KEYS.person.expiresAt, ''),
    getSetting(KEYS.organization.clientId, ''),
    readSecret(KEYS.organization.clientSecret),
    getSetting(KEYS.organization.token, ''),
    getSetting(KEYS.organization.expiresAt, ''),
    getSetting('linkedin_org_urn', ''),
    getSetting('linkedin_org_name', ''),
    getLinkedInOrgs(),
  ]);

  const pConnected = !!pToken && !!personUrn;
  const pExpired   = pExpiresAt ? new Date(pExpiresAt) < new Date() : false;
  const oConnected = !!oToken;
  const oExpired   = oExpiresAt ? new Date(oExpiresAt) < new Date() : false;

  const person = {
    hasClientId:     !!pClientId,
    hasClientSecret: !!pSecret,
    connected:       pConnected,
    expired:         pExpired,
    name:            pName,
    email:           pEmail,
    expiresAt:       pExpiresAt,
    personUrn,
  };

  const organization = {
    hasClientId:     !!oClientId,
    hasClientSecret: !!oSecret,
    connected:       oConnected,
    expired:         oExpired,
    name:            '',
    email:           '',
    expiresAt:       oExpiresAt,
    orgUrn,
    orgName,
    orgs,
  };

  return {
    redirectUri: getRedirectUri(req),
    person,
    organization,

    // ── compat « à plat » (= connexion perso, comportement historique) ──
    hasClientId:     person.hasClientId,
    hasClientSecret: person.hasClientSecret,
    connected:       person.connected,
    expired:         person.expired,
    personUrn,
    email:           pEmail,
    name:            pName,
    personName:      pName,
    expiresAt:       pExpiresAt,
    // « Page utilisable » : app Page connectée (non expirée) ET une Page choisie.
    orgEnabled:      oConnected && !oExpired && !!orgUrn,
    orgUrn,
    orgName,
    orgs,
  };
}

function liHeaders(token: string) {
  return {
    'Authorization':              `Bearer ${token}`,
    'Content-Type':               'application/json',
    'LinkedIn-Version':           LI_VERSION,
    'X-Restli-Protocol-Version':  '2.0.0',
  };
}

/**
 * Récupère les Pages LinkedIn dont le compte connecté est ADMINISTRATEUR, via
 * l'API Community Management (organizationAcls). Le nom lisible est résolu
 * directement par la décoration `organization~` (un seul appel) ; repli sur
 * /rest/organizations/{id} si la décoration n'est pas renvoyée.
 * Best-effort : renvoie [] si le scope r_organization_social n'a pas été accordé.
 */
export async function fetchAdminOrganizations(token: string): Promise<LinkedInOrg[]> {
  try {
    const res = await fetch(
      `${LI_API}/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` +
        `&projection=(elements*(organization~(id,localizedName,vanityName)))`,
      { headers: liHeaders(token) },
    );
    if (!res.ok) {
      logLinkedIn('organizationAcls failed', {
        status: res.status,
        body: await res.text().then(t => t.slice(0, 200)).catch(() => ''),
      });
      return [];
    }
    const data = await res.json();
    const elements: Array<{ organization?: string; ['organization~']?: { localizedName?: string; vanityName?: string } }> =
      Array.isArray(data?.elements) ? data.elements : [];

    const orgs: LinkedInOrg[] = [];
    for (const el of elements) {
      const urn = el.organization;
      if (!urn) continue;
      const deco = el['organization~'];
      let name = deco?.localizedName || deco?.vanityName || '';
      if (!name) name = await fetchOrganizationName(token, urn);
      orgs.push({ urn, name: name || urn });
    }
    return orgs;
  } catch (e) {
    logLinkedIn('fetchAdminOrganizations exception', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/** Enregistre le jeton + l'identité de la connexion PERSONNELLE. */
export async function saveLinkedInToken(opts: {
  accessToken: string;
  expiresIn:   number;
  personUrn:   string;
  email:       string;
  name:        string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + opts.expiresIn * 1000).toISOString();
  await Promise.all([
    setSetting(KEYS.person.token,      encrypt(opts.accessToken)),
    setSetting('linkedin_person_urn',  opts.personUrn),
    setSetting('linkedin_email',       opts.email),
    setSetting('linkedin_name',        opts.name),
    setSetting(KEYS.person.expiresAt,  expiresAt),
  ]);
}

/** Enregistre le jeton de la connexion PAGE ENTREPRISE (pas d'identité perso). */
export async function saveLinkedInOrgToken(opts: {
  accessToken: string;
  expiresIn:   number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + opts.expiresIn * 1000).toISOString();
  await Promise.all([
    setSetting(KEYS.organization.token,     encrypt(opts.accessToken)),
    setSetting(KEYS.organization.expiresAt, expiresAt),
  ]);
}

async function uploadImage(token: string, ownerUrn: string, buf: Buffer, mime: string): Promise<string> {
  const initRes = await fetch(`${LI_API}/rest/images?action=initializeUpload`, {
    method:  'POST',
    headers: liHeaders(token),
    body:    JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  if (!initRes.ok) {
    const t = await initRes.text();
    throw new Error(`LinkedIn initializeUpload ${initRes.status}: ${t.slice(0, 200)}`);
  }
  const init       = await initRes.json();
  const uploadUrl: string = init.value?.uploadUrl;
  const imageUrn:  string = init.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error('LinkedIn initializeUpload: réponse inattendue');

  const upRes = await fetch(uploadUrl, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mime },
    body:    new Uint8Array(buf),
  });
  if (!upRes.ok) throw new Error(`LinkedIn image upload ${upRes.status}`);
  return imageUrn;
}

export interface PostResult {
  postUrn: string;
  url:     string;
  target:  LinkedInTarget;
}

export interface PublishOptions {
  /** Cible de publication : 'person' (profil perso, défaut) ou 'organization' (Page entreprise). */
  as?: LinkedInTarget;
}

/** Récupère le jeton valide de la connexion ciblée (erreur explicite sinon). */
async function tokenForTarget(target: LinkedInTarget): Promise<string> {
  const token = await getLinkedInToken(target);
  if (!token) {
    throw new Error(target === 'organization'
      ? 'Page entreprise non connectée — connectez l’app « Page entreprise » dans Connecteurs → LinkedIn'
      : 'Compte LinkedIn non connecté — connectez votre compte dans Connecteurs → LinkedIn');
  }
  // Détection proactive de l'expiration (LinkedIn ne fournit pas de refresh
  // token par défaut → reconnexion manuelle requise tous les ~60 jours).
  const expiresAt = await getSetting(KEYS[target].expiresAt, '');
  if (expiresAt && new Date(expiresAt) < new Date()) {
    throw new Error(target === 'organization'
      ? 'Jeton « Page entreprise » expiré — reconnectez l’app Page dans Connecteurs → LinkedIn'
      : 'Jeton LinkedIn expiré — reconnectez votre compte dans Connecteurs → LinkedIn');
  }
  return token;
}

export async function publishLinkedInPost(
  text:         string,
  imageBuffer?: Buffer,
  mimeType?:    string,
  opts?:        PublishOptions,
): Promise<PostResult> {
  const target: LinkedInTarget = opts?.as === 'organization' ? 'organization' : 'person';
  const token = await tokenForTarget(target);

  // Détermine l'auteur du post selon la cible.
  let authorUrn: string;
  if (target === 'organization') {
    authorUrn = await getLinkedInOrgUrn();
    if (!authorUrn) {
      throw new Error('Aucune Page entreprise sélectionnée — choisissez la Page dans Connecteurs → LinkedIn');
    }
  } else {
    authorUrn = await getSetting('linkedin_person_urn', '');
    if (!authorUrn) throw new Error('URN LinkedIn manquant — reconnectez votre compte');
  }

  const headers = liHeaders(token);

  let imageUrn: string | undefined;
  if (imageBuffer && imageBuffer.length > 0 && mimeType) {
    imageUrn = await uploadImage(token, authorUrn, imageBuffer, mimeType);
  }

  const body: Record<string, unknown> = {
    author:       authorUrn,
    commentary:   text,
    visibility:   'PUBLIC',
    distribution: {
      feedDistribution:              'MAIN_FEED',
      targetEntities:                [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState:          'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (imageUrn) body.content = { media: { id: imageUrn } };

  const res = await fetch(`${LI_API}/rest/posts`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn POST /rest/posts ${res.status}: ${err.slice(0, 300)}`);
  }
  const postUrn = res.headers.get('x-restli-id') || '';
  return {
    postUrn,
    url: postUrn ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/` : '',
    target,
  };
}

/* ─── Statistiques d'engagement ──────────────────────────────────────────── */

export interface PostEngagement {
  likes:    number;
  comments: number;
}

/**
 * Récupère le nombre de likes + commentaires d'un post via l'endpoint
 * `socialActions`. Le jeton utilisé est celui de la connexion `which`
 * (défaut : perso, repli sur la connexion Page si la perso n'est pas connectée).
 *
 * Best-effort : renvoie `null` en cas d'échec (permission insuffisante, post
 * introuvable, URN absent…) — l'UI affiche alors « — ».
 */
export async function fetchPostEngagement(
  postUrn: string,
  which?:  LinkedInTarget,
): Promise<PostEngagement | null> {
  if (!postUrn) return null;

  const token = which
    ? await getLinkedInToken(which)
    : (await getLinkedInToken('person')) || (await getLinkedInToken('organization'));
  if (!token) return null;

  try {
    const res = await fetch(
      `${LI_API}/rest/socialActions/${encodeURIComponent(postUrn)}`,
      { headers: liHeaders(token) },
    );
    if (!res.ok) {
      logLinkedIn('socialActions failed', { urn: postUrn, status: res.status });
      return null;
    }
    const data = await res.json();
    const likes =
      Number(data?.likesSummary?.totalLikes ?? data?.likesSummary?.aggregatedTotalLikes ?? 0) || 0;
    const comments =
      Number(data?.commentsSummary?.aggregatedTotalComments ?? data?.commentsSummary?.count ?? 0) || 0;
    return { likes, comments };
  } catch (e) {
    logLinkedIn('socialActions exception', e instanceof Error ? e.message : String(e));
    return null;
  }
}
