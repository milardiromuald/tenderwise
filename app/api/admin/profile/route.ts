import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, query, execute } from '@/lib/db';
import { setSetting } from '@/lib/settings';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { type } = body;

  /* ── Avatar ─────────────────────────────────────────────────────────────── */
  if (type === 'avatar') {
    const { avatarUrl = '', avatarShape = 'round' } = body;

    if (avatarShape !== 'round' && avatarShape !== 'square') {
      return NextResponse.json({ error: 'Forme invalide' }, { status: 400 });
    }

    const user = await queryOne<{ id: number }>('SELECT id FROM users WHERE username = ? LIMIT 1', [session.user.name]);
    if (user) {
      try {
        await execute('UPDATE users SET avatar_url = ?, avatar_shape = ? WHERE id = ?', [avatarUrl, avatarShape, user.id]);
      } catch {
        // columns may not exist yet — migration will run on next article create
      }
    }
    await Promise.all([
      setSetting('admin_avatar_url', avatarUrl),
      setSetting('admin_avatar_shape', avatarShape),
    ]);

    return NextResponse.json({ ok: true });
  }

  /* ── Public profile (bio / display name / linkedin) ─────────────────────── */
  if (type === 'public_profile') {
    const { displayName = '', bioTitle = '', bio = '', linkedinUrl = '' } = body;

    const user = await queryOne<{ id: number }>('SELECT id FROM users WHERE username = ? LIMIT 1', [session.user.name]);
    if (user) {
      try {
        await execute(
          'UPDATE users SET display_name = ?, bio_title = ?, bio = ?, linkedin_url = ? WHERE id = ?',
          [displayName || null, bioTitle || null, bio || null, linkedinUrl || null, user.id]
        );
      } catch {
        // columns may not exist yet
      }
    }
    // Also keep global settings for backward compat with old articles
    await Promise.all([
      setSetting('admin_display_name', displayName),
      setSetting('admin_bio_title', bioTitle),
      setSetting('admin_bio', bio),
      setSetting('social_linkedin', linkedinUrl),
    ]);

    return NextResponse.json({ ok: true });
  }

  /* ── Password ────────────────────────────────────────────────────────────── */
  if (type === 'password') {
    const { currentPwd, newPwd } = body;

    if (!currentPwd || !newPwd) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }

    // Security requirements
    if (newPwd.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
    }
    if (!/[A-Z]/.test(newPwd)) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins une lettre majuscule.' }, { status: 400 });
    }
    if (!/[a-z]/.test(newPwd)) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins une lettre minuscule.' }, { status: 400 });
    }
    if (!/[0-9]/.test(newPwd)) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins un chiffre.' }, { status: 400 });
    }
    if (!/[^A-Za-z0-9]/.test(newPwd)) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*…).' }, { status: 400 });
    }

    // Fetch current user
    const user = await queryOne<{ id: number; password: string }>(
      'SELECT id, password FROM users WHERE username = ? LIMIT 1',
      [session.user.name]
    );

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPwd, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Le mot de passe actuel est incorrect.' }, { status: 403 });
    }

    // Prevent reuse
    const isSame = await bcrypt.compare(newPwd, user.password);
    if (isSame) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit être différent de l\'actuel.' }, { status: 400 });
    }

    // Hash and update
    const hashed = await bcrypt.hash(newPwd, 12);
    await execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);

    return NextResponse.json({ ok: true });
  }

  /* ── Username change ─────────────────────────────────────────────────── */
  if (type === 'username') {
    const { newUsername, currentPwd } = body;

    if (!newUsername || !newUsername.trim()) {
      return NextResponse.json({ error: "Le nom d’utilisateur est requis." }, { status: 400 });
    }
    if (newUsername.trim().length < 3) {
      return NextResponse.json({ error: "Minimum 3 caractères." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(newUsername.trim())) {
      return NextResponse.json({ error: "Caractères autorisés : lettres, chiffres, _ . -" }, { status: 400 });
    }
    if (!currentPwd) {
      return NextResponse.json({ error: 'Le mot de passe actuel est requis pour confirmer cette modification.' }, { status: 400 });
    }

    const user = await queryOne<{ id: number; username: string; password: string }>(
      'SELECT id, username, password FROM users WHERE username = ? LIMIT 1',
      [session.user.name]
    );
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }
    if (newUsername.trim() === user.username) {
      return NextResponse.json({ error: "Ce nom est déjà votre identifiant actuel." }, { status: 400 });
    }

    const isValid = await bcrypt.compare(currentPwd, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 403 });
    }

    const existing = await query('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername.trim(), user.id]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Ce nom d’utilisateur est déjà utilisé." }, { status: 409 });
    }

    await execute('UPDATE users SET username = ? WHERE id = ?', [newUsername.trim(), user.id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Type d\'opération inconnu' }, { status: 400 });
}
