import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';
import { DEFAULT_ARTICLE_PROMPT, DEFAULT_IMAGE_PROMPT } from '@/lib/defaultPrompts';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const [articlePrompt, imagePrompt] = await Promise.all([
    getSetting('ai_article_prompt', ''),
    getSetting('ai_image_prompt_context', ''),
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
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { articlePrompt, imagePrompt } = await req.json();
  const ops: Promise<void>[] = [];
  // Un prompt article vide est réinterprété comme « revenir au prompt par défaut »
  // pour garantir qu’une instruction est toujours présente en base.
  if (articlePrompt !== undefined) {
    const value = String(articlePrompt).trim() ? String(articlePrompt) : DEFAULT_ARTICLE_PROMPT;
    ops.push(setSetting('ai_article_prompt', value));
  }
  if (imagePrompt !== undefined) ops.push(setSetting('ai_image_prompt_context', String(imagePrompt)));
  await Promise.all(ops);

  return NextResponse.json({ ok: true });
}
