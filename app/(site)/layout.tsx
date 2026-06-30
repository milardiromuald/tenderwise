export const dynamic = 'force-dynamic';

import { getAllSettings } from '@/lib/settings';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getAllSettings();

  return (
    <>
      <Navbar settings={settings} />
      <main style={{ paddingTop: 'var(--header-height)' }}>
        {children}
      </main>
      <Footer settings={settings} />
    </>
  );
}
