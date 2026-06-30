export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { getAllSettings } from '@/lib/settings';
import CarriereClient from './CarriereClient';

export const metadata: Metadata = {
  title: 'Carrière & Recrutement AMO',
  description: 'Rejoignez l\'équipe TenderWise, expert AMO à Lyon. Découvrez nos offres d\'emploi en assistance à maîtrise d\'ouvrage, facility management et gestion de patrimoine immobilier.',
  alternates: { canonical: 'https://www.tenderwise.fr/carriere' },
  openGraph: {
    type: 'website',
    url: 'https://www.tenderwise.fr/carriere',
    title: 'Carrière & Recrutement AMO — TenderWise',
    description: 'Offres d\'emploi TenderWise : rejoignez des experts passionnés par l\'AMO et la gestion de patrimoine immobilier à Lyon.',
  },
};

interface JobOffer {
  id: number; titre: string; contrat: string; lieu: string; email: string;
  sujet_email: string; description: string; competences: string; avantages: string;
  statut: string; nouveau: number; urgence: number; date_publication: string; date_expiration: string;
}

export default async function CarrierePage() {
  const [offers, settings] = await Promise.all([
    query<JobOffer>(`
      SELECT * FROM job_offers
      WHERE statut = 'active'
      AND (date_expiration IS NULL OR date_expiration = '' OR date_expiration >= CURDATE())
      ORDER BY date_publication DESC, id DESC
    `),
    getAllSettings(),
  ]);

  const parsedOffers = offers.map((o) => ({
    id: o.id,
    titre: o.titre,
    contrat: o.contrat,
    lieu: o.lieu,
    email: o.email,
    sujet_email: o.sujet_email || `Candidature ${o.contrat} - ${o.titre}`,
    description: o.description || '',
    competences: (o.competences || '').split('\n').filter(Boolean),
    avantages: (o.avantages || '').split('\n').filter(Boolean),
    isNew: Boolean(o.nouveau),
    isUrgent: Boolean(o.urgence),
    hasRemote: o.lieu.toLowerCase().includes('télétravail') || o.lieu.toLowerCase().includes('remote'),
    datePublication: o.date_publication || '',
    dateExpiration: o.date_expiration || '',
  }));

  const spontaneousEmail = settings.spontaneous_email || 'r.milardi@tenderwise.fr';

  // Offre « Candidature spontanée » par défaut — toujours affichée, codée en dur
  // pour rester disponible même si la base est vide ou indisponible (backup).
  const spontaneousOffer = {
    id: -1,
    titre: 'Candidature spontanée',
    contrat: 'CDI · CDD · Stage · Alternance',
    lieu: 'Lyon / Télétravail partiel',
    email: spontaneousEmail,
    sujet_email: 'Candidature spontanée TenderWise',
    description:
      "Aucune offre ne correspond exactement à votre profil ? Nous sommes convaincus que les meilleurs talents ne se résument pas à une fiche de poste. Présentez-nous votre parcours, vos ambitions et ce que vous aimeriez construire avec nous : nous étudions chaque candidature avec attention.",
    competences: [
      'Passion pour l’immobilier durable et l’AMO',
      'Esprit d’équipe et sens du service client',
      'Autonomie, rigueur et curiosité',
      'Tous niveaux d’expérience : junior à confirmé',
    ],
    avantages: [
      'Une équipe à taille humaine et bienveillante',
      'Des projets variés et porteurs de sens',
      'Télétravail partiel & flexibilité',
      'Évolution et formation continue',
    ],
    isNew: false,
    isUrgent: false,
    hasRemote: true,
    datePublication: '',
    dateExpiration: '',
    isSpontaneous: true,
  };

  const allOffers = [...parsedOffers.map((o) => ({ ...o, isSpontaneous: false })), spontaneousOffer];

  const rgpd = {
    email: settings.rgpd_dpo_email || settings.contact_email || 'r.milardi@tenderwise.fr',
    retention: settings.application_retention || '2 ans',
    companyName: settings.company_name || settings.site_name || 'TenderWise',
  };

  // ── Données structurées : JobPosting (Google for Jobs) + fil d'Ariane ──────
  const SITE = 'https://www.tenderwise.fr';
  const orgName = settings.company_name || settings.site_name || 'TenderWise';

  // Map FR → enum Google ; valeur omise si aucun mapping fiable.
  const employmentTypeOf = (contrat: string): string | undefined => {
    const c = (contrat || '').toLowerCase();
    if (c.includes('stage')) return 'INTERN';
    if (c.includes('alternance') || c.includes('apprentissage')) return 'OTHER';
    if (c.includes('cdd') || c.includes('intérim') || c.includes('interim')) return 'TEMPORARY';
    if (c.includes('cdi') || c.includes('temps plein')) return 'FULL_TIME';
    if (c.includes('temps partiel')) return 'PART_TIME';
    return undefined;
  };

  const jobPostings = parsedOffers
    .filter((o) => o.datePublication)
    .map((o) => {
      const empType = employmentTypeOf(o.contrat);
      return {
        '@type': 'JobPosting',
        title: o.titre,
        description: o.description || `${o.titre} — ${o.competences.join('. ')}`,
        datePosted: o.datePublication,
        ...(o.dateExpiration ? { validThrough: o.dateExpiration } : {}),
        ...(empType ? { employmentType: empType } : {}),
        hiringOrganization: { '@type': 'Organization', name: orgName, sameAs: SITE, logo: `${SITE}/og-image.png` },
        jobLocation: {
          '@type': 'Place',
          address: { '@type': 'PostalAddress', addressLocality: o.lieu || 'Lyon', addressRegion: 'Auvergne-Rhône-Alpes', addressCountry: 'FR' },
        },
        ...(o.hasRemote ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'France' } } : {}),
        directApply: false,
      };
    });

  const careerSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      ...jobPostings,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Carrière', item: `${SITE}/carriere` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(careerSchema) }} />
      <CarriereClient offers={allOffers} rgpd={rgpd} />
    </>
  );
}
