import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { queryOne } from '@/lib/db';
import ArticleForm from '../ArticleForm';

type UserProfile = { display_name: string | null; bio_title: string | null; bio: string | null; avatar_url: string | null; avatar_shape: string | null; linkedin_url: string | null };

export default async function NewArticlePage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const userRow = await queryOne<UserProfile>(
    'SELECT display_name, bio_title, bio, avatar_url, avatar_shape, linkedin_url FROM users WHERE username = ? LIMIT 1',
    [session.user.name]
  ).catch(() => null);

  const authorProfile = {
    username:    session.user.name,
    displayName: userRow?.display_name || session.user.name,
    avatarUrl:   userRow?.avatar_url   || '',
    bioTitle:    userRow?.bio_title    || '',
    bio:         userRow?.bio          || '',
    linkedinUrl: userRow?.linkedin_url || '',
  };

  return <ArticleForm authorProfile={authorProfile} />;
}
