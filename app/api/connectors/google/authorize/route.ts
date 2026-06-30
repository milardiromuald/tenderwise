import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth';
import { setSetting } from '@/lib/settings';
import { getGoogleClient, getRedirectUri, getBaseUrl, GOOGLE_SCOPES } from '@/lib/google';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const base = getBaseUrl(req);
  if (!session) return NextResponse.redirect(`${base}/admin/login`);

  const { clientId } = await getGoogleClient();
  if (!clientId) {
    return NextResponse.redirect(`${base}/admin/connectors?error=no_client`);
  }

  // ── Protection CSRF : on génère un state et on le stocke côté serveur
  const state = crypto.randomBytes(24).toString('hex');
  await setSetting('google_oauth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'select_account consent',
    include_granted_scopes: 'true',
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
