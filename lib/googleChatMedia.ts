import { getSetting } from './settings';
import { getGoogleAccessToken } from './google';
import { logLinkedIn } from './linkedin';

/**
 * Pièce jointe telle que reçue dans l'évènement Google Chat (webhook MESSAGE).
 * Seuls les champs utiles au téléchargement d'image sont typés.
 */
export interface ChatAttachment {
  name?:        string;
  contentName?: string;
  contentType?: string;
  source?:      string; // 'UPLOADED_CONTENT' | 'DRIVE_FILE'
  attachmentDataRef?: { resourceName?: string };
  driveDataRef?:      { driveFileId?: string };
  downloadUri?: string;
  thumbnailUri?: string;
}

export interface DownloadedImage { buffer: Buffer; mime: string }

/**
 * Télécharge la PREMIÈRE pièce jointe image d'un message Google Chat.
 *
 * Best-effort et non bloquant : renvoie `null` si aucune image, si l'API n'est
 * pas autorisée (jeton sans scope `chat.bot`) ou en cas d'erreur — l'appelant
 * publie alors le post en texte seul, sans jamais échouer.
 *
 * Auth : le téléchargement de média Chat (`media/{resourceName}`) exige un jeton
 * autorisé pour l'app Chat. On essaie, dans l'ordre :
 *   1) un jeton dédié configuré dans les réglages (`google_chat_app_token`),
 *      typiquement un access token de compte de service avec scope chat.bot ;
 *   2) à défaut, le jeton OAuth Google de l'app (souvent insuffisant → 403,
 *      géré proprement).
 */
export async function downloadChatImage(
  attachments: ChatAttachment[] | undefined,
): Promise<DownloadedImage | null> {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  const img = attachments.find(a => (a.contentType || '').startsWith('image/'));
  if (!img) return null;

  const resourceName = img.attachmentDataRef?.resourceName;
  if (!resourceName) {
    // Pièces jointes provenant de Drive : non gérées ici (scope drive.file ne
    // donne pas accès aux fichiers arbitraires de l'utilisateur).
    return null;
  }

  // Jeton : dédié si fourni, sinon OAuth Google de l'app.
  let token = await getSetting('google_chat_app_token', '');
  if (!token) {
    try { token = await getGoogleAccessToken(); } catch { token = ''; }
  }
  if (!token) return null;

  try {
    const res = await fetch(
      `https://chat.googleapis.com/v1/media/${encodeURIComponent(resourceName)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      logLinkedIn('chat media download failed', { status: res.status });
      return null;
    }
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || img.contentType || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return null;
    return { buffer, mime };
  } catch (e) {
    logLinkedIn('chat media download exception', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Déduit la cible de publication LinkedIn d'un message en langage naturel.
 *   « sur mon compte perso / personnel / mon profil » → person
 *   « sur la page entreprise / société / notre page / page TenderWise » → organization
 * Défaut : person (préserve le comportement historique du connecteur Chat).
 */
export function detectLinkedInTarget(text: string): 'person' | 'organization' {
  const t = (text || '').toLowerCase();
  // « compte perso » prime si explicitement demandé.
  if (/\b(perso|personnel|personnelle|mon profil|profil perso)\b/.test(t)) return 'person';
  if (/\b(page entreprise|page de l['’]entreprise|page tenderwise|notre page|page de la soci[ée]t[ée]|soci[ée]t[ée]|company page|organisation|organization)\b/.test(t)) {
    return 'organization';
  }
  // « entreprise » seul reste ambigu → on garde le défaut historique (perso).
  return 'person';
}
