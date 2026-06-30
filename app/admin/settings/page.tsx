import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllSettings } from '@/lib/settings';
import SettingsClient from './SettingsClient';

export default async function SettingsPage({
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

  return <SettingsClient settings={settings} activeSection={section || 'logo'} />;
}
