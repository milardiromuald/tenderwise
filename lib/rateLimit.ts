import { execute, query } from './db';

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      \`key\`    VARCHAR(120) NOT NULL PRIMARY KEY,
      count     INT UNSIGNED NOT NULL DEFAULT 1,
      reset_at  BIGINT       NOT NULL
    )
  `);
  tableReady = true;
}

/**
 * Returns true if the request is allowed, false if the limit is exceeded.
 * Backed by MySQL so limits survive server restarts and are shared across processes.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const resetAt = now + windowMs;

  try {
    await ensureTable();

    // Atomic upsert: reset counter if window expired, otherwise increment
    await execute(
      `INSERT INTO rate_limits (\`key\`, count, reset_at)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE
         count    = IF(reset_at < ?, 1, count + 1),
         reset_at = IF(reset_at < ?, ?, reset_at)`,
      [key, resetAt, now, now, resetAt],
    );

    const rows = await query<{ count: number }>(
      'SELECT count FROM rate_limits WHERE `key` = ?',
      [key],
    );
    return (rows[0]?.count ?? 1) <= limit;
  } catch {
    // Fail open: if DB is unavailable, allow the request
    return true;
  }
}
