import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { getGoogleProfile, sendGmailEmail, uploadToDrive } from '@/lib/google';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { action } = await req.json();
  const t0 = Date.now();

  try {
    if (action === 'profile') {
      const profile = await getGoogleProfile();
      return NextResponse.json({ success: true, result: `Connecté en tant que ${profile.email}`, ms: Date.now() - t0 });
    }

    if (action === 'gmail') {
      const email = await getSetting('google_oauth_email', '');
      if (!email) return NextResponse.json({ success: false, error: 'Email du compte introuvable', ms: 0 });
      await sendGmailEmail({
        to: email,
        subject: 'TenderWise — test de connexion Gmail',
        html: '<p>✅ La connexion <strong>Gmail</strong> de TenderWise fonctionne. Cet e-mail de test a été envoyé automatiquement.</p>',
      });
      return NextResponse.json({ success: true, result: `E-mail de test envoyé à ${email}`, ms: Date.now() - t0 });
    }

    if (action === 'drive') {
      const file = await uploadToDrive({
        name: `TenderWise-test-${new Date().toISOString().slice(0, 19)}.html`,
        content: '<h1>Test TenderWise</h1><p>Fichier de test créé via le connecteur Drive.</p>',
      });
      return NextResponse.json({ success: true, result: `Fichier créé dans Drive${file.webViewLink ? ` — ${file.webViewLink}` : ''}`, link: file.webViewLink, ms: Date.now() - t0 });
    }

    return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return NextResponse.json({ success: false, error: msg, ms: Date.now() - t0 });
  }
}
