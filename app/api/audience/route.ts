import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

// Condition SQL LinkedIn (gère ancien format source='social' + nouveau format source='linkedin')
const LI = `(source = 'linkedin' OR source_detail LIKE '%linkedin%' OR utm_source LIKE '%linkedin%' OR referrer LIKE '%linkedin.com%')`;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const url  = new URL(req.url);
  const type = url.searchParams.get('type') || 'overview';
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
  const since = `DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
  const where = `WHERE created_at >= ${since}`;

  try {
    if (type === 'overview') {
      const [[totals], bySource, topPages, byDevice, daily] = await Promise.all([
        query<{ visits: number; sessions: number; today: number; linkedin: number; avg_dur: number | null }>(
          `SELECT COUNT(*) AS visits,
                  COUNT(DISTINCT session_id) AS sessions,
                  SUM(created_at >= CURDATE()) AS today,
                  SUM(${LI}) AS linkedin,
                  AVG(duration_seconds) AS avg_dur
             FROM site_visits ${where}`
        ),
        query<{ k: string; c: number }>(
          `SELECT
             CASE WHEN ${LI} THEN 'linkedin'
                  ELSE COALESCE(source, 'direct') END AS k,
             COUNT(*) AS c
           FROM site_visits ${where}
           GROUP BY k ORDER BY c DESC LIMIT 10`
        ),
        query<{ k: string; c: number; avg_dur: number | null }>(
          `SELECT path AS k, COUNT(*) AS c, AVG(duration_seconds) AS avg_dur
             FROM site_visits ${where}
             GROUP BY path ORDER BY c DESC LIMIT 12`
        ),
        query<{ k: string; c: number }>(
          `SELECT COALESCE(device, '?') AS k, COUNT(*) AS c
             FROM site_visits ${where}
             GROUP BY device ORDER BY c DESC`
        ),
        query<{ d: string; c: number }>(
          `SELECT DATE(created_at) AS d, COUNT(*) AS c
             FROM site_visits ${where}
             GROUP BY DATE(created_at) ORDER BY d ASC`
        ),
      ]);

      return NextResponse.json({ ok: true, days, type, totals: totals ?? {}, bySource, topPages, byDevice, daily });
    }

    if (type === 'linkedin') {
      const liWhere = `WHERE ${LI} AND created_at >= ${since}`;

      const [[totals], topPages, byDevice, daily, byCampaign] = await Promise.all([
        query<{ total: number; sessions: number; avg_dur: number | null; unique_pages: number }>(
          `SELECT COUNT(*) AS total,
                  COUNT(DISTINCT session_id) AS sessions,
                  AVG(duration_seconds) AS avg_dur,
                  COUNT(DISTINCT path) AS unique_pages
             FROM site_visits ${liWhere}`
        ),
        query<{ k: string; c: number; avg_dur: number | null }>(
          `SELECT path AS k, COUNT(*) AS c, AVG(duration_seconds) AS avg_dur
             FROM site_visits ${liWhere}
             GROUP BY path ORDER BY c DESC LIMIT 12`
        ),
        query<{ k: string; c: number }>(
          `SELECT COALESCE(device, '?') AS k, COUNT(*) AS c
             FROM site_visits ${liWhere}
             GROUP BY device ORDER BY c DESC`
        ),
        query<{ d: string; c: number }>(
          `SELECT DATE(created_at) AS d, COUNT(*) AS c
             FROM site_visits ${liWhere}
             GROUP BY DATE(created_at) ORDER BY d ASC`
        ),
        query<{ k: string; c: number }>(
          `SELECT COALESCE(utm_campaign, 'Sans campagne UTM') AS k, COUNT(*) AS c
             FROM site_visits ${liWhere}
             GROUP BY utm_campaign ORDER BY c DESC LIMIT 8`
        ),
      ]);

      return NextResponse.json({ ok: true, days, type, totals: totals ?? {}, topPages, byDevice, daily, byCampaign });
    }

    if (type === 'journeys') {
      // Sessions multi-pages récentes
      const sessions = await query<{ session_id: string; steps: number; journey: string; started_at: string; total_dur: number | null; is_linkedin: number }>(
        `SELECT session_id,
                COUNT(*) AS steps,
                GROUP_CONCAT(path ORDER BY created_at SEPARATOR '|||') AS journey,
                MIN(created_at) AS started_at,
                SUM(duration_seconds) AS total_dur,
                MAX(${LI}) AS is_linkedin
           FROM site_visits
           ${where} AND session_id IS NOT NULL
           GROUP BY session_id
           HAVING steps > 1
           ORDER BY started_at DESC
           LIMIT 60`
      );

      // Transitions les plus fréquentes (paires de pages adjacentes)
      const transitions = await query<{ from_path: string; to_path: string; c: number }>(
        `SELECT a.path AS from_path, b.path AS to_path, COUNT(*) AS c
           FROM site_visits a
           JOIN site_visits b
             ON a.session_id = b.session_id
            AND b.created_at > a.created_at
            AND b.created_at <= a.created_at + INTERVAL 30 MINUTE
            AND NOT EXISTS (
              SELECT 1 FROM site_visits m
               WHERE m.session_id = a.session_id
                 AND m.created_at > a.created_at
                 AND m.created_at < b.created_at
            )
           WHERE a.created_at >= ${since}
             AND a.session_id IS NOT NULL
           GROUP BY from_path, to_path
           ORDER BY c DESC
           LIMIT 12`
      );

      // Pages d'entrée les plus fréquentes
      const entries = await query<{ k: string; c: number; linkedin_pct: number }>(
        `SELECT entry.path AS k, COUNT(*) AS c,
                ROUND(SUM(
                  entry.source = 'linkedin'
                  OR entry.source_detail LIKE '%linkedin%'
                  OR entry.utm_source LIKE '%linkedin%'
                  OR entry.referrer LIKE '%linkedin.com%'
                ) * 100 / COUNT(*)) AS linkedin_pct
           FROM site_visits entry
           WHERE entry.created_at >= ${since}
             AND entry.session_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM site_visits prev
                WHERE prev.session_id = entry.session_id
                  AND prev.created_at < entry.created_at
             )
           GROUP BY entry.path
           ORDER BY c DESC LIMIT 10`
      );

      return NextResponse.json({ ok: true, days, type, sessions, transitions, entries });
    }

    if (type === 'duration') {
      const byPage = await query<{ k: string; views: number; with_dur: number; avg_dur: number | null; quick: number; good: number }>(
        `SELECT path AS k,
                COUNT(*) AS views,
                SUM(duration_seconds IS NOT NULL) AS with_dur,
                AVG(duration_seconds) AS avg_dur,
                SUM(duration_seconds IS NOT NULL AND duration_seconds < 10) AS quick,
                SUM(duration_seconds >= 60) AS good
           FROM site_visits
           ${where} AND duration_seconds IS NOT NULL
           GROUP BY path
           ORDER BY avg_dur DESC
           LIMIT 20`
      );

      const [[overall]] = await Promise.all([
        query<{ avg_dur: number | null; med_dur: number | null; tracked: number }>(
          `SELECT AVG(duration_seconds) AS avg_dur,
                  AVG(duration_seconds) AS med_dur,
                  COUNT(*) AS tracked
             FROM site_visits ${where} AND duration_seconds IS NOT NULL`
        ),
      ]);

      return NextResponse.json({ ok: true, days, type, byPage, overall: overall ?? {} });
    }

    return NextResponse.json({ error: 'type inconnu' }, { status: 400 });

  } catch (err) {
    console.error('[GET /api/audience]', err);
    return NextResponse.json({ ok: false, error: 'erreur_serveur' }, { status: 500 });
  }
}
