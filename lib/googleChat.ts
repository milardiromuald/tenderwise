import crypto from 'crypto';

// ── Mode Chat API classique ──────────────────────────────────────
const CHAT_ISSUER   = 'chat@system.gserviceaccount.com';
const CHAT_CERTS    = 'https://www.googleapis.com/service_accounts/v1/metadata/x509/chat@system.gserviceaccount.com';

// ── Mode Workspace Add-on ────────────────────────────────────────
// Quand la case "module complémentaire Workspace" est cochée dans Google Cloud Console,
// le JWT est signé par service-{project}@gcp-sa-gsuiteaddons.iam.gserviceaccount.com
const ADDON_ISSUER_RE = /^service-\d+@gcp-sa-gsuiteaddons\.iam\.gserviceaccount\.com$/;
const addonCertsUrl = (iss: string) =>
  `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(iss)}`;

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  actualAudience?: string;
  actualIssuer?: string;
  mode?: 'chat' | 'addon' | 'unknown';
}

/**
 * Vérifie qu’une requête provient bien de Google Chat.
 * Supporte le mode Chat API classique ET le mode Workspace Add-on.
 *
 * @param expectedAudience  Numéro de projet (ex: "112389876748") configuré dans l’app.
 *                          Vide = audience non vérifiée.
 * @param endpointUrl       URL complète du webhook (ex: "https://www.tenderwise.fr/api/...")
 *                          Utilisée comme audience alternative en mode Workspace Add-on.
 */
export async function verifyChatRequest(
  authHeader: string | null,
  expectedAudience: string,
  endpointUrl?: string,
): Promise<VerifyResult> {
  if (!authHeader?.startsWith('Bearer ')) return { valid: false, reason: 'no_bearer' };
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };

  const [h, p, s] = parts;
  let header: { alg?: string; kid?: string };
  let payload: { iss?: string; aud?: string; exp?: number };
  try {
    header  = JSON.parse(b64urlToBuf(h).toString('utf8'));
    payload = JSON.parse(b64urlToBuf(p).toString('utf8'));
  } catch {
    return { valid: false, reason: 'decode' };
  }

  const actualAudience = payload.aud;
  const actualIssuer   = payload.iss;

  // ── Déterminer le mode ──────────────────────────────────────────
  const isAddon = ADDON_ISSUER_RE.test(actualIssuer || '');
  const isChat  = actualIssuer === CHAT_ISSUER;
  const mode: VerifyResult['mode'] = isAddon ? 'addon' : isChat ? 'chat' : 'unknown';

  if (header.alg !== 'RS256') return { valid: false, reason: 'alg', actualAudience, actualIssuer, mode };

  // ── Vérification de l’émetteur ──────────────────────────────────
  if (!isChat && !isAddon) {
    return { valid: false, reason: 'issuer', actualAudience, actualIssuer, mode };
  }

  // ── Vérification de l’audience ──────────────────────────────────
  // Accepte : (1) la valeur configurée dans l’app, OU (2) l’URL du webhook (mode Add-on)
  if (expectedAudience) {
    const audOk =
      payload.aud === expectedAudience ||
      (endpointUrl && payload.aud === endpointUrl);
    if (!audOk) {
      return { valid: false, reason: 'audience', actualAudience, actualIssuer, mode };
    }
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: 'expired', actualAudience, actualIssuer, mode };
  }
  if (!header.kid) return { valid: false, reason: 'no_kid', actualAudience, actualIssuer, mode };

  // ── Récupération des certificats Google ─────────────────────────
  const certsUrl = isAddon ? addonCertsUrl(actualIssuer!) : CHAT_CERTS;
  let certs: Record<string, string>;
  try {
    certs = await fetch(certsUrl).then(r => r.json());
  } catch {
    return { valid: false, reason: 'certs_fetch', actualAudience, actualIssuer, mode };
  }
  const cert = certs[header.kid];
  if (!cert) return { valid: false, reason: 'no_cert', actualAudience, actualIssuer, mode };

  // ── Vérification de la signature ────────────────────────────────
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    const ok = verifier.verify(cert, b64urlToBuf(s));
    return ok
      ? { valid: true, actualAudience, actualIssuer, mode }
      : { valid: false, reason: 'signature', actualAudience, actualIssuer, mode };
  } catch {
    return { valid: false, reason: 'verify_error', actualAudience, actualIssuer, mode };
  }
}

/**
 * Extrait le sujet d’article d’un message de chat.
 */
export function extractSubject(text: string): string {
  let t = (text || '').trim();
  t = t.replace(/^\/?(article|articles|génère|genere|crée|cree|créer|creer)\b[\s:.-]*/i, '');
  t = t.replace(/^(un|une|le|la|sur|à propos de|a propos de)\s+/i, '');
  return t.trim();
}
