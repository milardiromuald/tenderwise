import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import JobForm from '../JobForm';

export default async function NewJobPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  return <JobForm />;
}
