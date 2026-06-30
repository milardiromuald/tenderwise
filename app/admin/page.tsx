import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query, queryOne } from '@/lib/db';
import Link from 'next/link';

interface RecentArticle {
  id: number;
  titre: string;
  statut: string;
  date_publication: string;
  categorie: string;
}

interface WorkflowItem {
  id: number;
  titre: string | null;
  subject: string;
  source: string;
  created_at: string;
  token: string;
}

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  let articlePub = 0, articleDraft = 0, articleSched = 0;
  let recentArticles: RecentArticle[] = [];
  let dbError: string | null = null;

  try {
    const [pubRow, draftRow, schedRow, articlesData] = await Promise.all([
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM articles WHERE statut = 'publie'"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM articles WHERE statut = 'brouillon'"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM articles WHERE statut = 'programme'"),
      query<RecentArticle>(
        'SELECT id, titre, statut, date_publication, categorie FROM articles ORDER BY id DESC LIMIT 8'
      ),
    ]);
    articlePub   = pubRow?.c   ?? 0;
    articleDraft = draftRow?.c ?? 0;
    articleSched = schedRow?.c ?? 0;
    recentArticles = articlesData;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  let workflowPending = 0;
  let pendingItems: WorkflowItem[] = [];
  try {
    const [wfRow, wfItems] = await Promise.all([
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM article_reviews WHERE status = 'en_attente'"),
      query<WorkflowItem>(
        `SELECT r.id, a.titre, r.subject, r.source, r.created_at, r.token
         FROM article_reviews r LEFT JOIN articles a ON a.id = r.article_id
         WHERE r.status = 'en_attente' ORDER BY r.id DESC LIMIT 4`
      ),
    ]);
    workflowPending = wfRow?.c ?? 0;
    pendingItems    = wfItems;
  } catch { /* table absente */ }

  let unreadMessages = 0;
  let newApplications = 0;
  try {
    const [msgRow, appRow] = await Promise.all([
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM contact_messages WHERE is_read = 0"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM job_applications WHERE is_read = 0"),
    ]);
    unreadMessages  = msgRow?.c ?? 0;
    newApplications = appRow?.c ?? 0;
  } catch { /* tables absentes */ }

  const fmtDate = (s: string) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }
    catch { return String(s).split('T')[0]; }
  };

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div style={{ padding: '1.75rem 2rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .dash-row:hover     { background: #f9fafb; }
        .dash-kpi:hover     { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; transform: translateY(-2px); }
        .dash-kpi           { transition: box-shadow 0.15s, transform 0.15s; }
        .dash-cta-a:hover   { background: #b8913e !important; }
        .dash-cta-b:hover   { background: rgba(255,255,255,0.13) !important; }
        .dash-pending-row:hover { background: #fffbf0; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .dash-main          { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; }
        .dash-kpis          { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        @media (max-width: 1100px) {
          .dash-main  { grid-template-columns: 1fr !important; }
          .dash-kpis  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .dash-kpis       { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-welcome-btns { flex-direction: column !important; }
        }
      `}</style>

      {/* ── Bannière de bienvenue ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #002d5c 0%, #004a99 100%)',
        borderRadius: '14px',
        padding: '1.25rem 1.75rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
        boxShadow: '0 4px 20px rgba(0,74,153,0.2)',
      }}>
        <div>
          <h1 style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '1.35rem',
            fontWeight: 800,
            color: 'white',
            margin: 0,
            lineHeight: 1.2,
          }}>
            Bonjour, {session.user?.name || 'Administrateur'} 👋
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', margin: '4px 0 0' }}>
            {todayCapitalized}
          </p>
        </div>
        <div className="dash-welcome-btns" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <Link href="/admin/articles/generate" className="dash-cta-a" style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: '#c5a059', color: '#0f172a',
            padding: '9px 18px', borderRadius: '8px',
            fontWeight: 700, fontSize: '0.845rem', textDecoration: 'none',
            fontFamily: 'Montserrat, sans-serif', transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Générer avec l&apos;IA
          </Link>
          <Link href="/admin/articles/new" className="dash-cta-b" style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)',
            padding: '9px 18px', borderRadius: '8px',
            fontWeight: 600, fontSize: '0.845rem', textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.18)', transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rédiger
          </Link>
        </div>
      </div>

      {/* ── Alertes ───────────────────────────────────────────────── */}
      {dbError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '4px', fontSize: '0.875rem' }}>Erreur de connexion à la base de données</div>
          <div style={{ color: '#991b1b', fontSize: '0.8rem', fontFamily: 'monospace' }}>{dbError}</div>
        </div>
      )}

      {workflowPending > 0 && (
        <Link href="/admin/workflow" style={{ textDecoration: 'none', display: 'block', marginBottom: '1.25rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            border: '1px solid #fcd34d',
            borderRadius: '12px',
            padding: '0.875rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            animation: 'fadeUp 0.3s ease both',
          }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#fef3c7', border: '1px solid #fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#92400e', fontSize: '0.875rem' }}>
                {workflowPending} article{workflowPending > 1 ? 's' : ''} en attente de validation
              </div>
              <div style={{ color: '#b45309', fontSize: '0.75rem', marginTop: '1px' }}>Cliquez pour ouvrir le workflow</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </Link>
      )}

      {/* ── 4 KPIs ───────────────────────────────────────────────── */}
      <div className="dash-kpis">
        {[
          {
            label: 'Articles publiés',
            value: articlePub,
            sub: `${articleDraft} brouillon${articleDraft !== 1 ? 's' : ''}`,
            color: '#059669', bg: '#f0fdf4', border: '#a7f3d0',
            href: '/admin/articles',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
          },
          {
            label: 'En attente de validation',
            value: workflowPending,
            sub: workflowPending > 0 ? 'Action requise' : 'Tout est traité',
            color: workflowPending > 0 ? '#c2410c' : '#9ca3af',
            bg:    workflowPending > 0 ? '#fff7ed' : '#f9fafb',
            border:workflowPending > 0 ? '#fed7aa' : '#e5e7eb',
            href: '/admin/workflow',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a2 2 0 012 2v7"/></svg>,
          },
          {
            label: 'Messages non lus',
            value: unreadMessages,
            sub: newApplications > 0 ? `+ ${newApplications} candidature${newApplications > 1 ? 's' : ''}` : 'Boîte de réception',
            color: unreadMessages > 0 ? '#0369a1' : '#9ca3af',
            bg:    unreadMessages > 0 ? '#e0f2fe' : '#f9fafb',
            border:unreadMessages > 0 ? '#bae6fd' : '#e5e7eb',
            href: '/admin/contact',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
          },
          {
            label: 'Articles programmés',
            value: articleSched,
            sub: 'Publication planifiée',
            color: '#7c3aed',
            bg: '#f5f3ff',
            border: '#ddd6fe',
            href: '/admin/articles',
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          },
        ].map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="dash-kpi" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.1rem 1.25rem',
              border: `1px solid ${s.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              height: '100%',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                  {s.icon}
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, fontFamily: 'Montserrat, sans-serif', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>{s.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Grille principale ─────────────────────────────────────── */}
      <div className="dash-main">

        {/* Colonne gauche — Articles récents */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Articles récents
            </h2>
            <Link href="/admin/articles" style={{ fontSize: '0.78rem', color: '#004a99', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Voir tout
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {recentArticles.length === 0 ? (
            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ width: '52px', height: '52px', background: '#f0f4ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p style={{ color: '#374151', fontWeight: 600, marginBottom: '4px', fontSize: '0.875rem' }}>Aucun article pour l&apos;instant</p>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: '1.25rem' }}>Créez votre premier article ci-dessous</p>
              <Link href="/admin/articles/generate" style={{ background: '#004a99', color: 'white', padding: '8px 18px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'Montserrat, sans-serif' }}>
                Générer avec l&apos;IA
              </Link>
            </div>
          ) : (
            recentArticles.map((a, i) => {
              const dateStr = fmtDate(a.date_publication);
              const statutMap: Record<string, { bg: string; color: string; label: string }> = {
                publie:    { bg: '#d1fae5', color: '#065f46', label: 'Publié' },
                programme: { bg: '#fef3c7', color: '#92400e', label: 'Programmé' },
                brouillon: { bg: '#f3f4f6', color: '#6b7280', label: 'Brouillon' },
              };
              const s = statutMap[a.statut] || statutMap.brouillon;

              return (
                <Link key={a.id} href={`/admin/articles/${a.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    className="dash-row"
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.titre}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px' }}>
                        {a.categorie && (
                          <span style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {a.categorie}
                          </span>
                        )}
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{dateStr}</span>
                      </div>
                    </div>
                    <span style={{ padding: '3px 9px', borderRadius: '10px', fontSize: '0.68rem', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {s.label}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Colonne droite */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Canaux de publication */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: '#111827', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Canaux de publication
              </h3>
              <Link href="/admin/workflow" style={{ fontSize: '0.73rem', color: '#004a99', fontWeight: 600, textDecoration: 'none' }}>
                Configurer →
              </Link>
            </div>
            {[
              {
                icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
                label: 'Site web TenderWise',
                status: 'Actif',
                statusBg: '#dcfce7', statusColor: '#16a34a',
                dot: '#16a34a',
                href: '/admin/workflow',
                disabled: false,
              },
              {
                icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
                label: 'LinkedIn',
                status: 'Bientôt',
                statusBg: '#dbeafe', statusColor: '#1d4ed8',
                dot: '#d1d5db',
                href: null,
                disabled: true,
              },
              {
                icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg>,
                label: 'X / Twitter',
                status: 'Bientôt',
                statusBg: '#dbeafe', statusColor: '#1d4ed8',
                dot: '#d1d5db',
                href: null,
                disabled: true,
              },
            ].map((ch) => {
              const inner = (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.7rem 1.25rem', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ch.dot, flexShrink: 0 }} />
                  <span style={{ color: '#374151', flexShrink: 0, opacity: ch.disabled ? 0.5 : 1 }}>{ch.icon}</span>
                  <span style={{ fontSize: '0.82rem', color: ch.disabled ? '#9ca3af' : '#374151', flex: 1, fontWeight: 500 }}>{ch.label}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: ch.statusBg, color: ch.statusColor, whiteSpace: 'nowrap' }}>
                    {ch.status}
                  </span>
                </div>
              );
              return ch.href ? (
                <Link key={ch.label} href={ch.href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
              ) : (
                <div key={ch.label}>{inner}</div>
              );
            })}
          </div>

          {/* Workflow en attente (conditionnel) */}
          {pendingItems.length > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #fde68a', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb' }}>
                <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: '#92400e', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  En attente de validation
                </h3>
                <span style={{ background: '#d97706', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '8px' }}>
                  {workflowPending}
                </span>
              </div>
              {pendingItems.map((item, i) => (
                <Link key={item.id} href={`/review/${item.token}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    className="dash-pending-row"
                    style={{
                      padding: '0.65rem 1.25rem',
                      borderTop: i > 0 ? '1px solid #fef3c7' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d97706', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.titre || item.subject || 'Sans titre'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '1px' }}>
                        {item.source} · {fmtDate(item.created_at)}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </Link>
              ))}
              <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid #fef3c7', background: '#fffbeb' }}>
                <Link href="/admin/workflow" style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Gérer le workflow complet
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
              </div>
            </div>
          )}

          {/* Statistiques secondaires */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
              Aperçu du contenu
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Brouillons', value: articleDraft, href: '/admin/articles', color: '#6b7280', bg: '#f9fafb' },
                { label: 'Candidatures', value: newApplications, href: '/admin/applications', color: newApplications > 0 ? '#7c3aed' : '#6b7280', bg: newApplications > 0 ? '#f5f3ff' : '#f9fafb' },
              ].map((s) => (
                <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
                  <div style={{ background: s.bg, borderRadius: '8px', padding: '0.7rem 0.875rem', textAlign: 'center', transition: 'opacity 0.15s' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color, fontFamily: 'Montserrat, sans-serif', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px', fontWeight: 500 }}>{s.label}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Accès rapides (aligné sur le menu réorganisé) ──────────── */}
      <div style={{ marginTop: '1.5rem' }}>
        <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
          Accès rapides
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Statistiques', sub: 'Visites & parcours', href: '/admin/stats', color: '#0369a1', bg: '#e0f2fe',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
            { label: 'Réalisations', sub: 'Projets & références', href: '/admin/projects', color: '#0f766e', bg: '#ccfbf1',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> },
            { label: 'Offres d’emploi', sub: 'Recrutement', href: '/admin/jobs', color: '#9333ea', bg: '#f3e8ff',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg> },
            { label: 'Configuration IA', sub: 'Clé, modèles, prompts', href: '/admin/ai', color: '#c2410c', bg: '#ffedd5',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
            { label: 'Paramètres', sub: 'Identité, pages, SEO', href: '/admin/settings', color: '#475569', bg: '#f1f5f9',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
            { label: 'RGPD & Cookies', sub: 'Conformité & consentement', href: '/admin/rgpd', color: '#16a34a', bg: '#dcfce7',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
          ].map((q) => (
            <Link key={q.label} href={q.href} className="dash-kpi" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: '12px', padding: '0.9rem 1rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '11px', height: '100%' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: q.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: q.color, flexShrink: 0 }}>
                  {q.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', fontFamily: 'Montserrat, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.label}</div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.sub}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
