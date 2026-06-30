import { getSession } from '@/lib/auth';
import AdminShell from './AdminShell';

export const metadata = {
  title: 'Admin — TenderWise',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {children}
      </div>
    );
  }

  return <AdminShell role={session.user.role}>{children}</AdminShell>;
}
