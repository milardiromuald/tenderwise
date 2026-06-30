import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';
import { encrypt, decrypt, looksEncrypted } from '@/lib/encrypt';
import { detectKeyTier } from '@/lib/aiKey';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const storedKey = await getSetting('gemini_api_key', '');
  let hasKey = false;
  let maskedKey = '';

  if (storedKey) {
    try {
      const plain = looksEncrypted(storedKey) ? decrypt(storedKey) : storedKey;
      hasKey = plain.length > 0;
      if (hasKey) {
        const v = 6;
        maskedKey = plain.slice(0, v) + '•'.repeat(Math.max(4, plain.length - v * 2)) + plain.slice(-v);
      }
    } catch {
      hasKey = false;
    }
  }

  const [articlesCount, imagesCount, selectedModel, imageModel, lastGeneration, tokensInRaw, tokensOutRaw, maxOutputTokensRaw, keyTier, keyModelsRaw] = await Promise.all([
    getSetting('ai_articles_count', '0'),
    getSetting('ai_images_count', '0'),
    getSetting('ai_article_model', 'gemini-3.1-flash-lite'),
    getSetting('ai_image_model', 'gemini-2.5-flash-image'),
    getSetting('ai_last_generation', ''),
    getSetting('ai_tokens_in', '0'),
    getSetting('ai_tokens_out', '0'),
    getSetting('ai_max_output_tokens', '32768'),
    getSetting('ai_key_tier', 'unknown'),
    getSetting('ai_key_models', '[]'),
  ]);

  let keyModels: string[] = [];
  try { keyModels = JSON.parse(keyModelsRaw); } catch { keyModels = []; }

  return NextResponse.json({
    hasKey,
    maskedKey,
    articlesCount: parseInt(articlesCount, 10) || 0,
    imagesCount: parseInt(imagesCount, 10) || 0,
    selectedModel,
    imageModel,
    lastGeneration,
    tokensIn: parseInt(tokensInRaw, 10) || 0,
    tokensOut: parseInt(tokensOutRaw, 10) || 0,
    maxOutputTokens: parseInt(maxOutputTokensRaw, 10) || 32768,
    keyTier: hasKey ? keyTier : 'unknown',
    keyModels,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { apiKey, selectedModel, imageModel, maxOutputTokens } = await req.json();

  let keyChanged = false;
  if (apiKey !== undefined) {
    if (!apiKey.trim()) {
      await setSetting('gemini_api_key', '');
    } else {
      try {
        await setSetting('gemini_api_key', encrypt(apiKey.trim()));
      } catch {
        await setSetting('gemini_api_key', apiKey.trim());
      }
    }
    keyChanged = true;
    // Changement de clé API → on repart de zéro sur toutes les métriques d’usage
    // (compteurs d’articles/images, tokens cumulés, dernière génération).
    await Promise.all([
      setSetting('ai_articles_count', '0'),
      setSetting('ai_images_count', '0'),
      setSetting('ai_tokens_in', '0'),
      setSetting('ai_tokens_out', '0'),
      setSetting('ai_last_generation', ''),
    ]);
  }

  if (selectedModel)    await setSetting('ai_article_model',    selectedModel);
  if (imageModel)       await setSetting('ai_image_model',      imageModel);
  if (maxOutputTokens)  await setSetting('ai_max_output_tokens', String(maxOutputTokens));

  // ── Détection automatique du tier (gratuit/payant) + modèles accessibles ──
  // Lancée à l’enregistrement d’une clé non vide. Placée APRÈS l’écriture du
  // modèle choisi pour que l’auto-correction (modèle inaccessible) ait le dernier mot.
  let detection: Awaited<ReturnType<typeof detectKeyTier>> | null = null;
  if (apiKey !== undefined && apiKey.trim()) {
    try {
      detection = await detectKeyTier(apiKey.trim());
      await setSetting('ai_key_tier', detection.tier);
      await setSetting('ai_key_models', JSON.stringify(detection.models));
      // Si le modèle d’article retenu n’est pas accessible avec cette clé,
      // on bascule automatiquement sur le premier modèle disponible.
      const current = await getSetting('ai_article_model', 'gemini-3.1-flash-lite');
      if (detection.models.length && !detection.models.includes(current)) {
        await setSetting('ai_article_model', detection.models[0]);
      }
    } catch { /* détection non bloquante */ }
  } else if (apiKey !== undefined) {
    // Clé effacée → on réinitialise le tier.
    await setSetting('ai_key_tier', 'unknown');
    await setSetting('ai_key_models', '[]');
  }

  return NextResponse.json({ ok: true, metricsReset: keyChanged, detection });
}
