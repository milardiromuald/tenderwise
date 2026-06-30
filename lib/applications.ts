/**
 * Validation des pièces jointes de candidature (CV / lettre de motivation).
 * Documents acceptés : PDF, DOC, DOCX — avec vérification des magic bytes
 * (anti-usurpation de type, même logique que lib/media.ts pour les images).
 */

export const MAX_DOC_SIZE_MB = 8;

// MIME accepté → extension informative.
export const ALLOWED_DOC_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/** Libellé lisible des formats acceptés (pour les messages d’erreur / l’UI). */
export const ALLOWED_DOC_LABEL = 'PDF, DOC ou DOCX';

/** Vérifie que les octets correspondent bien au type déclaré. */
export function validateDocMagic(buf: Buffer, mimeType: string): boolean {
  // PDF : "%PDF"
  if (mimeType === 'application/pdf') {
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  }
  // DOCX (et tout format Office moderne) : archive ZIP → "PK\x03\x04"
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04;
  }
  // DOC (ancien format OLE2) : D0 CF 11 E0 A1 B1 1A E1
  if (mimeType === 'application/msword') {
    return buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0
        && buf[4] === 0xA1 && buf[5] === 0xB1 && buf[6] === 0x1A && buf[7] === 0xE1;
  }
  return false;
}

/** Nettoie un nom de fichier pour l’en-tête Content-Disposition / le stockage. */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = (name || '').replace(/[^\w.\-() ]+/g, '_').slice(0, 200).trim();
  return cleaned || fallback;
}
