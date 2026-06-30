import { cache } from 'react';
import { query, execute } from './db';

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const rows = await query<{ value: string }>(
    'SELECT `value` FROM settings WHERE `key` = ?',
    [key]
  );
  return rows[0]?.value ?? fallback;
}

/** Lit un réglage booléen ('1'/'true' = vrai). `def` est la valeur par défaut si non défini. */
export async function getBoolSetting(key: string, def: boolean): Promise<boolean> {
  const v = await getSetting(key, def ? '1' : '0');
  return v === '1' || v === 'true';
}

// React.cache() déduplique les appels dans la même requête serveur (layout + generateMetadata = 1 seul hit DB)
export const getAllSettings = cache(async (): Promise<Record<string, string>> => {
  const rows = await query<{ key: string; value: string }>(
    'SELECT `key`, `value` FROM settings'
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
});

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, value]
  );
}

/** Incrémente atomiquement un compteur numérique stocké dans settings. Thread-safe. */
export async function incrementSetting(key: string, by: number): Promise<void> {
  await execute(
    `INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = CAST(CAST(\`value\` AS SIGNED) + ? AS CHAR)`,
    [key, String(by), by],
  );
}
