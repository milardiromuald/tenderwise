import type { GeneratedArticle } from './articleGen';

interface ReviewEmailOpts {
  article: GeneratedArticle;
  imageUrl?: string;       // URL absolue
  reviewUrl: string;       // page de revue (édition)
  approveUrl: string;      // bouton approuver → page de revue ancrée
  rejectUrl: string;       // bouton refuser → page de revue ancrée
  driveLink?: string;
  isTest?: boolean;
}

function btn(href: string, label: string, bg: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 22px;margin:4px;border-radius:8px;background:${bg};color:#ffffff;text-decoration:none;font-weight:700;font-family:Arial,sans-serif;font-size:14px;">${label}</a>`;
}

export function buildReviewEmail(opts: ReviewEmailOpts): { subject: string; html: string } {
  const { article, imageUrl, reviewUrl, approveUrl, rejectUrl, driveLink, isTest } = opts;
  const subject = `${isTest ? '[TEST] ' : ''}Article à valider : ${article.titre}`;

  const testBanner = isTest
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;font-family:Arial,sans-serif;">
         🧪 <strong>E-mail de test</strong> — contenu factice, aucun token Gemini consommé. Les boutons ci-dessous testent le circuit de validation.
       </div>`
    : '';

  const imageBlock = imageUrl
    ? `<img src="${imageUrl}" alt="" style="width:100%;max-width:600px;border-radius:10px;display:block;margin:0 0 18px;" />`
    : '';

  const driveBlock = driveLink
    ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:#475569;">📁 Sauvegardé dans Drive : <a href="${driveLink}" style="color:#004a99;">ouvrir le document</a></p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;padding:24px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <tr><td style="background:#0f172a;padding:18px 28px;">
        <span style="font-family:Arial,sans-serif;font-weight:900;color:#ffffff;font-size:20px;">Tender<span style="color:#c5a059;">Wise</span></span>
        <span style="font-family:Arial,sans-serif;color:rgba(255,255,255,.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-left:8px;">Validation d’article</span>
      </td></tr>
      <tr><td style="padding:28px;">
        ${testBanner}
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#64748b;margin:0 0 4px;text-transform:uppercase;letter-spacing:.5px;">Nouvel article généré</p>
        <h1 style="font-family:Arial,sans-serif;font-size:22px;color:#0f172a;margin:0 0 16px;line-height:1.3;">${article.titre}</h1>
        ${imageBlock}
        <p style="font-family:Arial,sans-serif;font-size:15px;color:#334155;font-style:italic;border-left:3px solid #c5a059;padding-left:12px;margin:0 0 20px;">${article.extrait}</p>

        <!-- Boutons d’action -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td>
          ${btn(approveUrl, '✅ Valider', '#059669')}
          ${btn(reviewUrl, '✏️ Modifier', '#004a99')}
          ${btn(rejectUrl, '❌ Refuser', '#dc2626')}
        </td></tr></table>
        ${driveBlock}

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px;">Aperçu complet de l’article</p>
        <div style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;line-height:1.7;">
          ${article.contenu}
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="font-family:Arial,sans-serif;font-size:12px;color:#94a3b8;margin:0;">
          <strong>SEO</strong> — Titre : ${article.meta_title}<br/>
          Description : ${article.meta_description}<br/>
          Mots-clés : ${article.meta_keywords} · Lecture ~${article.temps_lecture} min
        </p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:16px 28px;text-align:center;">
        <a href="${reviewUrl}" style="font-family:Arial,sans-serif;font-size:13px;color:#004a99;">Ouvrir la page de validation</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html };
}
