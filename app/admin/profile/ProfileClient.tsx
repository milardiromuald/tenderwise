'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import ImageUpload from '../ImageUpload';

type User = {
  id: number; username: string; role: string; created_at: string;
  display_name?: string | null; bio_title?: string | null; bio?: string | null;
  avatar_url?: string | null; avatar_shape?: string | null; linkedin_url?: string | null;
} | null;

interface ProfileClientProps {
  user: User;
  settings: Record<string, string>;
}

function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { score, label: 'Faible', color: '#ef4444' };
  if (score <= 3) return { score, label: 'Moyen', color: '#f59e0b' };
  if (score <= 4) return { score, label: 'Bon', color: '#3b82f6' };
  return { score, label: 'Fort', color: '#10b981' };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.925rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
  background: 'white',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.78rem',
  color: '#374151',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const sectionStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
  marginBottom: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.92rem',
  fontWeight: 700,
  color: '#111827',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export default function ProfileClient({ user, settings }: ProfileClientProps) {
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || settings.admin_avatar_url || '');
  const [avatarShape, setAvatarShape] = useState<'round' | 'square'>(
    ((user?.avatar_shape || settings.admin_avatar_shape) as 'round' | 'square') || 'round'
  );
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);

  const [displayName, setDisplayName] = useState(user?.display_name || settings.admin_display_name || '');
  const [bioTitle, setBioTitle] = useState(user?.bio_title || settings.admin_bio_title || '');
  const [bio, setBio] = useState(user?.bio || settings.admin_bio || '');
  const [linkedin, setLinkedin] = useState(user?.linkedin_url || settings.social_linkedin || '');
  const [savingBio, setSavingBio] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);

  const saveBio = async () => {
    setSavingBio(true);
    setBioSaved(false);
    await fetch('/api/admin/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'public_profile',
        displayName,
        bioTitle,
        bio,
        linkedinUrl: linkedin,
      }),
    });
    setSavingBio(false);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 3000);
  };

  const [loginNewName, setLoginNewName] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');

  const changeUsername = async () => {
    setLoginError('');
    setLoginSuccess('');
    if (!loginNewName.trim()) { setLoginError("Le nouvel identifiant est requis."); return; }
    if (loginNewName.trim().length < 3) { setLoginError("Minimum 3 caractères."); return; }
    if (!/^[a-zA-Z0-9_.-]+$/.test(loginNewName.trim())) { setLoginError("Caractères autorisés : lettres, chiffres, _ . -"); return; }
    if (!loginPwd) { setLoginError("Le mot de passe actuel est requis pour confirmer cette modification."); return; }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'username', newUsername: loginNewName.trim(), currentPwd: loginPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Une erreur est survenue.'); return; }
      setLoginSuccess('Identifiant modifié avec succès. Reconnexion dans 3 secondes…');
      setTimeout(() => signOut({ callbackUrl: `${window.location.origin}/admin/login` }), 3000);
    } catch {
      setLoginError('Erreur réseau. Veuillez réessayer.');
    }
    setLoginLoading(false);
  };

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const strength = getPasswordStrength(newPwd);
  const pwdRequirements = [
    { ok: newPwd.length >= 8, text: '8 caractères minimum' },
    { ok: /[A-Z]/.test(newPwd), text: 'Une lettre majuscule' },
    { ok: /[a-z]/.test(newPwd), text: 'Une lettre minuscule' },
    { ok: /[0-9]/.test(newPwd), text: 'Un chiffre' },
    { ok: /[^A-Za-z0-9]/.test(newPwd), text: 'Un caractère spécial (!@#$%^&*…)' },
  ];
  const allRequirementsMet = pwdRequirements.every((r) => r.ok);
  const passwordsMatch = newPwd.length > 0 && confirmPwd === newPwd;

  const saveAvatar = async () => {
    setSavingAvatar(true);
    setAvatarSaved(false);
    await fetch('/api/admin/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'avatar', avatarUrl, avatarShape }),
    });
    setSavingAvatar(false);
    setAvatarSaved(true);
    setTimeout(() => setAvatarSaved(false), 3000);
  };

  const changePassword = async () => {
    setPwdError('');
    setPwdSuccess('');

    if (!currentPwd) { setPwdError('Veuillez saisir votre mot de passe actuel.'); return; }
    if (!newPwd) { setPwdError('Veuillez saisir un nouveau mot de passe.'); return; }
    if (!allRequirementsMet) { setPwdError('Le nouveau mot de passe ne respecte pas les exigences de sécurité.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('Les nouveaux mots de passe ne correspondent pas.'); return; }
    if (currentPwd === newPwd) { setPwdError('Le nouveau mot de passe doit être différent de l\'actuel.'); return; }

    setPwdLoading(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'password', currentPwd, newPwd }),
      });
      const data = await res.json();
      if (data.ok) {
        setPwdSuccess('Mot de passe modifié avec succès. Reconnectez-vous si nécessaire.');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        setPwdError(data.error || 'Une erreur est survenue, veuillez réessayer.');
      }
    } catch {
      setPwdError('Erreur réseau. Veuillez réessayer.');
    }
    setPwdLoading(false);
  };

  const eyeIcon = (show: boolean) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {show
        ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      }
    </svg>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '820px' }}>
      <style>{`
        .profile-input:focus { border-color: #004a99 !important; box-shadow: 0 0 0 3px rgba(0,74,153,0.08); }
        .shape-btn:hover { border-color: #93c5fd !important; }
        .pwd-toggle { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 0 4px; display: flex; align-items: center; transition: color 0.15s; }
        .pwd-toggle:hover { color: #374151; }
        @media (max-width: 640px) {
          .profile-grid-2 { grid-template-columns: 1fr !important; }
          .profile-avatar-row { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.75rem', color: '#003366', margin: 0 }}>
          Mon profil
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '4px' }}>
          Gérez votre photo de profil et la sécurité de votre compte
        </p>
      </div>

      {/* Section: Informations du compte */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>👤 Informations du compte</h2>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div className="profile-avatar-row" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Avatar preview */}
            <div style={{ flexShrink: 0 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  style={{
                    width: '80px',
                    height: '80px',
                    objectFit: 'cover',
                    borderRadius: avatarShape === 'round' ? '50%' : '12px',
                    border: '3px solid #e5e7eb',
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: avatarShape === 'round' ? '50%' : '12px',
                  background: 'linear-gradient(135deg, #004a99, #003366)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '2rem',
                  fontWeight: 700,
                  fontFamily: 'Montserrat, sans-serif',
                  border: '3px solid #e5e7eb',
                  flexShrink: 0,
                }}>
                  {user?.username?.[0]?.toUpperCase() ?? 'A'}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', marginBottom: '4px', fontFamily: 'Montserrat, sans-serif' }}>
                {user?.username ?? 'Administrateur'}
              </div>
              <div style={{ fontSize: '0.83rem', color: '#6b7280', marginBottom: '4px' }}>
                Rôle :{' '}
                <span style={{ fontWeight: 700, color: '#004a99', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                  {user?.role ?? 'admin'}
                </span>
              </div>
              {user?.created_at && (
                <div style={{ fontSize: '0.77rem', color: '#9ca3af' }}>
                  Compte créé le {String(user.created_at).split('T')[0].split(' ')[0]}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Photo de profil */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>🖼 Photo de profil</h2>
        </div>
        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.5rem' }}>
          <ImageUpload
            value={avatarUrl}
            onChange={setAvatarUrl}
            label="Photo de profil"
            hint="JPEG ou PNG recommandé — image carrée (ex : 400×400 px)"
            previewHeight={160}
            accept="image/jpeg,image/png,image/webp"
          />

          {/* Shape selector */}
          <div>
            <label style={labelStyle}>Forme de l&apos;avatar</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {([
                { value: 'round', label: 'Arrondi (cercle)', border: '50%' },
                { value: 'square', label: 'Carré (coins arrondis)', border: '10px' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAvatarShape(opt.value)}
                  className="shape-btn"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 20px',
                    border: `2px solid ${avatarShape === opt.value ? '#004a99' : '#e5e7eb'}`,
                    borderRadius: '10px',
                    background: avatarShape === opt.value ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    minWidth: '110px',
                  }}
                >
                  {/* Preview */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: avatarUrl ? undefined : 'linear-gradient(135deg, #004a99, #c5a059)',
                      borderRadius: opt.border,
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '2px solid #e5e7eb',
                    }}>
                      {avatarUrl && (
                        <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: avatarShape === opt.value ? '#004a99' : '#6b7280',
                    textAlign: 'center',
                  }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
            <button
              onClick={saveAvatar}
              disabled={savingAvatar}
              style={{
                padding: '10px 28px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: savingAvatar ? 'not-allowed' : 'pointer',
                background: savingAvatar ? '#9ca3af' : avatarSaved ? '#059669' : '#004a99',
                color: 'white',
                transition: 'background 0.2s',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {savingAvatar ? 'Sauvegarde…' : avatarSaved ? '✓ Sauvegardé !' : 'Sauvegarder la photo'}
            </button>
          </div>
        </div>
      </div>

      {/* Section: Profil public */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>📢 Profil public — Articles & Blog</h2>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '4px 0 0' }}>
            Ces informations apparaissent dans le badge auteur en bas de chaque article.
          </p>
        </div>
        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem' }}>

          {/* Prévisualisation du badge */}
          <div style={{ background: '#f0f6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px', fontSize: '0.78rem', color: '#1e40af', display: 'flex', gap: '12px', alignItems: 'center' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.14)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #003366, #004a99)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0, border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.14)' }}>
                {(displayName || user?.username || 'A')[0].toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontWeight: 700, color: '#003366', fontSize: '0.9rem' }}>
                  {displayName || user?.username || 'Nom affiché'}
                </span>
                {bioTitle && (
                  <span style={{ background: '#dbeafe', color: '#003366', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                    {bioTitle}
                  </span>
                )}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.78rem', lineHeight: 1.5 }}>
                {bio || 'La biographie courte apparaîtra ici…'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="profile-grid-2">
            <div>
              <label style={labelStyle}>Nom affiché publiquement</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="profile-input"
                style={inputStyle}
                placeholder={user?.username || 'Ex : L\'équipe TenderWise'}
              />
              <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>Si vide, le nom saisi dans l&apos;article est utilisé.</p>
            </div>
            <div>
              <label style={labelStyle}>Titre / Spécialité</label>
              <input
                type="text"
                value={bioTitle}
                onChange={(e) => setBioTitle(e.target.value)}
                className="profile-input"
                style={inputStyle}
                placeholder="Ex : Expert AMO"
              />
              <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>Badge affiché à côté du nom.</p>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Biographie courte</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="profile-input"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Expert passionné par la gestion de projet immobilier et l’AMO…"
            />
            <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>Affiché dans la carte bio en bas de chaque article.</p>
          </div>

          <div>
            <label style={labelStyle}>Lien LinkedIn</label>
            <input
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className="profile-input"
              style={inputStyle}
              placeholder="https://linkedin.com/company/tenderwise"
            />
            <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>Affiché dans la carte bio et sur la page contact.</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={saveBio}
              disabled={savingBio}
              style={{
                padding: '10px 28px', border: 'none', borderRadius: '8px',
                fontWeight: 700, fontSize: '0.9rem',
                cursor: savingBio ? 'not-allowed' : 'pointer',
                background: savingBio ? '#9ca3af' : bioSaved ? '#059669' : '#004a99',
                color: 'white', transition: 'background 0.2s', fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {savingBio ? 'Sauvegarde…' : bioSaved ? '✓ Sauvegardé !' : 'Sauvegarder le profil public'}
            </button>
          </div>
        </div>
      </div>

      {/* Section: Changer l’identifiant */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>🔑 Changer mon identifiant de connexion</h2>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '4px 0 0' }}>
            Modifiez votre nom d&apos;utilisateur. Vous serez déconnecté(e) et devrez vous reconnecter avec le nouveau nom.
          </p>
        </div>
        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem', maxWidth: '500px' }}>

          {loginError && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.83rem', color: '#dc2626', fontWeight: 600, display: 'flex', gap: '8px' }}>
              <span>⚠</span>{loginError}
            </div>
          )}
          {loginSuccess && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.83rem', color: '#059669', fontWeight: 600, display: 'flex', gap: '8px' }}>
              <span>✓</span>{loginSuccess}
            </div>
          )}

          <div>
            <label style={labelStyle}>Identifiant actuel</label>
            <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9rem', color: '#374151', fontWeight: 600, fontFamily: 'monospace' }}>
              {user?.username ?? '—'}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Nouvel identifiant</label>
            <input
              type="text"
              value={loginNewName}
              onChange={e => setLoginNewName(e.target.value)}
              className="profile-input"
              style={inputStyle}
              placeholder="ex : r.milardi"
              autoComplete="off"
            />
            <p style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: '4px' }}>Lettres, chiffres, _ . - — 3 à 50 caractères</p>
          </div>

          <div>
            <label style={labelStyle}>Confirmer avec votre mot de passe actuel</label>
            <input
              type="password"
              value={loginPwd}
              onChange={e => setLoginPwd(e.target.value)}
              className="profile-input"
              style={inputStyle}
              placeholder="Saisir votre mot de passe actuel"
              autoComplete="current-password"
            />
          </div>

          <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.75rem', color: '#92400e' }}>
            <strong>Attention :</strong> Après validation, vous serez automatiquement déconnecté(e) et devrez vous reconnecter avec le nouvel identifiant.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={changeUsername}
              disabled={loginLoading || !!loginSuccess}
              style={{
                padding: '10px 28px', border: 'none', borderRadius: '8px',
                fontWeight: 700, fontSize: '0.9rem',
                cursor: loginLoading || loginSuccess ? 'not-allowed' : 'pointer',
                background: loginLoading || loginSuccess ? '#9ca3af' : '#004a99',
                color: 'white', transition: 'background 0.2s', fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {loginLoading ? 'Modification…' : 'Modifier l\'identifiant'}
            </button>
          </div>
        </div>
      </div>

      {/* Section: Mot de passe */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={sectionTitleStyle}>🔒 Sécurité — Changer le mot de passe</h2>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '4px 0 0' }}>
            Votre mot de passe doit respecter toutes les exigences ci-dessous.
          </p>
        </div>
        <div style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem', maxWidth: '500px' }}>

          {/* Mot de passe actuel */}
          <div>
            <label style={labelStyle}>Mot de passe actuel</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="profile-input"
                style={{ ...inputStyle, paddingRight: '44px' }}
                placeholder="Saisir votre mot de passe actuel"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowCurrent((v) => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center' }}
                tabIndex={-1}
                aria-label={showCurrent ? 'Masquer' : 'Afficher'}
              >
                {eyeIcon(showCurrent)}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label style={labelStyle}>Nouveau mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="profile-input"
                style={{ ...inputStyle, paddingRight: '44px' }}
                placeholder="Choisir un nouveau mot de passe"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center' }}
                tabIndex={-1}
                aria-label={showNew ? 'Masquer' : 'Afficher'}
              >
                {eyeIcon(showNew)}
              </button>
            </div>

            {/* Strength bar + requirements */}
            {newPwd.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                {/* Bar */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: '5px',
                        borderRadius: '3px',
                        background: strength.score >= i * 1.4 ? strength.color : '#e5e7eb',
                        transition: 'background 0.25s',
                      }}
                    />
                  ))}
                </div>
                <p style={{ fontSize: '0.73rem', color: strength.color, fontWeight: 700, margin: '0 0 6px' }}>
                  Force du mot de passe : {strength.label}
                </p>
                {/* Checklist */}
                <ul style={{ margin: 0, paddingLeft: '4px', listStyle: 'none', display: 'grid', gap: '3px' }}>
                  {pwdRequirements.map(({ ok, text }) => (
                    <li key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.73rem', color: ok ? '#059669' : '#9ca3af' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, width: '12px', textAlign: 'center' }}>
                        {ok ? '✓' : '○'}
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirmer */}
          <div>
            <label style={labelStyle}>Confirmer le nouveau mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="profile-input"
                style={{
                  ...inputStyle,
                  paddingRight: '44px',
                  borderColor: confirmPwd
                    ? passwordsMatch ? '#10b981' : '#ef4444'
                    : '#d1d5db',
                }}
                placeholder="Répéter le nouveau mot de passe"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center' }}
                tabIndex={-1}
                aria-label={showConfirm ? 'Masquer' : 'Afficher'}
              >
                {eyeIcon(showConfirm)}
              </button>
            </div>
            {confirmPwd && (
              <p style={{ fontSize: '0.73rem', marginTop: '4px', fontWeight: 600, color: passwordsMatch ? '#059669' : '#ef4444' }}>
                {passwordsMatch ? '✓ Les mots de passe correspondent' : '✕ Les mots de passe ne correspondent pas'}
              </p>
            )}
          </div>

          {/* Feedback */}
          {pwdError && (
            <div style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              fontSize: '0.83rem',
              color: '#dc2626',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div style={{
              padding: '10px 14px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              fontSize: '0.83rem',
              color: '#059669',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>✓</span>
              {pwdSuccess}
            </div>
          )}

          {/* Security tips */}
          <div style={{
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#6b7280',
          }}>
            <strong style={{ color: '#374151' }}>Conseils de sécurité :</strong> Utilisez un gestionnaire de mots de passe. Ne réutilisez jamais un mot de passe. Un bon mot de passe ressemble à : <span style={{ fontFamily: 'monospace', color: '#004a99', fontWeight: 700 }}>T3nder#Wise2024!</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={changePassword}
              disabled={pwdLoading || !currentPwd || !allRequirementsMet || !passwordsMatch}
              style={{
                padding: '11px 28px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: pwdLoading || !currentPwd || !allRequirementsMet || !passwordsMatch ? 'not-allowed' : 'pointer',
                background: pwdLoading
                  ? '#9ca3af'
                  : !currentPwd || !allRequirementsMet || !passwordsMatch
                    ? '#d1d5db'
                    : '#004a99',
                color: 'white',
                transition: 'background 0.2s',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {pwdLoading ? 'Modification…' : 'Modifier le mot de passe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
