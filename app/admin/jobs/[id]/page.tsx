import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { queryOne } from '@/lib/db';
import JobForm from '../JobForm';

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { id } = await params;
  const job = await queryOne<Record<string, unknown>>('SELECT * FROM job_offers WHERE id = ?', [id]);
  if (!job) notFound();

  return <JobForm initial={{ ...job, id: Number(job.id) } as Parameters<typeof JobForm>[0]['initial']} />;
}
