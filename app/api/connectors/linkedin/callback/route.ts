import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getLinkedInCredentials,
  getRedirectUri,
  getBaseUrl,
  saveLinkedInToken,
  saveLinkedInOrgToken,
  fetchAdminOrganizations,
  logLinkedIn,
  type LinkedInTarget,
} from '@/lib/linkedin';
import { getSetting, setSetting } from '@/lib/settings';
import { LI_STATE_COOKIE, LI_TARGET_COOKIE } from '../authorize/route';

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req);

  // Tout retour vers l'admin efface les cookies du flux (usage unique).
  const back = (q: string) => {
    const r = NextResponse.redirect(`${base}/admin/linkedin?${q}`);
    r.cookies.set(LI_STATE_COOKIE,  '', { path: '/', maxAge: 0 });
    r.cookies.set(LI_TARGET_COOKIE, '', { path: '/', maxAge: 0 });
    return r;
  };

  const session = await getSession();
  if (!session) return NextResponse.redirect(`${base}/admin/login`);

  const code       = req.nextUrl.searchParams.get('code');
  const state      = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');
  const oauthDesc  = req.nextUrl.searchParams.get('error_description');

  // Connexion ciblée (cookie posé à l'authorize ; perso par défaut).
  const which: LinkedInTarget =
    req.cookies.get(LI_TARGET_COOKIE)?.value === 'organization' ? 'organization' : 'person';

  if (oauthError) {
    logLinkedIn('callback ← LinkedIn error', { which, error: oauthError, description: oauthDesc });
    return back(`error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) return back('error=missing_code');

  // CSRF check — le state attendu provient du cookie httpOnly posé à l'authorize.
  const storedState = req.cookies.get(LI_STATE_COOKIE)?.value || '';
  if (!state || !storedState || state !== storedState) {
    logLinkedIn('callback invalid_state', { which, hasState: !!state, hasCookie: !!storedState });
    return back('error=invalid_state');
  }

  const { clientId, clientSecret } = await getLinkedInCredentials(which);
  if (!clientId || !clientSecret) {
    logLinkedIn('callback no_client', { which, hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    return back('error=no_client');
  }

  // Code → access token
  let tokens: {
    access_token?: string;
    expires_in?:   number;
    error?:        string;
    error_description?: string;
  };
  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  getRedirectUri(req),
      }),
    });
    tokens = await res.json().catch(() => ({}));
    if (!res.ok) {
      logLinkedIn('token exchange failed', { which, status: res.status, body: tokens });
      return back(`error=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`);
    }
  } catch (e) {
    logLinkedIn('token exchange exception', e instanceof Error ? e.message : String(e));
    return back('error=token_exchange_failed');
  }

  if (!tokens.access_token) {
    logLinkedIn('token exchange: no access_token', { which, tokens });
    return back('error=no_access_token');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONNEXION PAGE ENTREPRISE : jeton + liste des Pages administrables.
  //  Pas d'identité personnelle à récupérer (scopes Community Management seuls).
  // ════════════════════════════════════════════════════════════════════════
  if (which === 'organization') {
    await saveLinkedInOrgToken({
      accessToken: tokens.access_token,
      expiresIn:   tokens.expires_in ?? 5184000, // 60 jours par défaut
    });

    try {
      const orgs = await fetchAdminOrganizations(tokens.access_token);
      await setSetting('linkedin_orgs', JSON.stringify(orgs));
      const currentUrn = await getSetting('linkedin_org_urn', '');
      const stillValid = orgs.some(o => o.urn === currentUrn);
      if (orgs.length > 0 && (!currentUrn || !stillValid)) {
        await setSetting('linkedin_org_urn',  orgs[0].urn);
        await setSetting('linkedin_org_name', orgs[0].name);
      }
      logLinkedIn('org connected', { count: orgs.length });
    } catch (e) {
      logLinkedIn('org pages fetch exception', e instanceof Error ? e.message : String(e));
    }

    return back('connected=org');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONNEXION COMPTE PERSONNEL : jeton + identité (OpenID userinfo → v2/me).
  // ════════════════════════════════════════════════════════════════════════
  let personUrn = '';
  let email     = '';
  let name      = '';

  try {
    const uRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (uRes.ok) {
      const u = await uRes.json();
      const sub = (u.sub as string) || '';
      personUrn = sub.startsWith('urn:li:') ? sub : `urn:li:person:${sub}`;
      email     = (u.email as string) || '';
      name      = (u.name  as string) || '';
    } else {
      logLinkedIn('userinfo failed', { status: uRes.status, body: await uRes.text().then(t => t.slice(0, 300)).catch(() => '') });
    }
  } catch (e) {
    logLinkedIn('userinfo exception', e instanceof Error ? e.message : String(e));
  }

  // Fallback: /v2/me (anciennes apps sans produit OpenID)
  if (!personUrn) {
    try {
      const meRes = await fetch(
        'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
      if (meRes.ok) {
        const me = await meRes.json();
        const id = (me.id as string) || '';
        if (id) {
          personUrn = `urn:li:person:${id}`;
          name      = `${me.localizedFirstName ?? ''} ${me.localizedLastName ?? ''}`.trim();
        }
      } else {
        logLinkedIn('v2/me failed', { status: meRes.status, body: await meRes.text().then(t => t.slice(0, 300)).catch(() => '') });
      }
    } catch (e) {
      logLinkedIn('v2/me exception', e instanceof Error ? e.message : String(e));
    }
  }

  if (!personUrn) {
    logLinkedIn('profile_fetch_failed', 'ni userinfo ni v2/me n\'ont renvoyé d\'identité');
    return back('error=profile_fetch_failed');
  }

  await saveLinkedInToken({
    accessToken: tokens.access_token,
    expiresIn:   tokens.expires_in ?? 5184000,
    personUrn,
    email,
    name,
  });

  logLinkedIn('person connected', { personUrn, email, name });
  return back('connected=1');
}
