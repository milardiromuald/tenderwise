import crypto from 'crypto';
import { execute } from './db';
import { getSetting, getBoolSetting, incrementSetting } from './settings';
import type { GeneratedArticle } from './articleGen';
import { composeHeader } from './composeImage';
import { pickRandomBackground } from './backgrounds';
import { getMedia, saveMedia } from './media';
import {
  uploadToDrive,
  uploadBinaryToDrive,
  createDriveFolder,
  sendGmailEmail,
  sendGoogleChatMessage,
  getGoogleRefreshToken,
} from './google';
import { buildReviewEmail } from './emailTemplates';
import { createNotification } from './notifications';
import { emitWorkflowUpdate } from './workflowEvents';
import { runAgentPipeline } from './agents';

export interface WorkflowStep { name: string; ok: boolean; detail?: string }
export interface WorkflowResult {
  ok: boolean;
  isTest: boolean;
  articleId?: number;
  reviewToken?: string;
  reviewUrl?: string;
  imageUrl?: string;
  driveLink?: string;
  emailTo?: string;
  emailSent: boolean;
  title?: string;
  error?: string;
  steps: WorkflowStep[];
}

const TEST_IMAGE = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80';

function sampleArticle(subject: string): GeneratedArticle {
  const titre = `[TEST] ${subject || 'Article de démonstration'}`;
  return {
    titre,
    extrait: 'Extrait de test généré sans appel à l’IA, pour valider le circuit e-mail de validation.',
    contenu:
      '<h2>Introduction</h2><p>Cet article est un <strong>contenu factice</strong> créé pour tester le workflow complet (génération → e-mail → validation) <strong>sans consommer de tokens Gemini</strong>.</p>' +
      '<h2>Section de démonstration</h2><p>Vous pouvez approuver, modifier ou refuser cet article depuis l’e-mail ou la page de validation.</p>' +
      '<blockquote>Aucun token n’a été utilisé pour générer cet article de test.</blockquote>' +
      '<h2>Conclusion</h2><p>Si vous voyez les boutons d’action dans votre boîte mail, le connecteur fonctionne de bout en bout.</p>',
    meta_title: titre.slice(0, 60),
    meta_description: 'Article de test du workflow TenderWise, généré sans IA.',
    meta_keywords: 'test, workflow, tenderwise',
    temps_lecture: 2,
    categorie: 'Test',
    image_title: 'TEST',
    image_subtitle: 'Article de démonstration',
  };
}

function slugify(titre: string): string {
  const base = (titre || 'article')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

function articleHtmlDoc(a: GeneratedArticle): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${a.titre}</title></head>
<body><h1>${a.titre}</h1><p><em>${a.extrait}</em></p>${a.contenu}</body></html>`;
}

/**
 * Exécute le workflow complet de création d’article.
 * Insère une ligne "en_cours" dès le démarrage pour visibilité en temps réel.
 * @param opts.test  true = article factice + image placeholder (aucun token Gemini)
 */
export async function runArticleWorkflow(opts: {
  subject: string;
  baseUrl: string;
  test?: boolean;
  source?: string;
  requestedBy?: string;
}): Promise<WorkflowResult> {
  const isTest = !!opts.test;
  const steps: WorkflowStep[] = [];
  const result: WorkflowResult = { ok: false, isTest, emailSent: false, steps };
  const source = opts.source || (isTest ? 'test' : 'chat');

  // ── Réglages fins du workflow (activables indépendamment) ──
  const [saveDrive, sendEmail, sendChat] = await Promise.all([
    getBoolSetting('workflow_save_drive', true),   // Sauvegarde Drive
    getBoolSetting('workflow_send_email', true),   // E-mail de validation
    getBoolSetting('workflow_send_chat', false),   // Message Google Chat de validation
  ]);

  // ── Token pré-généré + ligne "en_cours" immédiate pour visibilité UI ──
  const token = crypto.randomBytes(24).toString('hex');
  result.reviewToken = token;

  let reviewId: number | undefined;
  try {
    const ins = await execute(
      `INSERT INTO article_reviews (token, subject, status, source, is_test, steps_log)
       VALUES (?, ?, 'en_cours', ?, ?, '[]')`,
      [token, opts.subject, source, isTest ? 1 : 0],
    );
    reviewId = ins.insertId;
    emitWorkflowUpdate();
  } catch { /* ignore */ }

  const saveSteps = async () => {
    if (!reviewId) return;
    try {
      await execute('UPDATE article_reviews SET steps_log=? WHERE id=?', [JSON.stringify(steps), reviewId]);
      emitWorkflowUpdate();
    } catch { /* ignore */ }
  };

  const finalize = async (status: string, fields?: Record<string, unknown>) => {
    if (!reviewId) return;
    const cols = ['status=?', 'steps_log=?'];
    const vals: unknown[] = [status, JSON.stringify(steps)];
    if (fields) {
      for (const [k, v] of Object.entries(fields)) { cols.push(`${k}=?`); vals.push(v); }
    }
    vals.push(reviewId);
    try {
      await execute(`UPDATE article_reviews SET ${cols.join(',')} WHERE id=?`, vals);
      emitWorkflowUpdate();
    } catch { /* ignore */ }
  };

  // ── 1. Article (réel ou factice) ──
  let article: GeneratedArticle;
  try {
    if (isTest) {
      article = sampleArticle(opts.subject);
      steps.push({ name: 'article', ok: true, detail: 'Article factice (sans token)' });
    } else {
      const pipeline = await runAgentPipeline({ sujet: opts.subject });
      if (!pipeline.articleFinal) throw new Error('Pipeline IA : aucun article généré');
      article = pipeline.articleFinal;

      // Injecte les étapes du pipeline dans le log de workflow
      for (const s of pipeline.steps) {
        steps.push({
          name:   s.agent,
          ok:     s.ok,
          detail: s.detail ?? (s.tokensUsed ? `${s.tokensUsed} tokens` : undefined),
        });
      }
      await saveSteps();

      // Avertissement si score faible (article forcé après maxRetries)
      if (pipeline.finalScore?.verdict === 'force_approuve') {
        steps.push({
          name:   'qualite',
          ok:     false,
          detail: `Score faible : ${pipeline.finalScore.total}/100 — vérifier avant publication`,
        });
      }
    }
    await saveSteps();
  } catch (e) {
    steps.push({ name: 'article', ok: false, detail: e instanceof Error ? e.message : String(e) });
    result.error = 'Échec de génération de l’article';
    await finalize('refuse');
    return result;
  }
  result.title = article.titre;

  // ── 2. Image (réelle ou placeholder) ──
  let imageUrl = '';
  let imageRelUrl = ''; // URL applicative (/api/media/{id}) pour la sauvegarde Drive
  try {
    if (isTest) {
      imageUrl = TEST_IMAGE;
      steps.push({ name: 'image', ok: true, detail: 'Image placeholder (sans token)' });
    } else {
      // Plus d’IA : on incruste le texte sur un fond prédéfini choisi au hasard.
      const bg = await pickRandomBackground();
      if (bg) {
        const titleTxt = (article.image_title || article.titre || '').trim();
        const subTxt = (article.image_subtitle || article.extrait || '').trim();
        const buffer = await composeHeader({ backgroundUrl: bg.url, title: titleTxt, subtitle: subTxt });
        const filename = 'header-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.png';
        const saved = await saveMedia(buffer, 'image/png', { filename, source: 'ai', altText: article.titre });
        imageRelUrl = saved.url;
        imageUrl = `${opts.baseUrl}${saved.url}`;
        // Compteur d'images (affiché dans Configuration IA) : une image composée par article.
        await incrementSetting('ai_images_count', 1);
        steps.push({ name: 'image', ok: true, detail: `Image composée (fond « ${bg.label || ('#' + bg.id)} » + texte)` });
      } else {
        steps.push({ name: 'image', ok: false, detail: 'Aucun fond d’en-tête configuré — voir Admin → Fonds d’en-tête' });
      }
    }
    await saveSteps();
  } catch (e) {
    // Non bloquant : on continue sans image
    steps.push({ name: 'image', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  result.imageUrl = imageUrl;

  // ── 3. Brouillon en base ──
  const slug = slugify(article.titre);
  const author = opts.requestedBy || 'Workflow IA';
  let articleId: number | undefined;
  try {
    const ins = await execute(
      `INSERT INTO articles
        (titre, slug, extrait, contenu, categorie, image, statut, auteur, date_publication,
         meta_title, meta_description, meta_keywords, temps_lecture, author_username)
       VALUES (?, ?, ?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?, ?)`,
      [
        article.titre, slug, article.extrait, article.contenu, article.categorie,
        imageUrl.startsWith(opts.baseUrl) ? imageUrl.slice(opts.baseUrl.length) : imageUrl,
        author, new Date().toISOString().slice(0, 19).replace('T', ' '),
        article.meta_title, article.meta_description, article.meta_keywords,
        article.temps_lecture || 0, author,
      ],
    );
    articleId = ins.insertId;
    result.articleId = articleId;
    // Titre/sous-titre image (non bloquant si les colonnes ne sont pas migrées).
    try {
      await execute('UPDATE articles SET image_title = ?, image_subtitle = ? WHERE id = ?', [article.image_title || '', article.image_subtitle || '', articleId]);
    } catch { /* colonnes absentes — ignoré */ }
    steps.push({ name: 'brouillon', ok: true, detail: `Article #${articleId}` });
    await saveSteps();
  } catch (e) {
    steps.push({ name: 'brouillon', ok: false, detail: e instanceof Error ? e.message : String(e) });
    result.error = 'Échec de l’enregistrement en base';
    await finalize('refuse');
    return result;
  }

  // ── 4. Sauvegarde Drive (non bloquant, activable) ──
  // Quand activée : on crée un dossier daté « AAAA-MM-JJ — Titre » et on y dépose
  // le document de l’article ET l’image générée (sauvegarde). Le lien Drive
  // renvoyé pointe vers ce dossier (qui contient les deux).
  let driveLink = '';
  let driveFileId = '';
  if (!saveDrive) {
    steps.push({ name: 'drive', ok: true, detail: 'Désactivée dans les réglages' });
  } else {
    try {
      const connected = !!(await getGoogleRefreshToken());
      if (connected) {
        // Nettoie le titre des caractères interdits dans les noms Drive/fichiers.
        const safeTitle = article.titre.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
        const dateStr = new Date().toISOString().slice(0, 10); // AAAA-MM-JJ
        const folderName = `${dateStr} — ${safeTitle}`.slice(0, 200);

        // 4a. Dossier daté (dans le dossier racine configuré)
        const folder = await createDriveFolder(folderName);

        // 4b. Le document de l’article, dans ce dossier
        const doc = await uploadToDrive({
          name: `${safeTitle || 'article'}.html`,
          content: articleHtmlDoc(article),
          mimeType: 'text/html',
          folderId: folder.id,
        });
        driveFileId = doc.id || '';

        // 4c. L’image générée, en sauvegarde dans le même dossier.
        // L’image est stockée en base (table media) : on relit les octets via getMedia.
        let imageSaved = false;
        const mediaIdMatch = imageRelUrl.match(/^\/api\/media\/(\d+)$/);
        if (mediaIdMatch) {
          try {
            const media = await getMedia(parseInt(mediaIdMatch[1], 10));
            if (media) {
              const ext = media.mime_type.includes('png') ? '.png'
                : media.mime_type.includes('webp') ? '.webp' : '.jpg';
              await uploadBinaryToDrive({
                name: `${safeTitle || 'image'}${ext}`,
                data: media.data,
                mimeType: media.mime_type,
                folderId: folder.id,
              });
              imageSaved = true;
            }
          } catch { /* image non bloquante : on garde au moins le document */ }
        }

        // Lien Drive = le dossier (contient document + image)
        driveLink = folder.webViewLink || doc.webViewLink || '';
        steps.push({
          name: 'drive',
          ok: true,
          detail: `Dossier « ${folderName} » — article${imageSaved ? ' + image' : ''}`,
        });
      } else {
        steps.push({ name: 'drive', ok: false, detail: 'Google non connecté — ignoré' });
      }
    } catch (e) {
      steps.push({ name: 'drive', ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  result.driveLink = driveLink;

  // ── 5. Finalisation de la ligne review (en_cours → en_attente) ──
  const emailTo = (await getSetting('workflow_notify_email', '')) || (await getSetting('google_oauth_email', ''));
  result.emailTo = emailTo;
  const reviewUrl = `${opts.baseUrl}/review/${token}`;
  result.reviewUrl = reviewUrl;

  try {
    steps.push({ name: 'review', ok: true, detail: 'Lien de validation créé' });
    await finalize('en_attente', {
      article_id: articleId ?? null,
      drive_file_id: driveFileId,
      drive_link: driveLink,
      image_url: imageUrl,
      email_to: emailTo,
    });
  } catch (e) {
    steps.push({ name: 'review', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 6. E-mail de validation (activable) ──
  if (!sendEmail) {
    steps.push({ name: 'email', ok: true, detail: 'Désactivé dans les réglages' });
  } else {
    try {
      const connected = !!(await getGoogleRefreshToken());
      if (!emailTo) {
        steps.push({ name: 'email', ok: false, detail: 'Aucun destinataire (configurez l’e-mail de notification)' });
      } else if (!connected) {
        steps.push({ name: 'email', ok: false, detail: 'Gmail non connecté — e-mail non envoyé' });
      } else {
        const { subject, html } = buildReviewEmail({
          article,
          imageUrl,
          reviewUrl,
          approveUrl: `${reviewUrl}?action=approve`,
          rejectUrl: `${reviewUrl}?action=reject`,
          driveLink,
          isTest,
        });
        await sendGmailEmail({ to: emailTo, subject, html });
        result.emailSent = true;
        steps.push({ name: 'email', ok: true, detail: `Envoyé à ${emailTo}` });
      }
    } catch (e) {
      steps.push({ name: 'email', ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  await saveSteps();

  // ── 6 bis. Message Google Chat de validation (activable) ──
  if (sendChat) {
    try {
      const chatText =
        `${isTest ? '🧪 [TEST] ' : '📝 '}*Nouvel article à valider* : ${article.titre}\n` +
        `👉 Validation : ${reviewUrl}` +
        (driveLink ? `\n📄 Drive : ${driveLink}` : '');
      await sendGoogleChatMessage(chatText);
      steps.push({ name: 'chat', ok: true, detail: 'Message envoyé dans Google Chat' });
    } catch (e) {
      steps.push({ name: 'chat', ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
    await saveSteps();
  }

  // ── 7. Notification in-app ──
  await createNotification({
    type: 'info',
    title: `${isTest ? '[TEST] ' : ''}Article à valider : ${article.titre}`,
    message: result.emailSent ? `E-mail envoyé à ${emailTo}` : 'En attente de validation',
    link: `/review/${token}`,
  });

  result.ok = true;
  return result;
}
