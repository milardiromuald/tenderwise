'use client';

import { useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProjectFull {
  id: number; nom: string; annees?: string; budget_fmt?: string;
  client?: string; categorie?: string; type_etablissement?: string;
  description?: string; missions?: string; images?: string;
}

interface SettingsData {
  ownerName: string; companyName: string;
  phone: string; email: string; address: string; siren: string;
}

interface Props { id: number; nom: string; client: string }

// ─── Image loading ─────────────────────────────────────────────────────────────

interface ImgData { dataUrl: string; natW: number; natH: number }

async function fetchImg(url: string): Promise<ImgData | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : window.location.origin + url;
    const res = await fetch(fullUrl);
    if (!res.ok) { console.error('[PDF] image HTTP', res.status, fullUrl); return null; }
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('FileReader failed'));
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload  = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
      img.onerror = () => resolve({ w: 400, h: 300 });
      img.src = dataUrl;
    });
    return { dataUrl, natW: dims.w, natH: dims.h };
  } catch (e) { console.error('[PDF] fetchImg', url, e); return null; }
}

function todayStr() {
  const d = new Date();
  return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('/');
}

// ─── PDF generation ─────────────────────────────────────────────────────────────

async function buildPDF(
  project: ProjectFull,
  s: SettingsData,
  maitreDOuvrage: string,
  sigNom: string, sigPrenom: string, sigTel: string, sigMail: string,
  sigFaitA: string, sigDate: string,
): Promise<void> {

  const { jsPDF } = await import('jspdf');

  const imgUrls: string[] = (() => { try { return JSON.parse(project.images||'[]'); } catch { return []; } })().slice(0,4);
  const loadedPhotos = await Promise.all(imgUrls.map(fetchImg));

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW=210, PH=297, M=15, CW=PW-2*M;

  // ── Palette (reprend l’identité visuelle du site) ──────────────────────────
  type RGB = [number,number,number];
  const NAVY:    RGB = [0,   51,  102];
  const BLUE:    RGB = [0,   74,  153];
  const GOLD:    RGB = [197, 160,  89];
  const LT_BLUE: RGB = [235, 244, 255];
  const LT_GRAY: RGB = [249, 250, 251];
  const BORDER:  RGB = [229, 231, 235];
  const TXT_D:   RGB = [17,  24,  39];
  const TXT_G:   RGB = [107, 114, 128];
  const WHITE:   RGB = [255, 255, 255];
  const HDR_SUB: RGB = [180, 205, 240];   // gris-bleu clair pour sous-titres header
  const HDR_TXT: RGB = [150, 185, 225];   // encore plus clair pour 3e ligne

  // ── Helpers ────────────────────────────────────────────────────────────────

  function sf(sz: number, style: 'normal'|'bold'|'italic'='normal', col: RGB=TXT_D) {
    doc.setFontSize(sz); doc.setFont('helvetica', style); doc.setTextColor(...col);
  }
  function tx(s: string, x: number, y: number, opts: { align?:'left'|'center'|'right'; maxWidth?: number }={}) {
    doc.text(s, x, y, { align: opts.align ?? 'left', maxWidth: opts.maxWidth });
  }
  function txLines(lines: string[], x: number, startY: number) {
    const step = doc.getFontSize() * 1.15 * (25.4 / 72);
    lines.forEach((l, i) => doc.text(l, x, startY + i * step, { align: 'left' }));
  }
  function cell(x: number, y: number, w: number, h: number, bg: RGB, bd: RGB=BORDER) {
    doc.setFillColor(...bg); doc.setDrawColor(...bd); doc.setLineWidth(0.18);
    doc.rect(x, y, w, h, 'FD');
  }
  function lh(pts: number) { return pts * 1.15 * (25.4 / 72); }
  function fitBox(nw: number, nh: number, bx: number, by: number, bw: number, bh: number) {
    const sc = Math.min(bw/nw, bh/nh);
    return { x: bx+(bw-nw*sc)/2, y: by+(bh-nh*sc)/2, w: nw*sc, h: nh*sc };
  }

  // Section heading: blue left bar + label in NAVY
  function secHead(label: string, sy: number): number {
    doc.setFillColor(...BLUE); doc.rect(M, sy, 3, 7, 'F');
    sf(9.5,'bold',NAVY); tx(label, M+7, sy+5.5);
    return sy + 12;
  }

  // 4-col table row; mutates y externally via closure
  const LW=50, MV=38, RL=38, RV=CW-LW-MV-RL;  // 180-50-38-38=54
  function row4(l1:string, v1:string, l2:string, v2:string, rh:number) {
    cell(M,           y, LW, rh, LT_BLUE); cell(M+LW,        y, MV, rh, WHITE);
    cell(M+LW+MV,     y, RL, rh, LT_BLUE); cell(M+LW+MV+RL, y, RV, rh, WHITE);
    const mid = y + rh/2 + 2.5;
    sf(7.5,'bold',BLUE);  txLines(doc.splitTextToSize(l1, LW-4), M+3,        y+5);
    sf(8,'normal',TXT_D); tx(v1||'—', M+LW+3,        mid, { maxWidth:MV-4 });
    sf(7.5,'bold',BLUE);  txLines(doc.splitTextToSize(l2, RL-3), M+LW+MV+2, y+5);
    sf(8,'normal',TXT_D); tx(v2||'—', M+LW+MV+RL+2,  mid, { maxWidth:RV-3 });
    y += rh;
  }

  // 2-col full-width row (label | value spanning rest)
  function row2(label: string, value: string, rh: number) {
    cell(M, y, LW, rh, LT_BLUE); cell(M+LW, y, CW-LW, rh, WHITE);
    const mid = y + rh/2 + 2.5;
    sf(7.5,'bold',BLUE);  tx(label, M+3, mid);
    sf(8,'normal',TXT_D); tx(value||'—', M+LW+3, mid, { maxWidth: CW-LW-6 });
    y += rh;
  }

  const footerLabel = `Fiche de Référence — ${(project.nom||'').slice(0,50)}`;
  const missionLines = (project.missions||'').split('\n').map(s=>s.trim()).filter(Boolean);

  // ── Shared layout variable (mutated by row4/row2) ─────────────────────────
  let y = 0;

  // ════════════════════════════════════════════════════════════════
  // PAGE 1
  // ════════════════════════════════════════════════════════════════

  // ── HEADER BAND (navy, full width) ─────────────────────────────
  const HDR_H = 30;
  doc.setFillColor(...NAVY); doc.rect(0, 0, PW, HDR_H, 'F');
  // Gold left accent bar
  doc.setFillColor(...GOLD); doc.rect(0, 0, 5, HDR_H, 'F');
  // Gold bottom separator
  doc.setFillColor(...GOLD); doc.rect(0, HDR_H, PW, 1, 'F');

  // Left: document title
  sf(13,'bold',WHITE);
  tx('FICHE DE RÉFÉRENCE TECHNIQUE', 12, 12);
  sf(7.5,'normal',HDR_SUB);
  tx("Assistance à Maîtrise d’Ouvrage & Conduite d’Opération", 12, 21);

  // Right: prestataire identification
  const rX = PW - M;
  sf(8.5,'bold',WHITE);
  tx(s.ownerName||'Romuald de Milardi', rX, 10, { align:'right' });
  sf(7.5,'normal',HDR_SUB);
  tx(s.companyName||'TenderWise', rX, 17, { align:'right' });
  const ctLine = [s.phone, s.email].filter(Boolean).join('  ·  ');
  if (ctLine) { sf(6.5,'normal',HDR_TXT); tx(ctLine, rX, 24, { align:'right' }); }

  y = HDR_H + 5;

  // ── PROJECT TITLE BAND (light-blue) ────────────────────────────
  const nomLines = doc.splitTextToSize(project.nom||'', CW - 50);
  const projBandH = Math.max(nomLines.length * lh(11.5) + 7, 14);
  doc.setFillColor(...LT_BLUE); doc.rect(M, y, CW, projBandH, 'F');
  doc.setFillColor(...BLUE);    doc.rect(M, y, 4, projBandH, 'F');

  // Project name
  sf(11.5,'bold',NAVY); txLines(nomLines, M+9, y + 6.5);

  // Right badges (category, period)
  const badges = [project.categorie, project.annees].filter(Boolean) as string[];
  let bx = M + CW - 3;
  sf(6.5,'bold',BLUE);
  [...badges].reverse().forEach((badge) => {
    const bw = doc.getTextWidth(badge) + 8;
    bx -= bw;
    doc.setFillColor(255,255,255); doc.setDrawColor(...BLUE); doc.setLineWidth(0.3);
    doc.roundedRect(bx, y+4, bw, 6.5, 1, 1, 'FD');
    sf(6.5,'bold',BLUE); tx(badge, bx+4, y+9);
    bx -= 3;
  });

  y += projBandH + 6;

  // ── INFORMATIONS DU PROJET ─────────────────────────────────────
  y = secHead('INFORMATIONS DU PROJET', y);

  row2("Client / Maîtrise d’Ouvrage", maitreDOuvrage, 10);
  row4('Catégorie', project.type_etablissement||project.categorie||'',
       "Budget de l’Opération", project.budget_fmt||'', 9);
  row4('Prestataire', s.companyName||'TenderWise',
       'Période de Réalisation', project.annees||'', 9);
  y += 6;

  // ── DESCRIPTION ────────────────────────────────────────────────
  y = secHead("DESCRIPTION DE L’OPÉRATION", y);
  sf(8.5,'normal',TXT_D);
  const rawDL = doc.splitTextToSize(project.description||'Aucune description disponible.', CW-8);
  const maxDLines = Math.floor(46 / lh(8.5));
  const dLines = rawDL.length > maxDLines
    ? [...rawDL.slice(0, maxDLines-1), rawDL[maxDLines-1].replace(/.{3}$/, '…')]
    : rawDL;
  const dH = Math.max(dLines.length * lh(8.5) + 8, 14);
  doc.setFillColor(250,251,255); doc.setDrawColor(...BORDER); doc.setLineWidth(0.18);
  doc.rect(M, y, CW, dH, 'FD');
  sf(8.5,'normal',TXT_D); txLines(dLines, M+4, y+5.5);
  y += dH + 7;

  // ── PRESTATIONS ────────────────────────────────────────────────
  y = secHead('PRESTATIONS RÉALISÉES & COMPÉTENCES VALIDÉES', y);

  if (missionLines.length === 0) {
    cell(M, y, CW, 10, LT_GRAY);
    sf(8,'normal',TXT_G); tx('Aucune mission renseignée.', M+4, y+6.5);
    y += 10;
  } else {
    missionLines.forEach((mission, i) => {
      sf(8,'normal',TXT_D);
      const ml = doc.splitTextToSize(mission, CW-13);
      const rh = Math.max(ml.length * lh(8) + 6, 10);
      if (y + rh > PH - 16) {
        doc.addPage();
        y = M;
      }
      cell(M, y, CW, rh, i%2===0 ? WHITE : LT_GRAY);
      // Blue square bullet
      doc.setFillColor(...BLUE);
      doc.rect(M+4, y+rh/2-1.2, 2.2, 2.2, 'F');
      sf(8,'normal',TXT_D); txLines(ml, M+9, y+5.5);
      y += rh;
    });
  }

  // ── PHOTOS ─────────────────────────────────────────────────────
  if (imgUrls.length > 0) {
    const photoSecH = 12 + 4; // secHead height
    const cols  = Math.min(imgUrls.length, 2);
    const gap   = 5;
    const phW   = cols === 1 ? CW : (CW - gap) / 2;
    const phH   = 52;
    const numRows = Math.ceil(imgUrls.length / 2);
    const gridH = numRows * phH + (numRows-1) * gap;

    if (y + photoSecH + gridH > PH - 16) {
      doc.addPage();
      y = M;
    }

    y = secHead('VISUELS DU PROJET', y);
    y += 2;

    for (let i = 0; i < imgUrls.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const px  = M + col * (phW + gap);
      const py  = y + row * (phH + gap);
      const p   = loadedPhotos[i];

      if (p) {
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.15);
        doc.rect(px, py, phW, phH, 'D');
        const f = fitBox(p.natW, p.natH, px, py, phW, phH);
        const fmt = p.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(p.dataUrl, fmt, f.x, f.y, f.w, f.h);
      } else {
        cell(px, py, phW, phH, LT_GRAY);
        sf(7.5,'normal',TXT_G); tx(`Photo ${i+1}`, px+phW/2, py+phH/2+2, { align:'center' });
      }
    }
    y += gridH + 8;
  }

  // ── VALIDATION ─────────────────────────────────────────────────
  const introTxt =
    `Le représentant soussigné de la Maîtrise d’Ouvrage certifie que les prestations ` +
    `de conduite d’opération et d’assistance à maîtrise d’ouvrage confiées à ` +
    `${s.companyName||'TenderWise'}, représentée par ${s.ownerName||'Romuald de Milardi'}, ` +
    `ont été exécutées conformément aux règles de l’art et valide l’ensemble ` +
    `des compétences techniques et organisationnelles démontrées.`;
  const introL = doc.splitTextToSize(introTxt, CW-10);

  const fieldRowH = 9;
  const sigBoxH   = 32;
  const BLK_H = 11 + introL.length*lh(8) + 8 + 3*fieldRowH + 7 + sigBoxH + 6;

  if (y + BLK_H > PH - 16) {
    doc.addPage();
    y = M;
  }

  // Outer border
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
  doc.rect(M, y, CW, BLK_H, 'D');

  // Title bar
  doc.setFillColor(...NAVY); doc.rect(M, y, CW, 11, 'F');
  sf(8.5,'bold',WHITE);
  tx('VALIDATION DES COMPÉTENCES & PROCÈS-VERBAL DE FIN DE MISSION', PW/2, y+7.5, { align:'center' });

  // Gold accent under title bar
  doc.setFillColor(...GOLD); doc.rect(M, y+11, CW, 0.8, 'F');

  let bY = y + 15;
  sf(8,'normal',TXT_D); txLines(introL, M+5, bY);
  bY += introL.length * lh(8) + 7;

  // Fields sub-box
  const fBoxH = 3*fieldRowH + 6;
  doc.setFillColor(248,250,254); doc.setDrawColor(...BORDER); doc.setLineWidth(0.15);
  doc.rect(M+4, bY, CW-8, fBoxH, 'FD');
  bY += 4;

  const midX     = M + 4 + (CW-8)/2;
  const leftEnd  = midX - 3;
  const rightEnd = M + CW - 5;

  function sigField(label: string, value: string, x: number, fy: number, endX: number) {
    sf(7.5,'bold',TXT_D); const lbl = `${label} :`;
    tx(lbl, x, fy);
    const lblW = doc.getTextWidth(lbl) + 3;
    if (value.trim()) {
      sf(8,'normal',BLUE); tx(value, x+lblW, fy, { maxWidth: endX-x-lblW-1 });
    } else {
      doc.setDrawColor(190,210,230); doc.setLineDashPattern([0.8,1.2],0); doc.setLineWidth(0.18);
      doc.line(x+lblW, fy+0.5, endX, fy+0.5);
      doc.setLineDashPattern([],0);
    }
  }

  sigField('Nom',       sigNom,    M+7, bY, leftEnd);
  sigField('Téléphone', sigTel,    midX, bY, rightEnd);
  bY += fieldRowH;
  sigField('Prénom',    sigPrenom, M+7, bY, leftEnd);
  sigField('Mail',      sigMail,   midX, bY, rightEnd);
  bY += fieldRowH;
  sigField('Fait à',    sigFaitA,  M+7, bY, leftEnd);
  sigField('Le',        sigDate,   midX, bY, rightEnd);
  bY += fieldRowH + 4;

  // Signature box
  doc.setFillColor(235,242,255); doc.setDrawColor(...BLUE); doc.setLineWidth(0.3);
  doc.rect(M+4, bY, CW-8, sigBoxH, 'FD');

  sf(9,'bold',NAVY);  tx("Pour la Maîtrise d’Ouvrage", M+8, bY+8);
  sf(7.5,'italic',TXT_G);
  tx('Mention manuscrite "Lu et approuvé"', M+8, bY+15);
  tx('Signature & Cachet officiel', M+8, bY+21);

  // Signature line on right half
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.5);
  const sigLineX = M + 4 + (CW-8)*0.52;
  doc.line(sigLineX, bY+sigBoxH-6, M+CW-8, bY+sigBoxH-6);
  sf(7,'normal',TXT_G);
  tx('Signature', sigLineX + (M+CW-8-sigLineX)/2, bY+sigBoxH-2, { align:'center' });

  // ── FOOTER sur toutes les pages ────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Thin separator above footer
    doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
    doc.line(M, PH-12, M+CW, PH-12);
    sf(7,'normal',TXT_G);
    tx(footerLabel, M, PH-8);
    // Page indicator with GOLD accent
    doc.setFillColor(...GOLD); doc.rect(M+CW-18, PH-11, 18, 5, 'F');
    sf(7,'bold',WHITE);
    tx(`${p} / ${totalPages}`, M+CW-9, PH-7.5, { align:'center' });
  }

  // ── Save ────────────────────────────────────────────────────────
  const safe = (project.nom||'projet')
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]/gi,'_').toLowerCase()
    .replace(/_+/g,'_').slice(0,50);
  doc.save(`attestation_${safe}.pdf`);
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AttestationButton({ id, nom, client }: Props) {
  const [open,       setOpen]       = useState(false);
  const [fetching,   setFetching]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');
  const [project,    setProject]    = useState<ProjectFull|null>(null);
  const [settings,   setSettings]   = useState<SettingsData|null>(null);

  // Only user-editable fields remain
  const [maitre,    setMaitre]    = useState('');
  const [sigNom,    setSigNom]    = useState('');
  const [sigPrenom, setSigPrenom] = useState('');
  const [sigTel,    setSigTel]    = useState('');
  const [sigMail,   setSigMail]   = useState('');
  const [sigFaitA,  setSigFaitA]  = useState('');
  const [sigDate,   setSigDate]   = useState(todayStr);

  async function openModal() {
    setFetching(true);
    try {
      const [projRes, settingsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch('/api/settings'),
      ]);
      if (projRes.ok) {
        const d: ProjectFull = await projRes.json();
        setProject(d);
        setMaitre(d.client || client || '');
      } else {
        setProject({ id, nom, client });
        setMaitre(client || '');
      }
      if (settingsRes.ok) {
        const raw = await settingsRes.json();
        setSettings({
          ownerName:   raw.owner_name    || 'Romuald de Milardi',
          companyName: raw.company_name  || 'TenderWise',
          phone:       raw.contact_phone || '',
          email:       raw.contact_email || '',
          address:     raw.contact_address || '',
          siren:       raw.footer_siren  || '',
        });
      } else {
        setSettings({ ownerName:'Romuald de Milardi', companyName:'TenderWise', phone:'', email:'', address:'', siren:'' });
      }
    } catch {
      setProject({ id, nom, client });
      setMaitre(client || '');
      setSettings({ ownerName:'Romuald de Milardi', companyName:'TenderWise', phone:'', email:'', address:'', siren:'' });
    }
    setSigDate(todayStr());
    setFetching(false);
    setOpen(true);
  }

  async function handleGenerate() {
    if (!maitre.trim()) {
      setGenError("Veuillez renseigner le maître d’ouvrage.");
      return;
    }
    setGenError('');
    setGenerating(true);
    try {
      await buildPDF(
        project!,
        settings!,
        maitre,
        sigNom, sigPrenom, sigTel, sigMail, sigFaitA, sigDate,
      );
      setOpen(false);
    } catch (err) {
      console.error('PDF error:', err);
      setGenError('Erreur de génération PDF. Voir la console.');
    } finally {
      setGenerating(false);
    }
  }

  const canGen = !generating && maitre.trim() !== '';

  // ── Styles ──────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width:'100%', padding:'9px 12px', border:'1px solid #d1d5db',
    borderRadius:'7px', fontSize:'0.88rem', outline:'none',
    boxSizing:'border-box', fontFamily:'inherit', background:'white',
  };
  const lbl: React.CSSProperties = {
    display:'block', fontSize:'0.72rem', fontWeight:700, color:'#374151',
    textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'5px',
  };
  const sectionTitle: React.CSSProperties = {
    fontSize:'0.72rem', fontWeight:700, color:'#004a99',
    textTransform:'uppercase', letterSpacing:'0.6px',
    marginBottom:'0.7rem', paddingBottom:'0.4rem',
    borderBottom:'2px solid #e0f2fe',
  };

  return (
    <>
      <button
        onClick={openModal}
        disabled={fetching}
        className="proj-btn"
        style={{
          padding:'6px 12px', background:'#f0fdf4', color:'#166534',
          border:'1px solid #bbf7d0', borderRadius:'6px',
          fontSize:'0.8rem', fontWeight:600,
          cursor: fetching ? 'wait' : 'pointer', whiteSpace:'nowrap',
        }}
      >
        {fetching ? 'Chargement…' : 'Attestation'}
      </button>

      {open && (
        <div
          onClick={e => { if (e.target===e.currentTarget) setOpen(false); }}
          style={{
            position:'fixed', inset:0, zIndex:9999,
            background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'1rem',
          }}
        >
          <div style={{
            background:'white', borderRadius:'16px',
            width:'100%', maxWidth:'560px', maxHeight:'90vh', overflowY:'auto',
            boxShadow:'0 25px 60px rgba(0,0,0,0.22)',
            display:'flex', flexDirection:'column',
          }}>

            {/* ── Modal header ── */}
            <div style={{
              background:'linear-gradient(135deg,#003366,#004a99)',
              borderRadius:'16px 16px 0 0', padding:'1.25rem 1.5rem',
              flexShrink:0,
            }}>
              <h2 style={{ fontFamily:'Montserrat,sans-serif', fontSize:'1.05rem', color:'white', margin:'0 0 0.3rem', fontWeight:700 }}>
                Attestation de référence
              </h2>
              <p style={{ margin:0, fontSize:'0.82rem', color:'rgba(255,255,255,0.7)', fontWeight:400 }}>
                {project?.nom || nom}
              </p>
            </div>

            <div style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>

              {/* ── Prestataire (read-only, from settings) ── */}
              <div>
                <div style={sectionTitle}>Prestataire — pré-rempli depuis vos paramètres</div>
                <div style={{
                  display:'flex', alignItems:'center', gap:'12px',
                  background:'#f0f7ff', border:'1px solid #bfdbfe',
                  borderRadius:'10px', padding:'12px 14px',
                }}>
                  <div style={{
                    width:'40px', height:'40px', borderRadius:'10px',
                    background:'#004a99', display:'flex', alignItems:'center',
                    justifyContent:'center', flexShrink:0,
                  }}>
                    <span style={{ color:'white', fontSize:'1.1rem', fontWeight:700 }}>
                      {(settings?.companyName||'T')[0]}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'0.9rem', color:'#003366' }}>
                      {settings?.ownerName||'Romuald de Milardi'}
                    </div>
                    <div style={{ fontSize:'0.78rem', color:'#6b7280', marginTop:'2px' }}>
                      {settings?.companyName||'TenderWise'}
                      {settings?.phone ? ` · ${settings.phone}` : ''}
                    </div>
                  </div>
                  <div style={{ marginLeft:'auto' }}>
                    <a href="/admin/settings" style={{ fontSize:'0.72rem', color:'#004a99', textDecoration:'none', border:'1px solid #bfdbfe', borderRadius:'5px', padding:'3px 8px' }}>
                      Modifier
                    </a>
                  </div>
                </div>
              </div>

              {/* ── Maître d’ouvrage ── */}
              <div>
                <div style={sectionTitle}>Informations du projet</div>
                <label style={lbl}>Maître d&apos;ouvrage *</label>
                <input
                  type="text" value={maitre} onChange={e=>setMaitre(e.target.value)}
                  placeholder="Ex : Ville de Lyon, Conseil Régional…"
                  style={inp} autoFocus
                />
              </div>

              {/* ── Signataire MO ── */}
              <div>
                <div style={sectionTitle}>Signataire — Maîtrise d&apos;Ouvrage</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                  <div>
                    <label style={lbl}>Nom</label>
                    <input type="text" value={sigNom} onChange={e=>setSigNom(e.target.value)} placeholder="Dupont" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Prénom</label>
                    <input type="text" value={sigPrenom} onChange={e=>setSigPrenom(e.target.value)} placeholder="Jean" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Téléphone</label>
                    <input type="tel" value={sigTel} onChange={e=>setSigTel(e.target.value)} placeholder="06 12 34 56 78" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Adresse mail</label>
                    <input type="email" value={sigMail} onChange={e=>setSigMail(e.target.value)} placeholder="nom@exemple.fr" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Fait à</label>
                    <input type="text" value={sigFaitA} onChange={e=>setSigFaitA(e.target.value)} placeholder="Lyon" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Date</label>
                    <input type="text" value={sigDate} onChange={e=>setSigDate(e.target.value)} placeholder="JJ/MM/AAAA" style={inp} />
                  </div>
                </div>
              </div>

            </div>

            {/* ── Actions ── */}
            <div style={{
              display:'flex', gap:'10px', justifyContent:'flex-end',
              borderTop:'1px solid #f3f4f6', padding:'1rem 1.5rem',
              background:'#fafafa', borderRadius:'0 0 16px 16px', flexShrink:0,
            }}>
              <button
                onClick={()=>setOpen(false)}
                style={{ padding:'10px 20px', background:'white', border:'1px solid #d1d5db', borderRadius:'8px', fontWeight:600, cursor:'pointer', fontSize:'0.9rem', color:'#374151' }}
              >
                Annuler
              </button>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
                {genError && (
                  <span style={{ fontSize:'0.75rem', color:'#dc2626', fontWeight:600 }}>{genError}</span>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={!canGen}
                  style={{
                    padding:'10px 26px',
                    background: canGen ? 'linear-gradient(135deg,#003366,#004a99)' : '#9ca3af',
                    color:'white', border:'none', borderRadius:'8px',
                    fontWeight:700, cursor:canGen?'pointer':'not-allowed',
                    fontSize:'0.9rem', fontFamily:'Montserrat,sans-serif',
                  }}
                >
                  {generating ? 'Génération…' : 'Télécharger le PDF'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
