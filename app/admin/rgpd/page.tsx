import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllSettings } from '@/lib/settings';
import RgpdClient from './RgpdClient';

export const dynamic = 'force-dynamic';

export default async function RgpdPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const [settings, { s: section }] = await Promise.all([
    getAllSettings(),
    searchParams,
  ]);

  return <RgpdClient settings={settings} activeSection={section || 'banner'} />;
}
