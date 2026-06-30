export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getAllSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'TenderWise — AMO, Facility Management & Réhabilitation',
  description: 'TenderWise accompagne investisseurs et propriétaires immobiliers en AMO : faisabilité, conduite d\'opération, facility management et gestion de patrimoine à Lyon.',
  alternates: { canonical: 'https://www.tenderwise.fr/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'TenderWise',
    url: 'https://www.tenderwise.fr/',
    title: 'TenderWise — AMO, Facility Management & Réhabilitation',
    description: 'Expert indépendant en AMO à Lyon : faisabilité, conduite d\'opération, facility management et gestion de patrimoine immobilier.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TenderWise — AMO & Facility Management' }],
  },
};
import { query } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import AtotsSection from '@/components/AtotsSection';
import BlogTicker from '@/components/BlogTicker';

export default async function HomePage() {
  const settings = await getAllSettings();

  const articles = await query<{
    id: number; titre: string; slug: string;
    image: string; categorie: string; date_publication: string;
  }>(`
    SELECT id, titre, slug, image, categorie, date_publication
    FROM articles
    WHERE statut = 'publie'
    ORDER BY date_publication DESC
    LIMIT 15
  `);

  return (
    <>
      <Navbar settings={settings} />
      <main style={{ paddingTop: 'var(--header-height)' }}>
        <HeroSection settings={settings} />
        <AtotsSection settings={settings} />
        <BlogTicker articles={articles} settings={settings} />
      </main>
      <Footer settings={settings} />
    </>
  );
}
