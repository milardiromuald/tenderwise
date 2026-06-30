import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';
import { encrypt } from '@/lib/encrypt';
import { getGoogleClient, getRedirectUri, getBaseUrl, getGoogleProfile } from '@/lib/google';

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req);

  const session = await getSession();
  if (!session) return NextResponse.redirect(`${base}/admin/login`);

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');

  const backTo = (q: string) => NextResponse.redirect(`${base}/admin/connectors?${q}`);

  if (oauthError) return backTo(`error=${encodeURIComponent(oauthError)}`);
  if (!code) return backTo('error=missing_code');

  // Verification du state (CSRF)
  const storedState = await getSetting('google_oauth_state', '');
  await setSetting('google_oauth_state', '');
  if (!state || state !== storedState) return backTo('error=invalid_state');

  const { clientId, clientSecret } = await getGoogleClient();
  if (!clientId || !clientSecret) return backTo('error=no_client');

  // Echange code -> tokens
  let tokens: { access_token?: string; refresh_token?: string; scope?: string; error?: string; error_description?: string };
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });
    tokens = await res.json();
    if (!res.ok) return backTo(`error=${encodeURIComponent(tokens.error_description || tokens.error || 'token_exchange_failed')}`);
  } catch {
    return backTo('error=token_exchange_failed');
  }

  if (!tokens.refresh_token) {
    return backTo('error=no_refresh_token');
  }

  // Recuperation de l'email du compte connecte
  let email = '';
  try {
    if (tokens.access_token) {
      const profile = await getGoogleProfile(tokens.access_token);
      email = profile.email || '';
    }
  } catch { /* non bloquant */ }

  const encryptedToken = (() => { try { return encrypt(tokens.refresh_token!); } catch { return tokens.refresh_token!; } })();

  // Flux principal (Gmail, Drive, AI...)
  await Promise.all([
    setSetting('google_oauth_refresh_token', encryptedToken),
    setSetting('google_oauth_email', email),
    setSetting('google_oauth_scopes', tokens.scope || ''),
    setSetting('google_oauth_connected_at', new Date().toISOString()),
  ]);

  return backTo('connected=1');
}
