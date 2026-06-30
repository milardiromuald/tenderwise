import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';
import { DEFAULT_ARTICLE_PROMPT, DEFAULT_IMAGE_PROMPT } from '@/lib/defaultPrompts';

interface HistoryEntry { value: string; savedAt: string }

const MAX_HISTORY = 3;

function parseHistory(raw: string): HistoryEntry[] {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/** Archive l'ancienne valeur avant écrasement (best-effort, ne bloque jamais la sauvegarde). */
async function pushHistory(key: string, oldValue: string): Promise<void> {
  if (!oldValue.trim()) return;
  try {
    const history = parseHistory(await getSetting(key, '[]'));
    const next: HistoryEntry[] = [{ value: oldValue, savedAt: new Date().toISOString() }, ...history].slice(0, MAX_HISTORY);
    await setSetting(key, JSON.stringify(next));
  } catch { /* historique best-effort : une erreur ici ne doit jamais bloquer la sauvegarde du prompt */ }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const [articlePrompt, imagePrompt, articleHistoryRaw, imageHistoryRaw] = await Promise.all([
    getSetting('ai_article_prompt', ''),
    getSetting('ai_image_prompt_context', ''),
    getSetting('ai_article_prompt_history', '[]'),
    getSetting('ai_image_prompt_history', '[]'),
  ]);

  // Seed : si aucun prompt n’est encore en base, on y enregistre le prompt par
  // défaut afin qu’il soit réellement persisté (et plus seulement un défaut
  // affiché). Les générations suivantes le liront directement.
  let effectiveArticlePrompt = articlePrompt;
  if (!articlePrompt.trim()) {
    effectiveArticlePrompt = DEFAULT_ARTICLE_PROMPT;
    await setSetting('ai_article_prompt', DEFAULT_ARTICLE_PROMPT);
  }

  let effectiveImagePrompt = imagePrompt;
  if (!imagePrompt.trim()) {
    effectiveImagePrompt = DEFAULT_IMAGE_PROMPT;
    await setSetting('ai_image_prompt_context', DEFAULT_IMAGE_PROMPT);
  }

  return NextResponse.json({
    articlePrompt: effectiveArticlePrompt,
    imagePrompt: effectiveImagePrompt,
    defaultArticlePrompt: DEFAULT_ARTICLE_PROMPT,
    defaultImagePrompt: DEFAULT_IMAGE_PROMPT,
    isCustomArticlePrompt: effectiveArticlePrompt.trim() !== DEFAULT_ARTICLE_PROMPT.trim(),
    isCustomImagePrompt: effectiveImagePrompt.trim() !== DEFAULT_IMAGE_PROMPT.trim(),
    articleHistory: parseHistory(articleHistoryRaw),
    imageHistory: parseHistory(imageHistoryRaw),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { articlePrompt, imagePrompt } = await req.json();

  // Un prompt article vide est réinterprété comme « revenir au prompt par défaut »
  // pour garantir qu’une instruction est toujours présente en base.
  if (articlePrompt !== undefined) {
    const value = String(articlePrompt).trim() ? String(articlePrompt) : DEFAULT_ARTICLE_PROMPT;
    const current = await getSetting('ai_article_prompt', '');
    if (current.trim() && current.trim() !== value.trim()) {
      await pushHistory('ai_article_prompt_history', current);
    }
    await setSetting('ai_article_prompt', value);
  }

  if (imagePrompt !== undefined) {
    const value = String(imagePrompt);
    const current = await getSetting('ai_image_prompt_context', '');
    if (current.trim() && current.trim() !== value.trim()) {
      await pushHistory('ai_image_prompt_history', current);
    }
    await setSetting('ai_image_prompt_context', value);
  }

  return NextResponse.json({ ok: true });
}
