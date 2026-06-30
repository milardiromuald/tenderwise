import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query, execute } from '@/lib/db';
import UsersClient from './UsersClient';

type UserRow = { id: number; username: string; role: string; is_active: number; created_at: string };

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  // Migration: add is_active column if it doesn't exist yet
  try {
    await execute('ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1', []);
  } catch { /* column already exists */ }

  const users = await query<UserRow>(
    'SELECT id, username, role, COALESCE(is_active, 1) as is_active, created_at FROM users ORDER BY id ASC'
  );

  return <UsersClient users={users} currentUsername={session.user.name} />;
}
