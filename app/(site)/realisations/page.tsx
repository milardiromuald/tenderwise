export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import type { Metadata } from 'next';
import RealisationsClient from './RealisationsClient';

export const metadata: Metadata = {
  title: 'Nos Réalisations — Projets AMO & Réhabilitation',
  description: 'Portfolio TenderWise : projets de construction, réhabilitation et facility management pilotés en AMO. Découvrez nos références en gestion de patrimoine immobilier.',
  alternates: { canonical: 'https://www.tenderwise.fr/realisations' },
  openGraph: {
    title: 'Nos Réalisations — Projets AMO & Réhabilitation — TenderWise',
    description: 'Portfolio TenderWise : réhabilitation, construction neuve, facility management. Des projets maîtrisés de A à Z pour investisseurs et propriétaires.',
    siteName: 'TenderWise',
    locale: 'fr_FR',
    type: 'website',
  },
};

interface ProjectRow {
  id: number; nom: string; slug: string; sous_titre: string; annees: string; budget_fmt: string;
  client: string; categorie: string; type_etablissement: string; description: string;
  missions: string; images: string; statut: string;
}

export default async function RealisationsPage() {
  const rows = await query<ProjectRow>("SELECT * FROM projects WHERE statut != 'inactive' ORDER BY id DESC");

  const projects = rows.map((p) => ({
    id: p.id,
    slug: p.slug || String(p.id),
    titre: p.nom,
    meta: `${p.annees}${p.client ? ' — ' + p.client : ''}`,
    categorie: p.categorie || '',
    pills: [p.categorie, p.type_etablissement, p.budget_fmt].filter(Boolean),
    desc: p.description || '',
    client: p.client || '',
    typeEtab: p.type_etablissement || '',
    annees: p.annees || '',
    budget: p.budget_fmt || '',
    statut: p.statut || 'active',
    missions: (p.missions || '').split('\n').map(m => m.trim()).filter(Boolean),
    images: (() => {
      try {
        const arr = JSON.parse(p.images || '[]');
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    })(),
  }));

  return <RealisationsClient projects={projects} />;
}
