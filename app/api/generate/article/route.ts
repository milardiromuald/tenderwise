import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseGeminiError } from '@/lib/articleGen';
import { runAgentPipeline } from '@/lib/agents';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { sujet, categorie, ton, longueur, langue, motsCles } = await req.json();
  if (!sujet?.trim()) return NextResponse.json({ error: 'Le sujet est requis' }, { status: 400 });

  try {
    const ctx = await runAgentPipeline({ sujet, categorie, ton, longueur, langue, motsCles });
    if (!ctx.articleFinal) throw new Error('Pipeline IA : aucun article généré');
    return NextResponse.json({
      article:   ctx.articleFinal,
      tokensIn:  ctx.tokensIn,
      tokensOut: ctx.tokensOut,
      steps:     ctx.steps,
      score:     ctx.finalScore ?? null,
    });
  } catch (err) {
    console.error('Article generation error:', err);
    const msg = err instanceof Error && err.message === 'Le sujet est requis' ? err.message : parseGeminiError(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
