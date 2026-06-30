import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import ProjectForm from '../ProjectForm';

const DEFAULT_CATEGORIES = [
  "AMO",
  "Conduite d’opération",
  "Facility Management",
  "Gestion de patrimoine",
  "Maîtrise d'œuvre",
  "Réhabilitation",
];

const DEFAULT_TYPES = [
  "Bureau / Tertiaire",
  "Équipement culturel",
  "Équipement sportif",
  "Établissement de santé",
  "Établissement scolaire",
  "Industrie / Logistique",
  "Logement social",
];

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const catRows = await query<{ categorie: string }>(
    "SELECT DISTINCT categorie FROM projects WHERE categorie IS NOT NULL AND categorie != '' ORDER BY categorie"
  );
  const typeRows = await query<{ type_etablissement: string }>(
    "SELECT DISTINCT type_etablissement FROM projects WHERE type_etablissement IS NOT NULL AND type_etablissement != '' ORDER BY type_etablissement"
  );

  const categories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...catRows.map((r) => r.categorie)])
  ).sort((a, b) => a.localeCompare(b, 'fr'));

  const typesEtablissement = Array.from(
    new Set([...DEFAULT_TYPES, ...typeRows.map((r) => r.type_etablissement)])
  ).sort((a, b) => a.localeCompare(b, 'fr'));

  return <ProjectForm categories={categories} typesEtablissement={typesEtablissement} />;
}
