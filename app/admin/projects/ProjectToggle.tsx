'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectToggle({ id, statut }: { id: number; statut: string }) {
  const isActive = statut !== 'inactive';
  const [active, setActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = async () => {
    const newStatut = active ? 'inactive' : 'active';
    setActive(!active);
    await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: newStatut }),
    });
    startTransition(() => router.refresh());
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={active ? 'Cliquer pour masquer sur le site' : 'Cliquer pour afficher sur le site'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
        fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s',
        background: active ? '#d1fae5' : '#f3f4f6',
        color: active ? '#065f46' : '#9ca3af',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {/* Toggle track */}
      <span style={{
        width: '28px', height: '16px', borderRadius: '8px',
        background: active ? '#059669' : '#d1d5db',
        position: 'relative', flexShrink: 0, display: 'inline-block',
        transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: '2px',
          left: active ? '14px' : '2px',
          width: '12px', height: '12px', borderRadius: '50%',
          background: 'white', transition: 'left 0.2s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
      </span>
      {active ? 'Visible' : 'Masqué'}
    </button>
  );
}
