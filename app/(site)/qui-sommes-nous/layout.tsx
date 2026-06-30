import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Qui sommes-nous — Expert AMO Indépendant',
  description: 'Fondé par des experts des grands groupes d\'ingénierie, TenderWise est votre partenaire de confiance en AMO. Indépendance totale, pragmatisme et transparence à chaque projet.',
  alternates: { canonical: 'https://www.tenderwise.fr/qui-sommes-nous' },
  openGraph: {
    type: 'website',
    url: 'https://www.tenderwise.fr/qui-sommes-nous',
    title: 'Qui sommes-nous — TenderWise, Expert AMO Indépendant',
    description: 'Votre bras droit technique en AMO : 20 ans d\'expérience, indépendance garantie, pilotage de A à Z de vos projets immobiliers.',
  },
};

export default function QuiSommesNousLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
