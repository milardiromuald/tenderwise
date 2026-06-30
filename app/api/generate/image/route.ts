import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pickRandomBackground } from '@/lib/backgrounds';
import { composeHeader } from '@/lib/composeImage';
import { saveMedia } from '@/lib/media';

// Plus de generation IA : on compose l'en-tete a partir d'un fond predefini
// (tire au hasard ou cible) + titre/sous-titre incruste. Aucune cle payante requise.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  const { titre, sujet, backgroundUrl } = await req.json();

  try {
    let bgUrl: string;
    if (backgroundUrl) {
      // Fond cible fourni par le client (previsualisation depuis la page de validation).
      bgUrl = backgroundUrl as string;
    } else {
      const bg = await pickRandomBackground();
      if (!bg) {
        return NextResponse.json(
          { error: "Aucun fond d'en-tete configure (Admin > Fonds d'en-tete)." },
          { status: 400 },
        );
      }
      bgUrl = bg.url;
    }

    const buffer = await composeHeader({
      backgroundUrl: bgUrl,
      title: (titre || sujet || '').toString(),
      subtitle: (titre && sujet ? sujet : '').toString(),
    });
    const filename = 'header-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.png';
    const { url } = await saveMedia(buffer, 'image/png', { filename, source: 'ai', altText: titre });
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generate/image] Erreur:', msg);
    return NextResponse.json({ error: msg.slice(0, 400) }, { status: 503 });
  }
}
