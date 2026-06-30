import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { str, requireField, requireEmail } from '@/lib/validate';

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

  const titre = str(body.titre, 255);
  const email = str(body.email, 255);
  const errors: string[] = [];
  requireField(titre, "Le titre de l'offre", errors, 2);
  if (email) requireEmail(email, "L'email de contact", errors);
  if (errors.length > 0) return NextResponse.json({ error: errors.join(' ') }, { status: 422 });

  const result = await execute(`
    INSERT INTO job_offers (titre, contrat, lieu, email, sujet_email, description, competences, avantages, statut, nouveau, urgence, teletravail, date_publication, date_expiration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    titre, str(body.contrat, 50), str(body.lieu, 255),
    email, str(body.sujet_email, 255), str(body.description, 20000),
    str(body.competences, 5000), str(body.avantages, 5000),
    str(body.statut, 30) || 'active',
    body.nouveau ? 1 : 0, body.urgence ? 1 : 0, body.teletravail ? 1 : 0,
    body.date_publication || new Date().toISOString().split('T')[0],
    body.date_expiration || null,
  ]);

  return NextResponse.json({ id: result.insertId }, { status: 201 });
}
