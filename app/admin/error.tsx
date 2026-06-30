'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem', maxWidth: '520px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ fontFamily: 'Montserrat, sans-serif', color: '#003366', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Une erreur s&apos;est produite
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          {error.message || 'Erreur inconnue lors du chargement du tableau de bord.'}
        </p>
        {error.message?.includes('ER_NO_SUCH_TABLE') || error.message?.includes('ECONNREFUSED') ? (
          <p style={{ color: '#92400e', background: '#fef3c7', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            Vérifiez que vous avez importé <strong>schema.sql</strong> dans phpMyAdmin et que vos identifiants MySQL dans <code>.env.local</code> sont corrects.
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{ background: '#004a99', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
