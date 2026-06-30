'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Avertit l'utilisateur avant l'expiration de sa session (8h sans "rester
 * connecté", 10 jours sinon) pour éviter une déconnexion surprise en plein
 * travail. `session.expires` est dérivé par NextAuth du claim `exp` du JWT
 * (voir lib/auth.ts), donc déjà à jour côté client sans appel API dédié.
 */
const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes avant expiration
const CHECK_INTERVAL_MS = 30_000;

export default function SessionExpiryWarning() {
  const { data: session } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!session?.expires) return;
    const expiresAt = new Date(session.expires).getTime();
    if (Number.isNaN(expiresAt)) return;

    const check = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        // Session déjà expirée côté serveur : un rechargement renverra vers /admin/login.
        window.location.reload();
        return;
      }
      setShowWarning(remaining <= WARNING_THRESHOLD_MS);
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session?.expires]);

  if (!showWarning || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
      background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px',
      padding: '14px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: '320px',
      display: 'flex', gap: '12px', alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⏰</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, color: '#92400e', fontSize: '0.85rem', margin: '0 0 4px' }}>
          Session bientôt expirée
        </p>
        <p style={{ color: '#78350f', fontSize: '0.8rem', margin: '0 0 10px', lineHeight: 1.5 }}>
          Pensez à enregistrer votre travail en cours — vous allez être déconnecté(e) sous peu.
        </p>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
        >
          Compris
        </button>
      </div>
    </div>
  );
}
