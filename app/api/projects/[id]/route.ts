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
  const project = await queryOne('SELECT * FROM projects WHERE id = ?', [id]);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  const body = await req.json();

  // Support partial updates (e.g. toggle statut only)
  const existing = await queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE id = ?', [id]);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const merged = { ...existing, ...body };

  await execute(`
    UPDATE projects SET
      nom=?, sous_titre=?, start_year=?, end_year=?, annees=?,
      budget_raw=?, budget_fmt=?, client=?, categorie=?,
      type_etablissement=?, description=?, missions=?, images=?, statut=?, slug=?
    WHERE id=?
  `, [
    merged.nom || '', merged.sous_titre || '',
    merged.start_year || null, merged.end_year || null,
    merged.annees || '',
    merged.budget_raw || null, merged.budget_fmt || '',
    merged.client || '', merged.categorie || '', merged.type_etablissement || '',
    merged.description || '', merged.missions || '', merged.images || '[]',
    merged.statut || 'active', merged.slug || null,
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
  await execute('DELETE FROM projects WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
