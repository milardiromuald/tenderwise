import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ALLOWED_TYPES, validateMagicBytes, saveMedia } from '@/lib/media';

const MAX_SIZE_MB = 8;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error('[upload] formData parse error:', e);
      return NextResponse.json({ error: 'Données de formulaire invalides' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      console.error('[upload] type non autorisé:', file.type);
      return NextResponse.json(
        { error: `Type de fichier non autorisé : ${file.type}. Formats acceptés : JPEG, PNG, WebP, GIF, SVG, ICO.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Fichier trop lourd (max ${MAX_SIZE_MB} Mo)` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!validateMagicBytes(buffer, file.type)) {
      console.error('[upload] magic bytes invalides pour le type:', file.type);
      return NextResponse.json(
        { error: 'Le contenu du fichier ne correspond pas au type déclaré.' },
        { status: 400 }
      );
    }

    // Stockage EN BASE (table media) — survit aux réinstallations, sauvegardé avec le dump MySQL.
    const { url } = await saveMedia(buffer, file.type, {
      filename: file.name || `image.${ext}`,
      source: 'upload',
      uploadedBy: session.user?.name || undefined,
    });

    console.info('[upload] image enregistrée en base:', url);
    return NextResponse.json({ url });

  } catch (err) {
    console.error('[upload] erreur inattendue:', err);
    return NextResponse.json(
      { error: `Erreur serveur lors de l’upload : ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
