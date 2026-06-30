import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendContactEmail } from '@/lib/mailer';

function sanitize(str: unknown): string {
  return typeof str === 'string' ? str.trim().slice(0, 2000) : '';
}

export async function POST(req: NextRequest) {
  /* ── Rate limiting: 5 submissions per IP per 10 minutes ─────── */
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
  if (!await checkRateLimit(`contact:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { success: false, errors: ['Trop de tentatives. Veuillez patienter quelques minutes.'] },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    const nom      = sanitize(body.nom);
    const email    = sanitize(body.email);
    const telephone = sanitize(body.telephone);
    const societe  = sanitize(body.societe);
    const objet    = sanitize(body.objet);
    const message  = sanitize(body.message);
    const rgpdConsent = body.rgpd_consent === true;

    /* ── Validation ────────────────────────────────────────────── */
    const errors: string[] = [];
    if (!nom || nom.length < 2)         errors.push('Nom invalide (min. 2 caractères).');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Adresse email invalide.');
    if (!objet || objet.length < 3)     errors.push('Objet requis.');
    if (!message || message.length < 10) errors.push('Message trop court (min. 10 caractères).');
    if (!rgpdConsent)                   errors.push('Le consentement RGPD est obligatoire.');

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 422 });
    }

    /* ── Honeypot anti-spam ────────────────────────────────────── */
    if (body._hp && sanitize(body._hp).length > 0) {
      return NextResponse.json({ success: true }); // Silently discard
    }

    /* ── Save to DB ────────────────────────────────────────────── */
    const userAgent = req.headers.get('user-agent') || '';

    await execute(
      `INSERT INTO contact_messages
         (nom, email, telephone, societe, objet, message, rgpd_consent, rgpd_consent_date, ip_address, user_agent, statut, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), ?, ?, 'nouveau', NOW())`,
      [nom, email, telephone || null, societe || null, objet, message, ip.slice(0, 45), userAgent.slice(0, 500)]
    );

    // Envoi email asynchrone — ne bloque pas la réponse si SMTP non configuré
    sendContactEmail({ nom, email, telephone, societe, objet, message }).catch((err) => {
      console.error('[contact] Erreur envoi email:', err);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/contact]', err);
    return NextResponse.json(
      { success: false, errors: ['Erreur serveur. Veuillez réessayer.'] },
      { status: 500 }
    );
  }
}

/* ── GET (admin only) ────────────────────────────────────────── */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    const rows = await query<{ statut: string; c: number }>(
      "SELECT statut, COUNT(*) as c FROM contact_messages GROUP BY statut"
    );
    const counts: Record<string, number> = {};
    rows.forEach((r) => { counts[r.statut] = Number(r.c); });
    return NextResponse.json({ counts });
  } catch {
    return NextResponse.json({ counts: {} });
  }
}
