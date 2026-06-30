import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth';
import {
  getLinkedInCredentials,
  getRedirectUri,
  getBaseUrl,
  getLinkedInScopes,
  logLinkedIn,
  type LinkedInTarget,
} from '@/lib/linkedin';

/** Cookie portant le `state` CSRF pour la durée du round-trip OAuth. */
export const LI_STATE_COOKIE  = 'li_oauth_state';
/** Cookie mémorisant la connexion ciblée (perso/Page) pour le callback. */
export const LI_TARGET_COOKIE = 'li_oauth_target';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const base    = getBaseUrl(req);
  if (!session) return NextResponse.redirect(`${base}/admin/login`);

  // Connexion ciblée : ?which=organization pour la Page entreprise, perso sinon.
  const which: LinkedInTarget =
    req.nextUrl.searchParams.get('which') === 'organization' ? 'organization' : 'person';

  // On exige clientId ET un secret réellement déchiffrable, pour l'app ciblée.
  const { clientId, clientSecret } = await getLinkedInCredentials(which);
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/admin/linkedin?error=no_client`);
  }

  const state       = crypto.randomBytes(24).toString('hex');
  const redirectUri = getRedirectUri(req);
  const scopes      = await getLinkedInScopes(which);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    state,
    scope:         scopes.join(' '),
  });

  logLinkedIn('authorize → redirect', { which, redirectUri, scope: scopes.join(' ') });

  const res = NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
  );

  // `state` + `target` portés par des cookies httpOnly propres à CE flux (et non
  // par une ligne globale en base partagée entre onglets, qui provoquait des
  // « invalid_state » dès qu'un second flux démarrait). SameSite=Lax : renvoyés
  // sur la navigation top-level GET de retour depuis linkedin.com.
  const cookieOpts = {
    httpOnly: true,
    secure:   base.startsWith('https://'),
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   600, // 10 minutes
  };
  res.cookies.set(LI_STATE_COOKIE,  state, cookieOpts);
  res.cookies.set(LI_TARGET_COOKIE, which, cookieOpts);

  return res;
}
