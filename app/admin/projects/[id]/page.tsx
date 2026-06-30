import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { query, queryOne } from '@/lib/db';
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

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { id } = await params;
  const project = await queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE id = ?', [id]);
  if (!project) notFound();

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

  return (
    <ProjectForm
      initial={{ ...project, id: Number(project.id) } as Parameters<typeof ProjectForm>[0]['initial']}
      categories={categories}
      typesEtablissement={typesEtablissement}
    />
  );
}
