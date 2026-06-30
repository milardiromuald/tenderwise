import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { getAllSettings } from '@/lib/settings';
import { parseUserAgent, parseReferrer } from '@/lib/visits';

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  ).slice(0, 45);
}

function s(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/* ── POST (public) — enregistre une visite (consentement audience requis) ── */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Anti-abus large : autorise une navigation normale, bloque le flood.
  if (!await checkRateLimit(`track:${ip}`, 120, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const settings = await getAllSettings().catch(() => ({} as Record<string, string>));
    if ((settings.visit_tracking_enabled ?? '1') === '0') {
      return NextResponse.json({ ok: false, disabled: true });
    }

    const body = await req.json().catch(() => ({}));
    const path     = s(body.path, 512) || '/';
    const referrer = s(body.referrer, 512) || '';
    const session  = s(body.session_id, 40);

    const ua = parseUserAgent(req.headers.get('user-agent') || '');

    const selfHost = (() => { try { return new URL(req.url).hostname; } catch { return ''; } })();
    let { source, detail } = parseReferrer(referrer, selfHost);

    // UTM (priment sur le referrer s'ils existent)
    let utmSource = null, utmMedium = null, utmCampaign = null;
    try {
      const u = new URL(path, 'https://x');
      utmSource   = s(u.searchParams.get('utm_source'), 120);
      utmMedium   = s(u.searchParams.get('utm_medium'), 120);
      utmCampaign = s(u.searchParams.get('utm_campaign'), 120);
      if (utmSource) { source = utmSource.toLowerCase(); detail = utmMedium || detail; }
    } catch { /* ignore */ }

    // Trafic interne → on n'enregistre pas (pollue les stats)
    if (source === 'internal') return NextResponse.json({ ok: true, skipped: 'internal' });

    const geo = await (async () => {
      const isPrivate = !ip || ip === 'unknown' || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fe80:)/i.test(ip);
      if (isPrivate) return { country: null as string | null, country_code: null as string | null, city: null as string | null };
      try {
        const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
          headers: { 'User-Agent': 'tenderwise-stats/1.0' },
          signal: AbortSignal.timeout(1500),
        });
        if (!r.ok) return { country: null, country_code: null, city: null };
        const d = await r.json();
        if (d.error) return { country: null, country_code: null, city: null };
        return {
          country: (d.country_name as string) || null,
          country_code: (d.country_code as string) || null,
          city: (d.city as string) || null,
        };
      } catch {
        return { country: null, country_code: null, city: null };
      }
    })();

    const { insertId } = await execute(
      `INSERT INTO site_visits
         (path, referrer, source, source_detail, utm_source, utm_medium, utm_campaign,
          device, browser, os, country, country_code, city, ip_address, session_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [path, referrer || null, source, detail, utmSource, utmMedium, utmCampaign,
       ua.device, ua.browser, ua.os, geo.country, geo.country_code, geo.city, ip, session]
    );

    return NextResponse.json({ ok: true, visit_id: insertId });
  } catch (err) {
    console.error('[POST /api/track]', err);
    return NextResponse.json({ ok: false }, { status: 200 }); // jamais bloquant côté visiteur
  }
}

/* ── GET (admin) — agrégats pour le tableau de bord ──────────────────────── */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const days = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('days') || '30', 10) || 30, 1), 365);

  try {
    const since = `DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
    const where = `WHERE created_at >= ${since}`;

    const [[totals], byDevice, bySource, topPages, byCountry, byBrowser, daily, recent] = await Promise.all([
      query<{ visits: number; sessions: number; today: number }>(
        `SELECT COUNT(*) AS visits,
                COUNT(DISTINCT session_id) AS sessions,
                SUM(created_at >= CURDATE()) AS today
           FROM site_visits ${where}`
      ),
      query(`SELECT COALESCE(device,'?') AS k, COUNT(*) AS c FROM site_visits ${where} GROUP BY device ORDER BY c DESC`),
      query(`SELECT COALESCE(source,'?') AS k, COUNT(*) AS c FROM site_visits ${where} GROUP BY source ORDER BY c DESC LIMIT 8`),
      query(`SELECT COALESCE(path,'?') AS k, COUNT(*) AS c FROM site_visits ${where} GROUP BY path ORDER BY c DESC LIMIT 8`),
      query(`SELECT COALESCE(country,'Inconnu') AS k, country_code AS cc, COUNT(*) AS c FROM site_visits ${where} GROUP BY country, country_code ORDER BY c DESC LIMIT 8`),
      query(`SELECT COALESCE(browser,'?') AS k, COUNT(*) AS c FROM site_visits ${where} GROUP BY browser ORDER BY c DESC LIMIT 6`),
      query(`SELECT DATE(created_at) AS d, COUNT(*) AS c FROM site_visits ${where} GROUP BY DATE(created_at) ORDER BY d ASC`),
      query(`SELECT created_at, path, source, source_detail, device, browser, os, country, city, ip_address
               FROM site_visits ORDER BY created_at DESC LIMIT 50`),
    ]);

    return NextResponse.json({
      ok: true, days,
      totals: { visits: Number(totals?.visits || 0), sessions: Number(totals?.sessions || 0), today: Number(totals?.today || 0) },
      byDevice, bySource, topPages, byCountry, byBrowser, daily, recent,
    });
  } catch (err) {
    console.error('[GET /api/track]', err);
    return NextResponse.json({ ok: false, error: 'table_absente' });
  }
}
