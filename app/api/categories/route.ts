import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';

const KEY = 'article_categories';
const DEFAULTS = ['Marchés publics', 'Actualités', 'Réglementation', 'Conseils pratiques', 'Veille juridique'];

export async function GET() {
  try {
    const row = await queryOne<{ value: string }>(
      'SELECT `value` FROM settings WHERE `key` = ?',
      [KEY]
    );
    const categories: string[] = row ? JSON.parse(row.value) : DEFAULTS;
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ categories: DEFAULTS });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const categories: string[] = Array.isArray(body.categories) ? body.categories : DEFAULTS;
  const json = JSON.stringify(categories);

  try {
    const existing = await queryOne<{ value: string }>('SELECT `value` FROM settings WHERE `key` = ?', [KEY]);
    if (existing) {
      await execute('UPDATE settings SET `value` = ? WHERE `key` = ?', [json, KEY]);
    } else {
      await execute('INSERT INTO settings (`key`, `value`) VALUES (?, ?)', [KEY, json]);
    }
  } catch {
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, categories });
}
