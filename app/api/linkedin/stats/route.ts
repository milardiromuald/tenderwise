import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { fetchPostEngagement } from '@/lib/linkedin';

interface PostRow {
  id:               number;
  text:             string;
  linkedin_urn:     string | null;
  linkedin_url:     string | null;
  status:           string;
  source:           string;
  created_at:       string;
  likes:            number | null;
  comments:         number | null;
  stats_fetched_at: string | null;
}

/**
 * Tableau de bord LinkedIn — agrégations calculées à partir des posts en base
 * (`linkedin_posts`), enrichies au besoin avec l'engagement réel récupéré
 * depuis l'API LinkedIn.
 *
 *   GET /api/linkedin/stats             → renvoie les agrégats (rapide, base seule)
 *   GET /api/linkedin/stats?refresh=1   → rafraîchit d'abord likes/commentaires
 *                                          via l'API LinkedIn, puis renvoie
 *
 * Ne renvoie QUE des données réelles : pas d'impressions / vues / clics
 * (indisponibles via l'API pour un compte personnel).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const refresh = req.nextUrl.searchParams.get('refresh') === '1';

  // Sélection tolérante : si la migration des colonnes d'engagement n'a pas été
  // exécutée, on retombe sur une requête sans ces colonnes.
  let rows: PostRow[] = [];
  let hasEngagementColumns = true;
  try {
    rows = await query<PostRow>(
      `SELECT id, text, linkedin_urn, linkedin_url, status, source, created_at,
              likes, comments, stats_fetched_at
       FROM linkedin_posts
       ORDER BY created_at DESC`,
    );
  } catch {
    hasEngagementColumns = false;
    try {
      const base = await query<Omit<PostRow, 'likes' | 'comments' | 'stats_fetched_at'>>(
        `SELECT id, text, linkedin_urn, linkedin_url, status, source, created_at
         FROM linkedin_posts
         ORDER BY created_at DESC`,
      );
      rows = base.map(r => ({ ...r, likes: null, comments: null, stats_fetched_at: null }));
    } catch {
      // Table absente → renvoie un tableau de bord vide plutôt qu'une erreur.
      return NextResponse.json(emptyDashboard());
    }
  }

  // ── Rafraîchissement de l'engagement via l'API LinkedIn ──────────────────
  let refreshed = 0;
  let refreshError: string | null = null;
  if (refresh && hasEngagementColumns) {
    // On limite aux 25 posts publiés les plus récents disposant d'un URN, pour
    // éviter de saturer l'API à chaque clic.
    const targets = rows
      .filter(r => r.status === 'published' && r.linkedin_urn)
      .slice(0, 25);
    for (const r of targets) {
      const eng = await fetchPostEngagement(r.linkedin_urn as string);
      if (eng) {
        await execute(
          `UPDATE linkedin_posts
           SET likes = ?, comments = ?, stats_fetched_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [eng.likes, eng.comments, r.id],
        ).catch(() => {});
        r.likes = eng.likes;
        r.comments = eng.comments;
        r.stats_fetched_at = new Date().toISOString();
        refreshed++;
      }
    }
    if (targets.length > 0 && refreshed === 0) {
      refreshError =
        "L'API LinkedIn n'a renvoyé aucune statistique. Les likes/commentaires ne sont " +
        'pas accessibles avec les permissions actuelles de votre app LinkedIn.';
    }
  }

  // ── Agrégations ──────────────────────────────────────────────────────────
  const total      = rows.length;
  const published  = rows.filter(r => r.status === 'published').length;
  const failed     = rows.filter(r => r.status === 'failed').length;
  const successRate = total > 0 ? Math.round((published / total) * 100) : 0;

  const bySource: Record<string, number> = { manual: 0, chat: 0, blog: 0 };
  for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + 1;

  const totalLikes    = rows.reduce((s, r) => s + (r.likes ?? 0), 0);
  const totalComments = rows.reduce((s, r) => s + (r.comments ?? 0), 0);
  const engagementKnown = rows.some(r => r.stats_fetched_at);

  // Activité sur les 30 derniers jours (par jour).
  const byDay: { date: string; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = r.created_at.slice(0, 10); // YYYY-MM-DD (dateStrings activé)
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay.push({ date: key, count: counts.get(key) || 0 });
  }

  const dates = rows.map(r => r.created_at).sort();
  const firstPost = dates[0] || null;
  const lastPost  = dates[dates.length - 1] || null;

  // Liste détaillée pour l'onglet Engagement.
  const posts = rows.map(r => ({
    id:               r.id,
    text:             r.text.length > 160 ? r.text.slice(0, 160) + '…' : r.text,
    linkedin_url:     r.linkedin_url,
    status:           r.status,
    source:           r.source,
    created_at:       r.created_at,
    likes:            r.likes,
    comments:         r.comments,
    stats_fetched_at: r.stats_fetched_at,
  }));

  return NextResponse.json({
    summary: {
      total, published, failed, successRate,
      totalLikes, totalComments, engagementKnown,
      firstPost, lastPost,
    },
    bySource,
    byDay,
    posts,
    engagementSupported: hasEngagementColumns,
    refreshed,
    refreshError,
  });
}

function emptyDashboard() {
  const byDay: { date: string; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    byDay.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  return {
    summary: {
      total: 0, published: 0, failed: 0, successRate: 0,
      totalLikes: 0, totalComments: 0, engagementKnown: false,
      firstPost: null, lastPost: null,
    },
    bySource: { manual: 0, chat: 0, blog: 0 },
    byDay,
    posts: [],
    engagementSupported: false,
    refreshed: 0,
    refreshError: null,
  };
}
