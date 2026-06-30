import { execute, query } from './db';

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS \`login_audit\` (
        \`id\`         INT          NOT NULL AUTO_INCREMENT,
        \`username\`   VARCHAR(100) NOT NULL,
        \`ip\`         VARCHAR(64)  NOT NULL,
        \`user_agent\` VARCHAR(500) NOT NULL DEFAULT '',
        \`success\`    TINYINT(1)   NOT NULL DEFAULT 0,
        \`reason\`     VARCHAR(100) NOT NULL DEFAULT '',
        \`created_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_ip\`      (\`ip\`),
        INDEX \`idx_username\` (\`username\`),
        INDEX \`idx_created\`  (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
    tableEnsured = true;
  } catch {
    // table already exists or DB unavailable — not fatal
  }
}

export async function logLoginAttempt(data: {
  username: string;
  ip: string;
  userAgent: string;
  success: boolean;
  reason: string;
}): Promise<void> {
  try {
    await ensureTable();
    await execute(
      'INSERT INTO `login_audit` (username, ip, user_agent, success, reason) VALUES (?, ?, ?, ?, ?)',
      [
        data.username.slice(0, 100),
        data.ip.slice(0, 64),
        data.userAgent.slice(0, 500),
        data.success ? 1 : 0,
        data.reason.slice(0, 100),
      ]
    );
  } catch (err) {
    // Audit failure must never break the login flow
    console.error('[loginAudit] log failed:', err);
  }
}

export async function getAuditLogs(limit = 100): Promise<{
  id: number;
  username: string;
  ip: string;
  user_agent: string;
  success: number;
  reason: string;
  created_at: string;
}[]> {
  try {
    await ensureTable();
    return await query(
      'SELECT id, username, ip, user_agent, success, reason, created_at FROM `login_audit` ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  } catch {
    return [];
  }
}
