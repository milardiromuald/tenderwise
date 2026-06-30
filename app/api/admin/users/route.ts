import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import bcrypt from 'bcryptjs';

/** Run once — adds is_active if the column doesn't exist yet (MySQL 5.7 compatible). */
async function ensureIsActiveColumn() {
  try {
    await execute(
      'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
      []
    );
  } catch {
    // MySQL 1060: Duplicate column name — column already exists, that's expected.
  }
}

function validatePassword(pwd: string): string | null {
  if (!pwd || pwd.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[A-Z]/.test(pwd)) return 'Au moins une lettre majuscule requise.';
  if (!/[a-z]/.test(pwd)) return 'Au moins une lettre minuscule requise.';
  if (!/[0-9]/.test(pwd)) return 'Au moins un chiffre requis.';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Au moins un caractère spécial requis (!@#$%^&*…).';
  return null;
}

function validateUsername(u: string): string | null {
  if (!u || !u.trim()) return "Le nom d’utilisateur est requis.";
  if (u.trim().length < 3) return "Minimum 3 caractères.";
  if (u.trim().length > 50) return "Maximum 50 caractères.";
  if (!/^[a-zA-Z0-9_.-]+$/.test(u.trim())) return "Caractères autorisés : lettres, chiffres, _ . -";
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  await ensureIsActiveColumn();

  const users = await query<{
    id: number; username: string; role: string; is_active: number; created_at: string;
  }>('SELECT id, username, role, COALESCE(is_active, 1) as is_active, created_at FROM users ORDER BY id ASC');

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  await ensureIsActiveColumn();

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { username, password, role = 'admin' } = body;

  const usernameErr = validateUsername(username);
  if (usernameErr) return NextResponse.json({ error: usernameErr }, { status: 400 });

  const pwdErr = validatePassword(password);
  if (pwdErr) return NextResponse.json({ error: pwdErr }, { status: 400 });

  if (!['admin', 'editor'].includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  const existing = await query('SELECT id FROM users WHERE username = ?', [username.trim()]);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Ce nom d’utilisateur est déjà utilisé." }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const result = await execute(
    'INSERT INTO users (username, password, role, is_active) VALUES (?, ?, ?, 1)',
    [username.trim(), hashed, role]
  );

  return NextResponse.json({ ok: true, id: result.insertId }, { status: 201 });
}
