import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ── GET (admin) — télécharge une pièce jointe : ?doc=cv | lm ─────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new NextResponse('Non autorisé', { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return new NextResponse('ID invalide', { status: 400 });

  const doc = new URL(req.url).searchParams.get('doc') === 'lm' ? 'lm' : 'cv';

  const row = await queryOne<Record<string, unknown>>(
    `SELECT ${doc}_filename AS filename, ${doc}_mime AS mime, ${doc}_size AS size, ${doc}_data AS data
       FROM job_applications WHERE id = ?`,
    [id]
  );
  if (!row || !row.data) return new NextResponse('Fichier introuvable', { status: 404 });

  // Marque la candidature comme lue à l’ouverture d’une pièce.
  await execute("UPDATE job_applications SET statut = 'lu' WHERE id = ? AND statut = 'nouveau'", [id]).catch(() => {});

  const filename = String(row.filename || `${doc}-${id}`);
  return new NextResponse(new Uint8Array(row.data as Buffer), {
    status: 200,
    headers: {
      'Content-Type': String(row.mime || 'application/octet-stream'),
      'Content-Length': String(row.size || (row.data as Buffer).length),
      // Pièce sensible : pas de cache, téléchargement forcé.
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      'Cache-Control': 'no-store, private',
    },
  });
}

/* ── PUT (admin) — change le statut ──────────────────────────────────────── */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const { statut } = await req.json() as { statut: string };
  if (!['nouveau', 'lu', 'traite', 'archive'].includes(statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }
  await execute('UPDATE job_applications SET statut = ? WHERE id = ?', [statut, id]);
  return NextResponse.json({ success: true });
}

/* ── DELETE (admin) — effacement définitif (RGPD) ────────────────────────── */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  await execute('DELETE FROM job_applications WHERE id = ?', [id]);
  return NextResponse.json({ success: true });
}
