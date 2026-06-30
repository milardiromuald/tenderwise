import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || 'projet';
  let row = await queryOne<{ id: number }>('SELECT id FROM projects WHERE slug = ?', [candidate]);
  let i = 2;
  while (row) {
    candidate = `${base}-${i++}`;
    row = await queryOne<{ id: number }>('SELECT id FROM projects WHERE slug = ?', [candidate]);
  }
  return candidate;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projects = await query('SELECT * FROM projects ORDER BY id DESC');
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const slug = await uniqueSlug(body.slug || toSlug(body.nom || ''));

  const result = await execute(`
    INSERT INTO projects (nom, sous_titre, start_year, end_year, annees, budget_raw, budget_fmt, client, categorie, type_etablissement, description, missions, images, statut, slug)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    body.nom || '', body.sous_titre || '',
    body.start_year || null, body.end_year || null,
    body.annees || '',
    body.budget_raw || null, body.budget_fmt || '',
    body.client || '', body.categorie || '', body.type_etablissement || '',
    body.description || '', body.missions || '', body.images || '[]',
    body.statut || 'active', slug,
  ]);

  return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
}
