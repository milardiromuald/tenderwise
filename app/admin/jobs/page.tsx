import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import Link from 'next/link';
import DeleteButton from '../DeleteButton';
import JobToggle from './JobToggle';

interface Job { id: number; titre: string; contrat: string; lieu: string; statut: string; date_publication: string; date_expiration: string; nouveau: number; urgence: number; }

export default async function AdminJobsPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const jobs = await query<Job>('SELECT id, titre, contrat, lieu, statut, date_publication, date_expiration, nouveau, urgence FROM job_offers ORDER BY id DESC');
  const activeCount = jobs.filter((j) => j.statut === 'active').length;
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ padding: '2rem' }}>
      <style>{`.job-row:hover { background: #f9fafb; } .job-btn:hover { opacity: 0.85; }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>{"Offres d’emploi"}</h1>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>✓ {activeCount} active{activeCount !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>✗ {jobs.length - activeCount} inactive{jobs.length - activeCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <Link href="/admin/jobs/new" style={{ padding: '12px 24px', background: '#004a99', color: 'white', borderRadius: '8px', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'Montserrat, sans-serif' }}>+ Nouvelle offre</Link>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {jobs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Aucune offre. <Link href="/admin/jobs/new" style={{ color: '#004a99', fontWeight: 600 }}>Créer la première →</Link></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                {['Poste', 'Contrat', 'Lieu', 'Période', 'Statut', ''].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j, i) => {
                const expired = j.date_expiration && j.date_expiration < today;
                return (
                  <tr key={j.id} className="job-row" style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '0.875rem 1.25rem', maxWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{j.titre}</span>
                        {j.nouveau === 1 && <span style={{ padding: '2px 6px', background: '#dbeafe', color: '#1e40af', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700 }}>NOUVEAU</span>}
                        {j.urgence === 1 && <span style={{ padding: '2px 6px', background: '#fee2e2', color: '#b91c1c', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700 }}>URGENT</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>{j.contrat ? <span style={{ padding: '3px 8px', background: '#f3f4f6', color: '#374151', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{j.contrat}</span> : '—'}</td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.83rem', color: '#6b7280' }}>{j.lieu || '—'}</td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 }}>
                        {j.date_publication && <div>Du {j.date_publication}</div>}
                        {j.date_expiration ? <div style={{ color: expired ? '#dc2626' : '#6b7280', fontWeight: expired ? 700 : 400 }}>{expired ? '⚠ Expiré le ' : 'Au '}{j.date_expiration}</div> : <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Pas d&apos;expiration</div>}
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}><JobToggle id={j.id} statut={j.statut} /></td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <Link href={`/admin/jobs/${j.id}`} className="job-btn" style={{ padding: '6px 12px', background: '#eff6ff', color: '#004a99', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>Modifier</Link>
                        <DeleteButton id={j.id} endpoint="/api/job-offers" redirectTo="/admin/jobs" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
