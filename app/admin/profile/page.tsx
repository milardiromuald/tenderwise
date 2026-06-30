import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { queryOne } from '@/lib/db';
import { getAllSettings } from '@/lib/settings';
import ProfileClient from './ProfileClient';

export const metadata = { title: 'Mon profil — Admin TenderWise' };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const [user, settings] = await Promise.all([
    queryOne<{
      id: number; username: string; role: string; created_at: string;
      display_name: string | null; bio_title: string | null; bio: string | null;
      avatar_url: string | null; avatar_shape: string | null; linkedin_url: string | null;
    }>(
      'SELECT id, username, role, created_at, display_name, bio_title, bio, avatar_url, avatar_shape, linkedin_url FROM users WHERE username = ? LIMIT 1',
      [session.user.name]
    ).catch(() =>
      queryOne<{ id: number; username: string; role: string; created_at: string }>(
        'SELECT id, username, role, created_at FROM users WHERE username = ? LIMIT 1',
        [session.user.name]
      )
    ),
    getAllSettings(),
  ]);

  return <ProfileClient user={user ?? null} settings={settings} />;
}
