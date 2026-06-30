import { getAllSettings } from './settings';
import { sendGmailEmail } from './google';

export interface ContactMailParams {
  nom: string;
  email: string;
  telephone?: string;
  societe?: string;
  objet: string;
  message: string;
}

/** Escape all HTML special characters to prevent HTML injection in email templates */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Strip CR/LF to prevent email header injection in From/ReplyTo fields */
function stripNewlines(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

function htmlEmail(p: ContactMailParams, companyName: string): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const safeEmail = esc(p.email);
  const rows = [
    ['Nom complet', esc(p.nom)],
    ['Email', `<a href="mailto:${safeEmail}" style="color:#004a99">${safeEmail}</a>`],
    p.telephone ? ['Téléphone', esc(p.telephone)] : null,
    p.societe ? ['Société / Organisation', esc(p.societe)] : null,
    ['Objet', `<strong>${esc(p.objet)}</strong>`],
  ].filter(Boolean) as [string, string][];

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#003366 0%,#004a99 100%);padding:32px 40px;text-align:left;">
            <p style="color:#c5a059;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 8px;">Nouveau message de contact</p>
            <h1 style="color:white;font-size:22px;font-weight:900;margin:0;letter-spacing:-0.3px;">${companyName}</h1>
          </td>
        </tr>
        <!-- Sender info table -->
        <tr>
          <td style="padding:32px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              ${rows.map((r, i) => `
              <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'};">
                <td style="padding:11px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;width:38%;border-bottom:1px solid #e2e8f0;">${r[0]}</td>
                <td style="padding:11px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${r[1]}</td>
              </tr>`).join('')}
            </table>
          </td>
        </tr>
        <!-- Message -->
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 10px;">Message</p>
            <div style="background:#f8fafc;border-left:4px solid #004a99;border-radius:0 10px 10px 0;padding:20px 24px;">
              <p style="color:#334155;font-size:15px;line-height:1.8;margin:0;white-space:pre-wrap;">${esc(p.message)}</p>
            </div>
          </td>
        </tr>
        <!-- CTA Reply -->
        <tr>
          <td style="padding:28px 40px;">
            <a href="mailto:${p.email}?subject=RE: ${encodeURIComponent(p.objet)}"
              style="display:inline-block;background:#004a99;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
              ← Répondre à ${p.nom}
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">Reçu le ${date} via le formulaire de contact ${companyName}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendContactEmail(
  params: ContactMailParams
): Promise<{ success: boolean; emailSent: boolean; error?: string }> {
  const settings = await getAllSettings();

  // Notification désactivable depuis Paramètres › Notifications par email (défaut : activée)
  if (settings.notify_contact_enabled === '0') {
    return { success: true, emailSent: false };
  }

  const recipientRaw = settings.contact_recipient_email?.trim() || settings.contact_email?.trim() || '';
  const companyName  = settings.company_name || 'TenderWise';

  if (!recipientRaw) {
    console.warn('[Mailer] Destinataire manquant — notification de contact non envoyée.');
    return { success: true, emailSent: false };
  }

  try {
    await sendGmailEmail({
      to:      recipientRaw,
      replyTo: `"${stripNewlines(params.nom)}" <${params.email}>`,
      subject: `[Contact] ${stripNewlines(params.objet)} — ${stripNewlines(params.nom)}`,
      html:    htmlEmail(params, companyName),
    });
    return { success: true, emailSent: true };
  } catch (err) {
    console.error('[Mailer] Erreur envoi contact (Gmail) :', err);
    return { success: true, emailSent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ─── Notification de candidature (carrière) ─────────────────────────────── */
export interface ApplicationMailParams {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  message: string;
  jobTitle: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}

export async function sendApplicationEmail(
  p: ApplicationMailParams
): Promise<{ success: boolean; emailSent: boolean; error?: string }> {
  const settings = await getAllSettings();

  // Notification désactivable depuis Paramètres › Notifications par email (défaut : activée)
  if (settings.notify_application_enabled === '0') {
    return { success: true, emailSent: false };
  }

  const recipient = settings.application_recipient_email?.trim()
    || settings.contact_recipient_email?.trim()
    || settings.contact_email?.trim() || '';
  const companyName = settings.company_name || 'TenderWise';

  if (!recipient) {
    console.warn('[Mailer] Destinataire manquant — notification de candidature non envoyée (la candidature reste enregistrée en base).');
    return { success: true, emailSent: false };
  }

  const rows: [string, string][] = [
    ['Candidat', `${esc(p.prenom)} ${esc(p.nom)}`],
    ['Poste', esc(p.jobTitle)],
    ['Email', `<a href="mailto:${esc(p.email)}" style="color:#004a99">${esc(p.email)}</a>`],
    ['Téléphone', `<a href="tel:${esc(p.telephone.replace(/\s/g, ''))}" style="color:#004a99">${esc(p.telephone)}</a>`],
  ];

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">
      <tr><td style="background:#003366;padding:28px 40px;">
        <p style="color:#c5a059;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 6px;">Nouvelle candidature</p>
        <p style="color:white;font-size:20px;font-weight:800;margin:0;">${esc(p.jobTitle)}</p>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          ${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'};">
            <td style="padding:11px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;width:38%;border-bottom:1px solid #e2e8f0;">${r[0]}</td>
            <td style="padding:11px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${r[1]}</td>
          </tr>`).join('')}
        </table>
      </td></tr>
      ${p.message ? `<tr><td style="padding:24px 40px 0;">
        <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 10px;">Message</p>
        <div style="background:#f8fafc;border-left:4px solid #004a99;border-radius:0 10px 10px 0;padding:18px 22px;">
          <p style="color:#334155;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${esc(p.message)}</p>
        </div></td></tr>` : ''}
      <tr><td style="padding:24px 40px;">
        <p style="color:#64748b;font-size:13px;margin:0 0 4px;">📎 ${p.attachments.length} document(s) reçu(s) : ${p.attachments.map(a => esc(a.filename)).join(', ')}</p>
        <p style="color:#94a3b8;font-size:12px;margin:8px 0 0;">CV et lettre de motivation téléchargeables dans l’espace d’administration.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 40px;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Reçu via le formulaire carrière ${esc(companyName)}.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  try {
    await sendGmailEmail({
      to:      recipient,
      replyTo: `"${stripNewlines(p.prenom)} ${stripNewlines(p.nom)}" <${p.email}>`,
      subject: `[Candidature] ${stripNewlines(p.jobTitle)} — ${stripNewlines(p.prenom)} ${stripNewlines(p.nom)}`,
      html,
    });
    return { success: true, emailSent: true };
  } catch (err) {
    console.error('[Mailer] Erreur envoi candidature (Gmail) :', err);
    return { success: true, emailSent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
