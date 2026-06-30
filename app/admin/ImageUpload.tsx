'use client';

import { useState, useRef } from 'react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  /** Height of the preview image in px. Default 160 */
  previewHeight?: number;
  /** Accepted MIME types. Default "image/*" */
  accept?: string;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.78rem',
  color: '#374151',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export default function ImageUpload({
  value,
  onChange,
  label,
  hint,
  previewHeight = 160,
  accept = 'image/*',
}: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      let data: { url?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        setError(`Erreur serveur (${res.status}) — consultez la console Next.js.`);
        setUploading(false);
        return;
      }
      if (data.url) {
        onChange(data.url);
        setShowUrl(false);
      } else {
        setError(data.error || "Erreur lors de l'envoi — fichier non sauvegardé.");
      }
    } catch (e) {
      setError(`Erreur réseau : ${e instanceof Error ? e.message : 'vérifiez votre connexion.'}`);
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  const PANEL_H = previewHeight;

  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}

      {/*
        ┌─── IMAGE (fixe) ─────┬─── CONTRÔLES (côté droit) ───┐
        │  preview / dropzone  │  boutons + URL input          │
        └──────────────────────┴───────────────────────────────┘
        La colonne image ne bouge JAMAIS quelle que soit l'état des contrôles.
      */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        alignItems: 'stretch',
        minHeight: `${PANEL_H}px`,
      }}>

        {/* ── Colonne gauche : image fixe ── */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !value && fileRef.current?.click()}
          style={{
            border: `2px ${dragOver ? 'solid' : 'dashed'} ${dragOver ? '#004a99' : value ? '#d1d5db' : '#c4b5fd'}`,
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative',
            background: dragOver ? '#eff6ff' : value ? '#000' : '#faf5ff',
            height: `${PANEL_H}px`,
            cursor: value ? 'default' : 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            flexShrink: 0,
          }}
        >
          {value ? (
            <img
              src={value}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                background: '#f3f4f6',
              }}
            />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: '8px',
              color: dragOver ? '#004a99' : '#7c3aed', padding: '1rem',
              textAlign: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                {dragOver ? 'Déposer ici' : 'Glisser une image ici'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                ou utiliser les boutons →
              </div>
            </div>
          )}

          {uploading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,255,255,0.92)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: '24px', height: '24px', border: '3px solid #e5e7eb',
                borderTopColor: '#004a99', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              <span style={{ fontSize: '0.82rem', color: '#004a99', fontWeight: 600 }}>
                Envoi en cours…
              </span>
            </div>
          )}
        </div>

        {/* ── Colonne droite : contrôles ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          justifyContent: 'flex-start',
          padding: '4px 0',
        }}>

          {/* Bouton upload */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '9px 14px',
              background: '#004a99', color: 'white',
              border: 'none', borderRadius: '8px',
              fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {value ? 'Changer l\'image' : 'Joindre un fichier'}
          </button>

          {/* Bouton URL */}
          <button
            type="button"
            onClick={() => setShowUrl((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '9px 14px',
              background: showUrl ? '#e0f2fe' : '#f3f4f6',
              color: showUrl ? '#0369a1' : '#6b7280',
              border: `1px solid ${showUrl ? '#bae6fd' : '#e5e7eb'}`,
              borderRadius: '8px', fontSize: '0.83rem',
              fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            Coller une URL
          </button>

          {/* Input URL — transition fluide, ne touche pas la colonne image */}
          <div style={{
            overflow: 'hidden',
            maxHeight: showUrl ? '44px' : '0',
            opacity: showUrl ? 1 : 0,
            transition: 'max-height 0.2s ease, opacity 0.15s ease',
          }}>
            <input
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={{
                width: '100%', padding: '9px 12px',
                border: '1px solid #d1d5db', borderRadius: '8px',
                fontSize: '0.83rem', boxSizing: 'border-box',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Supprimer */}
          {value && !uploading && (
            <button
              type="button"
              onClick={() => { onChange(''); setShowUrl(false); setError(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '9px 14px',
                background: '#fef2f2', color: '#dc2626',
                border: '1px solid #fecaca', borderRadius: '8px',
                fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              Supprimer l&apos;image
            </button>
          )}

          {/* Espace bas avec hint / erreur */}
          <div style={{ marginTop: 'auto' }}>
            {error && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, margin: 0 }}>
                ⚠ {error}
              </p>
            )}
            {hint && !error && (
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                {hint}
              </p>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
