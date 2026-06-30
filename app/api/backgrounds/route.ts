import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllBackgrounds, addBackground, deleteBackground, updateBackgroundLabel, setBackgroundActive } from '@/lib/backgrounds';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  try {
    return NextResponse.json({ backgrounds: await getAllBackgrounds() });
  } catch {
    return NextResponse.json({ backgrounds: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { url, label } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL de l’image manquante' }, { status: 400 });
  }
  try {
    await addBackground(url, typeof label === 'string' ? label : '');
    return NextResponse.json({ ok: true, backgrounds: await getAllBackgrounds() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    // Aide explicite si la table n’a pas encore été créée.
    const hint = /header_backgrounds/.test(msg) || /doesn.t exist|n.existe pas/i.test(msg)
      ? 'Table absente : exécutez schema-backgrounds.sql dans phpMyAdmin.'
      : msg;
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, label, active } = await req.json();
  if (!id || typeof id !== 'number') {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  }
  try {
    if (typeof label === 'string') await updateBackgroundLabel(id, label.trim());
    if (typeof active === 'boolean') await setBackgroundActive(id, active);
    return NextResponse.json({ ok: true, backgrounds: await getAllBackgrounds() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const id = parseInt(new URL(req.url).searchParams.get('id') || '', 10);
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  try {
    await deleteBackground(id);
    return NextResponse.json({ ok: true, backgrounds: await getAllBackgrounds() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
