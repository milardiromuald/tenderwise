'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface LIOrg { urn: string; name: string }

interface LIConn {
  hasClientId:     boolean;
  hasClientSecret: boolean;
  connected:       boolean;
  expired:         boolean;
  name:            string;
  email:           string;
  expiresAt:       string;
}

interface LIStatus {
  redirectUri:     string;
  person:          LIConn & { personUrn: string };
  organization:    LIConn & { orgUrn: string; orgName: string; orgs: LIOrg[] };

  // Champs « à plat » de compatibilité (= connexion perso).
  hasClientId:     boolean;
  hasClientSecret: boolean;
  connected:       boolean;
  expired:         boolean;
  personUrn:       string;
  email:           string;
  name:            string;
  personName:      string;
  expiresAt:       string;
  orgEnabled:      boolean;
  orgUrn:          string;
  orgName:         string;
  orgs:            LIOrg[];
}

interface LIPost {
  id:           number;
  text:         string;
  linkedin_urn: string | null;
  linkedin_url: string | null;
  status:       string;
  source:       string;
  created_at:   string;
}

interface LIStatPost {
  id:               number;
  text:             string;
  linkedin_url:     string | null;
  status:           string;
  source:           string;
  created_at:       string;
  likes:            number | null;
  comments:         number | null;
  stats_fetched_at: string | null;
}

interface LIStats {
  summary: {
    total:          number;
    published:      number;
    failed:         number;
    successRate:    number;
    totalLikes:     number;
    totalComments:  number;
    engagementKnown:boolean;
    firstPost:      string | null;
    lastPost:       string | null;
  };
  bySource:            Record<string, number>;
  byDay:               { date: string; count: number }[];
  posts:               LIStatPost[];
  engagementSupported: boolean;
  refreshed:           number;
  refreshError:        string | null;
}

type LITab = 'connexion' | 'post' | 'historique' | 'statistiques' | 'engagement' | 'audience';

const TAB_LABELS: Record<LITab, string> = {
  connexion:    '🔗 Connexion',
  post:         '✏️ Nouveau post',
  historique:   '📋 Historique',
  statistiques: '📊 Statistiques',
  engagement:   '💬 Engagement',
  audience:     '👤 Audience / Profil',
};

const CHAR_LIMIT   = 3000;
const WARN_AT      = 2700;

const ERROR_LABELS: Record<string, string> = {
  no_client:            'Identifiants OAuth manquants ou illisibles. Ressaisissez le Client ID et le Client Secret ci-dessous, puis enregistrez.',
  invalid_state:        'Vérification de sécurité échouée (lien expiré ou ouvert dans un autre onglet). Relancez « Se connecter » depuis cette page.',
  missing_code:         'Code d\'autorisation manquant.',
  token_exchange_failed:'Échec de l\'échange du code. Vérifiez le Client Secret et l\'URI de redirection.',
  no_access_token:      'LinkedIn n\'a pas renvoyé de jeton d\'accès.',
  access_denied:        'Autorisation refusée par LinkedIn.',
  unauthorized_scope_error: 'Permissions refusées par l\'app LinkedIn. Compte perso → activez "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn". Page entreprise → le produit "Community Management API" doit être approuvé (onglet Products de l\'app concernée).',
  invalid_scope_error: 'Scopes non encore autorisés par l\'app LinkedIn. Pour la Page entreprise, cela signifie presque toujours que "Community Management API" est encore en review (non approuvé) : les scopes r_organization_social / w_organization_social ne sont pas disponibles tant que le produit n\'est pas validé par LinkedIn.',
  redirect_uri_mismatch: 'L\'URI de redirection ne correspond pas. Copiez l\'URI ci-dessous et ajoutez-la à l\'identique dans Auth → Authorized redirect URLs.',
  invalid_redirect_uri:  'L\'URI de redirection ne correspond pas. Copiez l\'URI ci-dessous et ajoutez-la à l\'identique dans Auth → Authorized redirect URLs.',
  profile_fetch_failed: 'Impossible de récupérer votre profil LinkedIn. Vérifiez que votre app LinkedIn a les produits "Sign In with LinkedIn" et "Share on LinkedIn" activés.',
};

/* ─── Sous-composants ───────────────────────────────────────────────── */

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         '6px',
      background:  ok ? '#d1fae5' : '#f3f4f6',
      color:       ok ? '#065f46' : '#6b7280',
      padding:     '6px 14px',
      borderRadius:'20px',
      fontSize:    '0.78rem',
      fontWeight:  700,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin .9s linear infinite' }}>
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/>
      <path d="M21 12a9 9 0 00-9-9"/>
    </svg>
  );
}

/* ─── Page principale ───────────────────────────────────────────────── */

function LinkedInContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<LITab>('connexion');

  const [status, setStatus]     = useState<LIStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notice, setNotice]     = useState<{ type: 'success' | 'error'; text: string; code?: string } | null>(null);

  // Credentials form — app « Compte personnel »
  const [clientId,     setClientId]     = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [credSaving,   setCredSaving]   = useState(false);
  const [credSaved,    setCredSaved]    = useState(false);
  const [copiedUri,    setCopiedUri]    = useState(false);

  // Credentials form — app « Page entreprise »
  const [orgClientId,     setOrgClientId]     = useState('');
  const [orgClientSecret, setOrgClientSecret] = useState('');
  const [orgCredSaving,   setOrgCredSaving]   = useState(false);
  const [orgCredSaved,    setOrgCredSaved]    = useState(false);

  // Disconnect (perso / Page / global)
  const [disconnecting, setDisconnecting] = useState(false);

  // Org (Page entreprise) — sélection / saisie
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgManual, setOrgManual] = useState('');

  // Post form
  const [postText,      setPostText]      = useState('');
  const [postImage,     setPostImage]     = useState<File | null>(null);
  const [postPreview,   setPostPreview]   = useState('');
  const [postTarget,    setPostTarget]    = useState<'person' | 'organization'>('person');
  const [publishing,    setPublishing]    = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; url?: string; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // True dès que l'utilisateur choisit explicitement une cible (évite d'écraser
  // son choix par le défaut « Page entreprise prioritaire »).
  const targetTouched = useRef(false);

  // History
  const [posts,    setPosts]    = useState<LIPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Stats / engagement / audience
  const [stats,        setStats]        = useState<LIStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [engSort,      setEngSort]      = useState<'date' | 'likes' | 'comments'>('date');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const d: LIStatus = await fetch('/api/connectors/linkedin/config').then(r => r.json());
      setStatus(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const d: LIPost[] = await fetch('/api/linkedin/posts').then(r => r.json());
      setPosts(d);
    } catch { /* ignore */ }
    finally { setPostsLoading(false); }
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const err       = searchParams.get('error');
    if (connected === '1')   setNotice({ type: 'success', text: 'Compte personnel LinkedIn connecté avec succès !' });
    if (connected === 'org') setNotice({ type: 'success', text: 'Page entreprise LinkedIn connectée avec succès !' });
    if (err)                 setNotice({ type: 'error',   text: ERROR_LABELS[err] || `Erreur : ${err}`, code: err });
    if (connected || err)    window.history.replaceState({}, '', '/admin/linkedin');
    loadStatus();
  }, [searchParams, loadStatus]);

  // Page entreprise prioritaire : si elle est prête et que l'utilisateur n'a pas
  // encore choisi de cible, on pré-sélectionne la Page pour le nouveau post.
  useEffect(() => {
    if (!targetTouched.current && status?.orgEnabled && status?.orgUrn) {
      setPostTarget('organization');
    }
  }, [status]);

  const loadStats = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setStatsLoading(true);
    try {
      const d: LIStats = await fetch(`/api/linkedin/stats${refresh ? '?refresh=1' : ''}`).then(r => r.json());
      setStats(d);
    } catch { /* ignore */ }
    finally { setStatsLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (tab === 'historique') loadPosts();
    if ((tab === 'statistiques' || tab === 'engagement' || tab === 'audience') && !stats) loadStats();
  }, [tab, loadPosts, loadStats, stats]);

  const saveCredentials = async () => {
    setCredSaving(true);
    try {
      await fetch('/api/connectors/linkedin/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          clientId:     clientId     || undefined,
          clientSecret: clientSecret || undefined,
        }),
      });
      setClientId('');
      setClientSecret('');
      setCredSaved(true);
      setTimeout(() => setCredSaved(false), 3000);
      await loadStatus();
    } catch { /* ignore */ }
    finally { setCredSaving(false); }
  };

  const saveOrgCredentials = async () => {
    setOrgCredSaving(true);
    try {
      await fetch('/api/connectors/linkedin/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          orgClientId:     orgClientId     || undefined,
          orgClientSecret: orgClientSecret || undefined,
        }),
      });
      setOrgClientId('');
      setOrgClientSecret('');
      setOrgCredSaved(true);
      setTimeout(() => setOrgCredSaved(false), 3000);
      await loadStatus();
    } catch { /* ignore */ }
    finally { setOrgCredSaving(false); }
  };

  // Change la Page sélectionnée ou saisit une Page manuellement (orgUrnManual).
  // Renvoie true si succès.
  const saveOrgConfig = async (patch: { orgUrn?: string; orgUrnManual?: string }): Promise<boolean> => {
    setOrgSaving(true);
    try {
      const r = await fetch('/api/connectors/linkedin/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(res => res.json()).catch(() => null);
      if (r?.error) { setNotice({ type: 'error', text: r.error }); return false; }
      await loadStatus();
      return true;
    } catch { return false; }
    finally { setOrgSaving(false); }
  };

  // Déconnecte une connexion ciblée (perso/Page) — identifiants OAuth conservés.
  const disconnect = async (which: 'person' | 'organization') => {
    const label = which === 'organization' ? 'la Page entreprise' : 'le compte personnel';
    if (!confirm(`Déconnecter ${label} ? Les identifiants OAuth seront conservés.`)) return;
    setDisconnecting(true);
    await fetch(`/api/connectors/linkedin/config?which=${which}`, { method: 'DELETE' });
    setDisconnecting(false);
    await loadStatus();
  };

  // Réinitialise un état de connexion partiel/bloqué (jeton présent mais profil
  // manquant, etc.) sans toucher aux identifiants OAuth.
  const resetConnection = async (which: 'person' | 'organization') => {
    if (!confirm('Réinitialiser cette connexion ? Le jeton sera effacé, vos identifiants OAuth (Client ID/Secret) sont conservés. Vous pourrez relancer « Se connecter » ensuite.')) return;
    setDisconnecting(true);
    await fetch(`/api/connectors/linkedin/config?which=${which}`, { method: 'DELETE' });
    setDisconnecting(false);
    setNotice({ type: 'success', text: 'Connexion réinitialisée. Vous pouvez relancer « Se connecter ».' });
    await loadStatus();
  };

  const copyUri = () => {
    if (!status?.redirectUri) return;
    navigator.clipboard?.writeText(status.redirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setPostImage(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = ev => setPostPreview(ev.target?.result as string || '');
      reader.readAsDataURL(f);
    } else {
      setPostPreview('');
    }
  };

  const publishPost = async () => {
    if (!postText.trim()) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const form = new FormData();
      form.append('text',   postText.trim());
      form.append('source', 'manual');
      form.append('target', postTarget);
      if (postImage) form.append('image', postImage);

      const r = await fetch('/api/linkedin/publish', { method: 'POST', body: form }).then(res => res.json());
      setPublishResult({ ok: !!r.ok, url: r.url, error: r.error });
      if (r.ok) {
        setPostText('');
        setPostImage(null);
        setPostPreview('');
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch (e) {
      setPublishResult({ ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'12px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" strokeWidth="2"
          style={{ animation:'spin .9s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/>
          <path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const canConnect  = (status?.hasClientId && status?.hasClientSecret) ?? false;
  const isConnected = status?.connected && !status?.expired;

  // Connexion Page entreprise (app Community Management).
  const orgCanConnect = !!(status?.organization?.hasClientId && status?.organization?.hasClientSecret);
  const orgConnected  = !!(status?.organization?.connected && !status?.organization?.expired);
  const orgReady      = !!(status?.orgEnabled && status?.orgUrn); // connectée + Page choisie

  // Cible « prête » pour le nouveau post (pilote le bouton Publier).
  const targetReady = postTarget === 'organization' ? orgReady : !!isConnected;

  return (
    <div style={{ padding:'2rem', width:'100%', boxSizing:'border-box', maxWidth:'860px' }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .li-card{background:white;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.06);}
        .li-input{width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:.88rem;outline:none;box-sizing:border-box;background:white;color:#111827;transition:border-color .15s;}
        .li-input:focus{border-color:#0a66c2;box-shadow:0 0 0 3px rgba(10,102,194,.1);}
        .li-btn{padding:9px 18px;border:none;border-radius:7px;font-weight:700;font-size:.85rem;cursor:pointer;font-family:Montserrat,sans-serif;transition:all .15s;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;}
        .li-btn:disabled{opacity:.5;cursor:not-allowed;}
        .li-btn-primary{background:#0a66c2;color:white;} .li-btn-primary:hover:not(:disabled){background:#004182;}
        .li-btn-secondary{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;} .li-btn-secondary:hover:not(:disabled){background:#e5e7eb;}
        .li-btn-danger{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;} .li-btn-danger:hover{background:#fee2e2;}
        .li-label{display:block;font-size:.72rem;font-weight:700;color:#374151;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em;}
        .li-tab{padding:8px 18px;border:none;background:none;font-size:.85rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;color:#6b7280;transition:all .15s;font-family:inherit;}
        .li-tab.active{color:#0a66c2;border-bottom-color:#0a66c2;}
        .li-tab:hover:not(.active){color:#374151;}
        textarea.li-input{resize:vertical;min-height:140px;line-height:1.6;}
        @media(max-width:600px){.li-grid-2{grid-template-columns:1fr!important;}}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:'1.75rem', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'16px', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ background:'linear-gradient(135deg,#0a66c2,#0077b5)', borderRadius:'10px', padding:'8px', display:'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/>
              <rect x="2" y="9" width="4" height="12"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1.5rem', fontWeight:800, color:'#003366', margin:'0 0 3px' }}>
              LinkedIn
            </h1>
            <p style={{ color:'#6b7280', fontSize:'0.82rem', margin:0 }}>
              Publiez des posts depuis l&apos;admin ou via Google Chat
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <StatusBadge ok={!!isConnected} label={isConnected ? `Perso · ${status?.name || status?.email || 'OK'}` : 'Perso non connecté'} />
          <StatusBadge ok={orgReady} label={orgReady ? `Page · ${status?.orgName || 'OK'}` : (orgConnected ? 'Page · à sélectionner' : 'Page non connectée')} />
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div style={{
          marginBottom:'1.5rem', padding:'12px 16px', borderRadius:'10px', fontSize:'.85rem',
          fontWeight:500, display:'flex', alignItems:'center', gap:'10px',
          background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border:     `1px solid ${notice.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color:      notice.type === 'success' ? '#065f46' : '#991b1b',
        }}>
          {notice.type === 'success'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          }
          {notice.text}
          <button onClick={() => setNotice(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'inherit', opacity:.6, fontSize:'1rem', lineHeight:1, padding:0 }}>×</button>
        </div>
      )}

      {/* Aide quand un scope est refusé par une app LinkedIn */}
      {(notice?.code === 'unauthorized_scope_error' || notice?.code === 'invalid_scope_error') && (
        <div style={{ marginBottom:'1.5rem', padding:'14px 16px', borderRadius:'10px', background:'#fffbeb', border:'1px solid #fde68a', fontSize:'.83rem', color:'#92400e', lineHeight:1.6 }}>
          <strong>Une permission a été refusée par l&apos;app LinkedIn utilisée.</strong>
          <ul style={{ margin:'8px 0 0', paddingLeft:'18px' }}>
            <li><strong>Compte perso</strong> : l&apos;app doit avoir les produits <strong>« Sign In with LinkedIn using OpenID Connect »</strong> et <strong>« Share on LinkedIn »</strong> (self-serve, immédiats).</li>
            <li><strong>Page entreprise</strong> : l&apos;app doit avoir <strong>« Community Management API »</strong> <em>approuvé</em>, et le compte doit être <strong>administrateur</strong> de la Page.</li>
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', marginBottom:'1.5rem', gap:'4px', flexWrap:'wrap' }}>
        {(['connexion','post','historique','statistiques','engagement','audience'] as const).map(t => (
          <button key={t} className={`li-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ══ TAB: CONNEXION ══ */}
      {tab === 'connexion' && (
        <>
          {/* URI de redirection — commune aux DEUX apps */}
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'9px', padding:'13px 16px', marginBottom:'1rem', fontSize:'.83rem', color:'#1e40af', lineHeight:1.6 }}>
            <strong>Étape commune — Ajoutez cette URI de redirection dans les DEUX apps LinkedIn</strong><br />
            Pour chaque app : <strong>linkedin.com/developers</strong> → app → <strong>Auth → Authorized redirect URLs</strong> → ajoutez l&apos;URL ci-dessous (identique).
          </div>
          <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'12px 14px', marginBottom:'1.5rem' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'6px' }}>URI de redirection autorisée</div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <code style={{ flex:1, fontSize:'.78rem', color:'#0a66c2', background:'white', padding:'6px 10px', borderRadius:'6px', border:'1px solid #e5e7eb', wordBreak:'break-all' }}>
                {status?.redirectUri}
              </code>
              <button className="li-btn li-btn-secondary" style={{ padding:'6px 12px', fontSize:'.78rem' }} onClick={copyUri}>
                {copiedUri ? '✓ Copié' : 'Copier'}
              </button>
            </div>
          </div>

          {/* ════════════ CARTE 1 — Page entreprise (prioritaire) ════════════ */}
          <div className="li-card" style={{ marginBottom:'1.5rem', overflow:'hidden', borderColor:'#bfdbfe' }}>
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap', background:'#f8fbff' }}>
              <div>
                <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:800, color:'#111827', margin:0 }}>
                  🏢 Page entreprise <span style={{ fontSize:'.7rem', fontWeight:700, color:'#0a66c2', background:'#e0f2fe', padding:'2px 8px', borderRadius:'10px', marginLeft:'6px' }}>cible prioritaire</span>
                </h2>
                <p style={{ fontSize:'.72rem', color:'#9ca3af', margin:'4px 0 0' }}>App « Tender Wise - Page entreprise » · Community Management API</p>
              </div>
              <StatusBadge ok={orgReady} label={orgReady ? `Active · ${status?.orgName || 'Page'}` : (orgConnected ? 'Connectée — Page à choisir' : 'Non connectée')} />
            </div>
            <div style={{ padding:'1.5rem' }}>
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'9px', padding:'12px 16px', fontSize:'.8rem', color:'#92400e', lineHeight:1.6, marginBottom:'1.25rem' }}>
                <strong>Pré-requis :</strong> l&apos;app doit avoir le produit <strong>« Community Management API »</strong> <em>approuvé</em> (scopes <code>r_organization_social</code> + <code>w_organization_social</code>), et le compte autorisant doit être <strong>administrateur</strong> de la Page.
              </div>

              {/* Identifiants OAuth — app Page entreprise */}
              <p style={{ fontSize:'.72rem', fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 10px' }}>
                Identifiants OAuth (app Page entreprise)
                {status?.organization?.hasClientId && status?.organization?.hasClientSecret && (
                  <span style={{ marginLeft:'8px', fontSize:'.7rem', fontWeight:700, color:'#065f46', background:'#d1fae5', padding:'2px 8px', borderRadius:'10px', textTransform:'none' }}>configurés</span>
                )}
              </p>
              <div className="li-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                <div>
                  <label className="li-label">Client ID{status?.organization?.hasClientId && <span style={{ color:'#9ca3af', textTransform:'none', fontWeight:400 }}> · enregistré</span>}</label>
                  <input className="li-input" value={orgClientId} onChange={e => setOrgClientId(e.target.value)} placeholder="78y07vs5knqhzp" />
                </div>
                <div>
                  <label className="li-label">Client Secret{status?.organization?.hasClientSecret && <span style={{ color:'#9ca3af', textTransform:'none', fontWeight:400 }}> · enregistré</span>}</label>
                  <input className="li-input" type="password" value={orgClientSecret} onChange={e => setOrgClientSecret(e.target.value)} placeholder="••••••••••••••••" />
                </div>
              </div>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', marginBottom:'1.25rem' }}>
                <button className="li-btn li-btn-secondary" onClick={saveOrgCredentials} disabled={orgCredSaving || (!orgClientId && !orgClientSecret)}>
                  {orgCredSaving ? <><Spinner /> Enregistrement…</> : orgCredSaved ? '✓ Enregistré' : 'Enregistrer les identifiants'}
                </button>
              </div>

              {/* Connexion / état */}
              <div style={{ borderTop:'1px solid #f3f4f6', paddingTop:'1.25rem' }}>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
                  <a className="li-btn li-btn-primary"
                    href={orgCanConnect ? '/api/connectors/linkedin/authorize?which=organization' : undefined}
                    style={!orgCanConnect ? { opacity:.5, pointerEvents:'none', textDecoration:'none' } : { textDecoration:'none' }}>
                    {orgConnected ? 'Reconnecter la Page' : 'Connecter la Page entreprise'}
                  </a>
                  {orgConnected && (
                    <button className="li-btn li-btn-danger" onClick={() => disconnect('organization')} disabled={disconnecting}>
                      {disconnecting ? '…' : 'Déconnecter la Page'}
                    </button>
                  )}
                </div>
                {!orgCanConnect && (
                  <p style={{ fontSize:'.75rem', color:'#9ca3af', margin:'10px 0 0' }}>Enregistrez d&apos;abord les identifiants de l&apos;app Page entreprise.</p>
                )}
              </div>

              {/* Sélection de la Page (par NOM) */}
              {orgConnected && (
                <div style={{ marginTop:'1.25rem', borderTop:'1px solid #f3f4f6', paddingTop:'1.25rem' }}>
                  {(status?.organization?.orgs && status.organization.orgs.length > 0) ? (
                    <>
                      <label className="li-label">Page utilisée pour les publications</label>
                      <select className="li-input" value={status?.orgUrn || ''} disabled={orgSaving}
                        onChange={e => saveOrgConfig({ orgUrn: e.target.value })}>
                        <option value="" disabled>— Choisissez une Page —</option>
                        {status.organization.orgs.map(o => <option key={o.urn} value={o.urn}>{o.name}</option>)}
                      </select>
                    </>
                  ) : (
                    <p style={{ fontSize:'.82rem', color:'#374151', lineHeight:1.6, margin:0 }}>
                      Aucune Page administrable détectée. Vérifiez que vous êtes <strong>admin</strong> de la Page et que <strong>Community Management API</strong> est approuvé, puis « Reconnecter la Page ». Vous pouvez aussi saisir la Page manuellement ci-dessous.
                    </p>
                  )}

                  {/* Saisie manuelle (repli) */}
                  <div style={{ marginTop:'1.25rem', paddingTop:'1rem', borderTop:'1px dashed #e5e7eb' }}>
                    <label className="li-label">Ou saisir la Page manuellement</label>
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      <input className="li-input" style={{ flex:1, minWidth:'200px' }}
                        value={orgManual} onChange={e => setOrgManual(e.target.value)}
                        placeholder="urn:li:organization:1234, ID numérique, ou URL admin de la Page" />
                      <button className="li-btn li-btn-secondary" disabled={orgSaving || !orgManual.trim()}
                        onClick={async () => { const ok = await saveOrgConfig({ orgUrnManual: orgManual.trim() }); if (ok) setOrgManual(''); }}>
                        {orgSaving ? <><Spinner /> …</> : 'Utiliser cette Page'}
                      </button>
                    </div>
                    <p style={{ margin:'6px 0 0', color:'#9ca3af', fontSize:'.72rem' }}>
                      L&apos;ID numérique se trouve dans l&apos;URL d&apos;admin de votre Page : linkedin.com/company/<strong>1234</strong>/admin
                    </p>
                  </div>
                  {status?.orgUrn && (
                    <p style={{ margin:'10px 0 0', fontSize:'.75rem', color:'#065f46', fontWeight:600 }}>
                      ✓ Page active : {status?.orgName || status.orgUrn}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ════════════ CARTE 2 — Compte personnel ════════════ */}
          <div className="li-card" style={{ marginBottom:'1.5rem', overflow:'hidden' }}>
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
              <div>
                <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:800, color:'#111827', margin:0 }}>👤 Compte personnel</h2>
                <p style={{ fontSize:'.72rem', color:'#9ca3af', margin:'4px 0 0' }}>App « Automatisation Tender Wise » · Sign In + Share</p>
              </div>
              <StatusBadge ok={!!isConnected} label={isConnected ? `Connecté · ${status?.name || status?.email}` : 'Non connecté'} />
            </div>
            <div style={{ padding:'1.5rem' }}>
              {isConnected ? (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'12px 16px', marginBottom:'1.25rem' }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'#0a66c2', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'1.1rem', flexShrink:0 }}>
                      {(status?.name || status?.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'.9rem', color:'#111827' }}>{status?.name || 'Utilisateur LinkedIn'}</div>
                      <div style={{ fontSize:'.72rem', color:'#9ca3af' }}>{status?.email}</div>
                      {status?.expiresAt && (
                        <div style={{ fontSize:'.68rem', color:'#9ca3af', marginTop:'2px' }}>
                          Jeton valide jusqu&apos;au {new Date(status.expiresAt).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <a className="li-btn li-btn-primary" href="/api/connectors/linkedin/authorize">Reconnecter / changer de compte</a>
                    <button className="li-btn li-btn-danger" onClick={() => disconnect('person')} disabled={disconnecting}>
                      {disconnecting ? 'Déconnexion…' : 'Déconnecter'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize:'.72rem', fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'.05em', margin:'0 0 10px' }}>
                    Identifiants OAuth (app compte personnel)
                    {status?.hasClientId && status?.hasClientSecret && (
                      <span style={{ marginLeft:'8px', fontSize:'.7rem', fontWeight:700, color:'#065f46', background:'#d1fae5', padding:'2px 8px', borderRadius:'10px', textTransform:'none' }}>configurés</span>
                    )}
                  </p>
                  <div className="li-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                    <div>
                      <label className="li-label">Client ID{status?.hasClientId && <span style={{ color:'#9ca3af', textTransform:'none', fontWeight:400 }}> · enregistré</span>}</label>
                      <input className="li-input" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="7868yt0we0vudm" />
                    </div>
                    <div>
                      <label className="li-label">Client Secret{status?.hasClientSecret && <span style={{ color:'#9ca3af', textTransform:'none', fontWeight:400 }}> · enregistré</span>}</label>
                      <input className="li-input" type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="••••••••••••••••" />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', marginBottom:'1.25rem' }}>
                    <button className="li-btn li-btn-secondary" onClick={saveCredentials} disabled={credSaving || (!clientId && !clientSecret)}>
                      {credSaving ? <><Spinner /> Enregistrement…</> : credSaved ? '✓ Enregistré' : 'Enregistrer les identifiants'}
                    </button>
                  </div>
                  <div style={{ borderTop:'1px solid #f3f4f6', paddingTop:'1.25rem', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
                    <a className="li-btn li-btn-primary"
                      href={canConnect ? '/api/connectors/linkedin/authorize' : undefined}
                      style={!canConnect ? { opacity:.5, pointerEvents:'none', textDecoration:'none' } : { textDecoration:'none' }}>
                      Se connecter avec LinkedIn
                    </a>
                    <button className="li-btn li-btn-danger" onClick={() => resetConnection('person')} disabled={disconnecting}
                      title="Efface le jeton en cas de connexion bloquée. Identifiants OAuth conservés.">
                      {disconnecting ? '…' : 'Réinitialiser'}
                    </button>
                    {!canConnect && (
                      <p style={{ fontSize:'.75rem', color:'#9ca3af', margin:0, flexBasis:'100%' }}>Enregistrez d&apos;abord les identifiants de l&apos;app compte personnel.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* How Chat works */}
          <details className="li-card" style={{ padding:'1rem 1.5rem' }}>
            <summary style={{ cursor:'pointer', fontWeight:700, fontSize:'.875rem', color:'#374151', fontFamily:'Montserrat,sans-serif' }}>
              Publier depuis Google Chat
            </summary>
            <div style={{ marginTop:'12px', fontSize:'.83rem', color:'#4b5563', lineHeight:1.8 }}>
              <p style={{ margin:'0 0 8px' }}>Une fois LinkedIn connecté, envoyez dans Google Chat :</p>
              <div style={{ background:'#1e1e2e', borderRadius:'8px', padding:'12px 16px', fontFamily:'monospace', fontSize:'.82rem', color:'#a6e3a1', marginBottom:'10px' }}>
                post lk: Mon texte du post LinkedIn avec #hashtags
              </div>
              <p style={{ margin:'0', color:'#6b7280' }}>
                <strong>Images :</strong> publiez avec une image directement depuis l&apos;onglet <em>Nouveau post</em> de cette page
                (photo + texte → publication en un clic).
              </p>
            </div>
          </details>
        </>
      )}

      {/* ══ TAB: NOUVEAU POST ══ */}
      {tab === 'post' && (
        <div className="li-card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #f3f4f6' }}>
            <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:800, color:'#111827', margin:0 }}>
              Créer un post LinkedIn
            </h2>
          </div>
          <div style={{ padding:'1.5rem' }}>
            {!targetReady && (
              <div style={{ padding:'14px 16px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'9px', marginBottom:'1.25rem', fontSize:'.83rem', color:'#9a3412', fontWeight:600 }}>
                ⚠️ {postTarget === 'organization'
                  ? <>Page entreprise non prête — connectez-la et choisissez une Page dans l&apos;onglet <strong>Connexion</strong>.</>
                  : <>Compte personnel non connecté — rendez-vous dans l&apos;onglet <strong>Connexion</strong> pour autoriser l&apos;accès.</>}
              </div>
            )}

            {/* Cible de publication */}
            <div style={{ marginBottom:'1.25rem' }}>
              <label className="li-label">Publier sur</label>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                <button type="button"
                  onClick={() => { targetTouched.current = true; if (orgReady) setPostTarget('organization'); }}
                  disabled={!orgReady}
                  title={orgReady ? '' : 'Connectez la Page entreprise dans l’onglet Connexion'}
                  className={`li-btn ${postTarget === 'organization' ? 'li-btn-primary' : 'li-btn-secondary'}`}
                  style={{ padding:'8px 14px', fontSize:'.82rem' }}>
                  🏢 Page entreprise{status?.orgName ? ` (${status.orgName})` : ''}
                </button>
                <button type="button"
                  onClick={() => { targetTouched.current = true; setPostTarget('person'); }}
                  disabled={!isConnected}
                  title={isConnected ? '' : 'Connectez le compte personnel dans l’onglet Connexion'}
                  className={`li-btn ${postTarget === 'person' ? 'li-btn-primary' : 'li-btn-secondary'}`}
                  style={{ padding:'8px 14px', fontSize:'.82rem' }}>
                  👤 Compte perso{status?.name ? ` (${status.name})` : ''}
                </button>
              </div>
            </div>

            <div style={{ marginBottom:'1rem' }}>
              <label className="li-label" style={{ display:'flex', justifyContent:'space-between' }}>
                <span>Texte du post</span>
                <span style={{ fontWeight:400, textTransform:'none', color: postText.length > WARN_AT ? (postText.length > CHAR_LIMIT ? '#dc2626' : '#d97706') : '#9ca3af' }}>
                  {postText.length} / {CHAR_LIMIT}
                </span>
              </label>
              <textarea
                className="li-input"
                value={postText}
                onChange={e => setPostText(e.target.value)}
                placeholder="Partagez une actualité, un conseil, ou le lien vers votre dernier article…&#10;&#10;Ajoutez vos #hashtags à la fin pour maximiser la portée."
                maxLength={CHAR_LIMIT}
              />
              <p style={{ fontSize:'.72rem', color:'#9ca3af', margin:'5px 0 0' }}>
                Optimal : 1 200 – 1 500 caractères. Jusqu&apos;à 3 000 caractères autorisés.
              </p>
            </div>

            {/* Image upload */}
            <div style={{ marginBottom:'1.25rem' }}>
              <label className="li-label">Image (optionnel)</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border:       `2px dashed ${postPreview ? '#0a66c2' : '#e5e7eb'}`,
                  borderRadius: '10px',
                  padding:      postPreview ? '0' : '24px',
                  textAlign:    'center',
                  cursor:       'pointer',
                  background:   postPreview ? '#000' : '#fafafa',
                  overflow:     'hidden',
                  transition:   'border-color .15s',
                  maxHeight:    postPreview ? '300px' : 'auto',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent:'center',
                }}
              >
                {postPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={postPreview} alt="Aperçu" style={{ maxWidth:'100%', maxHeight:'300px', objectFit:'contain', display:'block' }} />
                ) : (
                  <div>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ margin:'0 auto 8px', display:'block' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p style={{ color:'#9ca3af', fontSize:'.82rem', margin:0 }}>Cliquez pour ajouter une image</p>
                    <p style={{ color:'#d1d5db', fontSize:'.72rem', margin:'4px 0 0' }}>JPG, PNG, GIF — recommandé 1200×627px</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageChange} />
              {postPreview && (
                <button
                  onClick={() => { setPostImage(null); setPostPreview(''); if (fileRef.current) fileRef.current.value = ''; }}
                  className="li-btn li-btn-danger"
                  style={{ marginTop:'8px', padding:'5px 12px', fontSize:'.78rem' }}
                >
                  Supprimer l&apos;image
                </button>
              )}
            </div>

            {/* Publish result */}
            {publishResult && (
              <div style={{
                marginBottom:'1rem', padding:'12px 16px', borderRadius:'9px', fontSize:'.83rem', fontWeight:600,
                background:  publishResult.ok ? '#f0fdf4' : '#fef2f2',
                border:      `1px solid ${publishResult.ok ? '#a7f3d0' : '#fecaca'}`,
                color:       publishResult.ok ? '#065f46' : '#991b1b',
                display:     'flex', alignItems:'center', gap:'10px', flexWrap:'wrap',
              }}>
                {publishResult.ok
                  ? <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Post publié avec succès !
                      {publishResult.url && (
                        <a href={publishResult.url} target="_blank" rel="noopener noreferrer"
                          style={{ color:'#0a66c2', fontWeight:700, textDecoration:'none', marginLeft:'4px' }}>
                          Voir sur LinkedIn →
                        </a>
                      )}
                    </>
                  : <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {publishResult.error || 'Erreur lors de la publication'}
                    </>
                }
              </div>
            )}

            {/* Publish button */}
            <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <button
                className="li-btn li-btn-primary"
                onClick={publishPost}
                disabled={publishing || !postText.trim() || postText.length > CHAR_LIMIT || !targetReady}
              >
                {publishing ? <><Spinner /> Publication…</> : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    {postTarget === 'organization' ? 'Publier sur la Page' : 'Publier sur LinkedIn'}
                  </>
                )}
              </button>
              {(postText || postPreview) && (
                <button className="li-btn li-btn-secondary" onClick={() => { setPostText(''); setPostImage(null); setPostPreview(''); if (fileRef.current) fileRef.current.value = ''; setPublishResult(null); }}>
                  Effacer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: HISTORIQUE ══ */}
      {tab === 'historique' && (
        <div className="li-card" style={{ overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1.25rem 1.5rem', borderBottom:'1px solid #f3f4f6', flexWrap:'wrap', gap:'10px' }}>
            <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:800, color:'#111827', margin:0 }}>
              Posts publiés
            </h2>
            <button className="li-btn li-btn-secondary" style={{ padding:'5px 12px', fontSize:'.78rem' }} onClick={loadPosts} disabled={postsLoading}>
              {postsLoading ? <><Spinner /> Chargement</> : '↻ Actualiser'}
            </button>
          </div>
          <div style={{ padding:'1rem 1.5rem' }}>
            {postsLoading ? (
              <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#9ca3af', fontSize:'.85rem', padding:'12px 0' }}>
                <Spinner /> Chargement…
              </div>
            ) : posts.length === 0 ? (
              <p style={{ color:'#9ca3af', fontSize:'.82rem', padding:'8px 0', margin:0 }}>
                Aucun post publié pour le moment. Créez votre premier post dans l&apos;onglet <em>Nouveau post</em>.
              </p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {posts.map(p => (
                  <div key={p.id} style={{
                    borderRadius:'9px',
                    border:      `1px solid ${p.status === 'published' ? '#e5e7eb' : '#fecaca'}`,
                    background:  p.status === 'published' ? '#fafafa' : '#fef2f2',
                    padding:     '14px 16px',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px', marginBottom:'8px', flexWrap:'wrap' }}>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{
                          fontSize:    '.68rem',
                          fontWeight:  700,
                          padding:     '2px 8px',
                          borderRadius:'10px',
                          background:  p.status === 'published' ? '#d1fae5' : '#fecaca',
                          color:       p.status === 'published' ? '#065f46' : '#991b1b',
                        }}>
                          {p.status === 'published' ? '✓ Publié' : '✗ Échec'}
                        </span>
                        <span style={{ fontSize:'.7rem', color:'#9ca3af' }}>
                          {p.source === 'chat' ? '💬 Chat' : p.source === 'blog' ? '📝 Article' : '✏️ Manuel'}
                        </span>
                      </div>
                      <span style={{ fontSize:'.72rem', color:'#9ca3af', whiteSpace:'nowrap' }}>
                        {new Date(p.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize:'.83rem', color:'#374151', margin:'0 0 8px', lineHeight:1.55, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                      {p.text.length > 200 ? p.text.slice(0, 200) + '…' : p.text}
                    </p>
                    {p.linkedin_url && (
                      <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize:'.78rem', color:'#0a66c2', fontWeight:700, textDecoration:'none' }}>
                        Voir sur LinkedIn →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: STATISTIQUES ══ */}
      {tab === 'statistiques' && (
        <StatsView stats={stats} loading={statsLoading} onReload={() => loadStats()} />
      )}

      {/* ══ TAB: ENGAGEMENT ══ */}
      {tab === 'engagement' && (
        <EngagementView
          stats={stats}
          loading={statsLoading}
          refreshing={refreshing}
          sort={engSort}
          onSort={setEngSort}
          onRefresh={() => loadStats(true)}
        />
      )}

      {/* ══ TAB: AUDIENCE / PROFIL ══ */}
      {tab === 'audience' && (
        <AudienceView status={status} stats={stats} />
      )}
    </div>
  );
}

/* ─── Vues Statistiques / Engagement / Audience ─────────────────────────── */

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="li-card" style={{ padding:'16px 18px' }}>
      <div style={{ fontSize:'.7rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'1.7rem', fontWeight:800, color: accent || '#111827', fontFamily:'Montserrat,sans-serif', lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:'.72rem', color:'#9ca3af', marginTop:'4px' }}>{sub}</div>}
    </div>
  );
}

function ApiLimitNote() {
  return (
    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'9px', padding:'12px 16px', fontSize:'.8rem', color:'#92400e', lineHeight:1.6 }}>
      <strong>ℹ️ Limite de l&apos;API LinkedIn (compte personnel)</strong><br />
      Les <strong>impressions, vues et clics</strong> d&apos;un post, ainsi que <strong>« qui a vu votre profil »</strong>, ne sont pas exposés par l&apos;API LinkedIn pour un compte personnel — ils restent visibles uniquement dans l&apos;interface LinkedIn. Seuls les <strong>likes et commentaires</strong> sont récupérables ici. Ces métriques nécessiteraient une <strong>Page entreprise</strong> + l&apos;API Community Management.
    </div>
  );
}

function StatsLoading() {
  return (
    <div className="li-card" style={{ padding:'2rem', display:'flex', alignItems:'center', gap:'10px', color:'#9ca3af', fontSize:'.85rem' }}>
      <Spinner /> Chargement des statistiques…
    </div>
  );
}

function StatsView({ stats, loading, onReload }: { stats: LIStats | null; loading: boolean; onReload: () => void }) {
  if (loading && !stats) return <StatsLoading />;
  if (!stats) return <div className="li-card" style={{ padding:'2rem', color:'#9ca3af' }}>Aucune donnée.</div>;

  const { summary, byDay, bySource } = stats;
  const maxDay = Math.max(1, ...byDay.map(d => d.count));
  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) : '—';

  const sources: { key: string; label: string; color: string }[] = [
    { key:'manual', label:'✏️ Manuel',  color:'#0a66c2' },
    { key:'chat',   label:'💬 Chat',    color:'#10b981' },
    { key:'blog',   label:'📝 Article', color:'#f59e0b' },
  ];
  const sourceTotal = Math.max(1, sources.reduce((s, x) => s + (bySource[x.key] || 0), 0));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'12px' }}>
        <StatCard label="Posts publiés"   value={String(summary.published)} sub={`${summary.total} au total`} accent="#0a66c2" />
        <StatCard label="Taux de réussite" value={`${summary.successRate}%`} sub={`${summary.failed} échec(s)`} accent={summary.failed ? '#d97706' : '#10b981'} />
        <StatCard label="Likes (total)"    value={summary.engagementKnown ? String(summary.totalLikes) : '—'} sub={summary.engagementKnown ? 'cumul des posts' : 'actualiser dans Engagement'} accent="#ef4444" />
        <StatCard label="Commentaires"     value={summary.engagementKnown ? String(summary.totalComments) : '—'} sub={summary.engagementKnown ? 'cumul des posts' : 'actualiser dans Engagement'} accent="#8b5cf6" />
      </div>

      {/* Activity chart */}
      <div className="li-card" style={{ padding:'1.25rem 1.5rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'8px' }}>
          <h3 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'.9rem', fontWeight:800, color:'#111827', margin:0 }}>Activité — 30 derniers jours</h3>
          <button className="li-btn li-btn-secondary" style={{ padding:'5px 12px', fontSize:'.78rem' }} onClick={onReload} disabled={loading}>
            {loading ? <><Spinner /> Chargement</> : '↻ Actualiser'}
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'3px', height:'120px' }}>
          {byDay.map((d) => (
            <div key={d.date} title={`${new Date(d.date).toLocaleDateString('fr-FR')} : ${d.count} post(s)`}
              style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', height:'100%' }}>
              <div style={{
                height: `${(d.count / maxDay) * 100}%`,
                minHeight: d.count > 0 ? '4px' : '0',
                background: d.count > 0 ? 'linear-gradient(180deg,#0a66c2,#0077b5)' : '#f3f4f6',
                borderRadius:'3px 3px 0 0',
                transition:'height .2s',
              }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.68rem', color:'#9ca3af', marginTop:'6px' }}>
          <span>{fmtDate(byDay[0]?.date)}</span>
          <span>Aujourd&apos;hui</span>
        </div>
      </div>

      {/* Source breakdown */}
      <div className="li-card" style={{ padding:'1.25rem 1.5rem' }}>
        <h3 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'.9rem', fontWeight:800, color:'#111827', margin:'0 0 1rem' }}>Répartition par source</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {sources.map(s => {
            const n = bySource[s.key] || 0;
            const pct = Math.round((n / sourceTotal) * 100);
            return (
              <div key={s.key}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.78rem', color:'#374151', marginBottom:'4px' }}>
                  <span>{s.label}</span>
                  <span style={{ fontWeight:700 }}>{n} <span style={{ color:'#9ca3af', fontWeight:400 }}>· {pct}%</span></span>
                </div>
                <div style={{ height:'8px', background:'#f3f4f6', borderRadius:'5px', overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:s.color, borderRadius:'5px', transition:'width .3s' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', gap:'24px', marginTop:'1.25rem', paddingTop:'1rem', borderTop:'1px solid #f3f4f6', fontSize:'.78rem', color:'#6b7280', flexWrap:'wrap' }}>
          <span>Premier post : <strong style={{ color:'#374151' }}>{fmtDate(summary.firstPost)}</strong></span>
          <span>Dernier post : <strong style={{ color:'#374151' }}>{fmtDate(summary.lastPost)}</strong></span>
        </div>
      </div>

      <ApiLimitNote />
    </div>
  );
}

function EngagementView({ stats, loading, refreshing, sort, onSort, onRefresh }: {
  stats: LIStats | null; loading: boolean; refreshing: boolean;
  sort: 'date' | 'likes' | 'comments'; onSort: (s: 'date' | 'likes' | 'comments') => void; onRefresh: () => void;
}) {
  if (loading && !stats) return <StatsLoading />;
  if (!stats) return <div className="li-card" style={{ padding:'2rem', color:'#9ca3af' }}>Aucune donnée.</div>;

  const published = stats.posts.filter(p => p.status === 'published');
  const sorted = [...published].sort((a, b) => {
    if (sort === 'likes')    return (b.likes ?? -1) - (a.likes ?? -1);
    if (sort === 'comments') return (b.comments ?? -1) - (a.comments ?? -1);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <div className="li-card" style={{ overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1.25rem 1.5rem', borderBottom:'1px solid #f3f4f6', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:800, color:'#111827', margin:0 }}>Engagement par post</h2>
            <p style={{ fontSize:'.72rem', color:'#9ca3af', margin:'3px 0 0' }}>Likes &amp; commentaires récupérés depuis LinkedIn</p>
          </div>
          <button className="li-btn li-btn-primary" style={{ padding:'7px 14px', fontSize:'.8rem' }} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <><Spinner /> Récupération…</> : '↻ Actualiser les stats'}
          </button>
        </div>

        {stats.refreshError && (
          <div style={{ margin:'1rem 1.5rem 0', padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'.78rem', color:'#991b1b' }}>
            {stats.refreshError}
          </div>
        )}

        <div style={{ padding:'1rem 1.5rem' }}>
          {/* Sort */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'12px', alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:'.72rem', color:'#9ca3af', fontWeight:600 }}>Trier :</span>
            {([['date','Date'],['likes','Likes'],['comments','Commentaires']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => onSort(k)}
                style={{
                  padding:'4px 10px', borderRadius:'14px', fontSize:'.72rem', fontWeight:700, cursor:'pointer',
                  border:'1px solid', borderColor: sort === k ? '#0a66c2' : '#e5e7eb',
                  background: sort === k ? '#eff6ff' : 'white', color: sort === k ? '#0a66c2' : '#6b7280',
                }}>
                {lbl}
              </button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <p style={{ color:'#9ca3af', fontSize:'.82rem', padding:'8px 0', margin:0 }}>Aucun post publié à analyser.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {sorted.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'9px', background:'#fafafa', flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:'180px' }}>
                    <p style={{ fontSize:'.8rem', color:'#374151', margin:'0 0 3px', lineHeight:1.4, wordBreak:'break-word' }}>
                      {p.text || <em style={{ color:'#9ca3af' }}>(sans texte)</em>}
                    </p>
                    <span style={{ fontSize:'.68rem', color:'#9ca3af' }}>
                      {new Date(p.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })}
                      {p.linkedin_url && <> · <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color:'#0a66c2', textDecoration:'none', fontWeight:700 }}>Voir →</a></>}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:'18px', textAlign:'center' }}>
                    <div>
                      <div style={{ fontSize:'1.1rem', fontWeight:800, color:'#ef4444', fontFamily:'Montserrat,sans-serif' }}>
                        {p.stats_fetched_at ? (p.likes ?? 0) : '—'}
                      </div>
                      <div style={{ fontSize:'.62rem', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em' }}>❤️ Likes</div>
                    </div>
                    <div>
                      <div style={{ fontSize:'1.1rem', fontWeight:800, color:'#8b5cf6', fontFamily:'Montserrat,sans-serif' }}>
                        {p.stats_fetched_at ? (p.comments ?? 0) : '—'}
                      </div>
                      <div style={{ fontSize:'.62rem', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em' }}>💬 Comm.</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize:'.7rem', color:'#9ca3af', margin:'12px 0 0', lineHeight:1.5 }}>
            « — » signifie que la statistique n&apos;a pas encore été récupérée. Cliquez sur <strong>Actualiser les stats</strong> (les 25 posts les plus récents sont interrogés).
          </p>
        </div>
      </div>

      <ApiLimitNote />
    </div>
  );
}

function AudienceView({ status, stats }: { status: LIStatus | null; stats: LIStats | null }) {
  const connected = status?.connected && !status?.expired;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <div className="li-card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #f3f4f6' }}>
          <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:800, color:'#111827', margin:0 }}>Profil connecté</h2>
        </div>
        <div style={{ padding:'1.5rem' }}>
          {connected ? (
            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'#0a66c2', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'1.4rem', flexShrink:0 }}>
                {(status?.name || status?.email || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:'1rem', color:'#111827' }}>{status?.name || 'Utilisateur LinkedIn'}</div>
                <div style={{ fontSize:'.78rem', color:'#6b7280' }}>{status?.email}</div>
                {status?.expiresAt && (
                  <div style={{ fontSize:'.7rem', color:'#9ca3af', marginTop:'2px' }}>
                    Jeton valide jusqu&apos;au {new Date(status.expiresAt).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color:'#9ca3af', fontSize:'.85rem', margin:0 }}>
              LinkedIn non connecté — rendez-vous dans l&apos;onglet <strong>Connexion</strong>.
            </p>
          )}

          {connected && stats && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:'10px', marginTop:'1.25rem', paddingTop:'1.25rem', borderTop:'1px solid #f3f4f6' }}>
              <div><div style={{ fontSize:'1.4rem', fontWeight:800, color:'#0a66c2', fontFamily:'Montserrat,sans-serif' }}>{stats.summary.published}</div><div style={{ fontSize:'.68rem', color:'#9ca3af' }}>Posts publiés</div></div>
              <div><div style={{ fontSize:'1.4rem', fontWeight:800, color:'#ef4444', fontFamily:'Montserrat,sans-serif' }}>{stats.summary.engagementKnown ? stats.summary.totalLikes : '—'}</div><div style={{ fontSize:'.68rem', color:'#9ca3af' }}>Likes cumulés</div></div>
              <div><div style={{ fontSize:'1.4rem', fontWeight:800, color:'#8b5cf6', fontFamily:'Montserrat,sans-serif' }}>{stats.summary.engagementKnown ? stats.summary.totalComments : '—'}</div><div style={{ fontSize:'.68rem', color:'#9ca3af' }}>Commentaires</div></div>
            </div>
          )}
        </div>
      </div>

      {/* Visiteurs de profil — explication honnête */}
      <div className="li-card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #f3f4f6' }}>
          <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:800, color:'#111827', margin:0 }}>👁️ Qui a vu votre profil</h2>
        </div>
        <div style={{ padding:'1.5rem' }}>
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'9px', padding:'14px 16px', fontSize:'.82rem', color:'#92400e', lineHeight:1.7 }}>
            <strong>Non disponible via l&apos;API LinkedIn.</strong><br />
            La liste des personnes ayant consulté votre profil est une fonctionnalité <strong>réservée à l&apos;interface LinkedIn</strong> (et à l&apos;abonnement Premium). LinkedIn ne fournit <strong>aucune API publique</strong> permettant de la récupérer automatiquement, quel que soit le niveau de permission demandé.
            <div style={{ marginTop:'10px' }}>
              👉 Consultez-la directement sur{' '}
              <a href="https://www.linkedin.com/me/profile-views/" target="_blank" rel="noopener noreferrer" style={{ color:'#0a66c2', fontWeight:700, textDecoration:'none' }}>
                linkedin.com/me/profile-views →
              </a>
            </div>
          </div>
          <p style={{ fontSize:'.78rem', color:'#6b7280', margin:'14px 0 0', lineHeight:1.6 }}>
            Cet espace regroupe ce que l&apos;API autorise réellement pour un compte personnel. Pour des statistiques d&apos;audience complètes (impressions, démographie des visiteurs, abonnés), il faut une <strong>Page entreprise LinkedIn</strong> connectée via l&apos;API Community Management — structure que l&apos;on pourra ajouter ici le moment venu.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LinkedInPage() {
  return (
    <Suspense>
      <LinkedInContent />
    </Suspense>
  );
}
