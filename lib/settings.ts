import { query, execute } from './db';

// Cache en mémoire du process (TTL court) : les réglages changent rarement mais
// getSetting() était appelé individuellement à chaque lecture, multipliant les
// requêtes SQL sur une page (settings lus dans le layout, les métadonnées, les
// agents IA...). Un cache process-local évite cette charge répétée sans risquer
// de servir des données trop périmées (TTL 2 min, invalidé immédiatement à l'écriture).
const CACHE_TTL_MS = 120_000;
let cache: { data: Record<string, string>; ts: number } | null = null;
let inFlight: Promise<Record<string, string>> | null = null;

async function loadAllSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const rows = await query<{ key: string; value: string }>(
        'SELECT `key`, `value` FROM settings'
      );
      const data = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      cache = { data, ts: Date.now() };
      return data;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function invalidateSettingsCache(): void {
  cache = null;
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const all = await loadAllSettings();
  return all[key] ?? fallback;
}

/** Lit un réglage booléen ('1'/'true' = vrai). `def` est la valeur par défaut si non défini. */
export async function getBoolSetting(key: string, def: boolean): Promise<boolean> {
  const v = await getSetting(key, def ? '1' : '0');
  return v === '1' || v === 'true';
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return loadAllSettings();
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, value]
  );
  invalidateSettingsCache();
}

/** Incrémente atomiquement un compteur numérique stocké dans settings. Thread-safe. */
export async function incrementSetting(key: string, by: number): Promise<void> {
  await execute(
    `INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = CAST(CAST(\`value\` AS SIGNED) + ? AS CHAR)`,
    [key, String(by), by],
  );
  invalidateSettingsCache();
}
