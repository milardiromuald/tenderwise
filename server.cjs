'use strict';

if (typeof PhusionPassenger !== 'undefined') {
  PhusionPassenger.configure({ autoInstall: false });
}

const { createServer } = require('http');
const { parse } = require('url');
const { appendFileSync, createReadStream, existsSync } = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

const { loadEnvConfig } = require('@next/env');
loadEnvConfig(__dirname, process.env.NODE_ENV !== 'production');

const nextModule = require('next');
const next = typeof nextModule === 'function' ? nextModule : nextModule.default;

const logFile = path.join(__dirname, 'app_error.log');

function logError(label, err) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] [ERROR] ${label}: ${err && err.stack ? err.stack : err}\n`;
  try { appendFileSync(logFile, msg); } catch {}
  console.error(msg.trim());
}

function logInfo(label, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [CRON] ${label}: ${msg}\n`;
  try { appendFileSync(logFile, line); } catch {}
  console.log(line.trim());
}

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

process.on('uncaughtException', (err) => logError('uncaughtException', err));
process.on('unhandledRejection', (reason) => logError('unhandledRejection', reason));

// ─── Planificateur interne ────────────────────────────────────────────────────
// Les routes /api/cron/* contiennent toute la logique métier (publication,
// génération d'idées). On les appelle via un serveur HTTP local (127.0.0.1)
// qui tourne en parallèle de Passenger — pas besoin de tâche cPanel.

const CRON_SECRET = process.env.CRON_SECRET || '';
const CRON_PORT   = parseInt(process.env.CRON_INTERNAL_PORT || '3001', 10);

function callCron(endpoint) {
  if (!CRON_SECRET) return;
  const http = require('http');
  const req  = http.request(
    {
      hostname: '127.0.0.1',
      port    : CRON_PORT,
      path    : `/api/cron/${endpoint}?key=${encodeURIComponent(CRON_SECRET)}`,
      method  : 'GET',
      headers : { host: 'www.tenderwise.fr' },
      timeout : 120_000,
    },
    (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (endpoint === 'publish' && json.published > 0) {
            logInfo('publish', `${json.published} article(s) publié(s) automatiquement`);
          }
          if (endpoint === 'ideas') {
            if (json.ok && !json.skipped) logInfo('ideas', `${json.generated} idée(s) générée(s)`);
            else if (json.ok && json.skipped) logInfo('ideas', 'idées déjà générées aujourd\'hui');
            else logError('ideas', json.error || 'erreur inconnue');
          }
        } catch { /* réponse non-JSON : erreur Next.js déjà loguée */ }
      });
    },
  );
  req.on('error',   (err) => logError(`cron/${endpoint}`, err));
  req.on('timeout', ()    => { req.destroy(); logError(`cron/${endpoint}`, 'timeout 120s'); });
  req.end();
}

// Calcule le délai jusqu'au prochain 4h00 (heure serveur o2switch = UTC+2 en été)
function msUntilNextHour(hour) {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function startCronJobs() {
  // — Publication : vérification toutes les 60 secondes
  //   La date de déclenchement est dans la DB (scheduled_at), pas ici.
  setInterval(() => callCron('publish'), 60_000);

  // — Idées : tous les jours à 4h00
  const delay = msUntilNextHour(4);
  const nextRun = new Date(Date.now() + delay);
  console.log(`> Idées auto : prochain déclenchement à ${nextRun.toLocaleString('fr-FR')} (~${Math.round(delay / 3_600_000)}h)`);

  setTimeout(() => {
    callCron('ideas');
    setInterval(() => callCron('ideas'), 24 * 60 * 60 * 1_000);
  }, delay);

  console.log('> Cron interne actif — publication : toutes les 60 s | idées : 04h00 quotidien');
}

// ─── Serveur principal ────────────────────────────────────────────────────────

app.prepare()
  .then(() => {
    function handler(req, res) {
      const parsedUrl = parse(req.url || '/', true);
      const pathname  = parsedUrl.pathname || '/';

      // Fichiers uploadés servis directement (bypass Next.js)
      if (pathname.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, 'public', pathname);
        const ext      = path.extname(filePath).toLowerCase();
        if (existsSync(filePath) && MIME_TYPES[ext]) {
          res.setHeader('Content-Type', MIME_TYPES[ext]);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          createReadStream(filePath).pipe(res);
          return;
        }
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      handle(req, res, parsedUrl).catch((err) => {
        logError(`request ${req.url}`, err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });
    }

    // Serveur principal : Passenger (socket) ou port TCP selon l'environnement
    const server = createServer(handler);
    if (typeof PhusionPassenger !== 'undefined') {
      server.listen('passenger');
      console.log('> Ready via Passenger');
    } else {
      const port = parseInt(process.env.PORT || '3000', 10);
      server.listen(port, () => {
        console.log('> Ready on http://localhost:' + port);
      });
    }

    // Serveur interne cron : accessible uniquement depuis 127.0.0.1
    // Partage le même handler Next.js → toutes les routes API fonctionnent.
    const internalServer = createServer(handler);
    internalServer.on('error', (err) => {
      logError(`Serveur interne cron (port ${CRON_PORT})`, err);
    });
    internalServer.listen(CRON_PORT, '127.0.0.1', () => {
      console.log(`> Serveur interne cron : 127.0.0.1:${CRON_PORT}`);
      startCronJobs();
    });
  })
  .catch((err) => {
    logError('Startup error', err);
    process.exit(1);
  });
