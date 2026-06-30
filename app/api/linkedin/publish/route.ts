import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { publishLinkedInPost } from '@/lib/linkedin';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let text        = '';
  let imageBuffer: Buffer | undefined;
  let mimeType:   string | undefined;
  let source      = 'manual';
  let target: 'person' | 'organization' = 'person';

  const ct = req.headers.get('content-type') || '';

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    text   = (form.get('text') as string || '').trim();
    source = (form.get('source') as string || 'manual').trim();
    target = (form.get('target') as string) === 'organization' ? 'organization' : 'person';
    const file = form.get('image') as File | null;
    if (file && file.size > 0) {
      imageBuffer = Buffer.from(await file.arrayBuffer());
      mimeType    = file.type || 'image/jpeg';
    }
  } else {
    const body  = await req.json().catch(() => ({}));
    text   = (body.text  as string || '').trim();
    source = (body.source as string || 'manual').trim();
    target = (body.target as string) === 'organization' ? 'organization' : 'person';
    if (body.imageBase64 && body.mimeType) {
      imageBuffer = Buffer.from(body.imageBase64 as string, 'base64');
      mimeType    = body.mimeType as string;
    }
  }

  if (!text) {
    return NextResponse.json({ error: 'Le texte du post est requis' }, { status: 400 });
  }

  try {
    const { postUrn, url } = await publishLinkedInPost(text, imageBuffer, mimeType, { as: target });

    // Persist in DB (avec cible si schéma v2 migré, repli sinon).
    try {
      await execute(
        `INSERT INTO linkedin_posts (text, linkedin_urn, linkedin_url, status, source, target)
         VALUES (?, ?, ?, 'published', ?, ?)`,
        [text, postUrn, url, source, target],
      );
    } catch {
      await execute(
        `INSERT INTO linkedin_posts (text, linkedin_urn, linkedin_url, status, source)
         VALUES (?, ?, ?, 'published', ?)`,
        [text, postUrn, url, source],
      ).catch(() => { /* non bloquant si table absente */ });
    }

    return NextResponse.json({ ok: true, postUrn, url, target });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    try {
      await execute(
        `INSERT INTO linkedin_posts (text, status, source, target)
         VALUES (?, 'failed', ?, ?)`,
        [text, source, target],
      );
    } catch {
      await execute(
        `INSERT INTO linkedin_posts (text, status, source)
         VALUES (?, 'failed', ?)`,
        [text, source],
      ).catch(() => {});
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
