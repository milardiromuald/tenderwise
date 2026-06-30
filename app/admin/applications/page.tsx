import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ApplicationsClient from './ApplicationsClient';

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  return <ApplicationsClient />;
}
