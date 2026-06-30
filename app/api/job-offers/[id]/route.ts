import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  const offer = await queryOne('SELECT * FROM job_offers WHERE id = ?', [id]);
  if (!offer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(offer);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  const body = await req.json();

  // Support partial updates (e.g. toggle statut only)
  const existing = await queryOne<Record<string, unknown>>('SELECT * FROM job_offers WHERE id = ?', [id]);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const merged = { ...existing, ...body };

  await execute(`
    UPDATE job_offers SET
      titre=?, contrat=?, lieu=?, email=?, sujet_email=?, description=?, competences=?, avantages=?,
      statut=?, nouveau=?, urgence=?, teletravail=?, date_publication=?, date_expiration=?
    WHERE id=?
  `, [
    merged.titre || '', merged.contrat || '', merged.lieu || '',
    merged.email || '', merged.sujet_email || '', merged.description || '',
    merged.competences || '', merged.avantages || '',
    merged.statut || 'active',
    merged.nouveau ? 1 : 0, merged.urgence ? 1 : 0, merged.teletravail ? 1 : 0,
    merged.date_publication || null, merged.date_expiration || null,
    id,
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  await execute('DELETE FROM job_offers WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
