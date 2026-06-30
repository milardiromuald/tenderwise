import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, getBoolSetting, setSetting } from '@/lib/settings';
import { getBaseUrl } from '@/lib/google';

function maskWebhook(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const key = u.searchParams.get('key') || '';
    const token = u.searchParams.get('token') || '';
    const maskedKey   = key   ? key.slice(0, 6)   + '••••' : '';
    const maskedToken = token ? token.slice(0, 6) + '••••' : '';
    return `${u.origin}${u.pathname}?key=${maskedKey}&token=${maskedToken}`;
  } catch {
    return url.slice(0, 30) + '••••';
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const [audience, space, notifyEmail, oauthEmail, incomingWebhook, rawLog, saveDrive, sendEmail, sendChat] = await Promise.all([
    getSetting('google_chat_audience', ''),
    getSetting('google_chat_space', ''),
    getSetting('workflow_notify_email', ''),
    getSetting('google_oauth_email', ''),
    getSetting('google_chat_incoming_webhook', ''),
    getSetting('google_chat_webhook_log', '[]'),
    getBoolSetting('workflow_save_drive', true),
    getBoolSetting('workflow_send_email', true),
    getBoolSetting('workflow_send_chat', false),
  ]);

  let webhookLog: unknown[] = [];
  try { webhookLog = JSON.parse(rawLog).reverse(); } catch { /* ignore */ }

  return NextResponse.json({
    audience,
    space,
    notifyEmail,
    effectiveEmail: notifyEmail || oauthEmail,
    configured: !!audience,
    botReady: !!audience && !!space,
    spaceFormatOk: !space || space.startsWith('spaces/'),
    hasIncomingWebhook: !!incomingWebhook,
    maskedIncomingWebhook: maskWebhook(incomingWebhook),
    appWebhookUrl: `${getBaseUrl(req)}/api/connectors/google-chat/webhook`,
    webhookLog,
    // Réglages fins du workflow
    saveDrive,
    sendEmail,
    sendChat,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json();
  const { audience, space, notifyEmail, incomingWebhook, saveDrive, sendEmail, sendChat } = body;
  if (audience !== undefined)        await setSetting('google_chat_audience',          String(audience).trim());
  if (space !== undefined)           await setSetting('google_chat_space',             String(space).trim());
  if (notifyEmail !== undefined)     await setSetting('workflow_notify_email',         String(notifyEmail).trim());
  if (incomingWebhook !== undefined) await setSetting('google_chat_incoming_webhook',  String(incomingWebhook).trim());
  if (saveDrive !== undefined)       await setSetting('workflow_save_drive',           saveDrive ? '1' : '0');
  if (sendEmail !== undefined)       await setSetting('workflow_send_email',           sendEmail ? '1' : '0');
  if (sendChat !== undefined)        await setSetting('workflow_send_chat',            sendChat ? '1' : '0');

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { target } = await req.json().catch(() => ({ target: 'all' }));

  if (target === 'incoming') {
    await setSetting('google_chat_incoming_webhook', '');
  } else {
    // Efface toute la config bot Chat
    await Promise.all([
      setSetting('google_chat_audience', ''),
      setSetting('google_chat_space', ''),
    ]);
  }
  return NextResponse.json({ ok: true });
}
