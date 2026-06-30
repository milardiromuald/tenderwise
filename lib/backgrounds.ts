import { query, execute } from './db';

export interface HeaderBackground {
  id: number;
  url: string;
  label: string;
  sort_order: number;
  active: number;
}

/**
 * Liste les fonds d’en-tête actifs. Tolérant : renvoie [] si la table n’existe
 * pas encore (schema-backgrounds.sql non exécuté) — ne casse jamais le workflow.
 */
export async function getActiveBackgrounds(): Promise<HeaderBackground[]> {
  try {
    return await query<HeaderBackground>(
      'SELECT id, url, label, sort_order, active FROM header_backgrounds WHERE active = 1 ORDER BY sort_order, id',
    );
  } catch {
    return [];
  }
}

/** Tous les fonds (admin), actifs ou non. */
export async function getAllBackgrounds(): Promise<HeaderBackground[]> {
  try {
    return await query<HeaderBackground>(
      'SELECT id, url, label, sort_order, active FROM header_backgrounds ORDER BY sort_order, id',
    );
  } catch {
    return [];
  }
}

/** Tire un fond actif au hasard (ou null si aucun n’est configuré). */
export async function pickRandomBackground(): Promise<HeaderBackground | null> {
  const list = await getActiveBackgrounds();
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

export async function addBackground(url: string, label = ''): Promise<void> {
  await execute('INSERT INTO header_backgrounds (url, label) VALUES (?, ?)', [url, label]);
}

export async function deleteBackground(id: number): Promise<void> {
  await execute('DELETE FROM header_backgrounds WHERE id = ?', [id]);
}

/** Renomme un fond (modifie son libellé). */
export async function updateBackgroundLabel(id: number, label: string): Promise<void> {
  await execute('UPDATE header_backgrounds SET label = ? WHERE id = ?', [label, id]);
}

/**
 * Active ou désactive un fond. Un fond inactif reste enregistré mais n'est plus
 * tiré au sort pour les en-têtes d'articles (cf. getActiveBackgrounds).
 */
export async function setBackgroundActive(id: number, active: boolean): Promise<void> {
  await execute('UPDATE header_backgrounds SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
}
