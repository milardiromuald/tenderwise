import { NextRequest, NextResponse, after } from 'next/server';
import { getSetting, setSetting } from '@/lib/settings';
import { verifyChatRequest } from '@/lib/googleChat';
import { getBaseUrl, sendGoogleChatMessage } from '@/lib/google';
import { runArticleWorkflow } from '@/lib/workflow';
import { publishLinkedInPost } from '@/lib/linkedin';
import { downloadChatImage, detectLinkedInTarget, type ChatAttachment } from '@/lib/googleChatMedia';
import { routerAgent } from '@/lib/agents/routerAgent';
import { execute } from '@/lib/db';

export interface WebhookLogEntry {
  at:            string;
  auth:          string;
  configuredAud: string;
  receivedAud?:  string;
  receivedIss?:  string;
  mode?:         string;
  type:          string;
  space:         string;
  subject:       string;
  status:        'ok' | 'blocked' | 'auth_failed' | 'error';
  detail:        string;
}

async function appendLog(entry: WebhookLogEntry) {
  try {
    const raw = await getSetting('google_chat_webhook_log', '[]');
    const log: WebhookLogEntry[] = JSON.parse(raw).slice(-19);
    log.push(entry);
    await setSetting('google_chat_webhook_log', JSON.stringify(log));
  } catch { /* non bloquant */ }
}

function chatText(text: string) {
  return NextResponse.json({ text });
}

/**
 * Normalise un ID d'espace Google Chat.
 * Tolère l'absence du préfixe « spaces/ » (cas où l'ID est copié depuis l'URL
 * du navigateur, ex. « AAQAz5SGz9I ») et les espaces superflus, pour que la
 * comparaison avec event.space.name (« spaces/AAQAz5SGz9I ») ne dépende plus
 * du format saisi.
 */
function normalizeSpace(s: string): string {
  return (s || '').trim().replace(/^spaces\//i, '');
}

/**
 * Borne la durée d'une promesse : si elle dépasse `ms`, on renvoie `fallback`
 * sans annuler le travail sous-jacent. Empêche un appel lent (ex. chaîne de
 * repli Gemini) de faire dépasser le délai de 30 s imposé par Google Chat.
 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function POST(req: NextRequest) {
  const audience = await getSetting('google_chat_audience', '');

  // ── 1. Vérification Bearer
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    await appendLog({
      at: new Date().toISOString(), auth: 'no_bearer', configuredAud: audience,
      type: 'pre-auth', space: '', subject: '', status: 'auth_failed',
      detail: 'Requête reçue sans en-tête Authorization Bearer.',
    });
    return NextResponse.json({ error: 'unauthorized', reason: 'no_bearer' }, { status: 401 });
  }

  const endpointUrl = `${getBaseUrl(req)}/api/connectors/google-chat/webhook`;
  const verify      = await verifyChatRequest(authHeader, audience, endpointUrl);
  if (!verify.valid) {
    const reasons: Record<string, string> = {
      audience:     `Audience incorrecte — JWT reçu : "${verify.actualAudience}" / configuré : "${audience}"`,
      issuer:       `Émetteur JWT invalide : "${verify.actualIssuer}"`,
      signature:    'Signature JWT invalide',
      expired:      'JWT expiré',
      no_kid:       'kid manquant dans le JWT',
      no_cert:      `Certificat Google introuvable (mode: ${verify.mode})`,
      certs_fetch:  'Impossible de récupérer les certificats Google',
      malformed:    'JWT malformé',
      alg:          'Algorithme JWT non RS256',
      verify_error: 'Erreur lors de la vérification de la signature',
    };
    await appendLog({
      at: new Date().toISOString(), auth: verify.reason || 'unknown', configuredAud: audience,
      receivedAud: verify.actualAudience, receivedIss: verify.actualIssuer, mode: verify.mode,
      type: 'pre-auth', space: '', subject: '', status: 'auth_failed',
      detail: reasons[verify.reason || ''] || `Vérification JWT échouée : ${verify.reason}`,
    });
    return NextResponse.json({ error: 'unauthorized', reason: verify.reason }, { status: 401 });
  }

  // ── 2. Décodage du corps
  let event: {
    type?:    string;
    message?: { text?: string; argumentText?: string; attachment?: ChatAttachment[] };
    space?:   { name?: string };
    user?:    { displayName?: string; email?: string };
  };
  try {
    event = await req.json();
  } catch {
    await appendLog({
      at: new Date().toISOString(), auth: 'ok', configuredAud: audience,
      receivedAud: verify.actualAudience, receivedIss: verify.actualIssuer, mode: verify.mode,
      type: '', space: '', subject: '', status: 'error', detail: 'Corps JSON invalide',
    });
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const type  = event.type || '';
  const space = event.space?.name || '';

  // ── 3. Ajout dans un espace
  if (type === 'ADDED_TO_SPACE') {
    await appendLog({
      at: new Date().toISOString(), auth: 'ok', configuredAud: audience,
      receivedAud: verify.actualAudience, receivedIss: verify.actualIssuer, mode: verify.mode,
      type, space, subject: '', status: 'ok', detail: 'Bot ajouté à l\'espace — ID renvoyé',
    });
    return chatText(
      `👋 *TenderWise* est connecté à cet espace.\n` +
      `ID de l'espace : \`${space}\`\n\n` +
      `Colle-le dans *Admin → Connecteurs → Google Chat*, puis écris simplement ce que tu veux :\n\n` +
      `📝 *"Un article sur les obligations du donneur d'ordre"*\n` +
      `💼 *"Un post LinkedIn sur la nouvelle réglementation chantiers"*\n\n` +
      `L'IA comprend ton intention — pas besoin de commande spéciale.\n` +
      `Écris *test* pour vérifier le circuit sans consommer de tokens.`,
    );
  }

  if (type !== 'MESSAGE') {
    await appendLog({
      at: new Date().toISOString(), auth: 'ok', configuredAud: audience,
      receivedAud: verify.actualAudience, receivedIss: verify.actualIssuer, mode: verify.mode,
      type, space, subject: '', status: 'ok', detail: `Événement ignoré (type=${type})`,
    });
    return NextResponse.json({});
  }

  // ── 4. Filtre d'espace
  const allowedSpace = await getSetting('google_chat_space', '');
  if (allowedSpace && normalizeSpace(space) !== normalizeSpace(allowedSpace)) {
    await appendLog({
      at: new Date().toISOString(), auth: 'ok', configuredAud: audience,
      receivedAud: verify.actualAudience, receivedIss: verify.actualIssuer, mode: verify.mode,
      type, space, subject: '', status: 'blocked',
      detail: `Espace non autorisé — reçu : "${space}" / autorisé : "${allowedSpace}"`,
    });
    return chatText(`⛔ Cet espace (\`${space}\`) n'est pas autorisé.`);
  }

  const rawText = (event.message?.argumentText || event.message?.text || '').trim();
  const baseUrl = getBaseUrl(req);
  const author  = event.user?.displayName || 'Google Chat';

  if (!rawText) {
    return chatText('✍️ Envoie un message pour démarrer un workflow.');
  }

  // ── 5. Commande de test (rapide, pas de tokens)
  const isTest = /^\/?test\b/i.test(rawText);
  if (isTest) {
    await appendLog({
      at: new Date().toISOString(), auth: 'ok', configuredAud: audience,
      receivedAud: verify.actualAudience, receivedIss: verify.actualIssuer, mode: verify.mode,
      type, space, subject: 'test', status: 'ok', detail: `Test lancé par ${author}`,
    });
    // La génération de l'article de test peut prendre 1 à 3 min → bien au-delà
    // du délai de 30 s de Google Chat. On accuse réception tout de suite et on
    // poste le résultat via le webhook entrant.
    after(async () => {
      try {
        const r = await runArticleWorkflow({
          subject: 'Article de démonstration', baseUrl, test: true, source: 'test', requestedBy: author,
        });
        const msg = !r.ok
          ? `❌ Échec : ${r.error || 'erreur inconnue'}`
          : [
              `🧪 *[TEST]* Article généré : *${r.title}*`,
              r.emailSent ? `📧 E-mail envoyé à ${r.emailTo}` : `📧 E-mail non envoyé (vérifie la config Gmail)`,
              r.driveLink ? `📁 Drive : ${r.driveLink}` : '',
              r.reviewUrl ? `🔗 Valider : ${r.reviewUrl}` : '',
            ].filter(Boolean).join('\n');
        await sendGoogleChatMessage(msg);
      } catch (e) {
        console.error('[google-chat/webhook] test workflow error:', e);
        try { await sendGoogleChatMessage(`❌ Erreur : ${e instanceof Error ? e.message : 'inconnue'}`); } catch { /* webhook absent */ }
      }
    });
    return chatText('🧪 *Test lancé* — je vérifie le circuit (génération → e-mail → Drive). Je poste le résultat ici dans un instant…');
  }

  // ── 6. Agent routeur : analyse l'intention et détermine le workflow
  // Le routage est rapide (~1-2 s) donc synchrone — on répond après.
  // Le routeur appelle Gemini avec une chaîne de repli de 5 modèles : en cas de
  // 429 en cascade, il peut être lent. On le borne à 12 s pour garder une marge
  // confortable sous le délai de 30 s de Google Chat.
  let decision;
  try {
    decision = await withTimeout(
      routerAgent(rawText),
      12_000,
      { workflow: 'unknown' as const, reason: 'Routeur trop lent (timeout)' },
    );
  } catch {
    decision = { workflow: 'unknown' as const, reason: 'Erreur routeur' };
  }

  await appendLog({
    at: new Date().toISOString(), auth: 'ok', configuredAud: audience,
    receivedAud: verify.actualAudience, receivedIss: verify.actualIssuer, mode: verify.mode,
    type, space,
    subject: decision.workflow === 'article'
      ? (decision.subject || rawText).slice(0, 80)
      : rawText.slice(0, 80),
    status:  'ok',
    detail:  `Routeur → ${decision.workflow} | ${decision.reason?.slice(0, 80) || ''}`,
  });

  // ── 7a. Workflow article
  if (decision.workflow === 'article') {
    const subject = decision.subject || rawText;
    // Génération longue → après la réponse immédiate
    after(async () => {
      try {
        await runArticleWorkflow({ subject, baseUrl, test: false, source: 'chat', requestedBy: author });
      } catch (e) {
        console.error('[google-chat/webhook] article workflow error:', e);
      }
    });
    return chatText(
      `⏳ *Article en cours de génération*\n` +
      `Sujet : « ${subject} »\n\n` +
      `Le pipeline démarre (recherche → rédaction → révision). Tu recevras l'e-mail de validation dans 1 à 3 minutes.`,
    );
  }

  // ── 7b. Workflow LinkedIn (indépendant — publication directe)
  if (decision.workflow === 'linkedin_post') {
    const postText = decision.linkedin_text?.trim() || '';
    if (!postText) {
      return chatText('⚠️ Le routeur n\'a pas pu générer le texte du post. Réessaie avec plus de détails.');
    }
    // Cible : « compte perso » par défaut, « page entreprise » si demandé.
    const target = detectLinkedInTarget(rawText);
    // Image jointe au message Chat (best-effort, sinon texte seul).
    const attachments = event.message?.attachment;
    const hadAttachment = Array.isArray(attachments) && attachments.some(a => (a.contentType || '').startsWith('image/'));
    const cible = target === 'organization' ? 'la Page entreprise' : 'le compte perso';

    // Téléchargement image + appel API LinkedIn + insert DB peuvent dépasser
    // 30 s → en tâche de fond, confirmation via le webhook entrant.
    after(async () => {
      try {
        const image = await downloadChatImage(attachments);
        const { url } = await publishLinkedInPost(postText, image?.buffer, image?.mime, { as: target });
        try {
          await execute(
            `INSERT INTO linkedin_posts (text, linkedin_url, status, source, target) VALUES (?, ?, 'published', 'chat', ?)`,
            [postText, url, target],
          );
        } catch {
          await execute(
            `INSERT INTO linkedin_posts (text, linkedin_url, status, source) VALUES (?, ?, 'published', 'chat')`,
            [postText, url],
          ).catch(() => {});
        }
        const imgNote = image ? '🖼 avec image\n' : (hadAttachment ? '⚠️ image non récupérée (publiée en texte seul)\n' : '');
        await sendGoogleChatMessage(
          `✅ *Post LinkedIn publié* sur ${cible} par ${author}\n` +
          imgNote +
          (url ? `🔗 ${url}\n\n` : '\n') +
          `_Aperçu du texte :_\n${postText.slice(0, 200)}${postText.length > 200 ? '…' : ''}`,
        );
      } catch (e) {
        console.error('[google-chat/webhook] linkedin publish error:', e);
        try { await sendGoogleChatMessage(`❌ Échec publication LinkedIn : ${e instanceof Error ? e.message : String(e)}`); } catch { /* webhook absent */ }
      }
    });
    return chatText(
      `💼 *Publication LinkedIn en cours* sur ${cible}…\n` +
      `Je poste la confirmation (et le lien) ici dès que c'est en ligne.`,
    );
  }

  // ── 7c. Intention non reconnue
  return chatText(
    `🤔 Je n'ai pas compris l'intention. Précise ce que tu veux :\n\n` +
    `📝 *Article* : "Un article sur les obligations du donneur d'ordre"\n` +
    `💼 *Post LinkedIn* : "Un post LinkedIn sur la nouvelle réglementation chantiers"\n\n` +
    `Ou écris *test* pour vérifier le circuit.`,
  );
}
