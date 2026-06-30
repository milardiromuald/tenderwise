import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting } from '@/lib/settings';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const webhookUrl = await getSetting('google_chat_incoming_webhook', '');
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: 'Aucun webhook entrant configuré.' });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '✅ *TenderWise* est bien connecté à cet espace Google Chat.\nLes notifications de ton application apparaîtront ici.',
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json({ ok: false, error: `Google a répondu ${res.status} : ${body.slice(0, 200)}` });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' });
  }
}
