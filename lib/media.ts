import { createHash } from 'crypto';
import { query, queryOne, execute } from './db';

/**
 * Stockage des images EN BASE (table `media`).
 *
 * Source unique pour TOUS les uploads et générations IA du site :
 *   - upload manuel admin            → saveMedia(..., { source: 'upload' })
 *   - image générée par le workflow  → saveMedia(..., { source: 'ai' })
 *   - réimport des anciens /uploads/ → saveMedia(..., { source: 'imported' })
 *
 * Les octets sont servis par la route applicative /api/media/{id}.
 * Les colonnes URL existantes (projects.images, settings.logo_url, articles.image, …)
 * stockent simplement la chaîne "/api/media/{id}".
 */

// Types acceptés → extension (informative). Source unique partagée par /api/upload.
export const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg':                  'jpg',
  'image/jpg':                   'jpg',
  'image/png':                   'png',
  'image/webp':                  'webp',
  'image/gif':                   'gif',
  'image/svg+xml':               'svg',
  'image/x-icon':                'ico',
  'image/vnd.microsoft.icon':    'ico',
  'image/ico':                   'ico',
};

/** Normalise un mimeType d’icône vers la valeur canonique stockée en base. */
export function normalizeMime(mime: string): string {
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'image/x-icon' || mime === 'image/ico' || mime === 'image/vnd.microsoft.icon') {
    return 'image/x-icon';
  }
  return mime;
}

/** Vérifie que les octets correspondent bien au type déclaré (anti-spoofing). */
export function validateMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/svg+xml') {
    const text = buf.slice(0, 100).toString('utf8').trimStart();
    return text.startsWith('<svg') || text.startsWith('<?xml') || text.startsWith('<!--');
  }
  if (mimeType.includes('icon') || mimeType === 'image/ico') {
    // ICO magic : 00 00 01 00
    return buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00;
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  }
  if (mimeType === 'image/png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  }
  if (mimeType === 'image/gif') {
    return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  }
  if (mimeType === 'image/webp') {
    return (
      buf.slice(0, 4).toString('ascii') === 'RIFF' &&
      buf.slice(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

export interface SaveMediaOptions {
  filename?: string;
  source?: 'upload' | 'ai' | 'imported';
  aiModel?: string;
  aiPrompt?: string;
  altText?: string;
  uploadedBy?: string;
  width?: number;
  height?: number;
}

export interface SavedMedia {
  id: number;
  url: string;
}

/**
 * Enregistre une image en base et renvoie son id + l’URL applicative.
 *
 * Déduplication : si une image au contenu identique (même SHA-256) existe déjà,
 * on réutilise sa ligne au lieu d’en créer une nouvelle.
 */
export async function saveMedia(
  buffer: Buffer,
  mimeType: string,
  opts: SaveMediaOptions = {},
): Promise<SavedMedia> {
  const mime = normalizeMime(mimeType);
  const sha = createHash('sha256').update(buffer).digest('hex');

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM media WHERE sha256 = ?',
    [sha],
  );
  if (existing) {
    return { id: existing.id, url: `/api/media/${existing.id}` };
  }

  const res = await execute(
    `INSERT INTO media
       (filename, mime_type, byte_size, width, height, data, sha256, source, ai_model, ai_prompt, alt_text, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      opts.filename ?? null,
      mime,
      buffer.length,
      opts.width ?? null,
      opts.height ?? null,
      buffer,
      sha,
      opts.source ?? 'upload',
      opts.aiModel ?? null,
      opts.aiPrompt ?? null,
      opts.altText ?? null,
      opts.uploadedBy ?? null,
    ],
  );

  return { id: res.insertId, url: `/api/media/${res.insertId}` };
}

export interface MediaRow {
  id: number;
  filename: string | null;
  mime_type: string;
  byte_size: number;
  data: Buffer;
}

/** Lit une image (octets + métadonnées) pour la servir. Null si absente. */
export async function getMedia(id: number): Promise<MediaRow | null> {
  const rows = await query<MediaRow>(
    'SELECT id, filename, mime_type, byte_size, data FROM media WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}
