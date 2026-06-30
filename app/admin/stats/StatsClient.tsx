'use client';

import { useState, useEffect, useCallback } from 'react';

/* ══ TYPES — Données 1ère partie ════════════════════════════════════════ */

interface KV { k: string; c: number }
interface KVDur { k: string; c: number; avg_dur: number | null }
interface DailyRow { d: string; c: number }

interface OverviewData {
  totals: { visits: number; sessions: number; today: number; linkedin: number; avg_dur: number | null };
  bySource: KV[];
  topPages: KVDur[];
  byDevice: KV[];
  daily: DailyRow[];
}

interface LinkedInData {
  totals: { total: number; sessions: number; avg_dur: number | null; unique_pages: number };
  topPages: KVDur[];
  byDevice: KV[];
  daily: DailyRow[];
  byCampaign: KV[];
}

interface Session { session_id: string; steps: number; journey: string; started_at: string; total_dur: number | null; is_linkedin: number }
interface Transition { from_path: string; to_path: string; c: number }
interface EntryPage { k: string; c: number; linkedin_pct: number }
interface JourneysData { sessions: Session[]; transitions: Transition[]; entries: EntryPage[] }

interface PageDur { k: string; views: number; with_dur: number; avg_dur: number | null; quick: number; good: number }
interface DurationData { byPage: PageDur[]; overall: { avg_dur: number | null; tracked: number } }

interface RecentVisit {
  created_at: string; path: string; source: string; source_detail: string | null;
  device: string; browser: string; os: string;
  country: string | null; city: string | null; ip_address: string | null;
}

/* ══ ONGLETS ════════════════════════════════════════════════════════════ */

type TabKey = 'overview' | 'linkedin' | 'journeys' | 'duration';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',  label: 'Vue d\'ensemble' },
  { key: 'linkedin',  label: 'LinkedIn' },
  { key: 'journeys',  label: 'Parcours visiteurs' },
  { key: 'duration',  label: 'Temps de lecture' },
];

/* ══ HELPERS ════════════════════════════════════════════════════════════ */

function dur(s: number | null | undefined): string {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function num(n: number | null | undefined): string {
  if (n == null) return '—';
  return n >= 1000 ? n.toLocaleString('fr-FR') : String(Math.round(n));
}

function pct(n: number | null | undefined, total: number): string {
  if (!n || !total) return '0%';
  return ((n / total) * 100).toFixed(1) + '%';
}

function shortPath(p: string): string {
  if (!p || p === '/') return 'Accueil (/)';
  return p.length > 52 ? p.slice(0, 50) + '…' : p;
}

function srcColor(s: string): string {
  if (s === 'linkedin') return '#0a66c2';
  if (s === 'google')   return '#4285f4';
  if (s === 'direct')   return '#059669';
  if (s === 'social')   return '#ec4899';
  if (s === 'referral') return '#8b5cf6';
  if (s === 'email')    return '#f59e0b';
  return '#94a3b8';
}


/* ══ COMPOSANTS PARTAGÉS ════════════════════════════════════════════════ */

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.1rem 1.3rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        {icon && <span style={{ color: color ?? '#9ca3af' }}>{icon}</span>}
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 900, color: color ?? '#111827', fontFamily: 'Montserrat, sans-serif', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {sub && <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{sub}</span>}
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280' }}>{num(value)}</span>
        </div>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function Sparkline({ data, color = '#0a66c2' }: { data: DailyRow[]; color?: string }) {
  if (data.length < 2) return null;
  const W = 400; const H = 52;
  const max = Math.max(1, ...data.map((d) => d.c));
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.c / max) * (H - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const fill = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      <defs>
        <linearGradient id={`spk-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={`url(#spk-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '1.25rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 1rem' }}>{title}</h3>
      {children}
    </div>
  );
}

function Loading() {
  return <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af', fontSize: '0.9rem' }}>Chargement…</div>;
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.85rem' }}>{msg}</div>;
}

function IconLinkedIn({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>;
}

/* ══ ONGLET : VUE D'ENSEMBLE ════════════════════════════════════════════ */

function TabOverview({ data, recent }: { data: OverviewData | null; recent: RecentVisit[] }) {
  if (!data) return <Loading />;
  const { totals, bySource, topPages, byDevice, daily } = data;
  const maxSrc  = Math.max(1, ...bySource.map((r) => r.c));
  const maxPage = Math.max(1, ...topPages.map((r) => r.c));
  const maxDev  = Math.max(1, ...byDevice.map((r) => r.c));

  return (
    <>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
        Données 1ʳᵉ partie — suivi interne
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        <StatCard label="Pages vues" value={num(totals.visits)} sub="total période" />
        <StatCard label="Sessions" value={num(totals.sessions)} />
        <StatCard label="Aujourd'hui" value={num(totals.today)} />
        <StatCard label="Depuis LinkedIn" value={num(totals.linkedin)} sub={pct(totals.linkedin, totals.visits) + ' du trafic'} color="#0a66c2" icon={<IconLinkedIn size={14} />} />
        <StatCard label="Durée moy." value={dur(totals.avg_dur)} sub="par page" />
      </div>

      <Card title="Trafic quotidien">
        <Sparkline data={daily} color="#004a99" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#9ca3af', marginTop: 4 }}>
          <span>{daily[0]?.d ?? ''}</span><span>{daily[daily.length - 1]?.d ?? ''}</span>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
        <Card title="Sources de trafic">
          {bySource.length === 0
            ? <Empty msg="Aucune donnée" />
            : bySource.map((r) => <BarRow key={r.k} label={r.k === 'linkedin' ? 'LinkedIn' : r.k} value={r.c} max={maxSrc} color={srcColor(r.k)} />)}
        </Card>

        <Card title="Pages les plus visitées">
          {topPages.slice(0, 10).map((r) => <BarRow key={r.k} label={shortPath(r.k)} value={r.c} max={maxPage} color="#004a99" sub={dur(r.avg_dur)} />)}
        </Card>

        <Card title="Appareils">
          {byDevice.map((r) => (
            <BarRow key={r.k} label={r.k} value={r.c} max={maxDev} color={r.k === 'mobile' ? '#059669' : r.k === 'tablet' ? '#f59e0b' : '#3b82f6'} />
          ))}
        </Card>
      </div>

      {/* Dernières visites avec IP et localisation */}
      <div style={{ marginTop: '1.25rem', background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <p style={{ fontWeight: 700, fontSize: '0.75rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, padding: '12px 18px', borderBottom: '1px solid #f1f5f9' }}>
          50 dernières visites — IP &amp; localisation
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Date', 'Page', 'Source', 'Appareil', 'IP', 'Pays / Ville'].map((h) => (
                  <th key={h} style={{ padding: '8px 14px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>Aucune visite enregistrée.</td></tr>
              )}
              {recent.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>{r.created_at}</td>
                  <td style={{ padding: '7px 14px', color: '#334155', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.path}>{r.path}</td>
                  <td style={{ padding: '7px 14px', color: '#475569' }}>{r.source || '—'}{r.source_detail && r.source !== 'direct' ? <span style={{ color: '#94a3b8' }}> · {r.source_detail}</span> : null}</td>
                  <td style={{ padding: '7px 14px', color: '#475569' }}>{r.device || '—'}</td>
                  <td style={{ padding: '7px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.ip_address || '—'}</td>
                  <td style={{ padding: '7px 14px', color: '#475569' }}>{[r.country, r.city].filter(Boolean).join(' / ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ══ ONGLET : LINKEDIN ══════════════════════════════════════════════════ */

function TabLinkedIn({ data }: { data: LinkedInData | null }) {
  if (!data) return <Loading />;
  const { totals, topPages, byDevice, daily, byCampaign } = data;
  if (!totals.total) return <Empty msg="Aucune visite LinkedIn détectée sur cette période." />;

  const maxPage = Math.max(1, ...topPages.map((r) => r.c));
  const maxDev  = Math.max(1, ...byDevice.map((r) => r.c));
  const maxCamp = Math.max(1, ...byCampaign.map((r) => r.c));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Visites LinkedIn" value={num(totals.total)} color="#0a66c2" icon={<IconLinkedIn size={14} />} />
        <StatCard label="Sessions" value={num(totals.sessions)} />
        <StatCard label="Durée moy." value={dur(totals.avg_dur)} sub="par page" />
        <StatCard label="Pages distinctes" value={num(totals.unique_pages)} />
      </div>

      <Card title="Trafic LinkedIn quotidien">
        <Sparkline data={daily} color="#0a66c2" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#9ca3af', marginTop: 4 }}>
          <span>{daily[0]?.d ?? ''}</span><span>{daily[daily.length - 1]?.d ?? ''}</span>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
        <Card title="Pages les plus visitées depuis LinkedIn">
          {topPages.length === 0
            ? <Empty msg="Aucune donnée" />
            : topPages.map((r) => <BarRow key={r.k} label={shortPath(r.k)} value={r.c} max={maxPage} color="#0a66c2" sub={dur(r.avg_dur)} />)}
        </Card>

        <Card title="Appareils">
          {byDevice.map((r) => <BarRow key={r.k} label={r.k} value={r.c} max={maxDev} color="#0a66c2" />)}
        </Card>

        <Card title="Campagnes UTM">
          {byCampaign.length === 0
            ? <Empty msg="Aucune campagne UTM" />
            : byCampaign.map((r) => <BarRow key={r.k} label={r.k} value={r.c} max={maxCamp} color="#0a66c2" />)}
          <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 10, lineHeight: 1.5 }}>
            Ajoutez{' '}
            <code style={{ fontSize: '0.68rem', background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
              ?utm_source=linkedin&amp;utm_campaign=nom
            </code>{' '}
            à vos URLs LinkedIn pour identifier vos posts.
          </p>
        </Card>
      </div>
    </>
  );
}

/* ══ ONGLET : PARCOURS VISITEURS ════════════════════════════════════════ */

function PathChips({ journey, isLinkedin }: { journey: string; isLinkedin: boolean }) {
  const pages = journey.split('|||');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      {isLinkedin && (
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#0a66c2', background: '#e7f0fa', padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>LI</span>
      )}
      {pages.map((p, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.72rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 7px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p}>
            {p === '/' ? 'Accueil' : p}
          </span>
          {i < pages.length - 1 && <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>→</span>}
        </span>
      ))}
    </div>
  );
}

function TabJourneys({ data }: { data: JourneysData | null }) {
  if (!data) return <Loading />;
  const { sessions, transitions, entries } = data;
  const maxTr = Math.max(1, ...transitions.map((t) => t.c));
  const maxEn = Math.max(1, ...entries.map((e) => e.c));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <Card title="Transitions les plus fréquentes">
          {transitions.length === 0
            ? <Empty msg="Pas encore assez de données multi-pages." />
            : transitions.map((t, i) => (
              <BarRow key={i} label={`${shortPath(t.from_path)} → ${shortPath(t.to_path)}`} value={t.c} max={maxTr} color="#004a99" />
            ))}
        </Card>

        <Card title="Pages d'entrée">
          {entries.length === 0
            ? <Empty msg="Aucune donnée" />
            : entries.map((e) => (
              <BarRow key={e.k} label={shortPath(e.k)} value={e.c} max={maxEn} color="#059669" sub={e.linkedin_pct > 0 ? `${Math.round(e.linkedin_pct)}% LinkedIn` : undefined} />
            ))}
        </Card>
      </div>

      <Card title={`Parcours récents (${sessions.length} sessions multi-pages)`}>
        {sessions.length === 0
          ? <Empty msg="Aucune session multi-pages détectée. Le suivi de parcours nécessite des visiteurs ayant accepté les cookies d'audience." />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
              {sessions.map((s) => (
                <div key={s.session_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <div style={{ flexShrink: 0, minWidth: 64 }}>
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{s.started_at?.slice(0, 16) ?? ''}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginTop: 2 }}>{s.steps} pages</div>
                    {s.total_dur ? <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>{dur(s.total_dur)}</div> : null}
                  </div>
                  <PathChips journey={s.journey} isLinkedin={!!s.is_linkedin} />
                </div>
              ))}
            </div>
          )}
      </Card>
    </>
  );
}

/* ══ ONGLET : TEMPS DE LECTURE ══════════════════════════════════════════ */

function TabDuration({ data }: { data: DurationData | null }) {
  if (!data) return <Loading />;
  const { byPage, overall } = data;

  if (byPage.length === 0) return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center' }}>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 8px' }}>Aucune donnée de durée disponible.</p>
      <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: 0 }}>Les durées sont collectées progressivement via le tracking de lecture.</p>
    </div>
  );

  const maxDur = Math.max(1, ...byPage.map((r) => r.avg_dur ?? 0));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Durée moy. globale" value={dur(overall.avg_dur)} />
        <StatCard label="Pages avec durée" value={num(overall.tracked)} />
        <StatCard label="Pages analysées" value={String(byPage.length)} />
      </div>

      <Card title="Temps de lecture par page">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Page', 'Vues', 'Durée moy.', 'Lectures +60s', 'Rebonds <10s', 'Engagement'].map((h) => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byPage.map((r) => {
                const engPct    = r.with_dur > 0 ? Math.round((r.good / r.with_dur) * 100) : 0;
                const bouncePct = r.with_dur > 0 ? Math.round((r.quick / r.with_dur) * 100) : 0;
                return (
                  <tr key={r.k} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 12px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }} title={r.k}>{shortPath(r.k)}</td>
                    <td style={{ padding: '8px 12px', color: '#6b7280', textAlign: 'right' }}>{num(r.views)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#111827', textAlign: 'right' }}>{dur(r.avg_dur)}</td>
                    <td style={{ padding: '8px 12px', color: '#059669', textAlign: 'right' }}>{num(r.good)}</td>
                    <td style={{ padding: '8px 12px', color: bouncePct > 50 ? '#dc2626' : '#6b7280', textAlign: 'right' }}>{num(r.quick)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, background: '#f3f4f6', borderRadius: 4, height: 6 }}>
                          <div style={{ width: `${Math.min(100, (r.avg_dur ?? 0) / maxDur * 100)}%`, height: '100%', background: engPct > 50 ? '#059669' : '#004a99', borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{engPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 12 }}>
          Lectures +60s = visiteurs ayant passé plus d&apos;une minute. Rebonds &lt;10s = visiteurs repartis très vite.
        </p>
      </Card>
    </>
  );
}

/* ══ COMPOSANT PRINCIPAL ════════════════════════════════════════════════ */

export default function StatsClient() {
  const [tab,     setTab]     = useState<TabKey>('overview');
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(false);
  const [fpError, setFpError] = useState('');

  const [overview,      setOverview]      = useState<OverviewData | null>(null);
  const [linkedin,      setLinkedIn]      = useState<LinkedInData | null>(null);
  const [journeys,      setJourneys]      = useState<JourneysData | null>(null);
  const [duration,      setDuration]      = useState<DurationData | null>(null);
  const [recentVisits,  setRecentVisits]  = useState<RecentVisit[]>([]);

  const loadFP = useCallback(async (t: string, d: number) => {
    setLoading(true); setFpError('');
    try {
      const res  = await fetch(`/api/audience?type=${t}&days=${d}`);
      const data = await res.json();
      if (!data.ok) { setFpError(data.error ?? 'Erreur inconnue'); return; }
      if (t === 'overview') setOverview(data as OverviewData);
      if (t === 'linkedin') setLinkedIn(data as LinkedInData);
      if (t === 'journeys') setJourneys(data as JourneysData);
      if (t === 'duration') setDuration(data as DurationData);
    } catch { setFpError('Erreur réseau'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab !== 'overview') return;
    fetch('/api/track?days=30')
      .then((r) => r.json())
      .then((d) => { if (d.recent) setRecentVisits(d.recent); })
      .catch(() => { /* non-bloquant */ });
  }, [tab]);

  useEffect(() => { loadFP(tab, days); }, [tab, days, loadFP]);

  const handleDays = (d: number) => {
    setDays(d);
    setOverview(null); setLinkedIn(null); setJourneys(null); setDuration(null);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1400, boxSizing: 'border-box' }}>

      {/* En-tête */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.55rem', fontWeight: 800, color: '#003366', margin: 0 }}>Statistiques</h1>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          Suivi de vos visiteurs — données 1ʳᵉ partie, LinkedIn, parcours et temps de lecture.
        </p>
      </div>

      {/* Barre de navigation + période */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 10, padding: 4, gap: 2, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '7px 16px',
                border: tab === t.key ? '2px solid #bfdbfe' : '2px solid transparent',
                borderRadius: 7, fontSize: '0.83rem', cursor: 'pointer',
                background: tab === t.key ? '#eff6ff' : 'transparent',
                color: tab === t.key ? '#1d4ed8' : '#6b7280',
                fontWeight: tab === t.key ? 700 : 400,
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {t.key === 'linkedin' && <IconLinkedIn size={13} />}
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
          {([7, 30, 90] as const).map((d) => (
            <button key={d} onClick={() => handleDays(d)}
              style={{
                padding: '6px 14px',
                border: days === d ? '2px solid #bfdbfe' : '2px solid transparent',
                borderRadius: 7, fontSize: '0.82rem', cursor: 'pointer',
                background: days === d ? '#eff6ff' : 'transparent',
                color: days === d ? '#1d4ed8' : '#6b7280',
                fontWeight: days === d ? 700 : 400,
                transition: 'all 0.15s',
              }}>
              {d === 7 ? '7 jours' : d === 30 ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>

      {/* Notice RGPD */}
      <div style={{ marginBottom: '1.5rem', padding: '10px 16px', background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 8, fontSize: '0.75rem', color: '#065f46', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
        </svg>
        <span>
          Données collectées uniquement avec le consentement « Mesure d&apos;audience » du visiteur.
          Aucune identification personnelle — les parcours sont liés à un identifiant de session temporaire.
        </span>
      </div>

      {/* Erreur données 1ère partie */}
      {fpError && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {fpError === 'erreur_serveur'
            ? 'Erreur base de données. Vérifiez que le fichier schema-audience.sql a été exécuté dans phpMyAdmin.'
            : `Erreur : ${fpError}`}
        </div>
      )}

      {/* Contenu par onglet */}
      {loading
        ? <Loading />
        : (
          <>
            {tab === 'overview' && <TabOverview data={overview} recent={recentVisits} />}
            {tab === 'linkedin' && <TabLinkedIn data={linkedin} />}
            {tab === 'journeys' && <TabJourneys data={journeys} />}
            {tab === 'duration' && <TabDuration data={duration} />}
          </>
        )}
    </div>
  );
}
