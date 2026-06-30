import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StatsClient from './StatsClient';

export const metadata = { title: 'Statistiques — Admin TenderWise' };

export default async function StatsPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  return <StatsClient />;
}
