import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';
import { encrypt } from '@/lib/encrypt';
import { getGoogleRefreshToken, getRedirectUri } from '@/lib/google';

function mask(v: string): string {
  if (!v) return '';
  if (v.length <= 12) return v;
  return `${v.slice(0, 6)}…${v.slice(-6)}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const [clientId, clientSecret, email, scopes, folderId, connectedAt] = await Promise.all([
    getSetting('google_oauth_client_id', ''),
    getSetting('google_oauth_client_secret', ''),
    getSetting('google_oauth_email', ''),
    getSetting('google_oauth_scopes', ''),
    getSetting('google_drive_folder_id', ''),
    getSetting('google_oauth_connected_at', ''),
  ]);

  const refreshToken = await getGoogleRefreshToken();

  return NextResponse.json({
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    maskedClientId: mask(clientId),
    connected: !!refreshToken,
    email,
    scopes: scopes ? scopes.split(' ').filter(Boolean) : [],
    folderId,
    connectedAt,
    redirectUri: getRedirectUri(req),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { clientId, clientSecret, folderId } = await req.json();

  if (clientId !== undefined) {
    await setSetting('google_oauth_client_id', String(clientId).trim());
  }
  if (clientSecret !== undefined) {
    const v = String(clientSecret).trim();
    if (!v) {
      await setSetting('google_oauth_client_secret', '');
    } else {
      try {
        await setSetting('google_oauth_client_secret', encrypt(v));
      } catch {
        await setSetting('google_oauth_client_secret', v);
      }
    }
  }
  if (folderId !== undefined) {
    await setSetting('google_drive_folder_id', String(folderId).trim());
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  // Déconnexion : on efface le lien OAuth mais on garde les identifiants client
  await Promise.all([
    setSetting('google_oauth_refresh_token', ''),
    setSetting('google_oauth_email', ''),
    setSetting('google_oauth_scopes', ''),
    setSetting('google_oauth_connected_at', ''),
  ]);

  return NextResponse.json({ ok: true });
}
