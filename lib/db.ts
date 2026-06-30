import mysql from 'mysql2/promise';

if (!process.env.DB_PASSWORD) {
  console.error('[db] AVERTISSEMENT : DB_PASSWORD non défini — connexion sans mot de passe. Définissez la variable d\'environnement en production.');
}

const pool = mysql.createPool({
  host:        process.env.DB_HOST     || 'localhost',
  port:        parseInt(process.env.DB_PORT || '3306', 10),
  database:    process.env.DB_NAME     || 'duvu8164_tenderwise_next',
  user:        process.env.DB_USER     || 'duvu8164_romuald',
  password:    process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  timezone:    '+00:00',
  charset:     'utf8mb4',
  dateStrings: true,
});

/** SELECT multiple rows */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows] = await pool.execute(sql, params as any[]);
  return rows as T[];
}

/** SELECT single row — returns null if not found */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE — returns insertId and affectedRows */
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ insertId: number; affectedRows: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await pool.execute(sql, params as any[]);
  return result as { insertId: number; affectedRows: number };
}

export default pool;
