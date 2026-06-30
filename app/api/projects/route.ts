import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne, execute } from '@/lib/db';
import { str, requireField } from '@/lib/validate';

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

  const nom = str(body.nom, 255);
  const errors: string[] = [];
  requireField(nom, 'Le nom du projet', errors, 2);
  if (errors.length > 0) return NextResponse.json({ error: errors.join(' ') }, { status: 422 });

  const slug = await uniqueSlug(str(body.slug, 80) || toSlug(nom));

  const result = await execute(`
    INSERT INTO projects (nom, sous_titre, start_year, end_year, annees, budget_raw, budget_fmt, client, categorie, type_etablissement, description, missions, images, statut, slug)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    nom, str(body.sous_titre, 255),
    body.start_year || null, body.end_year || null,
    str(body.annees, 100),
    body.budget_raw || null, str(body.budget_fmt, 100),
    str(body.client, 255), str(body.categorie, 100), str(body.type_etablissement, 100),
    str(body.description, 20000), str(body.missions, 20000), str(body.images, 20000) || '[]',
    str(body.statut, 30) || 'active', slug,
  ]);

  return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
}
