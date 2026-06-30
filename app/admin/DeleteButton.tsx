'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteButton({ id, endpoint, redirectTo }: {
  id: number;
  endpoint: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
      style={{
        padding: '6px 14px',
        background: confirming ? '#dc2626' : '#fef2f2',
        color: confirming ? 'white' : '#dc2626',
        border: 'none', borderRadius: '6px', fontSize: '0.82rem',
        fontWeight: 600, cursor: 'pointer', transition: '0.15s',
      }}
    >
      {confirming ? 'Confirmer' : `Supprimer`}
    </button>
  );
}
