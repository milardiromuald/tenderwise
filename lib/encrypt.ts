import crypto from 'crypto';

function deriveKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY ?? '';
  if (!raw) throw new Error('SETTINGS_ENCRYPTION_KEY manquante dans .env.local');
  // 64 hex chars = 32 bytes AES-256
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(stored: string): string {
  const key = deriveKey();
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Format de chiffrement invalide');
  const dec = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'base64'));
  dec.setAuthTag(Buffer.from(parts[1], 'base64'));
  return dec.update(Buffer.from(parts[2], 'base64')).toString('utf8') + dec.final('utf8');
}

export function looksEncrypted(v: string): boolean {
  const parts = v.split(':');
  return parts.length === 3 && parts.every(p => p.length > 0 && /^[A-Za-z0-9+/=]+$/.test(p));
}

/** Retrieve the Gemini API key: DB (decrypted) → env fallback */
export async function getGeminiKey(): Promise<string> {
  const { getSetting } = await import('./settings');
  const stored = await getSetting('gemini_api_key', '');
  if (stored) {
    try {
      return looksEncrypted(stored) ? decrypt(stored) : stored;
    } catch {
      // corrupted value, fall through
    }
  }
  return process.env.GEMINI_API_KEY ?? '';
}

