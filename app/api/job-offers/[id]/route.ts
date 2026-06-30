import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import { str, requireField, requireEmail } from '@/lib/validate';

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

  const titre = str(merged.titre, 255);
  const email = str(merged.email, 255);
  const errors: string[] = [];
  requireField(titre, "Le titre de l'offre", errors, 2);
  if (email) requireEmail(email, "L'email de contact", errors);
  if (errors.length > 0) return NextResponse.json({ error: errors.join(' ') }, { status: 422 });

  await execute(`
    UPDATE job_offers SET
      titre=?, contrat=?, lieu=?, email=?, sujet_email=?, description=?, competences=?, avantages=?,
      statut=?, nouveau=?, urgence=?, teletravail=?, date_publication=?, date_expiration=?
    WHERE id=?
  `, [
    titre, str(merged.contrat, 50), str(merged.lieu, 255),
    email, str(merged.sujet_email, 255), str(merged.description, 20000),
    str(merged.competences, 5000), str(merged.avantages, 5000),
    str(merged.statut, 30) || 'active',
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
