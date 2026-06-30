'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

type UserRow = { id: number; username: string; role: string; is_active: number; created_at: string };

interface UsersClientProps {
  users: UserRow[];
  currentUsername: string;
}

function validatePassword(pwd: string): string | null {
  if (!pwd || pwd.length < 8) return 'Minimum 8 caractères.';
  if (!/[A-Z]/.test(pwd)) return 'Au moins une majuscule.';
  if (!/[a-z]/.test(pwd)) return 'Au moins une minuscule.';
  if (!/[0-9]/.test(pwd)) return 'Au moins un chiffre.';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Au moins un caractère spécial (!@#$%…).';
  return null;
}

function getPwdStrength(pwd: string) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (s <= 2) return { s, label: 'Faible', color: '#ef4444' };
  if (s <= 3) return { s, label: 'Moyen', color: '#f59e0b' };
  if (s <= 4) return { s, label: 'Bon', color: '#3b82f6' };
  return { s, label: 'Fort', color: '#10b981' };
}

type ActionState =
  | null
  | { type: 'rename'; userId: number; value: string; loading: boolean; error: string }
  | { type: 'delete'; userId: number; loading: boolean };

const inputS: React.CSSProperties = {
  width: '100%', padding: '9px 13px', border: '1px solid #d1d5db',
  borderRadius: '7px', fontSize: '0.9rem', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', background: 'white',
  transition: 'border-color 0.15s',
};
const labelS: React.CSSProperties = {
  display: 'block', fontWeight: 600, fontSize: '0.78rem', color: '#374151',
  marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px',
};

export default function UsersClient({ users: initial, currentUsername }: UsersClientProps) {
  const [users, setUsers] = useState<UserRow[]>(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [action, setAction] = useState<ActionState>(null);
  const [globalMsg, setGlobalMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Create-form state
  const [cUsername, setCUsername] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cConfirm, setCConfirm] = useState('');
  const [cRole, setCRole] = useState('admin');
  const [cLoading, setCLoading] = useState(false);
  const [cError, setCError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const flash = (ok: boolean, text: string) => {
    setGlobalMsg({ ok, text });
    setTimeout(() => setGlobalMsg(null), 4500);
  };

  const refreshList = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.users) setUsers(data.users);
  };

  /* ── Create ──────────────────────────────────────────────────────────── */
  const handleCreate = async () => {
    setCError('');
    if (!cUsername.trim()) { setCError("L'identifiant est requis."); return; }
    if (cUsername.trim().length < 3) { setCError("Minimum 3 caractères."); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cUsername.trim())) { setCError("Caractères invalides (lettres, chiffres, _ . - uniquement)."); return; }
    const pwdErr = validatePassword(cPassword);
    if (pwdErr) { setCError(pwdErr); return; }
    if (cPassword !== cConfirm) { setCError("Les mots de passe ne correspondent pas."); return; }

    setCLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cUsername.trim(), password: cPassword, role: cRole }),
      });
      const data = await res.json();
      if (!res.ok) { setCError(data.error || 'Erreur lors de la création.'); return; }
      await refreshList();
      setCUsername(''); setCPassword(''); setCConfirm(''); setCRole('admin');
      setShowCreate(false);
      flash(true, `Compte "${cUsername.trim()}" créé avec succès.`);
    } catch { setCError('Erreur réseau.'); }
    finally { setCLoading(false); }
  };

  /* ── Toggle active ───────────────────────────────────────────────────── */
  const handleToggle = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'toggle_active' }),
      });
      const data = await res.json();
      if (!res.ok) { flash(false, data.error || 'Impossible de modifier le statut.'); return; }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: data.is_active } : u));
      flash(true, data.is_active === 1 ? 'Compte activé.' : 'Compte désactivé.');
    } catch { flash(false, 'Erreur réseau.'); }
  };

  /* ── Rename ──────────────────────────────────────────────────────────── */
  const handleRename = async () => {
    if (action?.type !== 'rename') return;
    const { userId, value } = action;
    if (!value.trim() || value.trim().length < 3) { setAction({ ...action, error: 'Minimum 3 caractères.' }); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(value.trim())) { setAction({ ...action, error: 'Caractères invalides.' }); return; }
    setAction({ ...action, loading: true, error: '' });
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'rename', newUsername: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAction({ ...action, loading: false, error: data.error || 'Erreur.' }); return; }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, username: value.trim() } : u));
      setAction(null);
      if (data.requireRelogin) {
        flash(true, 'Identifiant modifié. Reconnexion dans 3 secondes…');
        setTimeout(() => signOut({ callbackUrl: '/admin/login' }), 3000);
      } else {
        flash(true, 'Identifiant modifié avec succès.');
      }
    } catch { setAction({ ...action, loading: false, error: 'Erreur réseau.' }); }
  };

  /* ── Delete ──────────────────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (action?.type !== 'delete') return;
    const { userId } = action;
    setAction({ ...action, loading: true });
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { flash(false, data.error || 'Impossible de supprimer.'); setAction(null); return; }
      setUsers(prev => prev.filter(u => u.id !== userId));
      setAction(null);
      flash(true, 'Compte supprimé.');
    } catch { flash(false, 'Erreur réseau.'); setAction(null); }
  };

  const pwdStrength = getPwdStrength(cPassword);
  const pwdReqs = [
    { ok: cPassword.length >= 8, text: '8 car. min.' },
    { ok: /[A-Z]/.test(cPassword), text: 'Majuscule' },
    { ok: /[a-z]/.test(cPassword), text: 'Minuscule' },
    { ok: /[0-9]/.test(cPassword), text: 'Chiffre' },
    { ok: /[^A-Za-z0-9]/.test(cPassword), text: 'Spécial' },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '900px' }}>
      <style>{`
        .um-input:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08); }
        .um-ghost:hover { background: #f1f5f9 !important; }
        .um-card { transition: box-shadow 0.15s; }
        .um-card:hover { box-shadow: 0 3px 14px rgba(0,0,0,0.09) !important; }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>Gestion des comptes</h1>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '4px' }}>Créez, renommez, activez ou supprimez les accès à l&apos;administration</p>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setCError(''); }}
          style={{ padding: '10px 22px', background: showCreate ? '#f1f5f9' : '#004a99', color: showCreate ? '#374151' : 'white', border: `1px solid ${showCreate ? '#d1d5db' : '#004a99'}`, borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        >
          {showCreate ? '✕ Annuler' : '+ Créer un compte'}
        </button>
      </div>

      {/* ── Flash message ────────────────────────────────────────────────── */}
      {globalMsg && (
        <div style={{ marginBottom: '1.25rem', padding: '11px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, background: globalMsg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${globalMsg.ok ? '#bbf7d0' : '#fecaca'}`, color: globalMsg.ok ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {globalMsg.ok ? '✓' : '⚠'} {globalMsg.text}
        </div>
      )}

      {/* ── Create form ──────────────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #004a99', boxShadow: '0 4px 20px rgba(0,74,153,0.07)', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#004a99" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.9rem', fontWeight: 700, color: '#003366', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nouveau compte administrateur</h2>
          </div>
          <div style={{ padding: '1.5rem', display: 'grid', gap: '1.1rem' }}>
            {cError && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.83rem', color: '#dc2626', fontWeight: 600 }}>⚠ {cError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelS}>Identifiant *</label>
                <input className="um-input" type="text" value={cUsername} onChange={e => setCUsername(e.target.value)} placeholder="ex : jean.dupont" style={inputS} autoComplete="off" />
                <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px' }}>Lettres, chiffres, _ . - — 3 à 50 caractères</p>
              </div>
              <div>
                <label style={labelS}>Rôle</label>
                <select value={cRole} onChange={e => setCRole(e.target.value)} className="um-input" style={{ ...inputS, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '36px' }}>
                  <option value="admin">Admin — accès complet</option>
                  <option value="editor">Éditeur — accès contenu</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelS}>Mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input className="um-input" type={showPwd ? 'text' : 'password'} value={cPassword} onChange={e => setCPassword(e.target.value)} placeholder="Mot de passe fort requis" style={{ ...inputS, paddingRight: '44px' }} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center' }} tabIndex={-1}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPwd ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
              {cPassword.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '5px' }}>
                    {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: pwdStrength.s >= i * 1.4 ? pwdStrength.color : '#e5e7eb', transition: 'background 0.2s' }} />)}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {pwdReqs.map(r => (
                      <span key={r.text} style={{ fontSize: '0.7rem', color: r.ok ? '#059669' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: r.ok ? 600 : 400 }}>
                        {r.ok ? '✓' : '○'} {r.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={labelS}>Confirmer le mot de passe *</label>
              <input className="um-input" type="password" value={cConfirm} onChange={e => setCConfirm(e.target.value)} placeholder="Répéter le mot de passe" style={{ ...inputS, borderColor: cConfirm ? (cConfirm === cPassword ? '#10b981' : '#ef4444') : '#d1d5db' }} autoComplete="new-password" />
              {cConfirm && <p style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 600, color: cConfirm === cPassword ? '#059669' : '#ef4444' }}>{cConfirm === cPassword ? '✓ Les mots de passe correspondent' : '✕ Les mots de passe ne correspondent pas'}</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { setShowCreate(false); setCError(''); setCUsername(''); setCPassword(''); setCConfirm(''); }} className="um-ghost" style={{ padding: '9px 20px', border: '1px solid #d1d5db', borderRadius: '7px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', background: 'white', color: '#374151', fontFamily: 'inherit', transition: 'background 0.15s' }}>Annuler</button>
              <button onClick={handleCreate} disabled={cLoading} style={{ padding: '9px 24px', background: cLoading ? '#9ca3af' : '#004a99', color: 'white', border: 'none', borderRadius: '7px', fontWeight: 700, fontSize: '0.88rem', cursor: cLoading ? 'not-allowed' : 'pointer', fontFamily: 'Montserrat, sans-serif', transition: 'background 0.15s' }}>
                {cLoading ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Security notice ───────────────────────────────────────────────── */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '11px 16px', marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <p style={{ fontSize: '0.78rem', color: '#92400e', margin: 0, lineHeight: 1.55 }}>
          <strong>Sécurité :</strong> Chaque compte dispose d&apos;un accès complet à l&apos;administration. Les comptes désactivés ne peuvent plus se connecter. Vous ne pouvez pas supprimer ni désactiver votre propre compte. Renommer votre propre compte déclenche une reconnexion automatique.
        </p>
      </div>

      {/* ── User list ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {users.map(user => {
          const isSelf = user.username === currentUsername;
          const isRenaming = action?.type === 'rename' && action.userId === user.id;
          const isDeleting = action?.type === 'delete' && action.userId === user.id;

          return (
            <div key={user.id} className="um-card" style={{ background: 'white', borderRadius: '10px', border: `1px solid ${isSelf ? '#bfdbfe' : '#e5e7eb'}`, padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>

              {/* Avatar */}
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: isSelf ? 'linear-gradient(135deg, #004a99, #003366)' : 'linear-gradient(135deg, #475569, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.15rem', flexShrink: 0, fontFamily: 'Montserrat, sans-serif', boxShadow: isSelf ? '0 0 0 3px rgba(0,74,153,0.2)' : 'none' }}>
                {user.username[0].toUpperCase()}
              </div>

              {/* Info + inline rename */}
              <div style={{ flex: 1, minWidth: '160px' }}>
                {isRenaming ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      className="um-input"
                      type="text"
                      value={action.value}
                      onChange={e => setAction({ ...action, value: e.target.value })}
                      style={{ ...inputS, width: '190px', padding: '6px 10px', fontSize: '0.88rem' }}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setAction(null); }}
                    />
                    <button onClick={handleRename} disabled={action.loading} style={{ padding: '6px 14px', background: action.loading ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem', cursor: action.loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                      {action.loading ? '…' : '✓ Valider'}
                    </button>
                    <button onClick={() => setAction(null)} style={{ padding: '6px 12px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                    {action.error && <span style={{ fontSize: '0.77rem', color: '#ef4444', fontWeight: 600 }}>⚠ {action.error}</span>}
                    {isSelf && <span style={{ fontSize: '0.74rem', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>⚠ Reconnexion requise après validation</span>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', fontFamily: 'Montserrat, sans-serif' }}>{user.username}</span>
                    {isSelf && <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '5px', letterSpacing: '0.05em' }}>VOUS</span>}
                    <span style={{ background: user.role === 'admin' ? '#f0fdf4' : '#fefce8', color: user.role === 'admin' ? '#15803d' : '#854d0e', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {user.role}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: user.is_active ? '#dcfce7' : '#f1f5f9', color: user.is_active ? '#16a34a' : '#94a3b8', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.is_active ? '#16a34a' : '#cbd5e1', display: 'inline-block' }} />
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                )}
                {!isRenaming && (
                  <p style={{ fontSize: '0.74rem', color: '#9ca3af', margin: '4px 0 0' }}>
                    Compte créé le {String(user.created_at).split('T')[0].split(' ')[0]}
                  </p>
                )}
              </div>

              {/* Actions */}
              {!isRenaming && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

                  {/* Rename */}
                  <button onClick={() => setAction({ type: 'rename', userId: user.id, value: user.username, loading: false, error: '' })} className="um-ghost" style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: 'white', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Renommer
                  </button>

                  {/* Toggle (not self) */}
                  {!isSelf && (
                    <button onClick={() => handleToggle(user.id)} className="um-ghost" style={{ padding: '6px 14px', border: `1px solid ${user.is_active ? '#fecaca' : '#bbf7d0'}`, borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: user.is_active ? '#fef2f2' : '#f0fdf4', color: user.is_active ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                      {user.is_active ? (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Désactiver</>
                      ) : (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>Activer</>
                      )}
                    </button>
                  )}

                  {/* Delete (not self) */}
                  {!isSelf && !isDeleting && (
                    <button onClick={() => setAction({ type: 'delete', userId: user.id, loading: false })} className="um-ghost" style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', background: 'white', color: '#cbd5e1', display: 'flex', alignItems: 'center', fontFamily: 'inherit', transition: 'all 0.15s' }} title="Supprimer ce compte">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    </button>
                  )}

                  {/* Delete confirmation */}
                  {!isSelf && isDeleting && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '5px 10px' }}>
                      <span style={{ fontSize: '0.79rem', color: '#dc2626', fontWeight: 600 }}>Confirmer la suppression ?</span>
                      <button onClick={handleDelete} disabled={action?.loading} style={{ padding: '4px 12px', background: action?.loading ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: '5px', fontSize: '0.78rem', fontWeight: 700, cursor: action?.loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                        {action?.loading ? '…' : 'Supprimer'}
                      </button>
                      <button onClick={() => setAction(null)} style={{ padding: '4px 10px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>Non</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.9rem' }}>Aucun compte trouvé.</div>
      )}
    </div>
  );
}
