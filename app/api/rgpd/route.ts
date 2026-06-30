import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';

/**
 * Outil « Demandes RGPD » (admin uniquement).
 *
 *  - op: 'search' → retrouve TOUTES les données personnelles d’une personne,
 *                   à partir de son email et/ou de son adresse IP, dans toutes
 *                   les tables concernées (droit d’accès / portabilité, art. 15 & 20).
 *  - op: 'erase'  → supprime définitivement ces données (droit à l’effacement, art. 17).
 *
 * L'email est l’identifiant principal d’une personne (le formulaire de contact
 * le collecte). L'IP, pseudonyme, ne permet de retrouver que des logs techniques
 * (cookies, tentatives de connexion) et reste facultative.
 */

interface Found {
  contact_messages: Record<string, unknown>[];
  job_applications: Record<string, unknown>[];
  cookie_consents: Record<string, unknown>[];
  site_visits: Record<string, unknown>[];
  login_audit: Record<string, unknown>[];
}

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try { return await fn(); } catch { return []; } // table absente / DB indispo → ignore
}

async function lookup(email: string, ip: string): Promise<Found> {
  const found: Found = { contact_messages: [], job_applications: [], cookie_consents: [], site_visits: [], login_audit: [] };

  if (email) {
    found.contact_messages = await safe(() =>
      query(
        `SELECT id, nom, email, telephone, societe, objet, message,
                rgpd_consent, rgpd_consent_date, ip_address, user_agent, statut, created_at
           FROM contact_messages
          WHERE LOWER(email) = LOWER(?)
          ORDER BY created_at DESC`,
        [email]
      )
    );

    // job_applications : on exclut les blobs CV/LM (on liste seulement les métadonnées).
    found.job_applications = await safe(() =>
      query(
        `SELECT id, job_id, job_title, nom, prenom, email, telephone, message,
                cv_filename, lm_filename, rgpd_consent, rgpd_consent_date,
                ip_address, statut, created_at
           FROM job_applications
          WHERE LOWER(email) = LOWER(?)
          ORDER BY created_at DESC`,
        [email]
      )
    );
  }

  if (ip) {
    found.cookie_consents = await safe(() =>
      query(
        `SELECT id, consent_id, analytics, marketing, action, policy_version,
                ip_address, user_agent, page_url, created_at
           FROM cookie_consents
          WHERE ip_address = ?
          ORDER BY created_at DESC`,
        [ip]
      )
    );

    found.site_visits = await safe(() =>
      query(
        `SELECT id, path, source, device, browser, os, country, city, ip_address, created_at
           FROM site_visits
          WHERE ip_address = ?
          ORDER BY created_at DESC
          LIMIT 500`,
        [ip]
      )
    );
  }

  // login_audit : on cherche par identifiant (souvent = email) ET par IP.
  if (email || ip) {
    found.login_audit = await safe(() =>
      query(
        `SELECT id, username, ip, user_agent, success, reason, created_at
           FROM login_audit
          WHERE (? <> '' AND LOWER(username) = LOWER(?))
             OR (? <> '' AND ip = ?)
          ORDER BY created_at DESC`,
        [email, email, ip, ip]
      )
    );
  }

  return found;
}

async function erase(email: string, ip: string) {
  const counts = { contact_messages: 0, job_applications: 0, cookie_consents: 0, site_visits: 0, login_audit: 0 };

  if (email) {
    try {
      const r = await execute('DELETE FROM contact_messages WHERE LOWER(email) = LOWER(?)', [email]);
      counts.contact_messages = r.affectedRows;
    } catch { /* table absente */ }
    try {
      const r = await execute('DELETE FROM job_applications WHERE LOWER(email) = LOWER(?)', [email]);
      counts.job_applications = r.affectedRows;
    } catch { /* table absente */ }
  }
  if (ip) {
    try {
      const r = await execute('DELETE FROM cookie_consents WHERE ip_address = ?', [ip]);
      counts.cookie_consents = r.affectedRows;
    } catch { /* table absente */ }
    try {
      const r = await execute('DELETE FROM site_visits WHERE ip_address = ?', [ip]);
      counts.site_visits = r.affectedRows;
    } catch { /* table absente */ }
  }
  if (email || ip) {
    try {
      const r = await execute(
        `DELETE FROM login_audit
          WHERE (? <> '' AND LOWER(username) = LOWER(?))
             OR (? <> '' AND ip = ?)`,
        [email, email, ip, ip]
      );
      counts.login_audit = r.affectedRows;
    } catch { /* table absente */ }
  }

  return counts;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const op    = body.op === 'erase' ? 'erase' : 'search';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 255) : '';
  const ip    = typeof body.ip === 'string' ? body.ip.trim().slice(0, 45) : '';

  if (!email && !ip) {
    return NextResponse.json({ error: 'Indiquez au moins un email ou une adresse IP.' }, { status: 422 });
  }

  try {
    if (op === 'erase') {
      const counts = await erase(email, ip);
      const total = counts.contact_messages + counts.cookie_consents + counts.login_audit;
      return NextResponse.json({ ok: true, counts, total });
    }
    const found = await lookup(email, ip);
    const total = found.contact_messages.length + found.cookie_consents.length + found.login_audit.length;
    return NextResponse.json({ ok: true, found, total });
  } catch (err) {
    console.error('[POST /api/rgpd]', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
