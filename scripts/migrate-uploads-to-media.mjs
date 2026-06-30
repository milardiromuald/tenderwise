/**
 * Migration : réimporte les images existantes de public/uploads/ vers la table
 * `media` (stockage en base), puis réécrit toutes les références "/uploads/xxx"
 * en "/api/media/{id}" dans la base.
 *
 * Non destructif : les fichiers disque NE sont PAS supprimés (on les garde en
 * filet de sécurité). Idempotent : déduplication par SHA-256, donc relançable.
 *
 *   node scripts/migrate-uploads-to-media.mjs           # applique
 *   node scripts/migrate-uploads-to-media.mjs --dry-run # simulation, n'écrit rien
 */
import { createPool } from 'mysql2/promise';
import { createHash } from 'crypto';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join, extname } from 'path';

const DRY = process.argv.includes('--dry-run');

// ── .env.local ──
const env = {};
try {
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i === -1) return;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
} catch {
  console.error('Impossible de lire .env.local — valeurs par défaut utilisées.');
}

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const pool = createPool({
  host:     env.DB_HOST     || 'localhost',
  port:     parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  charset:  'utf8mb4',
});

const log = (...a) => console.log(...a);

try {
  // 1. S'assurer que la table media existe (CREATE IF NOT EXISTS — non destructif).
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS \`media\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`filename\` VARCHAR(255) DEFAULT NULL,
      \`mime_type\` VARCHAR(100) NOT NULL,
      \`byte_size\` INT NOT NULL,
      \`width\` INT DEFAULT NULL,
      \`height\` INT DEFAULT NULL,
      \`data\` LONGBLOB NOT NULL,
      \`sha256\` CHAR(64) DEFAULT NULL,
      \`source\` VARCHAR(20) NOT NULL DEFAULT 'upload',
      \`ai_model\` VARCHAR(100) DEFAULT NULL,
      \`ai_prompt\` TEXT DEFAULT NULL,
      \`alt_text\` VARCHAR(500) DEFAULT NULL,
      \`uploaded_by\` VARCHAR(100) DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_sha256\` (\`sha256\`),
      KEY \`idx_source\` (\`source\`),
      KEY \`idx_created_at\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  log('✓ Table media prête.');

  // 2. Importer chaque fichier de public/uploads → media. Map oldUrl → newUrl.
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  const urlMap = new Map();
  let imported = 0, reused = 0;

  if (existsSync(uploadsDir)) {
    for (const name of readdirSync(uploadsDir)) {
      if (name.startsWith('.')) continue; // .gitkeep & co
      const ext = extname(name).toLowerCase();
      const mime = MIME_BY_EXT[ext];
      if (!mime) { log(`  - ignoré (type inconnu) : ${name}`); continue; }

      const buf = readFileSync(join(uploadsDir, name));
      const sha = createHash('sha256').update(buf).digest('hex');
      const oldUrl = `/uploads/${name}`;

      const [rows] = await pool.execute('SELECT id FROM media WHERE sha256 = ?', [sha]);
      let id;
      if (rows.length) {
        id = rows[0].id; reused++;
      } else if (DRY) {
        id = `<new>`;
      } else {
        const [res] = await pool.execute(
          `INSERT INTO media (filename, mime_type, byte_size, data, sha256, source)
           VALUES (?, ?, ?, ?, ?, 'imported')`,
          [name, mime, buf.length, buf, sha],
        );
        id = res.insertId; imported++;
      }
      urlMap.set(oldUrl, `/api/media/${id}`);
      log(`  ${oldUrl} → /api/media/${id}`);
    }
  } else {
    log('  (public/uploads absent — aucun fichier à importer)');
  }
  log(`✓ Import terminé : ${imported} importée(s), ${reused} déjà présente(s).`);

  // 3. Réécrire les références "/uploads/xxx" → "/api/media/{id}" dans la base.
  //    On opère par remplacement de chaîne, ce qui couvre aussi le JSON projects.images.
  const replacements = [
    { table: 'settings', col: 'value', where: '' },
    { table: 'articles', col: 'image', where: '' },
    { table: 'articles', col: 'og_image', where: '' },
    { table: 'projects', col: 'images', where: '' },
    { table: 'users',    col: 'avatar_url', where: '' },
  ];

  let rewrites = 0;
  for (const [oldUrl, newUrl] of urlMap) {
    for (const r of replacements) {
      try {
        if (DRY) {
          const [rows] = await pool.execute(
            `SELECT COUNT(*) AS n FROM \`${r.table}\` WHERE \`${r.col}\` LIKE ?`,
            [`%${oldUrl}%`],
          );
          if (rows[0].n > 0) { log(`  [dry] ${r.table}.${r.col} : ${rows[0].n} ligne(s) à mettre à jour`); rewrites += rows[0].n; }
        } else {
          const [res] = await pool.execute(
            `UPDATE \`${r.table}\` SET \`${r.col}\` = REPLACE(\`${r.col}\`, ?, ?) WHERE \`${r.col}\` LIKE ?`,
            [oldUrl, newUrl, `%${oldUrl}%`],
          );
          rewrites += res.affectedRows;
        }
      } catch (e) {
        // Table/colonne absente : on ignore (schémas variables).
        if (!/Unknown column|doesn't exist|Table .* doesn't exist/.test(String(e.message))) {
          log(`  ! ${r.table}.${r.col} : ${e.message}`);
        }
      }
    }
  }
  log(`✓ Références réécrites : ${rewrites} ${DRY ? '(simulation)' : ''}.`);

  log(DRY ? '\nSimulation terminée — rien n’a été écrit.' : '\n✓ Migration terminée.');
} catch (e) {
  console.error('Erreur :', e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
