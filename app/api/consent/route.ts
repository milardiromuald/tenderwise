import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * POST (public)  — enregistre une preuve de consentement aux cookies.
 * GET  (admin)   — renvoie le registre des consentements (pour /admin/rgpd).
 */

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  ).slice(0, 45);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // Anti-abus : max 20 enregistrements par IP / 10 min (suffisant pour des changements d’avis légitimes).
  if (!await checkRateLimit(`consent:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await req.json();

    const consentId = typeof body.consent_id === 'string' ? body.consent_id.slice(0, 40) : '';
    const analytics = body.analytics === true ? 1 : 0;
    const marketing = body.marketing === true ? 1 : 0;
    const action    = ['accept_all', 'reject_all', 'custom'].includes(body.action) ? body.action : 'custom';
    const version   = typeof body.policy_version === 'string' ? body.policy_version.slice(0, 20) : null;
    const pageUrl   = typeof body.page_url === 'string' ? body.page_url.slice(0, 500) : null;
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 500);

    if (!consentId) return NextResponse.json({ ok: false, error: 'consent_id requis' }, { status: 422 });

    await execute(
      `INSERT INTO cookie_consents
         (consent_id, necessary, analytics, marketing, action, policy_version, ip_address, user_agent, page_url, created_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [consentId, analytics, marketing, action, version, ip, userAgent, pageUrl]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/consent]', err);
    // On ne renvoie pas d’erreur bloquante : le consentement est déjà appliqué côté client.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

/* ── DELETE (admin) — suppression du registre : un id, une sélection, ou tout ── */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  try {
    // 1) un seul enregistrement
    if (body.id !== undefined) {
      const id = parseInt(String(body.id), 10);
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
      const r = await execute('DELETE FROM cookie_consents WHERE id = ?', [id]);
      return NextResponse.json({ ok: true, deleted: r.affectedRows });
    }
    // 2) une sélection d’identifiants
    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const ids = body.ids.map((x: unknown) => parseInt(String(x), 10)).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 1000);
      if (ids.length === 0) return NextResponse.json({ error: 'Sélection vide' }, { status: 400 });
      const placeholders = ids.map(() => '?').join(',');
      const r = await execute(`DELETE FROM cookie_consents WHERE id IN (${placeholders})`, ids);
      return NextResponse.json({ ok: true, deleted: r.affectedRows });
    }
    // 3) purge des plus anciens que N jours
    if (body.olderThanDays !== undefined) {
      const d = Math.min(Math.max(parseInt(String(body.olderThanDays), 10) || 0, 1), 3650);
      const r = await execute(`DELETE FROM cookie_consents WHERE created_at < DATE_SUB(NOW(), INTERVAL ${d} DAY)`);
      return NextResponse.json({ ok: true, deleted: r.affectedRows });
    }
    // 4) tout le registre (action explicite)
    if (body.all === true) {
      const r = await execute('DELETE FROM cookie_consents');
      return NextResponse.json({ ok: true, deleted: r.affectedRows });
    }
    return NextResponse.json({ error: 'Préciser id, ids, olderThanDays ou all.' }, { status: 422 });
  } catch (err) {
    console.error('[DELETE /api/consent]', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 1000);

  try {
    // `limit` est déjà validé en entier borné [1,1000] ci-dessus — inline sûr
    // (mysql2 ne lie pas correctement LIMIT via placeholder préparé).
    const rows = await query(
      `SELECT id, consent_id, necessary, analytics, marketing, action, policy_version,
              ip_address, user_agent, page_url, created_at
         FROM cookie_consents
        ORDER BY created_at DESC
        LIMIT ${limit}`
    );

    const stats = await query<{ action: string; c: number }>(
      'SELECT action, COUNT(*) AS c FROM cookie_consents GROUP BY action'
    );
    const counts: Record<string, number> = {};
    stats.forEach((s) => { counts[s.action] = Number(s.c); });

    return NextResponse.json({ rows, counts });
  } catch (err) {
    console.error('[GET /api/consent]', err);
    return NextResponse.json({ rows: [], counts: {}, error: 'table_absente' });
  }
}
