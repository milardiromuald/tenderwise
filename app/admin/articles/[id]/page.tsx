import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { queryOne } from '@/lib/db';
import ArticleForm from '../ArticleForm';

type UserProfile = { display_name: string | null; bio_title: string | null; bio: string | null; avatar_url: string | null; avatar_shape: string | null; linkedin_url: string | null };

export default async function EditArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { id } = await params;
  await searchParams; // le retour « workflow » est désormais géré par AdminTopBar (?from=workflow)

  const [article, userRow] = await Promise.all([
    queryOne<Record<string, unknown>>('SELECT * FROM articles WHERE id = ?', [id]),
    queryOne<UserProfile>(
      'SELECT display_name, bio_title, bio, avatar_url, avatar_shape, linkedin_url FROM users WHERE username = ? LIMIT 1',
      [session.user.name]
    ).catch(() => null),
  ]);
  if (!article) notFound();

  const authorProfile = {
    username:    session.user.name,
    displayName: userRow?.display_name || session.user.name,
    avatarUrl:   userRow?.avatar_url   || '',
    bioTitle:    userRow?.bio_title    || '',
    bio:         userRow?.bio          || '',
    linkedinUrl: userRow?.linkedin_url || '',
  };

  return (
    <ArticleForm
      initial={{ ...article, id: Number(article.id) } as Parameters<typeof ArticleForm>[0]['initial']}
      authorProfile={authorProfile}
    />
  );
}
