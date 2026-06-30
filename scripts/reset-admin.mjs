/**
 * Reset admin password — run with: node scripts/reset-admin.mjs [newPassword]
 * Example: node scripts/reset-admin.mjs "MonMotDePasse@2024"
 */
import { createPool } from 'mysql2/promise';
import { hash } from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read .env.local
const envPath = resolve(process.cwd(), '.env.local');
const env = {};
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  });
} catch {
  console.error('Could not read .env.local — using defaults');
}

const newPassword = process.argv[2] || 'TenderWise@2024!';

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const pool = createPool({
  host:     env.DB_HOST     || 'localhost',
  port:     parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
});

try {
  const hashed = await hash(newPassword, 10);

  // Ensure is_active column exists
  try {
    await pool.execute('ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
    console.log('Column is_active created.');
  } catch { /* already exists */ }

  // Re-activate all users and reset password for admin (id=1)
  await pool.execute('UPDATE users SET is_active = 1 WHERE id = 1');

  const [result] = await pool.execute(
    'UPDATE users SET password = ?, is_active = 1 WHERE id = 1',
    [hashed]
  );

  console.log(`\n✓ Done — ${result.affectedRows} row(s) updated.`);
  console.log(`  Username : admin`);
  console.log(`  Password : ${newPassword}`);
  console.log('\nNow rebuild the app:');
  console.log('  npm run build');
  console.log('  (then restart the server)');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
