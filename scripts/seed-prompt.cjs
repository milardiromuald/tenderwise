// Seede et vérifie le prompt article par défaut dans la table settings.
// Usage : node scripts/seed-prompt.cjs
const fs = require('fs');
const path = require('path');

// 1) Charger .env.local
const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

// 2) Lire le prompt par défaut depuis lib/defaultPrompts.ts (template literal)
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'defaultPrompts.ts'), 'utf8');
const start = src.indexOf('`');
const end = src.lastIndexOf('`');
const DEFAULT = src.slice(start + 1, end);

const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'duvu8164_tenderwise_next',
    user: process.env.DB_USER || 'duvu8164_romuald',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
  });

  const [before] = await pool.execute('SELECT `value` FROM settings WHERE `key`=?', ['ai_article_prompt']);
  const cur = (before[0] && before[0].value) || '';

  if (!cur.trim()) {
    await pool.execute(
      'INSERT INTO settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)',
      ['ai_article_prompt', DEFAULT],
    );
    console.log('=> SEED : prompt par défaut enregistré.');
  } else {
    console.log('=> Déjà présent en base (longueur ' + cur.length + ') — laissé intact.');
  }

  const [after] = await pool.execute('SELECT `value` FROM settings WHERE `key`=?', ['ai_article_prompt']);
  const v = (after[0] && after[0].value) || '';
  console.log('Longueur en base :', v.length);
  console.log('Correspond au défaut :', v.trim() === DEFAULT.trim());
  console.log('Début :', JSON.stringify(v.slice(0, 90)));

  // Vérifie qu\'aucune ancienne clé conflictuelle ne subsiste
  const [old] = await pool.execute('SELECT `key` FROM settings WHERE `key`=?', ['ai_article_prompt_context']);
  console.log('Ancienne clé ai_article_prompt_context encore présente :', old.length > 0);

  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
