'use client';

import { useEffect, useRef } from 'react';

export default function AdminNotifier() {
  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const check = async () => {
      try {
        const res = await fetch('/api/messages/count');
        if (!res.ok) return;
        const { count } = await res.json();

        if (lastCount.current !== null && count > lastCount.current) {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => {});

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Nouveau message', {
              body: 'Un client vient de remplir le formulaire de contact.',
              icon: '/favicon.ico',
            });
          }
        }

        lastCount.current = count;
      } catch {
        // silencieux — ne pas casser l’admin sur erreur réseau
      }
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
