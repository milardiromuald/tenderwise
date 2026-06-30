import { NextRequest, NextResponse } from 'next/server';
import { getMedia } from '@/lib/media';

// Sert les octets d’une image stockée en base : GET /api/media/42
// Cache long + immutable : un id correspond toujours au même contenu
// (déduplication par SHA-256 côté saveMedia → le contenu d’un id ne change jamais).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return new NextResponse('ID invalide', { status: 400 });
  }

  const media = await getMedia(id);
  if (!media) {
    return new NextResponse('Image introuvable', { status: 404 });
  }

  return new NextResponse(new Uint8Array(media.data), {
    status: 200,
    headers: {
      'Content-Type': media.mime_type,
      'Content-Length': String(media.byte_size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
