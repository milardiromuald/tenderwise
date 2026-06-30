import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const offers = await query('SELECT * FROM job_offers ORDER BY id DESC');
  return NextResponse.json(offers);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const result = await execute(`
    INSERT INTO job_offers (titre, contrat, lieu, email, sujet_email, description, competences, avantages, statut, nouveau, urgence, teletravail, date_publication, date_expiration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    body.titre || '', body.contrat || '', body.lieu || '',
    body.email || '', body.sujet_email || '', body.description || '',
    body.competences || '', body.avantages || '',
    body.statut || 'active',
    body.nouveau ? 1 : 0, body.urgence ? 1 : 0, body.teletravail ? 1 : 0,
    body.date_publication || new Date().toISOString().split('T')[0],
    body.date_expiration || null,
  ]);

  return NextResponse.json({ id: result.insertId }, { status: 201 });
}
