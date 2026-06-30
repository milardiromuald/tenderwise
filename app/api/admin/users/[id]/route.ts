import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, query, execute } from '@/lib/db';

type UserRow = { id: number; username: string; role: string; is_active: number };

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const target = await queryOne<UserRow>(
    'SELECT id, username, role, COALESCE(is_active, 1) as is_active FROM users WHERE id = ?',
    [targetId]
  );
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });

  /* ── Toggle active / inactive ──────────────────────────────────────── */
  if (body.type === 'toggle_active') {
    if (target.username === session.user.name) {
      return NextResponse.json({ error: 'Impossible de désactiver votre propre compte.' }, { status: 400 });
    }
    // Prevent disabling the last active account entirely
    if (target.is_active === 1) {
      const activeAccounts = await query<{ id: number }>(
        'SELECT id FROM users WHERE COALESCE(is_active, 1) = 1'
      );
      if (activeAccounts.length <= 1) {
        return NextResponse.json({ error: 'Impossible de désactiver le dernier compte actif.' }, { status: 400 });
      }
    }
    const newStatus = target.is_active === 1 ? 0 : 1;
    await execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, targetId]);
    return NextResponse.json({ ok: true, is_active: newStatus });
  }

  /* ── Rename ────────────────────────────────────────────────────────── */
  if (body.type === 'rename') {
    const newUsername = (body.newUsername || '').trim();

    if (!newUsername) return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });
    if (newUsername.length < 3) return NextResponse.json({ error: "Minimum 3 caractères." }, { status: 400 });
    if (newUsername.length > 50) return NextResponse.json({ error: "Maximum 50 caractères." }, { status: 400 });
    if (!/^[a-zA-Z0-9_.-]+$/.test(newUsername)) {
      return NextResponse.json({ error: "Caractères autorisés : lettres, chiffres, _ . -" }, { status: 400 });
    }
    if (newUsername === target.username) {
      return NextResponse.json({ error: "Ce nom est déjà celui de cet utilisateur." }, { status: 400 });
    }

    const existing = await query('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, targetId]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Ce nom d’utilisateur est déjà utilisé." }, { status: 409 });
    }

    await execute('UPDATE users SET username = ? WHERE id = ?', [newUsername, targetId]);

    // If the renamed user is the currently logged-in admin, their JWT becomes stale → force re-login
    const requireRelogin = target.username === session.user.name;
    return NextResponse.json({ ok: true, requireRelogin });
  }

  return NextResponse.json({ error: "Type d’opération inconnu." }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 });

  const target = await queryOne<{ id: number; username: string }>(
    'SELECT id, username FROM users WHERE id = ?',
    [targetId]
  );
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });

  if (target.username === session.user.name) {
    return NextResponse.json({ error: 'Impossible de supprimer votre propre compte.' }, { status: 400 });
  }

  const allUsers = await query<{ id: number }>('SELECT id FROM users');
  if (allUsers.length <= 1) {
    return NextResponse.json({ error: 'Impossible de supprimer le dernier compte administrateur.' }, { status: 400 });
  }

  await execute('DELETE FROM users WHERE id = ?', [targetId]);
  return NextResponse.json({ ok: true });
}
