import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import Link from 'next/link';
import DeleteButton from '../DeleteButton';
import ProjectToggle from './ProjectToggle';
import AttestationButton from './AttestationButton';

interface Project { id: number; nom: string; categorie: string; client: string; annees: string; statut: string; }

export default async function AdminProjectsPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const projects = await query<Project>('SELECT id, nom, categorie, client, annees, statut FROM projects ORDER BY id DESC');
  const activeCount = projects.filter((p) => p.statut !== 'inactive').length;

  return (
    <div style={{ padding: '2rem' }}>
      <style>{`.proj-row:hover { background: #f9fafb; } .proj-btn:hover { opacity: 0.85; }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>Réalisations</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>✓ {activeCount} actif{activeCount !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>✗ {projects.length - activeCount} masqué{projects.length - activeCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <Link href="/admin/projects/new" style={{ padding: '12px 24px', background: '#004a99', color: 'white', borderRadius: '8px', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}>+ Nouveau projet</Link>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {projects.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Aucun projet. <Link href="/admin/projects/new" style={{ color: '#004a99', fontWeight: 600 }}>Créer le premier →</Link></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                {['Projet', 'Catégorie', 'Client', 'Années', 'Visibilité', ''].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr key={p.id} className="proj-row" style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '1rem 1.25rem', maxWidth: '260px' }}><div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div></td>
                  <td style={{ padding: '1rem 1.25rem' }}>{p.categorie ? <span style={{ padding: '3px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{p.categorie}</span> : '—'}</td>
                  <td style={{ padding: '1rem 1.25rem', fontSize: '0.83rem', color: '#6b7280' }}>{p.client || '—'}</td>
                  <td style={{ padding: '1rem 1.25rem', fontSize: '0.83rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{p.annees || '—'}</td>
                  <td style={{ padding: '1rem 1.25rem' }}><ProjectToggle id={p.id} statut={p.statut} /></td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <AttestationButton id={p.id} nom={p.nom} client={p.client} />
                      <Link href={`/admin/projects/${p.id}`} className="proj-btn" style={{ padding: '6px 12px', background: '#eff6ff', color: '#004a99', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>Modifier</Link>
                      <DeleteButton id={p.id} endpoint="/api/projects" redirectTo="/admin/projects" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
