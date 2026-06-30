import type { NextRequest } from 'next/server';
import { getSetting } from './settings';
import { decrypt, looksEncrypted } from './encrypt';

// ── Scopes demandés à Google (Gmail envoi + Drive fichiers créés par l’app + identité)
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file',
];

/** Libellés lisibles des scopes pour l’UI */
export const SCOPE_LABELS: Record<string, string> = {
  'https://www.googleapis.com/auth/gmail.send': 'Gmail — envoi d\'e-mails',
  'https://www.googleapis.com/auth/drive.file': 'Drive — fichiers créés par l\'app',
};

/**
 * Base URL publique réelle de l’app.
 * Gère les sous-domaines derrière un reverse proxy (o2switch) via x-forwarded-*.
 * Override possible avec GOOGLE_OAUTH_BASE_URL.
 */
export function getBaseUrl(req: NextRequest): string {
  if (process.env.GOOGLE_OAUTH_BASE_URL) {
    return process.env.GOOGLE_OAUTH_BASE_URL.replace(/\/$/, '');
  }
  const fwdProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const fwdHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = fwdHost || req.headers.get('host') || req.nextUrl.host;
  const proto = fwdProto || req.nextUrl.protocol.replace(':', '') || 'https';
  return `${proto}://${host}`;
}

/**
 * URI de redirection OAuth. Dérivée de l’hôte réel de la requête.
 * Override complet possible avec GOOGLE_OAUTH_REDIRECT_URI.
 */
export function getRedirectUri(req: NextRequest): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  return `${getBaseUrl(req)}/api/connectors/google/callback`;
}

/** Lit un réglage potentiellement chiffré et le déchiffre */
async function readSecret(key: string): Promise<string> {
  const v = await getSetting(key, '');
  if (!v) return '';
  try {
    return looksEncrypted(v) ? decrypt(v) : v;
  } catch {
    return '';
  }
}

/** Identifiants client OAuth (Client ID en clair, Secret déchiffré) */
export async function getGoogleClient(): Promise<{ clientId: string; clientSecret: string }> {
  const clientId = await getSetting('google_oauth_client_id', '');
  const clientSecret = await readSecret('google_oauth_client_secret');
  return { clientId, clientSecret };
}

export async function getGoogleRefreshToken(): Promise<string> {
  return readSecret('google_oauth_refresh_token');
}

/** Échange le refresh token contre un access token frais (validité ~1h) */
export async function getGoogleAccessToken(): Promise<string> {
  const { clientId, clientSecret } = await getGoogleClient();
  const refreshToken = await getGoogleRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Workspace non connecté');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Échec du rafraîchissement du token Google');
  }
  return data.access_token as string;
}

/** Profil du compte connecté (email + nom) via l’API userinfo */
export async function getGoogleProfile(accessToken?: string): Promise<{ email: string; name?: string }> {
  const token = accessToken || (await getGoogleAccessToken());
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Profil Google inaccessible');
  return { email: data.email, name: data.name };
}

/** Envoie un e-mail HTML via l’API Gmail (compte connecté) */
export async function sendGmailEmail(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<void> {
  const accessToken = await getGoogleAccessToken();
  const subjectEnc = `=?UTF-8?B?${Buffer.from(opts.subject, 'utf8').toString('base64')}?=`;
  const replyToHeader = opts.replyTo ? `Reply-To: ${opts.replyTo.replace(/[\r\n]+/g, ' ').trim()}\r\n` : '';
  const message =
    `To: ${opts.to}\r\n` +
    replyToHeader +
    `Subject: ${subjectEnc}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
    opts.html;
  const raw = Buffer.from(message, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail: ${err.slice(0, 250)}`);
  }
}

/**
 * Envoie un message texte dans un espace Google Chat via le webhook entrant configuré.
 * Indépendant d’OAuth : utilise l’URL de webhook stockée dans les réglages.
 */
export async function sendGoogleChatMessage(text: string): Promise<void> {
  const url = await getSetting('google_chat_incoming_webhook', '');
  if (!url) throw new Error('Aucun webhook Chat entrant configuré');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Google Chat ${res.status}: ${err.slice(0, 200)}`);
  }
}

/**
 * Crée un dossier dans Drive et renvoie son id.
 * Parent par défaut : le dossier racine configuré (google_drive_folder_id).
 */
export async function createDriveFolder(
  name: string,
  parentId?: string,
): Promise<{ id: string; webViewLink?: string }> {
  const accessToken = await getGoogleAccessToken();
  const parent = parentId || (await getSetting('google_drive_folder_id', '')) || undefined;

  const metadata: Record<string, unknown> = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parent) metadata.parents = [parent];

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Drive (dossier): ${JSON.stringify(data).slice(0, 250)}`);
  return { id: data.id, webViewLink: data.webViewLink };
}

/** Téléverse un fichier binaire (image…) dans Drive. Dossier cible optionnel. */
export async function uploadBinaryToDrive(opts: {
  name: string;
  data: Buffer;
  mimeType: string;
  folderId?: string;
}): Promise<{ id: string; webViewLink?: string }> {
  const accessToken = await getGoogleAccessToken();
  const folderId = opts.folderId || (await getSetting('google_drive_folder_id', '')) || undefined;

  const metadata: Record<string, unknown> = { name: opts.name, mimeType: opts.mimeType };
  if (folderId) metadata.parents = [folderId];

  const boundary = `tw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  // Partie binaire encodée en base64 (Content-Transfer-Encoding: base64).
  const head =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${opts.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  const body = Buffer.concat([
    Buffer.from(head, 'utf8'),
    Buffer.from(opts.data.toString('base64'), 'utf8'),
    Buffer.from(`\r\n--${boundary}--`, 'utf8'),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Drive (image): ${JSON.stringify(data).slice(0, 250)}`);
  return { id: data.id, webViewLink: data.webViewLink };
}

/** Téléverse un fichier (HTML/texte) dans Drive. Dossier cible optionnel. */
export async function uploadToDrive(opts: {
  name: string;
  content: string;
  mimeType?: string;
  folderId?: string;
}): Promise<{ id: string; webViewLink?: string }> {
  const accessToken = await getGoogleAccessToken();
  const mimeType = opts.mimeType || 'text/html';
  const folderId = opts.folderId || (await getSetting('google_drive_folder_id', '')) || undefined;

  const metadata: Record<string, unknown> = { name: opts.name, mimeType };
  if (folderId) metadata.parents = [folderId];

  const boundary = `tw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
    `${opts.content}\r\n--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Drive: ${JSON.stringify(data).slice(0, 250)}`);
  return { id: data.id, webViewLink: data.webViewLink };
}
