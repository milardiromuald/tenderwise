'use client';

import { useEffect, useRef, useState } from 'react';

// ── Éditeur visuel (WYSIWYG) ─────────────────────────────────────────────────
// Édite directement le rendu HTML de l’article (contentEditable) : le HTML est
// la source unique, donc AUCUNE conversion lossy — tableaux, liens, listes sont
// préservés à 100 %. Une bascule « HTML » reste disponible pour le contrôle fin.
// Réutilisable (workflow de validation, éditeur d’articles admin…).

const ALLOWED: Record<string, string[]> = {
  h1: [], h2: [], h3: [], p: [], br: [], strong: [], b: [], em: [], i: [], u: [], s: [],
  a: ['href'], ul: [], ol: [], li: [], blockquote: [],
  table: [], thead: [], tbody: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
};
const DROP = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'noscript'];

/** href autorisé (anti-XSS) : http(s), mailto, ancre ou chemin relatif. */
function sanitizeHref(href: string): string {
  const h = (href || '').trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(h) ? h : '';
}

/** Nettoie le HTML : liste blanche de balises/attributs, neutralise tout le reste. */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 1) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (DROP.includes(tag)) { node.removeChild(el); return; }
        if (!(tag in ALLOWED)) {
          // Balise non autorisée → on garde son contenu (nettoyé), on retire l’enveloppe.
          walk(el);
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          node.removeChild(el);
          return;
        }
        Array.from(el.attributes).forEach((attr) => {
          if (!ALLOWED[tag].includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
        });
        if (tag === 'a') {
          const href = sanitizeHref(el.getAttribute('href') || '');
          if (href) el.setAttribute('href', href); else el.removeAttribute('href');
        }
        walk(el);
      } else if (child.nodeType !== 3) {
        node.removeChild(child); // commentaires, etc.
      }
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

const TABLE_HTML =
  '<table><thead><tr><th>En-tête 1</th><th>En-tête 2</th></tr></thead>' +
  '<tbody><tr><td>Cellule</td><td>Cellule</td></tr>' +
  '<tr><td>Cellule</td><td>Cellule</td></tr></tbody></table><p><br></p>';

interface LinkState { top: number; left: number; text: string; href: string }

export default function RichEditor({
  value,
  onChange,
  minHeight = 420,
  stickyTop = 0,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  /** Décalage du haut pour la barre d’outils collante (sous une éventuelle barre fixe). */
  stickyTop?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const linkElRef = useRef<HTMLAnchorElement | null>(null); // <a> en cours d’édition (hors state : mutable)
  const [mode, setMode] = useState<'visuel' | 'html'>('visuel');
  const [link, setLink] = useState<LinkState | null>(null);

  // Initialise le contenu éditable ; ré-applique si `value` change hors frappe
  // (le garde-fou activeElement évite tout saut de curseur pendant la saisie).
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  // Ferme le mini-éditeur de lien si on clique en dehors.
  useEffect(() => {
    if (!link) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || linkElRef.current?.contains(t)) return;
      setLink(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [link]);

  const sync = () => { if (ref.current) onChange(ref.current.innerHTML); };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    sync();
  };
  const format = (tag: string) => exec('formatBlock', `<${tag}>`);

  // ── Mini-éditeur de lien (clic ou survol sur un <a>) ──
  const openLinkEditor = (a: HTMLAnchorElement) => {
    const cont = containerRef.current;
    if (!cont) return;
    const r = a.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    const left = Math.max(0, Math.min(r.left - cr.left, cont.clientWidth - 300));
    linkElRef.current = a;
    setLink({ top: r.bottom - cr.top + 6, left, text: a.textContent || '', href: a.getAttribute('href') || '' });
  };

  const onContentClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (a && ref.current?.contains(a)) { e.preventDefault(); openLinkEditor(a as HTMLAnchorElement); }
  };
  const onContentMouseOver = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (a && ref.current?.contains(a) && linkElRef.current !== a) openLinkEditor(a as HTMLAnchorElement);
  };

  const newLink = () => {
    const sel = window.getSelection();
    const text = sel?.toString() || '';
    ref.current?.focus();
    // Crée un lien (sur la sélection, ou insère un libellé par défaut).
    document.execCommand('createLink', false, 'https://example.com');
    sync();
    // Ouvre aussitôt le mini-éditeur sur le lien fraîchement créé.
    requestAnimationFrame(() => {
      const a = ref.current?.querySelector('a[href="https://example.com"]') as HTMLAnchorElement | null;
      if (a) { if (!text) a.textContent = 'lien'; openLinkEditor(a); }
    });
  };

  const applyLink = () => {
    const a = linkElRef.current;
    if (!link || !a) return;
    const href = sanitizeHref(link.href);
    if (!href) { window.alert('Lien refusé : seuls http(s), mailto et liens internes sont autorisés.'); return; }
    a.textContent = link.text.trim() || href;
    a.setAttribute('href', href);
    setLink(null);
    sync();
  };

  const removeLink = () => {
    const a = linkElRef.current;
    if (!link || !a) return;
    const parent = a.parentNode;
    if (parent) { while (a.firstChild) parent.insertBefore(a.firstChild, a); parent.removeChild(a); }
    setLink(null);
    sync();
  };

  // ── Opérations sur les tableaux ──
  const currentCell = (): HTMLTableCellElement | null => {
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.anchorNode) return null;
    let n: Node | null = sel.anchorNode;
    while (n && n !== root) {
      if (n.nodeType === 1 && /^(td|th)$/i.test((n as HTMLElement).tagName)) return n as HTMLTableCellElement;
      n = n.parentNode;
    }
    return null;
  };

  const insertTable = () => exec('insertHTML', TABLE_HTML);

  const addRow = (after: boolean) => {
    const cell = currentCell(); if (!cell) return alertTable();
    const tr = cell.parentElement as HTMLTableRowElement;
    const cols = tr.children.length;
    const newTr = document.createElement('tr');
    for (let i = 0; i < cols; i++) { const td = document.createElement('td'); td.innerHTML = '<br>'; newTr.appendChild(td); }
    tr.parentElement!.insertBefore(newTr, after ? tr.nextSibling : tr);
    sync();
  };

  const addCol = (after: boolean) => {
    const cell = currentCell(); if (!cell) return alertTable();
    const table = cell.closest('table'); if (!table) return;
    const idx = cell.cellIndex;
    table.querySelectorAll('tr').forEach((tr) => {
      const inHead = tr.parentElement?.tagName.toLowerCase() === 'thead';
      const c = document.createElement(inHead ? 'th' : 'td');
      c.innerHTML = '<br>';
      const refCell = tr.children[idx] || null;
      tr.insertBefore(c, after ? (refCell ? refCell.nextSibling : null) : refCell);
    });
    sync();
  };

  const delRow = () => {
    const cell = currentCell(); if (!cell) return alertTable();
    const tr = cell.parentElement as HTMLTableRowElement;
    const table = tr.closest('table')!;
    tr.remove();
    if (!table.querySelector('tr')) table.remove();
    sync();
  };

  const delCol = () => {
    const cell = currentCell(); if (!cell) return alertTable();
    const table = cell.closest('table'); if (!table) return;
    const idx = cell.cellIndex;
    table.querySelectorAll('tr').forEach((tr) => { if (tr.children[idx]) tr.children[idx].remove(); });
    if (!table.querySelector('td,th')) table.remove();
    sync();
  };

  const delTable = () => {
    const cell = currentCell(); if (!cell) return alertTable();
    cell.closest('table')?.remove();
    sync();
  };

  const alertTable = () => window.alert('Placez d’abord le curseur dans une cellule du tableau.');

  // Collage : on insère en texte brut pour éviter le HTML parasite des autres sites.
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    sync();
  };

  const onBlur = (e: React.FocusEvent) => {
    // Ne pas nettoyer si le focus part vers le mini-éditeur de lien (sinon il se ferme).
    if (popRef.current?.contains(e.relatedTarget as Node)) return;
    if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML));
  };

  const switchTo = (m: 'visuel' | 'html') => {
    if (m === mode) return;
    setLink(null);
    if (m === 'html') {
      const clean = ref.current ? sanitizeHtml(ref.current.innerHTML) : value;
      onChange(clean);
      setMode('html');
    } else {
      setMode('visuel');
      requestAnimationFrame(() => { if (ref.current) ref.current.innerHTML = value; });
    }
  };


  return (
    <div ref={containerRef} style={{ position: 'relative', border: '1.5px solid #e2e8f0', borderRadius: 10, background: 'white' }}>
      <style>{`
        .rich-content { padding: 16px 18px; outline: none; line-height: 1.7; color: #0f172a; font-size: 15px; }
        .rich-content:focus { box-shadow: inset 0 0 0 2px rgba(0,74,153,.12); }
        .rich-content h1 { font-family: Montserrat, sans-serif; font-size: 1.5rem; color: #003366; margin: 1rem 0 .5rem; }
        .rich-content h2 { font-family: Montserrat, sans-serif; font-size: 1.2rem; color: #003366; margin: 1.1rem 0 .4rem; }
        .rich-content h3 { font-family: Montserrat, sans-serif; font-size: 1.02rem; color: #004a99; margin: .9rem 0 .3rem; }
        .rich-content p { margin: .5rem 0; }
        .rich-content ul, .rich-content ol { padding-left: 1.5rem; margin: .5rem 0; }
        .rich-content blockquote { border-left: 4px solid #c5a059; padding: .5rem 1rem; background: #fffbf0; color: #6b4c12; margin: .75rem 0; border-radius: 0 8px 8px 0; font-style: italic; }
        .rich-content a { color: #004a99; text-decoration: underline; cursor: pointer; }
        .rich-content strong { color: #111827; }
        .rich-content table { border-collapse: collapse; width: 100%; margin: .75rem 0; font-size: .92em; }
        .rich-content th, .rich-content td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
        .rich-content th { background: #f1f5f9; font-weight: 700; }
        .rich-content:empty::before { content: 'Rédigez ici…'; color: #94a3b8; }
      `}</style>

      {/* ── Barre d’outils (collante au défilement) ── */}
      <div style={{ position: 'sticky', top: stickyTop, zIndex: 5, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderRadius: '9px 9px 0 0' }}>
        {mode === 'visuel' && (
          <>
            <ToolBtn label="G" title="Gras" onClick={() => exec('bold')} extra={{ fontWeight: 800 }} />
            <ToolBtn label="I" title="Italique" onClick={() => exec('italic')} extra={{ fontStyle: 'italic' }} />
            <ToolSep />
            <ToolBtn label="Titre" title="Sous-titre (H2)" onClick={() => format('h2')} />
            <ToolBtn label="Sous-titre" title="Sous-section (H3)" onClick={() => format('h3')} />
            <ToolBtn label="¶" title="Paragraphe normal" onClick={() => format('p')} />
            <ToolSep />
            <ToolBtn label="• Liste" title="Liste à puces" onClick={() => exec('insertUnorderedList')} />
            <ToolBtn label="1. Liste" title="Liste numérotée" onClick={() => exec('insertOrderedList')} />
            <ToolBtn label="❝" title="Citation" onClick={() => format('blockquote')} />
            <ToolBtn label="🔗" title="Insérer un lien" onClick={newLink} />
            <ToolSep />
            <ToolBtn label="⊞ Tableau" title="Insérer un tableau" onClick={insertTable} />
            <ToolBtn label="+Ligne" title="Ajouter une ligne en dessous" onClick={() => addRow(true)} />
            <ToolBtn label="+Col" title="Ajouter une colonne à droite" onClick={() => addCol(true)} />
            <ToolBtn label="−Ligne" title="Supprimer la ligne" onClick={delRow} />
            <ToolBtn label="−Col" title="Supprimer la colonne" onClick={delCol} />
            <ToolBtn label="×Tab" title="Supprimer le tableau" onClick={delTable} extra={{ color: '#dc2626' }} />
          </>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', border: '1.5px solid #cbd5e1', borderRadius: 7, overflow: 'hidden' }}>
          <button type="button" onClick={() => switchTo('visuel')} style={toggle(mode === 'visuel')}>Visuel</button>
          <button type="button" onClick={() => switchTo('html')} style={toggle(mode === 'html')}>HTML</button>
        </div>
      </div>

      {/* ── Zone d’édition ── */}
      {mode === 'visuel' ? (
        <div
          ref={ref}
          className="rich-content"
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onBlur={onBlur}
          onPaste={onPaste}
          onClick={onContentClick}
          onMouseOver={onContentMouseOver}
          style={{ minHeight }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%', minHeight, border: 'none', outline: 'none', resize: 'vertical',
            padding: '14px 16px', boxSizing: 'border-box', color: '#0f172a',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6,
          }}
        />
      )}

      {/* ── Mini-éditeur de lien (survol / clic sur un lien) ── */}
      {link && mode === 'visuel' && (
        <div
          ref={popRef}
          style={{
            position: 'absolute', top: link.top, left: link.left, zIndex: 20, width: 290,
            background: 'white', border: '1px solid #cbd5e1', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,.16)', padding: 12,
          }}
        >
          <label style={popLabel}>Texte affiché</label>
          <input
            value={link.text}
            onChange={(e) => setLink({ ...link, text: e.target.value })}
            style={popInput}
            placeholder="Texte du lien"
          />
          <label style={popLabel}>URL</label>
          <input
            value={link.href}
            onChange={(e) => setLink({ ...link, href: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); }}
            style={popInput}
            placeholder="https://…"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
            <button type="button" onClick={applyLink} style={popBtn('#004a99', 'white')}>Appliquer</button>
            <a href={sanitizeHref(link.href) || '#'} target="_blank" rel="noopener noreferrer" style={{ ...popBtn('#f1f5f9', '#334155'), textDecoration: 'none', display: 'inline-block', pointerEvents: sanitizeHref(link.href) ? 'auto' : 'none', opacity: sanitizeHref(link.href) ? 1 : 0.5 }}>Ouvrir ↗</a>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={removeLink} title="Retirer le lien (garder le texte)" style={popBtn('white', '#dc2626', '#fecaca')}>Retirer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ label, title, onClick, extra }: { label: string; title?: string; onClick: () => void; extra?: React.CSSProperties }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} style={{ ...toolBtn, ...extra }}>
      {label}
    </button>
  );
}
function ToolSep() {
  return <span style={{ width: 1, background: '#e2e8f0', margin: '0 3px', alignSelf: 'stretch' }} />;
}

const toolBtn: React.CSSProperties = {
  padding: '5px 9px', background: 'white', color: '#374151', border: '1px solid #e2e8f0',
  borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap',
};

function toggle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', border: 'none', background: active ? '#004a99' : 'white',
    color: active ? 'white' : '#475569', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
  };
}

const popLabel: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 3px',
};
const popInput: React.CSSProperties = {
  width: '100%', padding: '7px 9px', border: '1.5px solid #e2e8f0', borderRadius: 7,
  fontSize: 13, boxSizing: 'border-box', outline: 'none', color: '#0f172a', marginBottom: 8,
};
function popBtn(bg: string, color: string, border?: string): React.CSSProperties {
  return {
    padding: '6px 12px', border: border ? `1.5px solid ${border}` : 'none', borderRadius: 7,
    background: bg, color, fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
  };
}
