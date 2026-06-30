'use client';

import { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────
interface Config {
  hasKey: boolean;
  maskedKey: string;
  articlesCount: number;
  imagesCount: number;
  selectedModel: string;
  imageModel: string;
  lastGeneration: string;
  // ── Métriques d’usage (tokens cumulés)
  tokensIn: number;
  tokensOut: number;
  maxOutputTokens: number;
  keyTier: 'free' | 'paid' | 'unknown';
  keyModels: string[];
}
interface TestResult {
  success?: boolean;
  type?: string;
  result?: string;
  error?: string;
  detail?: string[];
  ms?: number;
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number;
  tokensCount?: number;
  charCount?: number;
  ratio?: string;
  models?: { id: string; available: boolean; ms: number; error?: string }[];
}
type TestStatus = 'idle' | 'running' | 'success' | 'error';

// ── Models data ───────────────────────────────────────────────────────────
// Clé avec facturation activée (prépaiement) : les modèles Imagen 4 et tous les
// modèles Gemini payants sont accessibles, et les limites suivent le tier payant
// (bien supérieures au tier gratuit). Les valeurs RPM/TPM/RPD ci-dessous sont
// indicatives pour le tier payant — votre tier exact se vérifie dans la console.
const MODELS = [
  {
    id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', version: '3.1',
    badge: 'Articles', badgeColor: '#059669',
    desc: 'Le plus rapide et le plus économique — idéal pour un volume élevé d\'articles',
    ctxTokens: 1_048_576, outTokens: 65_536,
    feat: { text: true, json: true, vision: true, imageOut: false, thinking: false },
    speed: 5, quality: 4,
    usedFor: 'Génération d\'articles', tier: 'Économique',
    rpm: 4000, tpm: '4M', rpd: 100000,
    usedFor2: 'article',
  },
  {
    id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', version: '2.5',
    badge: 'Stable', badgeColor: '#6b7280',
    desc: 'Équilibre qualité/vitesse — bonne alternative économique pour les articles',
    ctxTokens: 1_048_576, outTokens: 65_536,
    feat: { text: true, json: true, vision: true, imageOut: false, thinking: false },
    speed: 4, quality: 4,
    usedFor: 'Alternative articles', tier: 'Économique',
    rpm: 4000, tpm: '4M', rpd: 100000,
    usedFor2: 'article',
  },
  {
    id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', version: '2.5',
    badge: 'Flash', badgeColor: '#0369a1',
    desc: 'Puissant et polyvalent — articles longs et complexes',
    ctxTokens: 1_048_576, outTokens: 65_536,
    feat: { text: true, json: true, vision: true, imageOut: false, thinking: true },
    speed: 4, quality: 4,
    usedFor: 'Articles complexes', tier: 'Équilibré',
    rpm: 1000, tpm: '1M', rpd: 50000,
    usedFor2: 'article',
  },
  {
    id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', version: '2.5',
    badge: 'Premium', badgeColor: '#dc2626',
    desc: 'Raisonnement avancé — le plus précis pour les contenus juridiques exigeants',
    ctxTokens: 1_048_576, outTokens: 65_536,
    feat: { text: true, json: true, vision: true, imageOut: false, thinking: true },
    speed: 2, quality: 5,
    usedFor: 'Articles premium', tier: 'Premium',
    rpm: 150, tpm: '2M', rpd: 10000,
    usedFor2: 'article',
  },
  {
    id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image (Nano Banana)', version: '2.5',
    badge: 'Images IA', badgeColor: '#c5a059',
    desc: 'Génération d\'image rapide et économique — bon défaut pour les en-têtes',
    ctxTokens: 0, outTokens: 0,
    feat: { text: false, json: false, vision: false, imageOut: true, thinking: false },
    speed: 5, quality: 4,
    usedFor: 'Images d\'en-tête', tier: 'Image — économique',
    rpm: 500, tpm: '—', rpd: 10000,
    usedFor2: 'image',
  },
  {
    id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast', version: '4.0',
    badge: 'Images IA', badgeColor: '#c5a059',
    desc: 'Imagen 4 rapide — meilleure qualité que Nano Banana, coût maîtrisé (facturation requise)',
    ctxTokens: 0, outTokens: 0,
    feat: { text: false, json: false, vision: false, imageOut: true, thinking: false },
    speed: 4, quality: 4,
    usedFor: 'Images d\'en-tête', tier: 'Image — rapide',
    rpm: 200, tpm: '—', rpd: 10000,
    usedFor2: 'image',
  },
  {
    id: 'imagen-4.0-generate-001', name: 'Imagen 4', version: '4.0',
    badge: 'Images IA', badgeColor: '#c5a059',
    desc: 'Imagen 4 — qualité photoréaliste élevée, rendu fin des détails (facturation requise)',
    ctxTokens: 0, outTokens: 0,
    feat: { text: false, json: false, vision: false, imageOut: true, thinking: false },
    speed: 3, quality: 5,
    usedFor: 'Images d\'en-tête', tier: 'Image — qualité',
    rpm: 100, tpm: '—', rpd: 5000,
    usedFor2: 'image',
  },
  {
    id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra', version: '4.0',
    badge: 'Images IA', badgeColor: '#c5a059',
    desc: 'Imagen 4 Ultra — qualité maximale, meilleur respect du prompt (facturation requise)',
    ctxTokens: 0, outTokens: 0,
    feat: { text: false, json: false, vision: false, imageOut: true, thinking: false },
    speed: 2, quality: 5,
    usedFor: 'Images d\'en-tête', tier: 'Image — qualité max',
    rpm: 100, tpm: '—', rpd: 5000,
    usedFor2: 'image',
  },
];

/** Extrait un message propre depuis une erreur Gemini brute */
function cleanError(raw: string): { msg: string; status?: number; retryAfter?: number } {
  const statusMatch = raw.match(/\[(\d{3})\s/);
  const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
  const retryMatch = raw.match(/"retryDelay"\s*:\s*"(\d+)s"/) || raw.match(/retry in (\d+)/i);
  const retryAfter = retryMatch ? parseInt(retryMatch[1]) : undefined;

  if (status === 429) {
    if (raw.includes('limit: 0')) {
      return { msg: 'Quota = 0 : activez "Generative Language API" sur console.cloud.google.com, ou créez une nouvelle clé sur aistudio.google.com', status, retryAfter };
    }
    return { msg: `Quota dépassé${retryAfter ? ` — réessayez dans ${retryAfter}s` : ''}`, status, retryAfter };
  }
  if (status === 404) return { msg: 'Modèle non disponible avec cette clé', status };
  if (status === 403) return { msg: 'Clé API invalide ou révoquée', status };
  // Strip JSON noise
  const clean = raw.replace(/\[\{[\s\S]*?\}\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
  return { msg: clean || 'Erreur inconnue', status };
}

// ── Tests data ────────────────────────────────────────────────────────────
const TESTS = [
  { id: 'connection', label: 'Connexion API',         desc: 'Vérifie que la clé est valide et l\'API accessible',     model: 'gemini-3.1-flash-lite', icon: 'wifi' },
  { id: 'text',       label: 'Génération de texte',   desc: 'Génère 2 phrases sur l\'IA dans l\'immobilier',          model: 'gemini-3.1-flash-lite', icon: 'pen' },
  { id: 'json_mode',  label: 'Mode JSON structuré',   desc: 'Réponse JSON avec schéma strict (pour les articles)',    model: 'gemini-3.1-flash-lite', icon: 'code' },
  { id: 'tokens',     label: 'Comptage de tokens',    desc: 'Compte les tokens d\'un texte de référence',            model: 'gemini-3.1-flash-lite', icon: 'hash' },
  { id: 'image',      label: 'Génération d\'image',   desc: 'Génère une image test avec gemini-2.5-flash-image (500/jour)', model: 'gemini-2.5-flash-image', icon: 'image' },
  { id: 'models',     label: 'Disponibilité modèles', desc: 'Vérifie quels modèles Gemini sont accessibles',         model: 'Tous modèles',          icon: 'layers' },
];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function TestIcon({ id }: { id: string }) {
  const icons: Record<string, React.ReactNode> = {
    wifi: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
    pen: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
    code: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    hash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
    image: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    layers: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  };
  return <>{icons[id] || icons.wifi}</>;
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AIConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [selectedImageModel, setSelectedImageModel] = useState('gemini-2.5-flash-image');
  const [maxOutputTokens, setMaxOutputTokens] = useState(32768);
  const [tests, setTests] = useState<Record<string, { status: TestStatus; result: TestResult | null }>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [testsCollapsed, setTestsCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/ai/config')
      .then(r => r.json())
      .then((d: Config) => {
        setConfig(d);
        setSelectedModel(d.selectedModel || 'gemini-3.1-flash-lite');
        setSelectedImageModel(d.imageModel || 'gemini-2.5-flash-image');
        setMaxOutputTokens(d.maxOutputTokens || 32768);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyInput || undefined, selectedModel, imageModel: selectedImageModel }),
      });
      setSaveStatus('saved');
      const r = await fetch('/api/ai/config');
      const d: Config = await r.json();
      setConfig(d);
      setKeyInput('');
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch { setSaveStatus('error'); }
    finally { setSaving(false); }
  };

  const runTest = async (type: string) => {
    setTests(prev => ({ ...prev, [type]: { status: 'running', result: null } }));
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data: TestResult = await res.json();
      setTests(prev => ({ ...prev, [type]: { status: data.success ? 'success' : 'error', result: data } }));
    } catch (err) {
      setTests(prev => ({ ...prev, [type]: { status: 'error', result: { success: false, error: err instanceof Error ? err.message : 'Erreur réseau' } } }));
    }
  };

  const runAllTests = async () => {
    setRunningAll(true);
    for (const t of TESTS) {
      await runTest(t.id);
    }
    setRunningAll(false);
  };

  const saveArticleModel = async (mid: string) => {
    setSelectedModel(mid);
    await fetch('/api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedModel: mid }) });
    const d: Config = await fetch('/api/ai/config').then(r => r.json());
    setConfig(d);
  };

  const saveImageModel = async (mid: string) => {
    setSelectedImageModel(mid);
    await fetch('/api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageModel: mid }) });
    const d: Config = await fetch('/api/ai/config').then(r => r.json());
    setConfig(d);
  };

  const saveMaxTokens = async (val: number) => {
    setMaxOutputTokens(val);
    await fetch('/api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxOutputTokens: val }) });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2" style={{ animation: 'spin 0.9s linear infinite' }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/>
        </svg>
        <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  const hasKey = config?.hasKey ?? false;
  const allTestsDone = TESTS.every(t => tests[t.id]?.status === 'success' || tests[t.id]?.status === 'error');
  const successCount = TESTS.filter(t => tests[t.id]?.status === 'success').length;

  return (
    <div className="ai-page" style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .ai-page { max-width:100%; }
        .ai-card { background:white; border-radius:12px; border:1px solid #e5e7eb; box-shadow:0 1px 3px rgba(0,0,0,0.06); padding:1.5rem; }
        .ai-input { width:100%; padding:10px 14px; border:1.5px solid #e5e7eb; border-radius:8px; font-size:0.9rem; font-family:Inter,system-ui,sans-serif; outline:none; transition:border-color .15s,box-shadow .15s; box-sizing:border-box; background:white; color:#111827; }
        .ai-input:focus { border-color:#004a99; box-shadow:0 0 0 3px rgba(0,74,153,.1); }
        .ai-btn { padding:9px 18px; border:none; border-radius:7px; font-weight:700; font-size:0.85rem; cursor:pointer; font-family:Montserrat,sans-serif; transition:all .15s; display:inline-flex; align-items:center; gap:7px; white-space:nowrap; }
        .ai-btn:disabled { opacity:.5; cursor:not-allowed; transform:none !important; }
        .ai-btn-primary { background:#004a99; color:white; }
        .ai-btn-primary:hover:not(:disabled) { background:#003a80; transform:translateY(-1px); }
        .ai-btn-secondary { background:#f3f4f6; color:#374151; border:1px solid #e5e7eb; }
        .ai-btn-secondary:hover:not(:disabled) { background:#e5e7eb; }
        .ai-btn-gold { background:#c5a059; color:#0f172a; }
        .ai-btn-gold:hover:not(:disabled) { background:#b8913e; transform:translateY(-1px); }
        .ai-label { display:block; font-size:0.74rem; font-weight:700; color:#374151; margin-bottom:5px; text-transform:uppercase; letter-spacing:.05em; }
        .model-card { background:white; border:2px solid #e5e7eb; border-radius:12px; padding:1.1rem; cursor:pointer; transition:all .15s; position:relative; }
        .model-card:hover { border-color:#93c5fd; box-shadow:0 4px 12px rgba(0,74,153,.08); }
        .model-card.selected { border-color:#004a99; background:#f0f7ff; }
        .model-card.used-img { border-color:#c5a059; background:#fffbf0; }
        .feat-row { display:flex; align-items:center; gap:6px; font-size:0.75rem; margin-bottom:3px; }
        .test-card { background:white; border:1px solid #e5e7eb; border-radius:10px; padding:1.1rem; transition:all .15s; animation:fadeIn .2s ease both; }
        .test-card.success { border-color:#a7f3d0; background:#f0fdf4; }
        .test-card.error { border-color:#fecaca; background:#fef2f2; }
        .test-card.running { border-color:#bfdbfe; background:#eff6ff; }
        .rate-table { width:100%; border-collapse:collapse; font-size:0.82rem; }
        .rate-table th { background:#f8fafc; padding:9px 12px; text-align:left; font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; font-weight:700; border-bottom:2px solid #e5e7eb; white-space:nowrap; }
        .rate-table td { padding:9px 12px; border-bottom:1px solid #f3f4f6; color:#374151; vertical-align:middle; }
        .rate-table tr:hover td { background:#f9fafb; }
        .models-scroll { overflow-x:auto; padding-bottom:4px; }
        @media (max-width:1024px) {
          .ai-models-grid { grid-template-columns:repeat(3,1fr) !important; }
          .ai-models-2col { grid-template-columns:1fr !important; }
        }
        @media (max-width:760px) {
          .ai-page { padding:1.25rem !important; }
          .ai-models-grid { grid-template-columns:repeat(2,1fr) !important; }
          .ai-tests-grid { grid-template-columns:1fr !important; }
          .ai-key-row { flex-direction:column !important; align-items:stretch !important; }
          .ai-key-row .ai-btn { width:100% !important; justify-content:center; }
          .ai-stats-grid { grid-template-columns:repeat(2,1fr) !important; }
        }
        @media (max-width:480px) {
          .ai-page { padding:1rem !important; }
          .ai-models-grid { grid-template-columns:1fr !important; }
          .ai-stats-grid { grid-template-columns:1fr !important; }
        }
      `}</style>

      {/* ── Bandeau alerte quota ── */}
      {Object.values(tests).some(t => t.result?.error?.includes('limit: 0') || t.result?.error?.includes('Quota = 0')) && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <p style={{ fontWeight: 700, color: '#92400e', fontSize: '0.875rem', margin: '0 0 6px' }}>
              Quota = 0 — L&apos;API Gemini n&apos;est pas activée pour ce projet Google Cloud
            </p>
            <p style={{ color: '#78350f', fontSize: '0.8rem', margin: '0 0 8px', lineHeight: 1.6 }}>
              Votre clé API est valide mais le projet n&apos;a pas le quota free tier. Voici comment corriger :
            </p>
            <ol style={{ color: '#78350f', fontSize: '0.8rem', margin: 0, paddingLeft: '1.2rem', lineHeight: 1.8 }}>
              <li>Allez sur <strong>console.cloud.google.com</strong></li>
              <li>Sélectionnez votre projet Google Cloud</li>
              <li>Cherchez <strong>&laquo;&nbsp;Generative Language API&nbsp;&raquo;</strong> → cliquez <strong>Activer</strong></li>
              <li>Ou créez une nouvelle clé directement sur <strong>aistudio.google.com</strong> (plus simple)</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Title ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'2rem', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1.5rem', fontWeight:800, color:'#003366', margin:'0 0 4px', display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ background:'linear-gradient(135deg,#004a99,#0369a1)', borderRadius:'8px', padding:'7px', display:'flex', alignItems:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </span>
            Configuration IA — Gemini API
          </h1>
          <p style={{ color:'#6b7280', fontSize:'0.875rem', margin:0 }}>
            Gérez votre clé API, testez les fonctionnalités et configurez les modèles
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {hasKey && config?.keyTier === 'paid' && (
            <span style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fef3c7', color:'#92400e', padding:'6px 14px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700 }}>
              💳 Clé payante (facturation active)
            </span>
          )}
          {hasKey && config?.keyTier === 'free' && (
            <span style={{ display:'flex', alignItems:'center', gap:'6px', background:'#dbeafe', color:'#1e40af', padding:'6px 14px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700 }}>
              🆓 Clé gratuite
            </span>
          )}
          {hasKey ? (
            <span style={{ display:'flex', alignItems:'center', gap:'6px', background:'#d1fae5', color:'#065f46', padding:'6px 14px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              API connectée
            </span>
          ) : (
            <span style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fee2e2', color:'#991b1b', padding:'6px 14px', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              Clé non configurée
            </span>
          )}
        </div>
      </div>

      {/* ── Section 1 : Clé API ── */}
      <div className="ai-card" style={{ marginBottom:'1.75rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'1.25rem' }}>
          <div style={{ background:'#eff6ff', borderRadius:'8px', padding:'8px', display:'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <div>
            <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:700, color:'#111827', margin:0 }}>Clé API Gemini</h2>
            <p style={{ color:'#9ca3af', fontSize:'0.75rem', margin:0 }}>
              Chiffrée AES-256-GCM · Stockée en base de données · Jamais exposée côté client
            </p>
          </div>
        </div>

        {/* Current key status */}
        {hasKey && config?.maskedKey && (
          <div style={{ background:'#f0fdf4', border:'1px solid #a7f3d0', borderRadius:'8px', padding:'10px 14px', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'10px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize:'0.82rem', color:'#065f46', fontWeight:500 }}>
              Clé active : <code style={{ background:'#dcfce7', padding:'1px 6px', borderRadius:'4px', fontFamily:'monospace', fontSize:'0.85rem', letterSpacing:'0.05em' }}>{config.maskedKey}</code>
            </span>
          </div>
        )}

        {/* Key input row */}
        <div className="ai-key-row" style={{ display:'flex', gap:'10px', alignItems:'flex-end', marginBottom:'1rem' }}>
          <div style={{ flex:1 }}>
            <label className="ai-label">
              {hasKey ? 'Remplacer la clé API' : 'Entrer la clé API'}
            </label>
            <div style={{ position:'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="ai-input"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="AIzaSy••••••••••••••••••••••••••••••••••"
                style={{ paddingRight:'44px' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', display:'flex', padding:'4px' }}
              >
                {showKey
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>
          <button
            className="ai-btn ai-btn-primary"
            onClick={handleSave}
            disabled={saving || (!keyInput.trim() && selectedModel === (config?.selectedModel ?? 'gemini-3.1-flash-lite') && selectedImageModel === (config?.imageModel ?? 'gemini-2.5-flash-image'))}
          >
            {saving
              ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Sauvegarde…</>
              : saveStatus === 'saved'
                ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sauvegardé</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13"/></svg>Sauvegarder</>
            }
          </button>
          {hasKey && (
            <button className="ai-btn ai-btn-secondary" onClick={() => runTest('connection')} disabled={tests.connection?.status === 'running'}>
              {tests.connection?.status === 'running'
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              }
              Tester
            </button>
          )}
        </div>

        {/* Connection test result */}
        {tests.connection && (
          <div style={{
            background: tests.connection.status === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${tests.connection.status === 'success' ? '#a7f3d0' : '#fecaca'}`,
            borderRadius:'8px', padding:'10px 14px', marginBottom:'1rem',
            fontSize:'0.82rem', color: tests.connection.status === 'success' ? '#065f46' : '#dc2626',
            display:'flex', gap:'8px', alignItems:'center',
          }}>
            {tests.connection.status === 'running'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>
              : tests.connection.status === 'success'
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            }
            <span>
              {tests.connection.result?.result || tests.connection.result?.error || 'Test en cours…'}
              {tests.connection.result?.ms ? <span style={{ opacity:.6, marginLeft:'8px' }}>{tests.connection.result.ms}ms</span> : null}
            </span>
          </div>
        )}

        {/* Instructions */}
        {!hasKey && (
          <div style={{ background:'#fffbeb', border:'1px solid #fef3c7', borderRadius:'8px', padding:'1rem' }}>
            <p style={{ fontWeight:700, color:'#92400e', fontSize:'0.82rem', margin:'0 0 8px' }}>
              Comment obtenir votre clé API Gemini ?
            </p>
            <ol style={{ color:'#78350f', fontSize:'0.8rem', margin:0, paddingLeft:'1.2rem', lineHeight:1.7 }}>
              <li>Connectez-vous sur <strong>aistudio.google.com</strong> avec votre compte Google</li>
              <li>Cliquez sur <strong>&ldquo;Get API key&rdquo;</strong> → <strong>&ldquo;Create API key&rdquo;</strong></li>
              <li>Pour Imagen 4 et le tier payant : associez un projet Google Cloud avec <strong>facturation activée</strong></li>
              <li>Copiez la clé (commence par <code>AIzaSy</code>), collez-la ci-dessus et <strong>Sauvegardez</strong></li>
            </ol>
          </div>
        )}
      </div>

      {/* ── Section 2 : Statistiques d’usage ── */}
      <div className="ai-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'1rem', marginBottom:'1.75rem' }}>
        {[
          { label:'Articles générés', value: config?.articlesCount ?? 0, color:'#004a99', bg:'#eff6ff', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
          { label:'Images générées', value: config?.imagesCount ?? 0, color:'#c5a059', bg:'#fffbf0', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
          { label:'Modèle articles', value: (config?.selectedModel || 'gemini-3.1-flash-lite').replace('gemini-', ''), color:'#7c3aed', bg:'#f5f3ff', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
          { label:'Dernière génération', value: config?.lastGeneration ? new Date(config.lastGeneration).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '—', color:'#059669', bg:'#f0fdf4', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
        ].map(s => (
          <div key={s.label} style={{ background:'white', borderRadius:'10px', padding:'1rem 1.25rem', border:'1px solid #e5e7eb', display:'flex', gap:'12px', alignItems:'center' }}>
            <div style={{ width:'38px', height:'38px', borderRadius:'8px', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, flexShrink:0 }}>
              {s.icon}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1.25rem', fontWeight:900, color:s.color, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.value}</div>
              <div style={{ fontSize:'0.72rem', color:'#9ca3af', marginTop:'2px', fontWeight:600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 2bis : Métriques d’usage (tokens cumulés) ── */}
      <div style={{ marginBottom:'1.75rem' }}>
        <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:700, color:'#111827', margin:'0 0 0.75rem' }}>Métriques d&apos;usage</h2>
        <div className="ai-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'1rem' }}>
          {[
            { label:'Tokens entrée (cumul)', value: fmtTokens(config?.tokensIn ?? 0),  color:'#0369a1' },
            { label:'Tokens sortie (cumul)', value: fmtTokens(config?.tokensOut ?? 0), color:'#7c3aed' },
            { label:'Tokens total',          value: fmtTokens((config?.tokensIn ?? 0) + (config?.tokensOut ?? 0)), color:'#059669' },
          ].map(m => (
            <div key={m.label} style={{ background:'white', borderRadius:'10px', padding:'0.9rem 1.1rem', border:'1px solid #e5e7eb' }}>
              <div style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1.15rem', fontWeight:900, color:m.color, lineHeight:1.1 }}>{m.value}</div>
              <div style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:'3px', fontWeight:600 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3 : Modèles (compact, 2 colonnes) ── */}
      <div style={{ marginBottom:'1.75rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'8px' }}>
          <div>
            <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:700, color:'#111827', margin:'0 0 2px' }}>Modèles actifs</h2>
            <p style={{ color:'#9ca3af', fontSize:'0.78rem', margin:0 }}>Modèle <strong>par défaut</strong> des articles, utilisé par les agents du workflow (Analyste, Rédacteur, Réviseur) — sauf si un modèle spécifique est réglé par agent dans <strong>Workflow</strong>.</p>
          </div>
        </div>

        <div className="ai-models-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          {[
            { kind:'article' as const, title:'Articles (texte)', accent:'#004a99', bg:'#eff6ff', value:selectedModel,      onChange:saveArticleModel,
              icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
            { kind:'image' as const,   title:'Images',          accent:'#c5a059', bg:'#fffbf0', value:selectedImageModel, onChange:saveImageModel,
              icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
          ].map(col => {
            const list = MODELS.filter(m => m.usedFor2 === col.kind);
            const active = MODELS.find(m => m.id === col.value && m.usedFor2 === col.kind) ?? list[0];
            const imageDisabled = col.kind === 'image' && config?.keyTier === 'free';
            return (
              <div key={col.kind} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'1.1rem 1.25rem', position:'relative', opacity: imageDisabled ? 0.55 : 1 }}>
                {imageDisabled && (
                  <div style={{ position:'absolute', inset:0, zIndex:5, borderRadius:'12px', cursor:'not-allowed' }} title="Nécessite une clé avec facturation activée" />
                )}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ background:col.bg, borderRadius:'7px', padding:'6px', display:'flex' }}>{col.icon}</div>
                    <span style={{ fontFamily:'Montserrat,sans-serif', fontWeight:700, fontSize:'0.85rem', color:'#111827' }}>{col.title}</span>
                  </div>
                  {imageDisabled ? (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'#fef3c7', color:'#92400e', fontSize:'0.66rem', fontWeight:700, padding:'2px 9px', borderRadius:'10px' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Clé gratuite
                    </span>
                  ) : (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'#dcfce7', color:'#065f46', fontSize:'0.66rem', fontWeight:700, padding:'2px 9px', borderRadius:'10px' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                    Actif
                  </span>
                  )}
                </div>

                <select
                  value={col.value}
                  onChange={e => col.onChange(e.target.value)}
                  disabled={imageDisabled}
                  style={{ width:'100%', padding:'9px 12px', border:`1.5px solid ${col.accent}40`, borderRadius:'8px', fontSize:'0.85rem', fontWeight:600, color:'#111827', background:'white', outline:'none', cursor: imageDisabled ? 'not-allowed' : 'pointer' }}
                >
                  {list.map(m => {
                    // Pour les modèles d’article, on grise ceux qui ne sont pas
                    // accessibles avec la clé détectée (tier gratuit/payant).
                    const unavailable =
                      (col.kind === 'article'
                        && !!config && config.keyModels.length > 0
                        && !config.keyModels.includes(m.id))
                      || (col.kind === 'image'
                        && m.id.startsWith('imagen-')
                        && config?.keyTier === 'free');
                    return (
                      <option key={m.id} value={m.id} disabled={unavailable}>
                        {m.name}{unavailable ? ' — indisponible avec cette clé' : ''}
                      </option>
                    );
                  })}
                </select>

                {imageDisabled && (
                  <div style={{ marginTop:'10px', fontSize:'0.74rem', color:'#92400e', lineHeight:1.55, background:'#fef3c7', border:'1px solid #fde68a', borderRadius:'7px', padding:'8px 11px' }}>
                    La génération d&apos;images IA (Imagen 4) nécessite une clé avec <strong>facturation activée</strong>. Les en-têtes d&apos;articles utilisent des fonds prédéfinis.
                  </div>
                )}
                {!imageDisabled && active && (
                  <div style={{ marginTop:'10px', fontSize:'0.74rem', color:'#6b7280', lineHeight:1.5 }}>
                    <div style={{ marginBottom:'6px' }}>{active.desc}</div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {active.ctxTokens > 0 && <span style={{ background:'#eff6ff', color:'#1d4ed8', fontSize:'0.66rem', fontWeight:700, padding:'2px 8px', borderRadius:'5px' }}>{fmtTokens(active.ctxTokens)} ctx</span>}
                      {active.outTokens > 0 && <span style={{ background:'#eff6ff', color:'#1d4ed8', fontSize:'0.66rem', fontWeight:700, padding:'2px 8px', borderRadius:'5px' }}>Sortie max {fmtTokens(active.outTokens)}</span>}
                      {active.feat.imageOut && <span style={{ background:'#fffbf0', color:'#92400e', fontSize:'0.66rem', fontWeight:700, padding:'2px 8px', borderRadius:'5px' }}>Génération d&apos;image</span>}
                      {active.feat.thinking && <span style={{ background:'#f5f3ff', color:'#6d28d9', fontSize:'0.66rem', fontWeight:700, padding:'2px 8px', borderRadius:'5px' }}>Raisonnement</span>}
                      <span style={{ background:'#f3f4f6', color:'#374151', fontSize:'0.66rem', fontWeight:700, padding:'2px 8px', borderRadius:'5px' }}>{active.tier}</span>
                    </div>
                  </div>
                )}

                {/* Slider tokens de sortie — uniquement pour les modèles texte */}
                {col.kind === 'article' && (
                  <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid #f3f4f6' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'.04em' }}>
                        Tokens de sortie max
                      </span>
                      <span style={{ fontFamily:'Montserrat,sans-serif', fontWeight:900, fontSize:'0.9rem', color:'#004a99' }}>
                        {maxOutputTokens.toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4096}
                      max={65536}
                      step={4096}
                      value={maxOutputTokens}
                      onChange={e => setMaxOutputTokens(Number(e.target.value))}
                      onMouseUp={e => saveMaxTokens(Number((e.target as HTMLInputElement).value))}
                      onTouchEnd={e => saveMaxTokens(Number((e.target as HTMLInputElement).value))}
                      style={{ width:'100%', accentColor:'#004a99', cursor:'pointer' }}
                    />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.62rem', color:'#9ca3af', marginTop:'2px' }}>
                      <span>4 096 — court</span>
                      <span>32 768 — recommandé</span>
                      <span>65 536 — max</span>
                    </div>
                    {maxOutputTokens < 16384 && (
                      <div style={{ marginTop:'6px', fontSize:'0.68rem', color:'#92400e', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'5px', padding:'4px 8px' }}>
                        ⚠ Valeur faible — articles longs risquent d&apos;être tronqués
                      </div>
                    )}
                    {maxOutputTokens >= 49152 && (
                      <div style={{ marginTop:'6px', fontSize:'0.68rem', color:'#1e40af', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'5px', padding:'4px 8px' }}>
                        Modèles thinking (ex. Gemini 2.5 Pro) : budget raisonnement compris dans ce total
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ color:'#9ca3af', fontSize:'0.73rem', margin:'10px 2px 0', lineHeight:1.5 }}>
          Sécurité image : si un modèle <strong>Imagen</strong> est indisponible ou échoue, la génération bascule automatiquement sur <strong>Gemini 2.5 Flash Image</strong> pour ne jamais bloquer la création d&apos;article.
        </p>
      </div>

      {/* ── Section 4 : Tests ── */}
      <div style={{ marginBottom:'1.75rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'8px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }} onClick={() => setTestsCollapsed(v => !v)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" style={{ transform: testsCollapsed ? 'rotate(-90deg)' : 'none', transition:'transform .15s', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
            <div>
              <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1rem', fontWeight:700, color:'#111827', margin:'0 0 2px' }}>Tests des fonctionnalités</h2>
              <p style={{ color:'#9ca3af', fontSize:'0.78rem', margin:0 }}>Testez chaque capacité de l&apos;API depuis cette interface</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {allTestsDone && !testsCollapsed && (
              <span style={{ fontSize:'0.78rem', color:'#059669', fontWeight:700 }}>
                {successCount}/{TESTS.length} tests réussis
              </span>
            )}
            {!testsCollapsed && (
              <button className="ai-btn ai-btn-gold" onClick={runAllTests} disabled={runningAll || !hasKey}>
                {runningAll
                  ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>Tests en cours…</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>Tout tester</>
                }
              </button>
            )}
          </div>
        </div>

        {!testsCollapsed && <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'12px', overflow:'hidden' }}>
          {TESTS.map((t, idx) => {
            const st = tests[t.id];
            const ok = st?.status === 'success';
            const err = st?.status === 'error';
            const running = st?.status === 'running';
            const isOpen = expandedTest === t.id;
            const dotColor = ok ? '#059669' : err ? '#dc2626' : running ? '#3b82f6' : '#d1d5db';
            return (
              <div key={t.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6' }}>
                {/* Ligne compacte */}
                <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px' }}>
                  <div style={{ width:'24px', height:'24px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: dotColor, background: ok ? '#d1fae5' : err ? '#fee2e2' : running ? '#dbeafe' : '#f3f4f6' }}>
                    {running
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin .9s linear infinite' }}><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/><path d="M21 12a9 9 0 00-9-9"/></svg>
                      : ok ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      : err ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      : <TestIcon id={t.icon} />}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'0.83rem', color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.label}</div>
                    <div style={{ fontSize:'0.68rem', color:'#9ca3af', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.model}</div>
                  </div>

                  {/* Badge statut */}
                  {st && (
                    <span style={{ fontSize:'0.66rem', fontWeight:700, padding:'2px 9px', borderRadius:'10px', flexShrink:0, background: ok ? '#dcfce7' : err ? '#fee2e2' : '#dbeafe', color: ok ? '#065f46' : err ? '#991b1b' : '#1e40af' }}>
                      {ok ? 'OK' : err ? 'Erreur' : '…'}
                    </span>
                  )}
                  {/* Temps */}
                  {st?.result?.ms != null && <span style={{ fontSize:'0.68rem', color:'#9ca3af', flexShrink:0, minWidth:'42px', textAlign:'right' }}>{st.result.ms}ms</span>}

                  {/* Bouton Lancer */}
                  <button
                    className="ai-btn ai-btn-secondary"
                    style={{ padding:'5px 11px', fontSize:'0.75rem', flexShrink:0 }}
                    onClick={() => runTest(t.id)}
                    disabled={running || !hasKey}
                  >
                    {running ? '…' : 'Lancer'}
                  </button>

                  {/* Toggle log */}
                  <button
                    onClick={() => setExpandedTest(isOpen ? null : t.id)}
                    disabled={!st?.result}
                    title="Voir le log brut"
                    style={{ background:'none', border:'none', cursor: st?.result ? 'pointer' : 'not-allowed', color: st?.result ? '#6b7280' : '#e5e7eb', display:'flex', padding:'4px', flexShrink:0 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                </div>

                {/* Accordéon : log brut */}
                {isOpen && st?.result && (
                  <div style={{ padding:'0 14px 12px 50px', animation:'fadeIn .15s ease both' }}>
                    {st.result.result && (
                      <div style={{ fontSize:'0.76rem', color:'#374151', marginBottom:'6px', wordBreak:'break-word' }}>{st.result.result}</div>
                    )}
                    {(st.result.tokensIn != null || st.result.tokensOut != null || st.result.tokensCount != null) && (
                      <div style={{ display:'flex', gap:'6px', marginBottom:'6px', flexWrap:'wrap' }}>
                        {st.result.tokensIn != null  && <span style={{ background:'#dcfce7', color:'#065f46', padding:'1px 7px', borderRadius:'4px', fontSize:'0.68rem', fontWeight:700 }}>↑ {st.result.tokensIn} in</span>}
                        {st.result.tokensOut != null && <span style={{ background:'#dcfce7', color:'#065f46', padding:'1px 7px', borderRadius:'4px', fontSize:'0.68rem', fontWeight:700 }}>↓ {st.result.tokensOut} out</span>}
                        {st.result.tokensCount != null && <span style={{ background:'#dcfce7', color:'#065f46', padding:'1px 7px', borderRadius:'4px', fontSize:'0.68rem', fontWeight:700 }}>{st.result.tokensCount} tokens · ≈{st.result.ratio} c/tok</span>}
                      </div>
                    )}
                    {st.result.models && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'2px', marginBottom:'6px' }}>
                        {st.result.models.map(m => (
                          <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'0.7rem' }}>
                            {m.available
                              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                            <code style={{ fontSize:'0.68rem' }}>{m.id}</code>
                            <span style={{ color:'#9ca3af' }}>{m.ms}ms</span>
                            {m.error && <span style={{ color:'#dc2626', fontSize:'0.64rem' }}>({m.error.slice(0,60)})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {st.result.error && (() => {
                      const parsed = cleanError(st.result.error || '');
                      return (
                        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'6px', padding:'8px 10px', fontSize:'0.72rem', color:'#991b1b' }}>
                          <div style={{ fontWeight:700, marginBottom:'2px' }}>{parsed.status === 429 ? '⚠ Quota dépassé' : parsed.status === 404 ? '⚠ Modèle indisponible' : '✗ Erreur'}{parsed.retryAfter ? ` — réessayez dans ${parsed.retryAfter}s` : ''}</div>
                          <div>{parsed.msg}</div>
                        </div>
                      );
                    })()}
                    {/* Log brut JSON */}
                    <details style={{ marginTop:'6px' }}>
                      <summary style={{ fontSize:'0.68rem', color:'#9ca3af', cursor:'pointer', fontWeight:600 }}>Réponse brute (JSON)</summary>
                      <pre style={{ margin:'4px 0 0', padding:'8px 10px', background:'#0f172a', color:'#e2e8f0', borderRadius:'6px', fontSize:'0.66rem', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                        {JSON.stringify(st.result, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
}
