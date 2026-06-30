import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Expertise AMO & Facility Management',
  description: 'TenderWise : expertise en études de faisabilité, conduite d\'opération AMO, facility management et gestion de patrimoine immobilier. Sécurisez vos investissements de A à Z.',
  alternates: { canonical: 'https://www.tenderwise.fr/expertise' },
  openGraph: {
    type: 'website',
    url: 'https://www.tenderwise.fr/expertise',
    title: 'Expertise AMO & Facility Management — TenderWise',
    description: 'Études de faisabilité, conduite d\'opération, facility management : TenderWise sécurise vos actifs immobiliers à chaque étape.',
  },
};

export default function ExpertiseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
