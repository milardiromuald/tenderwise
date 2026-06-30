import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { publishDue } from '@/lib/workflowPublish';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Déclencheur de publication programmée — à appeler par une VRAIE tâche planifiée
 * (cron système o2switch, UptimeRobot, GitHub Actions, etc.) pour que les articles
 * programmés soient publiés à l'heure dite, sans dépendre de l'ouverture d'une page
 * d'admin.
 *
 * Exemple de cron (toutes les 5 min) :
 *   curl -fsS "https://www.tenderwise.fr/api/cron/publish?key=VOTRE_SECRET"
 *
 * Authentification (au choix) :
 *   - en-tête  Authorization: Bearer <CRON_SECRET>
 *   - en-tête  x-cron-key: <CRON_SECRET>
 *   - query    ?key=<CRON_SECRET>
 *   - sinon, une session admin valide (déclenchement manuel depuis le navigateur).
 *
 * Si la variable d'environnement CRON_SECRET n'est pas définie, seule la session
 * admin est acceptée (le endpoint n'est jamais ouvert sans authentification).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';

  let authorized = false;
  if (secret) {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const headerKey = req.headers.get('x-cron-key')?.trim();
    const queryKey = req.nextUrl.searchParams.get('key')?.trim();
    authorized = bearer === secret || headerKey === secret || queryKey === secret;
  }

  // Repli : une session admin peut toujours déclencher manuellement.
  if (!authorized) {
    const session = await getSession();
    authorized = !!session;
  }

  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const published = await publishDue();
    return NextResponse.json({ ok: true, published });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 },
    );
  }
}
