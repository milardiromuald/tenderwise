'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────
interface WorkflowStep { name: string; ok: boolean; detail?: string; attempt?: number }

interface Item {
  id: number;
  article_id: number | null;
  token: string;
  subject: string;
  status: string;
  drive_link: string;
  image_url: string;
  is_test: number;
  source: string;
  scheduled_at: string | null;
  created_at: string;
  titre: string | null;
  article_statut: string | null;
  steps_log: string | null;
  channel: string;
}
type Groups = Record<string, Item[]>;

interface Idea {
  id: number;
  titre_propose: string;
  angle_editorial: string;
  sources_trouvees: string[];
  mots_cles: string;
  categorie: string;
  date_generee: string;
}

// État de connexion LinkedIn (pilote les cibles disponibles + l'auteur de l'aperçu)
interface LiStatus { connected: boolean; orgEnabled: boolean; orgUrn: string; orgName: string; personName: string }
// Réglage de partage par article
interface LiShare { share: boolean; target: 'organization' | 'person'; text: string }

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (s?: string | null) =>
  s ? new Date(s.replace(' ', 'T')).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtTime = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// Labels d'étapes (pour le rapport d'échec)
const STEP_LABELS: Record<string, string> = {
  recherche:      'Recherche',
  analyste:       'Analyse',
  redacteur:      'Rédaction',
  'link-checker': 'Liens',
  reviseur:       'Révision',
  qualite:        'Qualité',
  article:        'Rédaction',
  image:          'Image',
  brouillon:      'Sauvegarde',
  drive:          'Drive',
  review:         'Validation',
  email:          'E-mail',
  chat:           'Chat',
};

// ── Composant principal ───────────────────────────────────────────────
export default function ValidationPage() {
  const [groups, setGroups]         = useState<Groups>({});
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busy, setBusy]             = useState<number | null>(null);
  const [ideas, setIdeas]           = useState<Idea[]>([]);
  const [ideaBusy, setIdeaBusy]     = useState<number | null>(null);
  const [genBusy, setGenBusy]       = useState(false);
  const [schedInputs, setSchedInputs] = useState<Record<number, string>>({});
  // ── Partage LinkedIn à la publication (par article) ──
  const [liStatus, setLiStatus] = useState<LiStatus | null>(null);
  const [liInputs, setLiInputs] = useState<Record<number, LiShare>>({});
  // Article dont le modal de partage LinkedIn est ouvert
  const [shareFor, setShareFor] = useState<Item | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ image: string; url: string; title: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async (manual?: boolean) => {
    if (manual) setRefreshing(true);
    try {
      const d = await fetch('/api/workflow').then(r => r.json());
      setGroups(d.groups || {});
      setNeedsMigration(!!d.needsMigration);
      setLastRefresh(new Date());
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { queueMicrotask(load); }, [load]);

  const loadIdeas = useCallback(async () => {
    try {
      const d = await fetch('/api/ideas').then(r => r.json()) as { ideas?: Idea[] };
      setIdeas(d.ideas ?? []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void loadIdeas(); }, [loadIdeas]);

  // Génération manuelle de la veille IA (sinon générée automatiquement par le cron).
  const generate = useCallback(async (force = false) => {
    setGenBusy(true);
    try {
      await fetch(force ? '/api/cron/ideas?force=1' : '/api/cron/ideas').then(r => r.json());
      await loadIdeas();
    } catch { /* ignore */ }
    finally { setGenBusy(false); }
  }, [loadIdeas]);

  const handleIdeaAction = useCallback(async (id: number, action: 'accept' | 'refuse') => {
    setIdeaBusy(id);
    try {
      const res = await fetch(`/api/ideas/${id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(r => r.json()) as { ok?: boolean };
      if (res.ok) {
        setIdeas(prev => prev.filter(i => i.id !== id));
        if (action === 'accept') void load();
      }
    } catch { /* ignore */ }
    finally { setIdeaBusy(null); }
  }, [load]);

  // Statut LinkedIn (connexion + Page entreprise) pour piloter les options de partage
  useEffect(() => {
    fetch('/api/connectors/linkedin/config')
      .then(r => r.json())
      .then((d) => setLiStatus({
        connected:  !!d.connected && !d.expired,
        orgEnabled: !!d.orgEnabled,
        orgUrn:     d.orgUrn || '',
        orgName:    d.orgName || '',
        personName: d.name || '',
      }))
      .catch(() => { /* ignore */ });
  }, []);

  // Réglages de partage par défaut pour un article (cible entreprise si dispo, sinon perso)
  const liGet = useCallback((id: number) => {
    return liInputs[id] || {
      share: false,
      target: (liStatus?.orgEnabled && liStatus?.orgUrn ? 'organization' : 'person') as 'organization' | 'person',
      text: '',
    };
  }, [liInputs, liStatus]);

  const liSet = useCallback((id: number, patch: Partial<LiShare>) => {
    setLiInputs(prev => {
      const cur = prev[id] || { share: false, target: (liStatus?.orgEnabled && liStatus?.orgUrn ? 'organization' : 'person') as 'organization' | 'person', text: '' };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }, [liStatus]);

  // Ouvre le modal de partage et pré-remplit le texte (depuis la même source que le post réel)
  const openShare = useCallback(async (it: Item) => {
    setShareFor(it);
    setPreviewMeta(null);
    setPreviewLoading(true);
    try {
      const d = await fetch(`/api/workflow/linkedin-preview?id=${it.id}`).then(r => r.json());
      if (d?.ok) {
        setPreviewMeta({ image: d.image || it.image_url || '', url: d.url || '', title: d.title || it.titre || '' });
        setLiInputs(prev => {
          const cur = prev[it.id];
          if (cur?.text) return prev; // ne pas écraser une saisie existante
          return {
            ...prev,
            [it.id]: {
              share:  cur?.share ?? false,
              target: cur?.target ?? ((liStatus?.orgEnabled && liStatus?.orgUrn) ? 'organization' : 'person'),
              text:   d.text || '',
            },
          };
        });
      } else {
        setPreviewMeta({ image: it.image_url || '', url: '', title: it.titre || '' });
      }
    } catch {
      setPreviewMeta({ image: it.image_url || '', url: '', title: it.titre || '' });
    } finally {
      setPreviewLoading(false);
    }
  }, [liStatus]);

  // Rafraîchissement temps réel via SSE (mêmes événements que le Workflow)
  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      try {
        es = new EventSource('/api/workflow/stream');
        es.onmessage = e => { if (e.data === 'update') load(); };
        es.onerror = () => { es?.close(); es = null; timer = setTimeout(connect, 3000); };
      } catch { /* ignore */ }
    };
    connect();
    return () => { if (timer) clearTimeout(timer); es?.close(); };
  }, [load]);

  const act = async (id: number, action: string, scheduledAt?: string, liOverride?: LiShare) => {
    setBusy(id);
    try {
      // Pour la publication/programmation, on joint le choix de partage LinkedIn.
      // `liOverride` permet de publier-et-partager directement depuis le modal
      // (l'état `liInputs` serait sinon obsolète juste après sa mise à jour).
      const li = liOverride ?? ((action === 'publish' || action === 'schedule') ? liInputs[id] : undefined);
      const body: Record<string, unknown> = { id, action, scheduledAt };
      if (li) { body.liShare = li.share; body.liTarget = li.target; body.liText = li.text; }
      const res = await fetch('/api/workflow/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()).catch(() => null);
      if (res?.linkedin && !res.linkedin.ok && res.linkedin.error) {
        alert(`Article publié, mais le partage LinkedIn a échoué :\n${res.linkedin.error}`);
      }
      await load();
    } catch { /* ignore */ }
    finally { setBusy(null); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ animation: 'vspin 0.9s linear infinite' }}>
          <style>{`@keyframes vspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Chargement…</span>
      </div>
    );
  }

  const g = (k: string) => groups[k] || [];
  const pending = g('en_attente').length + g('modifie').length;

  return (
    <div style={{ padding: '1.5rem', width: '100%', boxSizing: 'border-box', maxWidth: 1200 }}>
      <style>{`
        @keyframes vspin { from{transform:rotate(0)}to{transform:rotate(360deg)} }
        .v-card  { background:white; border:1px solid #e5e7eb; border-radius:14px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .v-btn   { padding:7px 13px; border:none; border-radius:8px; font-weight:700; font-size:0.78rem; cursor:pointer; font-family:Montserrat,sans-serif; display:inline-flex; align-items:center; gap:6px; text-decoration:none; transition:opacity .15s; }
        .v-btn:disabled { opacity:.5; cursor:not-allowed; }
        .v-input { padding:7px 10px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:0.8rem; outline:none; color:#111827; background:white; }
        .v-row { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
      `}</style>

      {/* En-tête */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1.4rem', fontWeight: 800, color: '#003366', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'linear-gradient(135deg,#004a99,#0a66c2)', borderRadius: 9, padding: 7, display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            </span>
            À valider
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
            Validez, programmez et publiez vos articles — avec partage LinkedIn direct.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {lastRefresh && (
            <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
              {fmtTime(lastRefresh)}<span style={{ color: '#0a66c2', fontWeight: 600 }}> · temps réel</span>
            </span>
          )}
          <button onClick={() => load(true)} disabled={refreshing} className="v-btn"
            style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: refreshing ? 'vspin 0.9s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Rafraîchir
          </button>
        </div>
      </div>

      {needsMigration && (
        <div style={{ marginBottom: '1.25rem', padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.85rem' }}>
          ⚠️ Tables du workflow non créées ou non migrées — exécutez <code>schema-workflow.sql</code> dans phpMyAdmin.
        </div>
      )}

      {/* ── Idées à valider ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a73e8', flexShrink: 0 }} />
          <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '0.93rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            Idées à valider
          </h2>
          <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 10 }}>
            {ideas.length}
          </span>
          <button onClick={() => void generate(false)} disabled={genBusy} className="v-btn"
            style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#004a99,#1a73e8)', color: 'white' }}>
            {genBusy ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'vspin 0.9s linear infinite' }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
              </svg> Génération…</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/></svg> Générer des idées</>
            )}
          </button>
        </div>
        {ideas.length === 0 ? (
          <div className="v-card" style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.82rem' }}>
            Aucune idée en attente. Cliquez sur « Générer des idées » pour lancer la veille IA (sinon elles sont générées automatiquement chaque jour).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ideas.map(idea => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                busy={ideaBusy === idea.id}
                onAccept={() => void handleIdeaAction(idea.id, 'accept')}
                onRefuse={() => void handleIdeaAction(idea.id, 'refuse')}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Sections ── */}
      <Section title="En attente de validation" color="#d97706" count={g('en_attente').length}
        empty="Rien à valider pour le moment.">
        {g('en_attente').map(it => (
          <Row key={it.id} it={it} busy={busy}>
            <Link className="v-btn" href={`/admin/workflow/review/${it.token}?from=validation`}
              style={{ background: '#004a99', color: 'white' }}>
              Ouvrir la validation
            </Link>
          </Row>
        ))}
      </Section>

      {g('modifie').length > 0 && (
        <Section title="En attente de modification" color="#1e40af" count={g('modifie').length} empty="">
          {g('modifie').map(it => (
            <Row key={it.id} it={it} busy={busy}>
              <Link className="v-btn" href={`/admin/workflow/review/${it.token}?from=validation`}
                style={{ background: '#004a99', color: 'white' }}>
                Reprendre
              </Link>
            </Row>
          ))}
        </Section>
      )}

      <Section title="Validés — en attente de programmation" color="#059669" count={g('valide').length}
        empty="Aucun article validé en attente.">
        {g('valide').map(it => (
          <Row key={it.id} it={it} busy={busy}>
            <ShareCheckbox
              share={liGet(it.id)}
              onOpen={() => openShare(it)}
              onToggle={checked => { if (checked) openShare(it); else liSet(it.id, { share: false }); }}
            />
            <input type="datetime-local" className="v-input"
              value={schedInputs[it.id] || ''}
              onChange={e => setSchedInputs(p => ({ ...p, [it.id]: e.target.value }))} />
            <button className="v-btn" style={{ background: '#1e40af', color: 'white' }}
              disabled={busy === it.id || !schedInputs[it.id]}
              onClick={() => act(it.id, 'schedule', schedInputs[it.id])}>
              Programmer
            </button>
            <button className="v-btn" style={{ background: '#0f766e', color: 'white' }}
              disabled={busy === it.id} onClick={() => act(it.id, 'publish')}>
              Publier maintenant
            </button>
            <button className="v-btn" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
              disabled={busy === it.id} onClick={() => act(it.id, 'reject')}>
              Refuser
            </button>
          </Row>
        ))}
      </Section>

      <Section title="Programmés" color="#1e40af" count={g('programme').length}
        empty="Aucune publication programmée.">
        {g('programme').map(it => (
          <Row key={it.id} it={it} busy={busy} highlight={`📅 Publication prévue : ${fmt(it.scheduled_at)}`}>
            <button className="v-btn" style={{ background: '#0f766e', color: 'white' }}
              disabled={busy === it.id} onClick={() => act(it.id, 'publish')}>
              Publier maintenant
            </button>
            <button className="v-btn" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
              disabled={busy === it.id} onClick={() => act(it.id, 'unschedule')}>
              Déprogrammer
            </button>
          </Row>
        ))}
      </Section>

      <Section title="Publiés" color="#0f766e" count={g('publie').length}
        empty="Aucun article publié via le workflow." collapsed>
        {g('publie').map(it => (
          <Row key={it.id} it={it} busy={busy}>
            {it.article_id && (
              <Link className="v-btn" href={`/admin/articles/${it.article_id}?from=validation`}
                style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
                Voir l&apos;article
              </Link>
            )}
          </Row>
        ))}
      </Section>

      {g('refuse').length > 0 && (
        <Section title="Refusés / Échecs" color="#991b1b" count={g('refuse').length} empty="" collapsed>
          {g('refuse').map(it => <RefuseRow key={it.id} it={it} busy={busy} act={act} />)}
        </Section>
      )}

      {/* Pied : lien vers le pipeline */}
      <div className="v-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#fafafa' }}>
        <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
          {pending === 0 ? 'Aucun contenu en attente de votre décision.' : `${pending} contenu${pending > 1 ? 's' : ''} en attente de votre décision.`}
        </span>
        <Link className="v-btn" href="/admin/workflow" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
          Voir le pipeline complet →
        </Link>
      </div>

      {/* ── Modal de partage LinkedIn (cible + texte + aperçu live) ── */}
      {shareFor && (
        <LinkedInShareModal
          item={shareFor}
          value={liGet(shareFor.id)}
          liStatus={liStatus}
          preview={previewMeta}
          loading={previewLoading}
          busy={busy === shareFor.id}
          onChange={patch => liSet(shareFor.id, patch)}
          onClose={() => setShareFor(null)}
          onSave={() => { liSet(shareFor.id, { share: true }); setShareFor(null); }}
          onPublish={() => {
            const id = shareFor.id;
            const cur: LiShare = { ...liGet(id), share: true };
            liSet(id, { share: true });
            setShareFor(null);
            act(id, 'publish', undefined, cur);
          }}
        />
      )}
    </div>
  );
}

// ── Carte idée à valider ─────────────────────────────────────────────
const CAT_IDEA_COLORS: Record<string, { bg: string; color: string }> = {
  'Réglementation chantier': { bg: '#fef3c7', color: '#92400e' },
  'Sécurité BTP':            { bg: '#fee2e2', color: '#991b1b' },
  'AMO':                     { bg: '#dbeafe', color: '#1e40af' },
  "Maîtrise d'œuvre":        { bg: '#ede9fe', color: '#5b21b6' },
  'Marchés privés':          { bg: '#d1fae5', color: '#065f46' },
  'Marchés publics':         { bg: '#dcfce7', color: '#14532d' },
  'Facility management':     { bg: '#fce7f3', color: '#9d174d' },
  'Jurisprudence':           { bg: '#fef9c3', color: '#713f12' },
  'Réglementation bâtiment': { bg: '#e0f2fe', color: '#0c4a6e' },
  'Actualités':              { bg: '#f3f4f6', color: '#374151' },
};

function IdeaRow({ idea, busy, onAccept, onRefuse }: {
  idea: Idea; busy: boolean; onAccept: () => void; onRefuse: () => void;
}) {
  const cat = CAT_IDEA_COLORS[idea.categorie] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <div className="v-card" style={{ padding: '12px 16px', opacity: busy ? 0.6 : 1, transition: 'opacity .15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        {/* Icône */}
        <div style={{ width: 38, height: 38, borderRadius: 9, background: 'linear-gradient(135deg,#004a99,#1a73e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/>
          </svg>
        </div>
        {/* Corps */}
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* Catégorie + mots-clés */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ background: cat.bg, color: cat.color, fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>
              {idea.categorie}
            </span>
            {idea.mots_cles && (
              <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{idea.mots_cles}</span>
            )}
          </div>
          {/* Titre */}
          <div style={{ fontSize: '0.87rem', fontWeight: 700, color: '#111827', lineHeight: 1.4, marginBottom: 6 }}>
            {idea.titre_propose}
          </div>
          {/* Angle */}
          <div style={{ fontSize: '0.79rem', color: '#374151', lineHeight: 1.55, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 10px' }}>
            {idea.angle_editorial}
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignSelf: 'center' }}>
          <button onClick={onAccept} disabled={busy} className="v-btn"
            style={{ background: 'linear-gradient(135deg,#004a99,#1a73e8)', color: 'white', whiteSpace: 'nowrap' }}>
            {busy ? (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'vspin 0.9s linear infinite' }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
              </svg> Lancement…</>
            ) : (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Générer l&apos;article</>
            )}
          </button>
          <button onClick={onRefuse} disabled={busy} className="v-btn"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section collapsible ───────────────────────────────────────────────
function Section({ title, color, count, empty, collapsed, children }: {
  title: string; color: string; count: number; empty: string;
  collapsed?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: open ? '0.6rem' : 0, padding: '4px 0' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '0.93rem', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
        <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: '10px' }}>{count}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
          style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && (count === 0
        ? (empty ? <div className="v-card" style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.82rem' }}>{empty}</div> : null)
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
      )}
    </div>
  );
}

// ── Case à cocher « Partager sur LinkedIn » (cocher → ouvre le modèle) + état ──
function ShareCheckbox({
  share, onOpen, onToggle,
}: {
  share: LiShare;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
}) {
  const liIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zM8.34 17V9.99H6.01V17h2.33zM7.17 8.95c.75 0 1.36-.62 1.36-1.38a1.37 1.37 0 10-2.74 0c0 .76.61 1.38 1.38 1.38zM18 17v-3.84c0-2.06-1.1-3.02-2.57-3.02-1.19 0-1.72.65-2.02 1.11v-.95h-2.32V17h2.32v-3.93c0-.21.02-.41.08-.56.16-.41.54-.84 1.17-.84.83 0 1.16.63 1.16 1.55V17H18z"/></svg>
  );
  const active = share.share;
  const cible = share.target === 'organization' ? 'Page entreprise' : 'Compte perso';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {/* Cocher ouvre le modèle (aperçu + texte éditable) ; décocher désactive le partage */}
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        border: `1.5px solid ${active ? '#0a66c2' : '#cfe2f6'}`,
        background: active ? '#eef5fc' : 'white',
        color: '#0a66c2', borderRadius: 8, padding: '5px 10px',
        fontSize: '0.76rem', fontWeight: 700,
      }}>
        <input
          type="checkbox"
          checked={active}
          onChange={e => onToggle(e.target.checked)}
          style={{ accentColor: '#0a66c2', width: 16, height: 16, cursor: 'pointer', margin: 0 }}
        />
        {liIcon}
        Partager sur LinkedIn
      </label>
      {active && (
        <>
          <span style={{ fontSize: '0.72rem', color: '#0a66c2', fontWeight: 600 }}>· {cible}</span>
          <button onClick={onOpen} className="v-btn" style={{ background: 'white', color: '#0a66c2', border: '1px solid #cfe2f6' }}>
            Modifier
          </button>
        </>
      )}
    </span>
  );
}

// ── Avatar à initiales (auteur de l'aperçu) ──────────────────────────────────
function Avatar({ name, color }: { name: string; color: string }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
  return (
    <div style={{ width: 48, height: 48, borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// Rend le texte du post avec liens et hashtags surlignés (aperçu fidèle).
function renderPostText(text: string): ReactNode {
  if (!text) return <span style={{ color: '#9ca3af' }}>Votre texte apparaîtra ici…</span>;
  return text.split(/(\s+)/).map((tok, i) => {
    if (/^https?:\/\//.test(tok)) return <span key={i} style={{ color: '#0a66c2' }}>{tok}</span>;
    if (/^#[\p{L}\d]+$/u.test(tok)) return <span key={i} style={{ color: '#0a66c2', fontWeight: 600 }}>{tok}</span>;
    return <span key={i}>{tok}</span>;
  });
}

// ── Modal de partage LinkedIn : configuration (cible + texte) + aperçu live ───
function LinkedInShareModal({
  item, value, liStatus, preview, loading, busy, onChange, onClose, onSave, onPublish,
}: {
  item: Item;
  value: LiShare;
  liStatus: LiStatus | null;
  preview: { image: string; url: string; title: string } | null;
  loading: boolean;
  busy: boolean;
  onChange: (patch: Partial<LiShare>) => void;
  onClose: () => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  // Fermeture à la touche Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const connected = !!liStatus?.connected;
  const orgReady  = !!(liStatus?.orgEnabled && liStatus?.orgUrn);

  const isOrg = value.target === 'organization';
  const authorName = isOrg
    ? (liStatus?.orgName || 'Votre page entreprise')
    : (liStatus?.personName || 'Votre profil');
  const authorSub  = isOrg ? 'Entreprise · maintenant' : 'Vous · maintenant';
  const authorColor = isOrg ? '#0a66c2' : '#047857';

  const image = preview?.image || item.image_url || '';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <style>{`
        .li-modal   { width: 920px; max-width: 96vw; max-height: 92vh; display: flex; flex-direction: column; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
        .li-body    { display: flex; flex: 1; min-height: 0; }
        .li-pane    { flex: 1 1 0; min-width: 0; overflow-y: auto; }
        .li-edit    { padding: 18px 20px; }
        .li-preview { padding: 18px 20px; background: #f3f6f8; border-left: 1px solid #e5e7eb; }
        .li-tabs    { display: none; }
        @media (max-width: 760px) {
          .li-body  { flex-direction: column; }
          .li-preview { border-left: none; border-top: 1px solid #e5e7eb; }
          .li-tabs  { display: flex; }
          .li-modal.show-edit    .li-preview { display: none; }
          .li-modal.show-preview .li-edit    { display: none; }
        }
      `}</style>

      <div className={`li-modal show-${mobileTab}`} onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid #eef0f3' }}>
          <span style={{ background: '#0a66c2', borderRadius: 8, padding: 6, display: 'flex', color: 'white' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zM8.34 17V9.99H6.01V17h2.33zM7.17 8.95c.75 0 1.36-.62 1.36-1.38a1.37 1.37 0 10-2.74 0c0 .76.61 1.38 1.38 1.38zM18 17v-3.84c0-2.06-1.1-3.02-2.57-3.02-1.19 0-1.72.65-2.02 1.11v-.95h-2.32V17h2.32v-3.93c0-.21.02-.41.08-.56.16-.41.54-.84 1.17-.84.83 0 1.16.63 1.16 1.55V17H18z"/></svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>Partager sur LinkedIn</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.titre || item.subject || 'Article'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ all: 'unset', cursor: 'pointer', color: '#9ca3af', fontSize: '1.2rem', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Bascule Éditer / Aperçu (mobile uniquement) */}
        <div className="li-tabs" style={{ borderBottom: '1px solid #eef0f3' }}>
          {(['edit', 'preview'] as const).map(t => (
            <button key={t} onClick={() => setMobileTab(t)}
              style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, fontSize: '0.8rem',
                background: mobileTab === t ? 'white' : '#f3f6f8',
                color: mobileTab === t ? '#0a66c2' : '#6b7280',
                borderBottom: mobileTab === t ? '2px solid #0a66c2' : '2px solid transparent' }}>
              {t === 'edit' ? 'Éditer' : 'Aperçu'}
            </button>
          ))}
        </div>

        {/* Corps : édition + aperçu */}
        <div className="li-body">
          {/* ── Édition ── */}
          <div className="li-pane li-edit">
            {!connected && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.78rem' }}>
                LinkedIn non connecté — connectez le compte dans <a href="/admin/linkedin" style={{ color: '#0a66c2' }}>Connecteurs → LinkedIn</a> pour publier.
              </div>
            )}

            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>Publier en tant que</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: orgReady ? 'pointer' : 'not-allowed', opacity: orgReady ? 1 : 0.5, border: `1.5px solid ${isOrg ? '#0a66c2' : '#e5e7eb'}`, background: isOrg ? '#eef5fc' : 'white', borderRadius: 10, padding: '10px 12px' }}>
                <input type="radio" checked={isOrg} disabled={!orgReady} onChange={() => onChange({ target: 'organization' })} />
                <span style={{ fontSize: '1.1rem' }}>🏢</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>
                  Page entreprise{liStatus?.orgName ? ` · ${liStatus.orgName}` : ''}
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: `1.5px solid ${!isOrg ? '#0a66c2' : '#e5e7eb'}`, background: !isOrg ? '#eef5fc' : 'white', borderRadius: 10, padding: '10px 12px' }}>
                <input type="radio" checked={!isOrg} onChange={() => onChange({ target: 'person' })} />
                <span style={{ fontSize: '1.1rem' }}>👤</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>
                  Compte perso{liStatus?.personName ? ` · ${liStatus.personName}` : ''}
                </span>
              </label>
              {!orgReady && (
                <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0 }}>
                  Page entreprise non configurée — activez-la dans <a href="/admin/linkedin" style={{ color: '#0a66c2' }}>Connecteurs → LinkedIn</a>.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>Texte du post</span>
              {loading && <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>Pré-remplissage…</span>}
            </div>
            <textarea
              value={value.text}
              onChange={e => onChange({ text: e.target.value })}
              placeholder="Texte auto (titre + extrait + lien + hashtags). Modifiez librement votre accroche."
              rows={10}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.82rem', lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit', color: '#111827', background: 'white' }}
            />
            <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '6px 0 0' }}>
              {value.text.length} caractères · l’image de l’article est jointe automatiquement.
            </p>
          </div>

          {/* ── Aperçu ── */}
          <div className="li-pane li-preview">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Aperçu du post
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              {/* Auteur */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 8px' }}>
                <Avatar name={authorName} color={authorColor} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authorName}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{authorSub} · 🌐</div>
                </div>
              </div>
              {/* Texte */}
              <div style={{ padding: '4px 14px 12px', fontSize: '0.82rem', color: '#1f2937', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {renderPostText(value.text)}
              </div>
              {/* Image */}
              {image
                ? <img src={image} alt="" style={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'cover', borderTop: '1px solid #eef0f3' }} />
                : <div style={{ padding: '18px 14px', background: '#f8fafc', borderTop: '1px solid #eef0f3', fontSize: '0.74rem', color: '#9ca3af', textAlign: 'center' }}>Aucune image jointe</div>}
              {/* Barre de réactions (mock) */}
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0', borderTop: '1px solid #eef0f3', color: '#6b7280', fontSize: '0.74rem', fontWeight: 600 }}>
                <span>👍 J’aime</span><span>💬 Commenter</span><span>↗ Partager</span>
              </div>
            </div>
            <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: '10px 0 0' }}>
              Rendu indicatif. L’affichage réel peut légèrement varier selon LinkedIn.
            </p>
          </div>
        </div>

        {/* Pied : actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', padding: '12px 20px', borderTop: '1px solid #eef0f3', background: '#fafafa' }}>
          <button onClick={onClose} className="v-btn" style={{ background: 'white', color: '#374151', border: '1px solid #e5e7eb' }}>
            Annuler
          </button>
          <button onClick={onPublish} disabled={!connected || busy} className="v-btn" style={{ background: 'white', color: '#0a66c2', border: '1.5px solid #0a66c2' }}>
            {busy ? 'Publication…' : 'Publier et partager maintenant'}
          </button>
          <button onClick={onSave} disabled={!connected} className="v-btn" style={{ background: '#0a66c2', color: 'white' }}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row article ───────────────────────────────────────────────────────
function Row({ it, busy, highlight, children }: { it: Item; busy: number | null; highlight?: string; children?: ReactNode }) {
  return (
    <div className="v-card v-row" style={{ padding: '12px 16px', opacity: busy === it.id ? 0.6 : 1 }}>
      {it.image_url
        ? <img src={it.image_url} alt="" style={{ width: '52px', height: '36px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
        : <div style={{ width: '52px', height: '36px', borderRadius: '6px', background: '#f1f5f9', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {it.titre || it.subject || 'Sans titre'}
          {it.is_test === 1 && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '8px' }}>TEST</span>}
          <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '8px' }}>{it.source}</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>
          {fmt(it.created_at)}
          {it.drive_link && <> · <a href={it.drive_link} target="_blank" rel="noopener noreferrer" style={{ color: '#004a99' }}>Drive</a></>}
        </div>
        {highlight && <div style={{ fontSize: '0.73rem', color: '#1e40af', marginTop: '3px', fontWeight: 600 }}>{highlight}</div>}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
    </div>
  );
}

// ── Refusé row ───────────────────────────────────────────────────────
function RefuseRow({ it, busy, act }: { it: Item; busy: number | null; act: (id: number, action: string) => void }) {
  const [open, setOpen] = useState(false);
  const steps: WorkflowStep[] = (() => {
    try { return it.steps_log ? JSON.parse(it.steps_log) as WorkflowStep[] : []; } catch { return []; }
  })();
  return (
    <div className="v-card" style={{ padding: '12px 16px', opacity: busy === it.id ? 0.6 : 0.85 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 36, borderRadius: '6px', background: '#fef2f2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {it.titre || it.subject || 'Sans titre'}
            {it.is_test === 1 && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '8px' }}>TEST</span>}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>Créé le {fmt(it.created_at)}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {steps.length > 0 && (
            <button onClick={() => setOpen(o => !o)} className="v-btn"
              style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: '0.72rem' }}>
              {open ? 'Masquer' : "Rapport d'échec"}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          )}
          <button onClick={() => { if (confirm('Supprimer définitivement : ' + (it.titre || it.subject || 'cet article') + ' ?')) act(it.id, 'delete'); }}
            disabled={busy === it.id} className="v-btn"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '0.72rem' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Supprimer
          </button>
        </div>
      </div>
      {open && steps.length > 0 && (
        <div style={{ marginTop: '10px', padding: '10px 12px', background: '#fef2f2', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem' }}>
              <span style={{ color: s.ok ? '#16a34a' : '#dc2626', fontWeight: 700, flexShrink: 0 }}>{s.ok ? '✓' : '✗'}</span>
              <span style={{ color: '#374151', fontWeight: 600, flexShrink: 0 }}>{STEP_LABELS[s.name] ?? s.name}</span>
              {s.detail && <span style={{ color: '#6b7280', wordBreak: 'break-word' }}>— {s.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
