'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ConnConfig {
  hasClientId: boolean;
  hasClientSecret: boolean;
  maskedClientId: string;
  connected: boolean;
  email: string;
  scopes: string[];
  folderId: string;
  connectedAt: string;
  redirectUri: string;
}

interface WebhookLogEntry {
  at: string;
  auth: string;
  configuredAud: string;
  receivedAud?: string;
  receivedIss?: string;
  mode?: string;
  type: string;
  space: string;
  subject: string;
  status: 'ok' | 'blocked' | 'auth_failed' | 'error';
  detail: string;
}

interface ChatConfig {
  audience: string;
  space: string;
  notifyEmail: string;
  effectiveEmail: string;
  configured: boolean;
  botReady: boolean;
  spaceFormatOk: boolean;
  appWebhookUrl: string;
  hasIncomingWebhook: boolean;
  maskedIncomingWebhook: string;
  webhookLog: WebhookLogEntry[];
  saveDrive: boolean;
  sendEmail: boolean;
  sendChat: boolean;
}

interface WorkflowStep { name: string; ok: boolean; detail?: string }
interface WorkflowResult {
  ok: boolean;
  title?: string;
  reviewUrl?: string;
  emailTo?: string;
  emailSent?: boolean;
  driveLink?: string;
  error?: string;
  steps: WorkflowStep[];
}

type TestState = { status: 'idle' | 'running' | 'success' | 'error'; msg?: string; link?: string };

const ERROR_MESSAGES: Record<string, string> = {
  no_client: "Configurez d’abord le Client ID et le Secret OAuth ci-dessous.",
  invalid_state: "Échec de vérification de sécurité (state). Relancez la connexion.",
  no_refresh_token: "Google n’a pas renvoyé de jeton de rafraîchissement. Révoquez l’accès sur myaccount.google.com/permissions puis reconnectez.",
  access_denied: "Autorisation refusée par Google.",
  missing_code: "Code d’autorisation manquant.",
  token_exchange_failed: "Échec de l’échange du code d’autorisation. Vérifiez le Client Secret et l’URI de redirection.",
};

const SECTION_META: Record<string, { title: string; description: string }> = {
  workspace:  { title: 'Google Workspace',         description: 'Connectez Gmail (envoi d\'e-mails) et Google Drive (stockage des articles).' },
  chat:       { title: 'Google Chat',               description: 'Configurez le bot Google Chat pour déclencher la génération d\'articles.' },
  workflow:   { title: 'Workflow & Test',            description: 'Paramètres d\'e-mail de notification et test complet du workflow.' },
};

/** Ligne avec interrupteur on/off pour activer une action du workflow */
function SwitchRow({ icon, iconBg, title, desc, checked, onChange, busy, accent }: {
  icon: React.ReactNode; iconBg: string; title: string; desc: string;
  checked: boolean; onChange: (v: boolean) => void; busy: boolean; accent: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', background: checked ? '#ffffff' : '#fafafa', transition: 'background .15s' }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: checked ? 1 : 0.55 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{desc}</div>
      </div>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: checked ? accent : '#9ca3af', minWidth: 52, textAlign: 'right' }}>
        {busy ? '…' : checked ? 'Activé' : 'Désactivé'}
      </span>
      <button
        type="button" role="switch" aria-checked={checked} disabled={busy}
        onClick={() => onChange(!checked)}
        style={{ position: 'relative', width: 46, height: 26, borderRadius: 20, border: 'none', cursor: busy ? 'wait' : 'pointer', background: checked ? accent : '#cbd5e1', transition: 'background .15s', flexShrink: 0, padding: 0 }}
      >
        <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
      </button>
    </div>
  );
}

function ConnectorsContent() {
  const searchParams = useSearchParams();
  const activeSection = searchParams.get('s') || 'workspace';

  const [cfg, setCfg] = useState<ConnConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [folderId, setFolderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  // ── Google Chat
  const [chatCfg, setChatCfg] = useState<ChatConfig | null>(null);
  const [chatAudience, setChatAudience] = useState('');
  const [chatSpace, setChatSpace] = useState('');
  const [chatSaving, setChatSaving] = useState(false);
  const [chatSaved, setChatSaved] = useState(false);
  const [appUrlCopied, setAppUrlCopied] = useState(false);
  const [deletingBot, setDeletingBot] = useState(false);
  const [botTesting, setBotTesting] = useState(false);
  const [botTestResult, setBotTestResult] = useState<WorkflowResult | null>(null);
  const [botVerified, setBotVerified] = useState(false);
  // Webhook entrant
  const [incomingWebhook, setIncomingWebhook] = useState('');
  const [incomingWHSaving, setIncomingWHSaving] = useState(false);
  const [incomingWHSaved, setIncomingWHSaved] = useState(false);
  const [incomingWHTesting, setIncomingWHTesting] = useState(false);
  const [incomingWHTestResult, setIncomingWHTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [deletingIncoming, setDeletingIncoming] = useState(false);

  // ── Workflow
  const [notifyEmail, setNotifyEmail] = useState('');
  const [wfSaving, setWfSaving] = useState(false);
  const [wfSaved, setWfSaved] = useState(false);
  const [wfTesting, setWfTesting] = useState(false);
  const [wfResult, setWfResult] = useState<WorkflowResult | null>(null);
  // Interrupteurs fins du workflow
  const [flagDrive, setFlagDrive] = useState(true);
  const [flagEmail, setFlagEmail] = useState(true);
  const [flagChat, setFlagChat] = useState(false);
  const [flagSaving, setFlagSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, c]: [ConnConfig, ChatConfig] = await Promise.all([
        fetch('/api/connectors/google/config').then(r => r.json()),
        fetch('/api/connectors/google-chat/config').then(r => r.json()),
      ]);
      setCfg(d);
      setFolderId(d.folderId || '');
      setChatCfg(c);
      setChatAudience(c.audience || '');
      setChatSpace(c.space || '');
      setNotifyEmail(c.notifyEmail || '');
      setFlagDrive(c.saveDrive ?? true);
      setFlagEmail(c.sendEmail ?? true);
      setFlagChat(c.sendChat ?? false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') setNotice({ type: 'success', text: 'Google Workspace connecté avec succès.' });
    const err = params.get('error');
    if (err) setNotice({ type: 'error', text: ERROR_MESSAGES[err] || `Erreur : ${err}` });
    if (params.get('connected') || err) {
      window.history.replaceState({}, '', '/admin/connectors');
    }
    load();
  }, [load]);

  const saveCreds = async () => {
    setSaving(true);
    try {
      await fetch('/api/connectors/google/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId || undefined, clientSecret: clientSecret || undefined, folderId }),
      });
      setClientId('');
      setClientSecret('');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
      await load();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const disconnect = async () => {
    if (!confirm('Déconnecter Google Workspace ? Les identifiants OAuth seront conservés.')) return;
    await fetch('/api/connectors/google/config', { method: 'DELETE' });
    setTests({});
    await load();
  };

  const runTest = async (action: 'profile' | 'gmail' | 'drive') => {
    setTests(p => ({ ...p, [action]: { status: 'running' } }));
    try {
      const d = await fetch('/api/connectors/google/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(r => r.json());
      setTests(p => ({ ...p, [action]: { status: d.success ? 'success' : 'error', msg: d.result || d.error, link: d.link } }));
    } catch (e) {
      setTests(p => ({ ...p, [action]: { status: 'error', msg: e instanceof Error ? e.message : 'Erreur réseau' } }));
    }
  };

  const copyRedirect = () => {
    if (!cfg?.redirectUri) return;
    navigator.clipboard?.writeText(cfg.redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveBotChat = async () => {
    setChatSaving(true);
    setBotVerified(false);
    setBotTestResult(null);
    try {
      await fetch('/api/connectors/google-chat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience: chatAudience, space: chatSpace }),
      });
      setChatSaved(true);
      setTimeout(() => setChatSaved(false), 3000);
      await load();
    } catch { /* ignore */ }
    finally { setChatSaving(false); }
  };

  const testBotTrigger = async () => {
    setBotTesting(true);
    setBotTestResult(null);
    try {
      const r: WorkflowResult = await fetch('/api/connectors/workflow/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'Test déclencheur bot Chat' }),
      }).then(res => res.json());
      setBotTestResult(r);
      if (r.ok) setBotVerified(true);
    } catch (e) {
      setBotTestResult({ ok: false, error: e instanceof Error ? e.message : 'Erreur réseau', steps: [] });
    } finally {
      setBotTesting(false);
    }
  };

  const deleteBotChat = async () => {
    if (!confirm('Supprimer la configuration du bot Chat (Audience + ID espace) ?')) return;
    setDeletingBot(true);
    try {
      await fetch('/api/connectors/google-chat/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'bot' }),
      });
      setChatAudience('');
      setChatSpace('');
      await load();
    } catch { /* ignore */ }
    finally { setDeletingBot(false); }
  };

  const copyAppUrl = () => {
    if (!chatCfg?.appWebhookUrl) return;
    navigator.clipboard?.writeText(chatCfg.appWebhookUrl);
    setAppUrlCopied(true);
    setTimeout(() => setAppUrlCopied(false), 2000);
  };

  const saveIncomingWebhook = async () => {
    if (!incomingWebhook.trim()) return;
    setIncomingWHSaving(true);
    try {
      await fetch('/api/connectors/google-chat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incomingWebhook: incomingWebhook.trim() }),
      });
      setIncomingWebhook('');
      setIncomingWHSaved(true);
      setIncomingWHTestResult(null);
      setTimeout(() => setIncomingWHSaved(false), 3000);
      await load();
    } catch { /* ignore */ }
    finally { setIncomingWHSaving(false); }
  };

  const deleteIncomingWebhook = async () => {
    if (!confirm('Supprimer ce webhook entrant ?')) return;
    setDeletingIncoming(true);
    try {
      await fetch('/api/connectors/google-chat/config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'incoming' }),
      });
      setIncomingWHTestResult(null);
      await load();
    } catch { /* ignore */ }
    finally { setDeletingIncoming(false); }
  };

  const testIncomingWebhook = async () => {
    setIncomingWHTesting(true);
    setIncomingWHTestResult(null);
    try {
      const r = await fetch('/api/connectors/google-chat/test', { method: 'POST' }).then(res => res.json());
      setIncomingWHTestResult(r);
    } catch (e) {
      setIncomingWHTestResult({ ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' });
    } finally {
      setIncomingWHTesting(false);
    }
  };

  const saveWorkflow = async () => {
    setWfSaving(true);
    try {
      await fetch('/api/connectors/google-chat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEmail }),
      });
      setWfSaved(true);
      setTimeout(() => setWfSaved(false), 3000);
      await load();
    } catch { /* ignore */ }
    finally { setWfSaving(false); }
  };

  // Bascule un interrupteur du workflow (Drive / e-mail / Chat) et persiste immédiatement
  const toggleFlag = async (key: 'saveDrive' | 'sendEmail' | 'sendChat', value: boolean) => {
    if (key === 'saveDrive') setFlagDrive(value);
    if (key === 'sendEmail') setFlagEmail(value);
    if (key === 'sendChat')  setFlagChat(value);
    setFlagSaving(key);
    try {
      await fetch('/api/connectors/google-chat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      await load();
    } catch { /* ignore */ }
    finally { setFlagSaving(null); }
  };

  const testWorkflow = async () => {
    setWfTesting(true);
    setWfResult(null);
    try {
      const r: WorkflowResult = await fetch('/api/connectors/workflow/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'Test du workflow TenderWise' }),
      }).then(res => res.json());
      setWfResult(r);
    } catch (e) {
      setWfResult({ ok: false, error: e instanceof Error ? e.message : 'Erreur réseau', steps: [] });
    } finally {
      setWfTesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ animation: 'spin 0.9s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3" /><path d="M21 12a9 9 0 00-9-9" />
        </svg>
        <style>{`@keyframes spin { from { transform:rotate(0deg);} to { transform:rotate(360deg);} }`}</style>
      </div>
    );
  }

  const connected = cfg?.connected ?? false;
  const hasClient = (cfg?.hasClientId && cfg?.hasClientSecret) ?? false;
  const meta = SECTION_META[activeSection] || SECTION_META.workspace;

  return (
    <div style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes spin { from { transform:rotate(0deg);} to { transform:rotate(360deg);} }
        .conn-card { background:white; border-radius:12px; border:1px solid #e5e7eb; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
        .conn-input { width:100%; padding:10px 14px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:0.88rem; outline:none; box-sizing:border-box; background:white; color:#111827; transition:border-color .15s, box-shadow .15s; }
        .conn-input:focus { border-color:#004a99; box-shadow:0 0 0 3px rgba(0,74,153,.1); }
        .conn-btn { padding:9px 18px; border:none; border-radius:7px; font-weight:700; font-size:0.85rem; cursor:pointer; font-family:Montserrat,sans-serif; transition:all .15s; display:inline-flex; align-items:center; gap:8px; white-space:nowrap; text-decoration:none; }
        .conn-btn:disabled { opacity:.5; cursor:not-allowed; }
        .conn-btn-primary { background:#004a99; color:white; } .conn-btn-primary:hover:not(:disabled){ background:#003a80; }
        .conn-btn-google { background:white; color:#3c4043; border:1px solid #dadce0; } .conn-btn-google:hover { background:#f8f9fa; box-shadow:0 1px 3px rgba(60,64,67,.15); }
        .conn-btn-secondary { background:#f3f4f6; color:#374151; border:1px solid #e5e7eb; } .conn-btn-secondary:hover:not(:disabled){ background:#e5e7eb; }
        .conn-btn-danger { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; } .conn-btn-danger:hover { background:#fee2e2; }
        .conn-label { display:block; font-size:0.72rem; font-weight:700; color:#374151; margin-bottom:5px; text-transform:uppercase; letter-spacing:.05em; }
      `}</style>

      {/* Title */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1.5rem', fontWeight: 800, color: '#003366', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'linear-gradient(135deg,#004a99,#0369a1)', borderRadius: '8px', padding: '7px', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
          </span>
          {meta.title}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{meta.description}</p>
      </div>

      {/* Notice */}
      {notice && (
        <div style={{
          marginBottom: '1.5rem', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '10px',
          background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notice.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          color: notice.type === 'success' ? '#065f46' : '#991b1b',
        }}>
          {notice.type === 'success'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
          {notice.text}
        </div>
      )}

      {/* ══ SECTION: WORKSPACE ══ */}
      {activeSection === 'workspace' && (
        <>
          <div className="conn-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="30" height="30" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" /><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" /><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 002 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" /><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" /></svg>
                <div>
                  <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1.05rem', fontWeight: 800, color: '#111827', margin: 0 }}>Google Workspace</h2>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>Gmail (envoi) &amp; Drive (stockage des articles)</p>
                </div>
              </div>
              {connected ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                  Connecté
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', color: '#6b7280', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                  Non connecté
                </span>
              )}
            </div>

            <div style={{ padding: '1.5rem' }}>
              {connected ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#004a99', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                      {(cfg?.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg?.email || 'Compte Google'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                        Connecté {cfg?.connectedAt ? `le ${new Date(cfg.connectedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <span className="conn-label">Permissions accordées</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {[
                        { ok: cfg?.scopes.some(s => s.includes('gmail')), label: "Gmail — envoi d’e-mails" },
                        { ok: cfg?.scopes.some(s => s.includes('drive')), label: "Drive — fichiers de l’app" },
                      ].map(s => (
                        <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', background: s.ok ? '#ecfdf5' : '#f3f4f6', color: s.ok ? '#065f46' : '#9ca3af', border: `1px solid ${s.ok ? '#a7f3d0' : '#e5e7eb'}` }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="conn-label">Dossier Drive cible (ID — optionnel)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input className="conn-input" value={folderId} onChange={e => setFolderId(e.target.value)} placeholder="ID du dossier Drive (laisser vide = racine)" />
                      <button className="conn-btn conn-btn-secondary" onClick={saveCreds} disabled={saving}>
                        {saveStatus === 'saved' ? '✓ Enregistré' : 'Enregistrer'}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '6px 0 0' }}>
                      Ouvrez un dossier dans Drive : l&apos;ID est la fin de l&apos;URL (drive.google.com/drive/folders/<strong>ID</strong>).
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1.25rem' }}>
                    <span className="conn-label">Tester la connexion</span>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      {([
                        { id: 'profile', label: 'Vérifier le compte' },
                        { id: 'gmail',   label: 'Envoyer un e-mail test' },
                        { id: 'drive',   label: 'Créer un fichier test' },
                      ] as const).map(b => {
                        const st = tests[b.id];
                        return (
                          <button key={b.id} className="conn-btn conn-btn-secondary" onClick={() => runTest(b.id)} disabled={st?.status === 'running'}>
                            {st?.status === 'running'
                              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3" /><path d="M21 12a9 9 0 00-9-9" /></svg>
                              : null}
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                    {(['profile', 'gmail', 'drive'] as const).map(id => {
                      const st = tests[id];
                      if (!st || st.status === 'running' || st.status === 'idle') return null;
                      return (
                        <div key={id} style={{ fontSize: '0.8rem', marginTop: '6px', color: st.status === 'success' ? '#065f46' : '#991b1b', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span>{st.status === 'success' ? '✓' : '✗'}</span>
                          <span>{st.msg}</span>
                          {st.link && <a href={st.link} target="_blank" rel="noopener noreferrer" style={{ color: '#004a99' }}>ouvrir</a>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ borderTop: '1px solid #f3f4f6', marginTop: '1.25rem', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <a className="conn-btn conn-btn-google" href="/api/connectors/google/authorize">Reconnecter / changer de compte</a>
                    <button className="conn-btn conn-btn-danger" onClick={disconnect}>Déconnecter</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ background: '#004a99', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>1</span>
                      <h3 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', margin: 0 }}>Identifiants OAuth</h3>
                      {hasClient && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: '10px' }}>configurés</span>}
                    </div>

                    <div style={{ display: 'grid', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label className="conn-label">Client ID {cfg?.maskedClientId && <span style={{ color: '#9ca3af', textTransform: 'none', fontWeight: 400 }}>· actuel : {cfg.maskedClientId}</span>}</label>
                        <input className="conn-input" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" />
                      </div>
                      <div>
                        <label className="conn-label">Client Secret {cfg?.hasClientSecret && <span style={{ color: '#9ca3af', textTransform: 'none', fontWeight: 400 }}>· enregistré</span>}</label>
                        <input className="conn-input" type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="GOCSPX-••••••••••••••••" />
                      </div>
                    </div>

                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>URI de redirection autorisée (à coller dans Google Cloud)</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <code style={{ flex: 1, fontSize: '0.78rem', color: '#004a99', background: 'white', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', wordBreak: 'break-all' }}>{cfg?.redirectUri}</code>
                        <button className="conn-btn conn-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={copyRedirect}>{copied ? '✓ Copié' : 'Copier'}</button>
                      </div>
                    </div>

                    <button className="conn-btn conn-btn-primary" onClick={saveCreds} disabled={saving || (!clientId && !clientSecret)}>
                      {saving ? 'Enregistrement…' : saveStatus === 'saved' ? '✓ Enregistré' : 'Enregistrer les identifiants'}
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ background: hasClient ? '#004a99' : '#d1d5db', color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>2</span>
                      <h3 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: hasClient ? '#111827' : '#9ca3af', margin: 0 }}>Autoriser l&apos;accès</h3>
                    </div>
                    <a
                      className="conn-btn conn-btn-google"
                      href={hasClient ? '/api/connectors/google/authorize' : undefined}
                      style={!hasClient ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                    >
                      <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" /><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" /><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 002 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" /><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" /></svg>
                      Se connecter avec Google
                    </a>
                    {!hasClient && <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '10px 0 0' }}>Enregistrez d&apos;abord vos identifiants OAuth ci-dessus.</p>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* OAuth guide */}
          <details className="conn-card" style={{ padding: '1rem 1.5rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: '#374151', fontFamily: 'Montserrat,sans-serif' }}>
              Comment obtenir mes identifiants OAuth Google ?
            </summary>
            <ol style={{ color: '#4b5563', fontSize: '0.83rem', lineHeight: 1.8, margin: '12px 0 0', paddingLeft: '1.2rem' }}>
              <li>Ouvrez <strong>console.cloud.google.com</strong> et sélectionnez (ou créez) un projet.</li>
              <li>Menu <strong>API et services → Bibliothèque</strong> : activez <strong>Gmail API</strong> et <strong>Google Drive API</strong>.</li>
              <li>Menu <strong>API et services → Écran de consentement OAuth</strong> : configurez-le (type « Externe », ajoutez votre adresse en utilisateur de test).</li>
              <li>Menu <strong>Identifiants → Créer des identifiants → ID client OAuth</strong> → type <strong>Application Web</strong>.</li>
              <li>Dans <strong>URI de redirection autorisés</strong>, collez l&apos;URI affichée plus haut.</li>
              <li>Copiez le <strong>Client ID</strong> et le <strong>Client Secret</strong> dans le formulaire, enregistrez, puis cliquez sur « Se connecter avec Google ».</li>
            </ol>
          </details>
        </>
      )}

      {/* ══ SECTION: CHAT ══ */}
      {activeSection === 'chat' && (
        <>

          {/* ─── PARTIE 1 : Webhook entrant (le plus simple) ─── */}
          <div className="conn-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Recevoir des notifications dans Google Chat
                  </h2>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>
                    L&apos;app envoie un message dans ton groupe Chat à chaque événement important
                  </p>
                </div>
              </div>
              {chatCfg?.hasIncomingWebhook ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                  Connecté
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', color: '#6b7280', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                  Non configuré
                </span>
              )}
            </div>

            <div style={{ padding: '1.5rem' }}>

              {/* Explication claire */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '9px', padding: '13px 16px', marginBottom: '1.25rem', fontSize: '0.83rem', color: '#1e40af', lineHeight: 1.6 }}>
                <strong>Comment ça marche ?</strong><br />
                Dans Google Chat, ouvre ton groupe → icône ⚙️ (en haut à droite de l&apos;espace) →{' '}
                <strong>Applications et intégrations → Webhooks → Ajouter des webhooks</strong>.
                Donne un nom, valide — Google génère une URL. <strong>Copie cette URL et colle-la ici.</strong>
              </div>

              {chatCfg?.hasIncomingWebhook ? (
                /* Webhook déjà enregistré */
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '9px', padding: '13px 16px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
                    Webhook enregistré
                  </div>
                  <code style={{ fontSize: '0.78rem', color: '#475569', wordBreak: 'break-all', display: 'block' }}>
                    {chatCfg.maskedIncomingWebhook}
                  </code>
                </div>
              ) : (
                /* Champ pour coller l’URL */
                <div style={{ marginBottom: '1rem' }}>
                  <label className="conn-label">URL du webhook (copiée depuis Google Chat)</label>
                  <input
                    className="conn-input"
                    value={incomingWebhook}
                    onChange={e => setIncomingWebhook(e.target.value)}
                    placeholder="https://chat.googleapis.com/v1/spaces/…/messages?key=…&token=…"
                  />
                </div>
              )}

              {/* Boutons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {!chatCfg?.hasIncomingWebhook ? (
                  <button
                    className="conn-btn conn-btn-primary"
                    onClick={saveIncomingWebhook}
                    disabled={incomingWHSaving || !incomingWebhook.trim()}
                  >
                    {incomingWHSaving ? 'Enregistrement…' : incomingWHSaved ? '✓ Enregistré' : 'Enregistrer le webhook'}
                  </button>
                ) : (
                  <>
                    <button
                      className="conn-btn conn-btn-primary"
                      onClick={testIncomingWebhook}
                      disabled={incomingWHTesting}
                      style={{ background: '#1a73e8' }}
                    >
                      {incomingWHTesting
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3" /><path d="M21 12a9 9 0 00-9-9" /></svg>&nbsp;Test en cours…</>
                        : '↗ Envoyer un message test'}
                    </button>
                    <button
                      className="conn-btn conn-btn-danger"
                      onClick={deleteIncomingWebhook}
                      disabled={deletingIncoming}
                    >
                      {deletingIncoming ? 'Suppression…' : 'Supprimer ce webhook'}
                    </button>
                  </>
                )}
              </div>

              {/* Résultat du test */}
              {incomingWHTestResult && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.83rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: incomingWHTestResult.ok ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${incomingWHTestResult.ok ? '#a7f3d0' : '#fecaca'}`,
                  color: incomingWHTestResult.ok ? '#065f46' : '#991b1b',
                }}>
                  {incomingWHTestResult.ok
                    ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Message envoyé dans le groupe — vérifie Google Chat !</>
                    : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{incomingWHTestResult.error}</>
                  }
                </div>
              )}
            </div>
          </div>

          {/* ─── PARTIE 2 : Bot déclencheur d’articles (avancé) ─── */}
          <div className="conn-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <div>
                  <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Déclencheur d&apos;articles via bot Chat
                  </h2>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>
                    Avancé — Écris un sujet dans Chat → l&apos;IA génère un brouillon d&apos;article
                  </p>
                </div>
              </div>
              {botVerified ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  Opérationnel
                </span>
              ) : chatCfg?.configured ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff7ed', color: '#c2410c', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  À tester
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f3f4f6', color: '#6b7280', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                  Non configuré
                </span>
              )}
            </div>

            <div style={{ padding: '1.5rem' }}>

              {/* Explication de l’URL de l’app */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '9px', padding: '13px 16px', marginBottom: '1.25rem', fontSize: '0.83rem', color: '#92400e', lineHeight: 1.6 }}>
                <strong>C&apos;est quoi cette URL de l&apos;app ?</strong><br />
                Ce n&apos;est <em>pas</em> quelque chose à coller dans Google Chat directement.
                Tu dois aller dans <strong>Google Cloud Console → API et services → Google Chat API → Configuration → Connection settings</strong>,
                choisir <strong>« URL de l&apos;app »</strong>, et coller l&apos;URL ci-dessous. Google Chat enverra alors chaque message tapé dans ton espace directement à ton application.
              </div>

              {/* URL de l’app à copier */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' }}>
                  URL de l&apos;app (→ Google Cloud Console)
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{ flex: 1, fontSize: '0.78rem', color: '#7c3aed', background: 'white', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', wordBreak: 'break-all' }}>
                    {chatCfg?.appWebhookUrl}
                  </code>
                  <button className="conn-btn conn-btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={copyAppUrl}>
                    {appUrlCopied ? '✓ Copié' : 'Copier'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '12px', marginBottom: '1.25rem' }}>
                <div>
                  <label className="conn-label">Audience — numéro de projet Google Cloud</label>
                  <input className="conn-input" value={chatAudience} onChange={e => setChatAudience(e.target.value)} placeholder="ex. 123456789012" />
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '6px 0 0' }}>
                    Sécurise les échanges : Google signe chaque requête avec ce numéro. Visible dans Google Cloud Console → Paramètres du projet.
                  </p>
                </div>
                <div>
                  <label className="conn-label">ID de l&apos;espace autorisé (optionnel)</label>
                  <input className="conn-input" value={chatSpace} onChange={e => setChatSpace(e.target.value)} placeholder="spaces/AAAA… (laisser vide = tous les espaces)" />
                  <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '6px 0 0' }}>
                    Ajoute le bot à ton espace — il te répondra avec l&apos;ID exact à coller ici.
                  </p>
                </div>
              </div>

              {/* ── Diagnostic de configuration ── */}
              {chatCfg?.configured && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '9px', padding: '13px 16px', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>
                    Diagnostic de configuration
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.8rem' }}>
                    {/* Audience */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {chatCfg.audience
                        ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                        : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>}
                      <span style={{ color: '#374151' }}>
                        Audience (numéro de projet) :{' '}
                        {chatCfg.audience
                          ? <code style={{ background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '4px' }}>{chatCfg.audience}</code>
                          : <span style={{ color: '#dc2626' }}>manquante</span>}
                      </span>
                    </div>
                    {/* Espace */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                      {!chatCfg.space
                        ? <span style={{ color: '#9ca3af', fontWeight: 700, marginTop: '1px' }}>·</span>
                        : chatCfg.spaceFormatOk
                          ? <span style={{ color: '#16a34a', fontWeight: 700, marginTop: '1px' }}>✓</span>
                          : <span style={{ color: '#d97706', fontWeight: 700, marginTop: '1px' }}>⚠</span>}
                      <span style={{ color: '#374151' }}>
                        {!chatCfg.space
                          ? <span style={{ color: '#9ca3af' }}>ID espace non filtré — tous les espaces acceptés</span>
                          : chatCfg.spaceFormatOk
                            ? <>Espace : <code style={{ background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: '4px' }}>{chatCfg.space}</code></>
                            : (
                              <span>
                                Format d&apos;espace incorrect : <code style={{ background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>{chatCfg.space}</code>
                                <br />
                                <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>
                                  ➜ Doit commencer par <code>spaces/</code> — ex : <code>spaces/AAQA5EKKyks</code>
                                </span>
                              </span>
                            )}
                      </span>
                    </div>
                    {/* Résumé */}
                    {!chatCfg.spaceFormatOk && chatCfg.space && (
                      <div style={{ marginTop: '4px', padding: '7px 10px', background: '#fef3c7', borderRadius: '6px', fontSize: '0.76rem', color: '#92400e', fontWeight: 600 }}>
                        ⚠ L&apos;ID espace incorrect bloque tous les messages entrants. Corrigez-le ci-dessous.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bannière "À tester" après enregistrement */}
              {chatCfg?.configured && !botVerified && !botTestResult && (
                <div style={{ marginBottom: '1rem', padding: '12px 16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '9px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ flex: 1, fontSize: '0.83rem', color: '#9a3412', fontWeight: 600 }}>
                    Configuration enregistrée — lance le test pour confirmer que tout le pipeline fonctionne.
                  </span>
                  <button
                    className="conn-btn"
                    onClick={testBotTrigger}
                    disabled={botTesting}
                    style={{ background: '#ea580c', color: 'white', fontWeight: 700, padding: '8px 16px', fontSize: '0.82rem', borderRadius: '7px', border: 'none', cursor: botTesting ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                  >
                    {botTesting
                      ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Test…</>
                      : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>Lancer le test</>}
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: botTestResult ? '1rem' : 0 }}>
                <button className="conn-btn conn-btn-primary" onClick={saveBotChat} disabled={chatSaving} style={{ background: '#7c3aed' }}>
                  {chatSaving ? 'Enregistrement…' : chatSaved ? '✓ Enregistré' : 'Enregistrer'}
                </button>
                {chatCfg?.configured && (
                  <button
                    className="conn-btn conn-btn-secondary"
                    onClick={testBotTrigger}
                    disabled={botTesting}
                    title="Lance un workflow de test sans consommer de tokens Gemini"
                  >
                    {botTesting
                      ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3" /><path d="M21 12a9 9 0 00-9-9" /></svg> Test en cours…</>
                      : '🧪 Tester le déclencheur'}
                  </button>
                )}
                {chatCfg?.configured && (
                  <button className="conn-btn conn-btn-danger" onClick={deleteBotChat} disabled={deletingBot}>
                    {deletingBot ? 'Suppression…' : 'Supprimer'}
                  </button>
                )}
              </div>

              {/* Résultat du test bot */}
              {botTestResult && (
                <div style={{ marginTop: '1rem', padding: '12px 14px', borderRadius: '9px', background: botTestResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${botTestResult.ok ? '#a7f3d0' : '#fecaca'}` }}>
                  <div style={{ fontWeight: 700, fontSize: '0.83rem', color: botTestResult.ok ? '#065f46' : '#991b1b', marginBottom: botTestResult.steps?.length ? '8px' : 0 }}>
                    {botTestResult.ok ? '✅ Pipeline opérationnel — le déclencheur est prêt' : `✗ Échec : ${botTestResult.error || 'erreur inconnue'}`}
                  </div>
                  {botTestResult.steps?.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', padding: '2px 0', color: '#374151' }}>
                      <span style={{ color: s.ok ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{s.ok ? '✓' : '✗'}</span>
                      <strong style={{ minWidth: '80px', textTransform: 'capitalize' }}>{s.name}</strong>
                      <span style={{ color: s.ok ? '#475569' : '#b45309' }}>{s.detail}</span>
                    </div>
                  ))}
                  {botTestResult.reviewUrl && (
                    <a href={botTestResult.reviewUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: '8px', fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>
                      → Ouvrir la page de validation →
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─── Logs du webhook ─── */}
          <div className="conn-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', margin: 0 }}>
                  Journal du webhook
                </h2>
                <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>20 derniers appels reçus</span>
              </div>
              <button className="conn-btn conn-btn-secondary" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={load}>↻ Actualiser</button>
            </div>

            <div style={{ padding: '1rem 1.5rem' }}>
              {!chatCfg?.webhookLog?.length ? (
                <div style={{ color: '#9ca3af', fontSize: '0.82rem', padding: '8px 0' }}>
                  Aucun appel reçu pour le moment. Envoyez un message depuis Google Chat pour voir les logs ici.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {chatCfg.webhookLog.map((entry, i) => {
                    const statusColors = {
                      ok:          { bg: '#f0fdf4', border: '#a7f3d0', dot: '#16a34a', text: '#065f46' },
                      blocked:     { bg: '#fefce8', border: '#fde68a', dot: '#d97706', text: '#92400e' },
                      auth_failed: { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', text: '#991b1b' },
                      error:       { bg: '#fef2f2', border: '#fecaca', dot: '#dc2626', text: '#991b1b' },
                    }[entry.status] ?? { bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af', text: '#6b7280' };

                    const typeLabel = { MESSAGE: '💬 Message', ADDED_TO_SPACE: '➕ Ajouté', 'pre-auth': '🔒 Avant auth' }[entry.type] || entry.type || '—';

                    return (
                      <div key={i} style={{ borderRadius: '8px', border: `1px solid ${statusColors.border}`, background: statusColors.bg, padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                          {/* Dot statut */}
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors.dot, flexShrink: 0, marginTop: 5 }} />
                          {/* Heure */}
                          <span style={{ fontSize: '0.72rem', color: '#9ca3af', flexShrink: 0, marginTop: 2 }}>
                            {new Date(entry.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          {/* Type */}
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', flexShrink: 0 }}>{typeLabel}</span>
                          {/* Espace */}
                          {entry.space && (
                            <code style={{ fontSize: '0.68rem', color: '#6b7280', background: '#f3f4f6', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>
                              {entry.space}
                            </code>
                          )}
                          {/* Sujet */}
                          {entry.subject && (
                            <span style={{ fontSize: '0.75rem', color: '#374151', fontStyle: 'italic', flex: 1, minWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              &quot;{entry.subject.slice(0, 80)}{entry.subject.length > 80 ? '…' : ''}&quot;
                            </span>
                          )}
                        </div>
                        {/* Détail */}
                        <div style={{ marginTop: '5px', marginLeft: '18px', fontSize: '0.75rem', color: statusColors.text, fontWeight: 500 }}>
                          {entry.detail}
                        </div>
                        {/* Mode JWT détecté (chat / addon / unknown) */}
                        {entry.mode && entry.status !== 'ok' && (
                          <div style={{ marginTop: '3px', marginLeft: '18px', fontSize: '0.7rem', color: '#6b7280' }}>
                            Mode détecté :{' '}
                            <span style={{ fontWeight: 700, color: entry.mode === 'chat' ? '#1e40af' : entry.mode === 'addon' ? '#7c3aed' : '#dc2626' }}>
                              {entry.mode === 'chat' ? 'Chat API classique' : entry.mode === 'addon' ? 'Workspace Add-on' : 'Inconnu'}
                            </span>
                            {entry.receivedIss && <> &nbsp;·&nbsp; Issuer : <code style={{ fontSize: '0.68rem' }}>{entry.receivedIss}</code></>}
                          </div>
                        )}
                        {/* Audience mismatch — aide au diagnostic */}
                        {entry.auth === 'audience' && entry.receivedAud && (
                          <div style={{ marginTop: '4px', marginLeft: '18px', fontSize: '0.72rem', color: '#7c2d12', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '5px', padding: '4px 8px' }}>
                            🔍 <strong>JWT reçu aud :</strong> <code>{entry.receivedAud}</code><br />
                            &nbsp;&nbsp;&nbsp;&nbsp;<strong>Configuré :</strong> <code>{entry.configuredAud}</code>
                            {entry.receivedAud !== entry.configuredAud && (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}> ← valeurs différentes !</span>
                            )}
                            {entry.mode === 'addon' && (
                              <div style={{ marginTop: '3px', color: '#7c3aed', fontWeight: 600 }}>
                                Mode Workspace Add-on détecté — l&apos;audience attendue est l&apos;URL du webhook, pas le numéro de projet.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Guide Google Cloud Console ─── */}
          <div className="conn-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Guide de configuration Google Cloud Console
                </h2>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>Environ 10 minutes — à faire une seule fois</p>
              </div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {([
                {
                  n: 1,
                  title: 'Activer la Google Chat API',
                  desc: <span>Dans Google Cloud Console, ouvre ton projet → <strong>API et services → Bibliothèque</strong> → cherche <strong>Google Chat API</strong> → <strong>Activer</strong>.</span>,
                  link: 'https://console.cloud.google.com/apis/library/chat.googleapis.com',
                  linkLabel: "Ouvrir la bibliothèque d'API →",
                },
                {
                  n: 2,
                  title: "Configurer l'app Chat",
                  desc: <span>Va dans <strong>Google Chat API → Configuration</strong>. Donne un nom au bot (ex. <em>TenderWise</em>), une icône. Active <strong>Fonctionnalités interactives</strong> : « Messages 1:1 » et « Rejoindre des espaces ».</span>,
                  link: 'https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat',
                  linkLabel: 'Ouvrir la configuration →',
                },
                {
                  n: 3,
                  title: "Coller l'URL de l'app",
                  desc: <span>Dans <strong>Connection settings</strong>, choisis <strong>URL de l&apos;app</strong> et colle l&apos;URL violette affichée ci-dessus (le champ « URL du Webhook »). C&apos;est l&apos;adresse que Google utilisera pour te contacter.</span>,
                  link: null as string | null,
                  linkLabel: null as string | null,
                },
                {
                  n: 4,
                  title: 'Récupérer le numéro de projet (Audience)',
                  desc: <span>Dans Google Cloud Console → <strong>Paramètres du projet</strong> (icône ⚙ en haut à droite ou menu IAM). Le <strong>Numéro du projet</strong> (12 chiffres) est l&apos;audience à coller dans le champ ci-dessus.</span>,
                  link: 'https://console.cloud.google.com/iam-admin/settings',
                  linkLabel: 'Paramètres du projet →',
                },
                {
                  n: 5,
                  title: 'Définir la visibilité (domaine Workspace)',
                  desc: <span>Dans <strong>Visibilité</strong>, sélectionne ton domaine pour que tous les utilisateurs de ton organisation puissent ajouter le bot à un espace.</span>,
                  link: null as string | null,
                  linkLabel: null as string | null,
                },
                {
                  n: 6,
                  title: "Ajouter le bot à un espace Chat — récupérer l'ID",
                  desc: <span>Dans Google Chat, crée ou ouvre un espace → <strong>+ Ajouter des personnes et des applications</strong> → cherche le nom du bot. Une fois ajouté, récupère l&apos;ID depuis l&apos;URL de l&apos;espace (ex. <code>spaces/AAQAz5SGz9I</code>) et colle-le dans le champ « ID de l&apos;espace » ci-dessus.</span>,
                  link: null as string | null,
                  linkLabel: null as string | null,
                },
                {
                  n: 7,
                  title: 'Enregistrer puis tester',
                  desc: <span>Clique <strong>Enregistrer</strong>, puis <strong>Tester le déclencheur</strong>. Si toutes les étapes sont vertes ✓, écris dans l&apos;espace : <code>article: la fiscalité des SCI</code> pour générer un vrai article.</span>,
                  link: null as string | null,
                  linkLabel: null as string | null,
                },
              ] as { n: number; title: string; desc: React.ReactNode; link: string | null; linkLabel: string | null }[]).map(({ n, title, desc, link, linkLabel }) => (
                <div key={n} style={{ display: 'flex', gap: '14px', marginBottom: n < 7 ? '18px' : 0, alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{n}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827', marginBottom: '3px' }}>{title}</div>
                    <div style={{ fontSize: '0.81rem', color: '#4b5563', lineHeight: 1.6 }}>{desc}</div>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700, textDecoration: 'none' }}>
                        {linkLabel}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══ SECTION: WORKFLOW ══ */}
      {activeSection === 'workflow' && (
        <>
          {/* ─── Actions de fin de workflow (activables indépendamment) ─── */}
          <div className="conn-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
              <div>
                <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1.05rem', fontWeight: 800, color: '#111827', margin: 0 }}>Actions de fin de workflow</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>Une fois l&apos;article généré, choisissez indépendamment ce qui est exécuté.</p>
              </div>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SwitchRow
                accent="#1a73e8"
                iconBg="#e8f0fe"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
                title="Message Google Chat"
                desc="Poster un message de demande de validation dans l’espace Google Chat."
                checked={flagChat}
                onChange={v => toggleFlag('sendChat', v)}
                busy={flagSaving === 'sendChat'}
              />
              {flagChat && !chatCfg?.hasIncomingWebhook && (
                <div style={{ marginTop: '-4px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.78rem', color: '#92400e' }}>
                  ⚠ Aucun webhook Google Chat n&apos;est configuré — le message ne pourra pas être envoyé.{' '}
                  <Link href="/admin/connectors?s=chat" style={{ color: '#b45309', fontWeight: 700 }}>Configurer le webhook Chat</Link>
                </div>
              )}
              <SwitchRow
                accent="#c5a059"
                iconBg="#fdf6e9"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b8860b" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 5L2 7" /></svg>}
                title="E-mail de validation"
                desc="Envoyer l’e-mail avec les boutons Valider / Modifier / Refuser."
                checked={flagEmail}
                onChange={v => toggleFlag('sendEmail', v)}
                busy={flagSaving === 'sendEmail'}
              />
              <SwitchRow
                accent="#059669"
                iconBg="#ecfdf5"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
                title="Sauvegarde sur Google Drive"
                desc="Enregistrer une copie HTML de l’article dans Google Drive."
                checked={flagDrive}
                onChange={v => toggleFlag('saveDrive', v)}
                busy={flagSaving === 'saveDrive'}
              />
              <p style={{ fontSize: '0.74rem', color: '#9ca3af', margin: '2px 0 0' }}>
                La validation en ligne (lien + page de validation) et la notification interne restent toujours actives.
              </p>
            </div>
          </div>

          <div className="conn-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M4 4h16v4H4z" /><path d="M4 12h16v8H4z" /><path d="M9 16h6" /></svg>
              <div>
                <h2 style={{ fontFamily: 'Montserrat,sans-serif', fontSize: '1.05rem', fontWeight: 800, color: '#111827', margin: 0 }}>Workflow de validation</h2>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: 0 }}>Génération → e-mail de validation → approuver / modifier / refuser → notification</p>
              </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="conn-label">E-mail de notification</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="conn-input" type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} placeholder={chatCfg?.effectiveEmail || 'destinataire@exemple.fr'} />
                  <button className="conn-btn conn-btn-secondary" onClick={saveWorkflow} disabled={wfSaving}>{wfSaved ? '✓ Enregistré' : 'Enregistrer'}</button>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '6px 0 0' }}>
                  Destinataire des e-mails de validation. Vide = compte Google connecté{chatCfg?.effectiveEmail ? ` (${chatCfg.effectiveEmail})` : ''}.
                </p>
              </div>

              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#581c87' }}>🧪 Tester sans consommer de tokens</div>
                    <div style={{ fontSize: '0.75rem', color: '#7c3aed' }}>Article factice (sans token Gemini) + image composée sur fond préenregistré.</div>
                  </div>
                  <button
                    onClick={testWorkflow}
                    disabled={wfTesting}
                    style={{ padding: '9px 18px', border: 'none', borderRadius: '8px', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: wfTesting ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat,sans-serif', opacity: wfTesting ? 0.6 : 1 }}
                  >
                    {wfTesting ? 'Test en cours…' : 'Lancer le test'}
                  </button>
                </div>

                {wfResult && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #e9d5ff', paddingTop: '12px' }}>
                    {wfResult.error && <div style={{ color: '#991b1b', fontSize: '0.82rem', marginBottom: '8px', fontWeight: 600 }}>✗ {wfResult.error}</div>}
                    {wfResult.steps?.map(s => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '3px 0' }}>
                        <span>{s.ok ? '✅' : '⛔'}</span>
                        <strong style={{ textTransform: 'capitalize', minWidth: '74px', color: '#374151' }}>{s.name}</strong>
                        <span style={{ color: s.ok ? '#475569' : '#b45309' }}>{s.detail}</span>
                      </div>
                    ))}
                    {wfResult.reviewUrl && (
                      <a href={wfResult.reviewUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', fontSize: '0.82rem', color: '#7c3aed', fontWeight: 700 }}>
                        → Ouvrir la page de validation de test
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.25rem', padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '0.8rem', color: '#1e40af' }}>
                <strong>Voir l&apos;état du workflow →</strong>{' '}
                <Link href="/admin/workflow" style={{ color: '#1d4ed8', fontWeight: 700 }}>Ouvrir la page Workflow</Link>
                {' '}pour suivre les articles en attente de validation, programmés ou publiés.
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

export default function ConnectorsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ animation: 'spin 0.9s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3" /><path d="M21 12a9 9 0 00-9-9" />
        </svg>
        <style>{`@keyframes spin { from { transform:rotate(0deg);} to { transform:rotate(360deg);} }`}</style>
      </div>
    }>
      <ConnectorsContent />
    </Suspense>
  );
}
