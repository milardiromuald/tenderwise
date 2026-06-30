'use client';

import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';

// Rate limit constants mirroring server-side (client-side UX only)
const MAX_ATTEMPTS    = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes
const STORAGE_KEY     = 'tw_login_lockout';

interface LockoutData {
  attempts: number;
  lockedUntil: number; // unix timestamp (ms)
}

function getLockout(): LockoutData {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw) as LockoutData;
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

function saveLockout(data: LockoutData) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* noop */ }
}

function clearLockout() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`;
}

export default function AdminLoginPage() {
  const [username,    setUsername]   = useState('');
  const [password,    setPassword]   = useState('');
  const [remember,    setRemember]   = useState(true);
  const [showPwd,     setShowPwd]    = useState(false);
  const [loading,     setLoading]    = useState(false);
  const [error,       setError]      = useState('');
  const [attempts,    setAttempts]   = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now,         setNow]        = useState(0);
  const [shake,       setShake]      = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);

  // Restore lockout state from sessionStorage on mount.
  // Déféré en macrotâche : pas de setState synchrone dans le corps de l’effet.
  useEffect(() => {
    usernameRef.current?.focus();
    const t = setTimeout(() => {
      const data = getLockout();
      setAttempts(data.attempts);
      setLockedUntil(data.lockedUntil);
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Countdown timer when locked out
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) {
        setLockedUntil(0);
        setAttempts(0);
        clearLockout();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Temps restant dérivé de l’horloge `now` (mise à jour par l’intervalle)
  const remaining = lockedUntil > 0 && now > 0
    ? Math.max(0, Math.ceil((lockedUntil - now) / 1000))
    : 0;
  const isLocked = remaining > 0;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || loading) return;

    if (!username.trim() || !password) {
      setError('Veuillez remplir l\'identifiant et le mot de passe.');
      triggerShake();
      return;
    }

    setError('');
    setLoading(true);

    let res: Awaited<ReturnType<typeof signIn>> = undefined;
    try {
      res = await signIn('credentials', {
        username: username.trim(),
        password,
        remember: String(remember),
        redirect: false,
      });
    } catch {
      setLoading(false);
      setError('Erreur réseau. Vérifiez votre connexion.');
      triggerShake();
      return;
    }

    setLoading(false);

    if (res?.ok) {
      clearLockout();
      window.location.href = '/admin';
      return;
    }

    // Failed — update attempt counter
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    triggerShake();

    if (newAttempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_SECONDS * 1000;
      setLockedUntil(until);
      setNow(Date.now());
      saveLockout({ attempts: newAttempts, lockedUntil: until });
      setError('');
    } else {
      saveLockout({ attempts: newAttempts, lockedUntil: 0 });
      const left = MAX_ATTEMPTS - newAttempts;
      setError(
        left === 1
          ? 'Identifiants incorrects. Dernier essai avant blocage temporaire.'
          : `Identifiants incorrects. ${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.`
      );
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #001f4d 0%, #003a80 60%, #004a99 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(7px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(5px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(2px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          animation: fadeIn 0.35s ease both;
        }
        .login-card.shake {
          animation: shake 0.55s ease both;
        }
        .login-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid #d1d5db;
          border-radius: 10px;
          font-size: 0.975rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: white;
          font-family: inherit;
        }
        .login-input:focus {
          border-color: #004a99;
          box-shadow: 0 0 0 3px rgba(0,74,153,0.12);
        }
        .login-input:disabled {
          background: #f3f4f6;
          color: #9ca3af;
          cursor: not-allowed;
        }
        .pwd-wrapper {
          position: relative;
        }
        .pwd-wrapper .login-input {
          padding-right: 48px;
        }
        .pwd-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .pwd-toggle:hover { color: #374151; }
        .login-btn {
          width: 100%;
          padding: 14px;
          background: #004a99;
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
          font-family: Montserrat, sans-serif;
          letter-spacing: 0.02em;
        }
        .login-btn:hover:not(:disabled) {
          background: #003a80;
          transform: translateY(-1px);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
        }
        .custom-checkbox {
          width: 18px;
          height: 18px;
          border: 2px solid #d1d5db;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.15s, background 0.15s;
          background: white;
        }
        .custom-checkbox.checked {
          background: #004a99;
          border-color: #004a99;
        }
        .attempt-dots {
          display: flex;
          gap: 6px;
          justify-content: center;
          margin-top: 4px;
        }
        .attempt-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: background 0.2s;
        }
      `}</style>

      <div
        className={`login-card${shake ? ' shake' : ''}`}
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '2.75rem 2.25rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        }}
      >
        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {/* App badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, rgba(0,74,153,0.08), rgba(197,160,89,0.08))',
            border: '1px solid rgba(197,160,89,0.25)',
            borderRadius: '20px',
            padding: '4px 12px 4px 8px',
            marginBottom: '14px',
          }}>
            <span style={{
              width: '18px', height: '18px',
              background: 'linear-gradient(135deg, #004a99, #0369a1)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#004a99', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Application privée
            </span>
          </div>

          {/* Logo */}
          <div style={{
            fontSize: '2.1rem', fontWeight: 900,
            fontFamily: 'Montserrat, sans-serif',
            color: '#003366', letterSpacing: '-1px',
            lineHeight: 1,
          }}>
            Tender<span style={{ color: '#c5a059' }}>Wise</span>
          </div>

          {/* Subtitle */}
          <p style={{
            color: '#6b7280', fontSize: '0.8rem', marginTop: '8px',
            fontWeight: 500, letterSpacing: '0.02em',
          }}>
            Gestion &amp; Création d&apos;articles
          </p>

          {/* Decorative separator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px auto 0', width: '120px' }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, #e5e7eb)' }} />
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#c5a059' }} />
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, #e5e7eb)' }} />
          </div>
        </div>

        {/* ── Lockout banner ───────────────────────────────────────────── */}
        {isLocked && (
          <div style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '1.5rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔒</div>
            <p style={{ fontWeight: 700, color: '#c2410c', fontSize: '0.9rem', margin: '0 0 4px' }}>
              Accès temporairement bloqué
            </p>
            <p style={{ color: '#9a3412', fontSize: '0.8rem', margin: '0 0 10px' }}>
              Trop de tentatives incorrectes.
            </p>
            <div style={{
              background: '#fee2e2',
              borderRadius: '8px',
              padding: '8px 16px',
              display: 'inline-block',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '1.05rem',
              color: '#dc2626',
              letterSpacing: '0.05em',
            }}>
              {formatTime(remaining)}
            </div>
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#374151', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Identifiant
            </label>
            <input
              ref={usernameRef}
              type="text"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              placeholder="admin"
              required
              disabled={isLocked || loading}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#374151', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Mot de passe
            </label>
            <div className="pwd-wrapper">
              <input
                type={showPwd ? 'text' : 'password'}
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                placeholder="••••••••"
                required
                disabled={isLocked || loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPwd ? (
                  // Eye-off icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  // Eye icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              className="checkbox-row"
              onClick={() => !isLocked && setRemember((v) => !v)}
            >
              <div className={`custom-checkbox${remember ? ' checked' : ''}`}>
                {remember && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                  Rester connecté
                </span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af', marginTop: '1px' }}>
                  {remember ? 'Session de 10 jours' : 'Session de 8 heures'}
                </span>
              </div>
            </label>
          </div>

          {/* Error message */}
          {error && !isLocked && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '11px 14px',
              marginBottom: '1.25rem',
              color: '#dc2626',
              fontSize: '0.83rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Attempt dots — appear after first failure */}
          {attempts > 0 && !isLocked && (
            <div className="attempt-dots" style={{ marginBottom: '1.25rem' }}>
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <div
                  key={i}
                  className="attempt-dot"
                  style={{
                    background: i < attempts
                      ? (attempts >= MAX_ATTEMPTS - 1 ? '#dc2626' : '#f59e0b')
                      : '#e5e7eb',
                  }}
                />
              ))}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="login-btn"
            disabled={isLocked || loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3"/>
                  <path d="M21 12a9 9 0 00-9-9"/>
                </svg>
                Vérification…
              </span>
            ) : isLocked ? (
              `Bloqué — ${formatTime(remaining)}`
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', borderTop: '1px solid #f3f4f6', paddingTop: '1.25rem' }}>
          <p style={{ color: '#d1d5db', fontSize: '0.72rem', margin: 0 }}>
            TenderWise Blog Manager — Accès restreint
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
