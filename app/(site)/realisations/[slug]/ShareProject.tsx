'use client';

import { useState } from 'react';

export function ShareProject({ shareUrl, titre: _titre }: { shareUrl: string; titre: string }) {
  const [copied, setCopied] = useState(false);

  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  const copy = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const btnBase: React.CSSProperties = {
    width: '40px', height: '40px', borderRadius: '10px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', border: 'none', flexShrink: 0,
    transition: 'transform 0.2s',
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
      <a href={liUrl} target="_blank" rel="noopener noreferrer"
        style={{ ...btnBase, background: '#0077B5', color: 'white', textDecoration: 'none' }}
        title="Partager sur LinkedIn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </a>
      <button onClick={copy}
        style={{ ...btnBase, background: copied ? '#dcfce7' : 'white', color: copied ? '#059669' : '#475569', border: '1px solid #e2e8f0' }}
        title={copied ? 'Copié !' : 'Copier le lien'}>
        {copied
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        }
      </button>
    </div>
  );
}
