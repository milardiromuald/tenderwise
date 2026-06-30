'use client';

import { useEffect, useRef, useReducer, useState } from 'react';
import { Stage, Layer, Line, Image as KonvaImage, Text as KonvaText, Rect, Transformer, Group } from 'react-konva';
import type Konva from 'konva';

const STAGE_W = 760;
const STAGE_H = Math.round((STAGE_W * 9) / 16);
const EXPORT_W = 1280;
const SNAP = 6;

const NAVY = '#0a1a2f';
const GOLD = '#c5a059';
const COLORS = [NAVY, '#003366', GOLD, '#ffffff', '#475569'];
const FONTS = ['Montserrat', 'Arial', 'Georgia', 'Times New Roman', 'Verdana'];

// ── Types ────────────────────────────────────────────────────────────────────
type NodeType = 'text' | 'line' | 'group';
interface BaseNode { id: string; type: NodeType; x: number; y: number; rotation: number; opacity: number }
interface TextNode extends BaseNode { type: 'text'; text: string; fontSize: number; fontFamily: string; fill: string; bold: boolean; italic: boolean; align: 'left' | 'center' | 'right'; width: number }
interface LineNode extends BaseNode { type: 'line'; width: number; height: number; fill: string }
interface GroupNode extends BaseNode { type: 'group'; children: (TextNode | LineNode)[] }
type LayerNode = TextNode | LineNode | GroupNode;
type FlatNode = TextNode | LineNode;
interface Guide { dir: 'h' | 'v'; pos: number }
interface CtxMenu { x: number; y: number }

// ── Historique ───────────────────────────────────────────────────────────────
interface HistState { past: LayerNode[][]; present: LayerNode[]; future: LayerNode[][] }
type HistAction = { type: 'SET'; nodes: LayerNode[] } | { type: 'UNDO' } | { type: 'REDO' };

function histReducer(s: HistState, a: HistAction): HistState {
  if (a.type === 'SET')  return { past: [...s.past, s.present], present: a.nodes, future: [] };
  if (a.type === 'UNDO') return s.past.length  ? { past: s.past.slice(0, -1),  present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s;
  if (a.type === 'REDO') return s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s;
  return s;
}

let _seq = 0;
const uid = () => `n${Date.now().toString(36)}${(_seq++).toString(36)}`;

// ── Composant principal ───────────────────────────────────────────────────────
export default function ImageComposer({
  backgroundUrl, initialTitle = '', initialSubtitle = '', backgrounds = [], saving = false, stateKey, onSave, onClose,
}: {
  backgroundUrl: string;
  initialTitle?: string;
  initialSubtitle?: string;
  backgrounds?: { url: string; label?: string }[];
  saving?: boolean;
  /** Clé unique (ex: token review) pour persister/restaurer l'état dans localStorage */
  stateKey?: string;
  onSave: (dataUrl: string, bgUrl: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgUrl, setBgUrl] = useState(() => {
    if (stateKey) {
      try {
        const saved = localStorage.getItem(`ic_bg_${stateKey}`);
        if (saved) return saved;
      } catch { /* ignore */ }
    }
    return backgroundUrl;
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const [hist, dispatch] = useReducer(histReducer, null, () => {
    // Tenter de restaurer l'état sauvegardé (positions, tailles, couleurs des calques)
    if (stateKey) {
      try {
        const saved = localStorage.getItem(`ic_nodes_${stateKey}`);
        if (saved) {
          const parsed = JSON.parse(saved) as LayerNode[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            return { past: [] as LayerNode[][], present: parsed, future: [] as LayerNode[][] };
          }
        }
      } catch { /* si localStorage indisponible ou JSON invalide, on ignore */ }
    }
    // État par défaut (premier lancement ou pas de stateKey)
    return {
      past: [] as LayerNode[][],
      present: [
        { id: uid(), type: 'text' as const, text: (initialTitle || 'TITRE').toUpperCase(), x: 80, y: 150, rotation: 0, opacity: 1, fontSize: 46, fontFamily: 'Montserrat', fill: NAVY, bold: true, italic: false, align: 'center' as const, width: 600 },
        { id: uid(), type: 'line' as const, x: 290, y: 212, rotation: 0, opacity: 1, width: 180, height: 3, fill: GOLD },
        { id: uid(), type: 'text' as const, text: initialSubtitle || 'Sous-titre', x: 130, y: 226, rotation: 0, opacity: 1, fontSize: 22, fontFamily: 'Montserrat', fill: NAVY, bold: false, italic: false, align: 'center' as const, width: 500 },
      ] as LayerNode[],
      future: [] as LayerNode[][],
    };
  });

  const nodes = hist.present;
  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;

  const stageRef = useRef<Konva.Stage>(null);
  const trRef    = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Node>>({});
  const kbRef    = useRef<(e: KeyboardEvent) => void>(() => {});

  // ── Fond ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bgUrl) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setBgImg(img);
    img.onerror = () => setBgImg(null);
    img.src = bgUrl;
  }, [bgUrl]);

  // ── Transformer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const konvaNodes = selectedIds.map(id => shapeRefs.current[id]).filter(Boolean) as Konva.Node[];
    tr.nodes(konvaNodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, nodes]);

  // ── Ferme le menu contextuel au clic extérieur ───────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [ctxMenu]);

  // ── Dérivés ──────────────────────────────────────────────────────────────────
  const selectedId  = selectedIds.length === 1 ? selectedIds[0] : null;
  const selected    = selectedId ? (nodes.find(n => n.id === selectedId) ?? null) : null;
  const isMultiSel  = selectedIds.length > 1;
  const canGroup    = selectedIds.length >= 2;
  const canUngroup  = !!selectedId && selected?.type === 'group';

  // ── Mutations ────────────────────────────────────────────────────────────────
  const setNodes = (ns: LayerNode[]) => dispatch({ type: 'SET', nodes: ns });
  const update = (id: string, patch: Partial<LayerNode>) =>
    setNodes(nodes.map(n => n.id === id ? { ...n, ...patch } as LayerNode : n));

  const addText = (preset?: Partial<TextNode>) => {
    const n: TextNode = { id: uid(), type: 'text', text: 'Nouveau texte', x: 120, y: 120, rotation: 0, opacity: 1, fontSize: 28, fontFamily: 'Montserrat', fill: NAVY, bold: false, italic: false, align: 'center', width: 420, ...preset };
    setNodes([...nodes, n]);
    setSelectedIds([n.id]);
  };

  const addLine = () => {
    const n: LineNode = { id: uid(), type: 'line', x: 290, y: 240, rotation: 0, opacity: 1, width: 180, height: 3, fill: GOLD };
    setNodes([...nodes, n]);
    setSelectedIds([n.id]);
  };

  const removeSelected = () => {
    if (!selectedIds.length) return;
    setNodes(nodes.filter(n => !selectedIds.includes(n.id)));
    setSelectedIds([]);
  };

  const duplicateSelected = () => {
    if (!selectedIds.length) return;
    const copies: LayerNode[] = [];
    const newIds: string[] = [];
    for (const id of selectedIds) {
      const orig = nodes.find(n => n.id === id);
      if (!orig) continue;
      const copy = { ...orig, id: uid(), x: orig.x + 20, y: orig.y + 20 } as LayerNode;
      copies.push(copy);
      newIds.push(copy.id);
    }
    setNodes([...nodes, ...copies]);
    setSelectedIds(newIds);
  };

  const moveZ = (dir: 'up' | 'down') => {
    if (!selectedId) return;
    const i = nodes.findIndex(n => n.id === selectedId);
    const j = dir === 'up' ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= nodes.length) return;
    const copy = [...nodes];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setNodes(copy);
  };

  const groupSelected = () => {
    if (selectedIds.length < 2) return;
    const toGroup = nodes.filter(n => selectedIds.includes(n.id) && n.type !== 'group') as FlatNode[];
    if (toGroup.length < 2) return;
    let minX = Infinity, minY = Infinity;
    for (const n of toGroup) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); }
    const children = toGroup.map(n => ({ ...n, x: n.x - minX, y: n.y - minY })) as FlatNode[];
    const group: GroupNode = { id: uid(), type: 'group', x: minX, y: minY, rotation: 0, opacity: 1, children };
    setNodes([...nodes.filter(n => !selectedIds.includes(n.id)), group]);
    setSelectedIds([group.id]);
  };

  const ungroupSelected = () => {
    if (!selectedId || selected?.type !== 'group') return;
    const g = selected as GroupNode;
    const expanded = g.children.map(child => ({ ...child, id: uid(), x: g.x + child.x, y: g.y + child.y })) as FlatNode[];
    setNodes([...nodes.filter(n => n.id !== selectedId), ...expanded]);
    setSelectedIds(expanded.map(n => n.id));
  };

  const alignSelected = (hAlign?: 'left' | 'center' | 'right', vAlign?: 'top' | 'middle' | 'bottom') => {
    if (!selectedId) return;
    const node = shapeRefs.current[selectedId];
    if (!node) return;
    const w = node.width() * node.scaleX();
    const h = node.height() * node.scaleY();
    const patch: Partial<LayerNode> = {};
    if (hAlign === 'left')   patch.x = 20;
    if (hAlign === 'center') patch.x = Math.round((STAGE_W - w) / 2);
    if (hAlign === 'right')  patch.x = STAGE_W - w - 20;
    if (vAlign === 'top')    patch.y = 20;
    if (vAlign === 'middle') patch.y = Math.round((STAGE_H - h) / 2);
    if (vAlign === 'bottom') patch.y = STAGE_H - h - 20;
    update(selectedId, patch);
  };

  // ── Snap ─────────────────────────────────────────────────────────────────────
  const getSnapAxes = (excludeId: string) => {
    const xs = new Set<number>([STAGE_W / 2]);
    const ys = new Set<number>([STAGE_H / 2]);
    for (const n of nodes) {
      if (n.id === excludeId) continue;
      const el = shapeRefs.current[n.id];
      if (!el) continue;
      const w = el.width() * el.scaleX(), h = el.height() * el.scaleY();
      xs.add(n.x); xs.add(n.x + w / 2); xs.add(n.x + w);
      ys.add(n.y); ys.add(n.y + h / 2); ys.add(n.y + h);
    }
    return { xs, ys };
  };

  const findSnap = (val: number, pool: Set<number>) => {
    let best: { target: number; dist: number } | null = null;
    for (const c of pool) { const d = Math.abs(val - c); if (d < SNAP && (!best || d < best.dist)) best = { target: c, dist: d }; }
    return best;
  };

  const onDragMoveSnap = (id: string, konvaNode: Konva.Node) => {
    if (selectedIds.length > 1) return;
    const w = konvaNode.width() * konvaNode.scaleX();
    const h = (konvaNode.height() * konvaNode.scaleY()) || SNAP;
    const nx = konvaNode.x(), ny = konvaNode.y();
    const { xs, ys } = getSnapAxes(id);
    const nextGuides: Guide[] = [];
    for (const { val, off } of [{ val: nx, off: 0 }, { val: nx + w / 2, off: w / 2 }, { val: nx + w, off: w }]) {
      const s = findSnap(val, xs);
      if (s) { konvaNode.x(s.target - off); nextGuides.push({ dir: 'v', pos: s.target }); break; }
    }
    for (const { val, off } of [{ val: ny, off: 0 }, { val: ny + h / 2, off: h / 2 }, { val: ny + h, off: h }]) {
      const s = findSnap(val, ys);
      if (s) { konvaNode.y(s.target - off); nextGuides.push({ dir: 'h', pos: s.target }); break; }
    }
    setGuides(nextGuides);
  };

  const onDragEndSnap = (id: string, konvaNode: Konva.Node) => {
    setGuides([]);
    update(id, { x: konvaNode.x(), y: konvaNode.y() });
  };

  // ── Menu contextuel (clic droit) ─────────────────────────────────────────────
  const openCtxMenu = (e: Konva.KonvaEventObject<PointerEvent>, nodeId: string) => {
    e.evt.preventDefault();
    if (!selectedIds.includes(nodeId)) setSelectedIds([nodeId]);
    setCtxMenu({ x: e.evt.clientX, y: e.evt.clientY });
  };

  // ── Raccourcis clavier ───────────────────────────────────────────────────────
  kbRef.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); return; }
    if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); dispatch({ type: 'REDO' }); return; }
    if (ctrl && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
    if (ctrl && e.key === 'g' && !e.shiftKey) { e.preventDefault(); groupSelected(); return; }
    if (ctrl && e.key === 'g' && e.shiftKey)  { e.preventDefault(); ungroupSelected(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { removeSelected(); return; }
    if (e.key === 'Escape') { setSelectedIds([]); setCtxMenu(null); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedId) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const node = nodes.find(n => n.id === selectedId);
      if (!node) return;
      const patch: Partial<LayerNode> = {};
      if (e.key === 'ArrowUp')    patch.y = node.y - step;
      if (e.key === 'ArrowDown')  patch.y = node.y + step;
      if (e.key === 'ArrowLeft')  patch.x = node.x - step;
      if (e.key === 'ArrowRight') patch.x = node.x + step;
      update(selectedId, patch);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => kbRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Enregistrement ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSelectedIds([]);
    setGuides([]);
    setCtxMenu(null);
    await new Promise(r => setTimeout(r, 40));
    try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
    const stage = stageRef.current;
    if (!stage) return;
    // Persister l'état des calques (positions, tailles, styles) pour restauration future
    if (stateKey) {
      try {
        localStorage.setItem(`ic_nodes_${stateKey}`, JSON.stringify(nodes));
        localStorage.setItem(`ic_bg_${stateKey}`, bgUrl);
      } catch { /* localStorage indisponible, on ignore */ }
    }
    const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: EXPORT_W / STAGE_W });
    await onSave(dataUrl, bgUrl);
  };

  // ── Rendu d'un nœud plat ─────────────────────────────────────────────────────
  const renderFlatNode = (n: FlatNode, isChild: boolean) => {
    const commonDrag = isChild ? {} : {
      draggable: true,
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => onDragMoveSnap(n.id, e.target as Konva.Node),
      onDragEnd:  (e: Konva.KonvaEventObject<DragEvent>) => onDragEndSnap(n.id, e.target as Konva.Node),
    };
    const handleClick = isChild ? undefined : (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.shiftKey) setSelectedIds(ids => ids.includes(n.id) ? ids.filter(i => i !== n.id) : [...ids, n.id]);
      else setSelectedIds([n.id]);
    };
    const handleCtx = isChild ? undefined : (e: Konva.KonvaEventObject<PointerEvent>) => openCtxMenu(e, n.id);

    if (n.type === 'text') {
      return (
        <KonvaText
          key={n.id}
          ref={node => { if (node) shapeRefs.current[n.id] = node; }}
          x={n.x} y={n.y} width={n.width} rotation={n.rotation} opacity={n.opacity}
          text={n.text} fontSize={n.fontSize} fontFamily={n.fontFamily} fill={n.fill} align={n.align}
          fontStyle={`${n.italic ? 'italic ' : ''}${n.bold ? 'bold' : 'normal'}`.trim()}
          {...commonDrag}
          onClick={handleClick}
          onTap={isChild ? undefined : () => setSelectedIds([n.id])}
          onContextMenu={handleCtx}
          onTransformEnd={isChild ? undefined : e => {
            const node = e.target as Konva.Text;
            const sx = node.scaleX();
            node.scaleX(1); node.scaleY(1);
            update(n.id, { x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(30, node.width() * sx), fontSize: Math.max(8, Math.round(node.fontSize() * sx)) });
          }}
        />
      );
    }
    return (
      <Rect
        key={n.id}
        ref={node => { if (node) shapeRefs.current[n.id] = node; }}
        x={n.x} y={n.y} width={n.width} height={n.height} rotation={n.rotation} fill={n.fill} opacity={n.opacity}
        {...commonDrag}
        onClick={handleClick}
        onTap={isChild ? undefined : () => setSelectedIds([n.id])}
        onContextMenu={handleCtx}
        onTransformEnd={isChild ? undefined : e => {
          const node = e.target as Konva.Rect;
          const sx = node.scaleX(), sy = node.scaleY();
          node.scaleX(1); node.scaleY(1);
          update(n.id, { x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(8, node.width() * sx), height: Math.max(1, node.height() * sy) });
        }}
      />
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,.35)', maxWidth: 1400, width: '100%', maxHeight: '96vh', overflow: 'auto', padding: 20 }}>

        {/* ── En-tête ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
          <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 16, fontWeight: 800, color: '#003366', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#003366" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Éditeur d&apos;images
          </h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} title="Annuler (Ctrl+Z)" style={hdrIconBtn(!canUndo)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>
            </button>
            <button onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} title="Rétablir (Ctrl+Y)" style={hdrIconBtn(!canRedo)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4"/></svg>
            </button>
            <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 2px' }} />
            <button onClick={onClose} disabled={saving} style={hdrBtn('#64748b')}>Fermer</button>
            <button onClick={handleSave} disabled={saving} style={hdrBtn('#059669')}>
              {saving ? 'Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>
        </div>

        {/* ── Layout principal : canvas gauche / outils droite ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

          {/* Canvas */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#f1f5f9' }}>
            <Stage
              ref={stageRef}
              width={STAGE_W} height={STAGE_H}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              onMouseDown={e => { if (e.target === e.target.getStage()) setSelectedIds([]); }}
              onTouchStart={e => { if (e.target === e.target.getStage()) setSelectedIds([]); }}
              onContextMenu={e => { if (e.target === e.target.getStage()) { e.evt.preventDefault(); setCtxMenu(null); setSelectedIds([]); } }}
            >
              <Layer>
                {bgImg
                  ? <KonvaImage image={bgImg} width={STAGE_W} height={STAGE_H} listening={false} />
                  : <Rect width={STAGE_W} height={STAGE_H} fill="#eef2f7" listening={false} />}

                {nodes.map(n => {
                  if (n.type === 'group') {
                    const g = n as GroupNode;
                    return (
                      <Group
                        key={g.id}
                        ref={node => { if (node) shapeRefs.current[g.id] = node; }}
                        x={g.x} y={g.y} rotation={g.rotation} opacity={g.opacity}
                        draggable
                        onClick={e => {
                          if (e.evt.shiftKey) setSelectedIds(ids => ids.includes(g.id) ? ids.filter(i => i !== g.id) : [...ids, g.id]);
                          else setSelectedIds([g.id]);
                        }}
                        onTap={() => setSelectedIds([g.id])}
                        onContextMenu={e => openCtxMenu(e, g.id)}
                        onDragMove={e => onDragMoveSnap(g.id, e.target as Konva.Node)}
                        onDragEnd={e => onDragEndSnap(g.id, e.target as Konva.Node)}
                        onTransformEnd={e => {
                          const node = e.target as Konva.Group;
                          const sx = node.scaleX(), sy = node.scaleY();
                          node.scaleX(1); node.scaleY(1);
                          const newChildren = g.children.map(child => ({
                            ...child,
                            x: child.x * sx, y: child.y * sy,
                            ...(child.type === 'text' ? { fontSize: Math.max(8, Math.round(child.fontSize * sx)), width: Math.max(30, child.width * sx) } : {}),
                            ...(child.type === 'line' ? { width: Math.max(8, child.width * sx), height: Math.max(1, child.height * sy) } : {}),
                          }));
                          update(g.id, { x: node.x(), y: node.y(), rotation: node.rotation(), children: newChildren });
                        }}
                      >
                        {g.children.map(child => renderFlatNode(child, true))}
                      </Group>
                    );
                  }
                  return renderFlatNode(n as FlatNode, false);
                })}

                <Transformer ref={trRef} rotateEnabled={!isMultiSel} resizeEnabled={!isMultiSel} anchorSize={8} borderStroke="#004a99" anchorStroke="#004a99" />
              </Layer>

              {/* Guides magnétisme */}
              <Layer listening={false}>
                {guides.map((g, i) => (
                  <Line key={i}
                    points={g.dir === 'h' ? [0, g.pos, STAGE_W, g.pos] : [g.pos, 0, g.pos, STAGE_H]}
                    stroke="#00c4ff" strokeWidth={1} dash={[4, 3]}
                  />
                ))}
              </Layer>
            </Stage>
          </div>

          {/* Panneau d'outils */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Section : Ajouter */}
            <ToolSection title="Ajouter un élément">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <AddBtn
                  icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="3" rx="1.5"/><rect x="10.5" y="5" width="3" height="14" rx="1.5"/></svg>}
                  label="Titre"
                  onClick={() => addText({ text: 'TITRE', fontSize: 46, bold: true, width: 600, x: 80, y: 150 })}
                />
                <AddBtn
                  icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="8" width="14" height="2.5" rx="1.25"/><rect x="11" y="8" width="2" height="11" rx="1"/></svg>}
                  label="Sous-titre"
                  onClick={() => addText({ text: 'Sous-titre', fontSize: 22, width: 500, x: 130, y: 230 })}
                />
                <AddBtn
                  icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="11" x2="21" y2="11"/><line x1="3" y1="15" x2="15" y2="15"/></svg>}
                  label="Texte libre"
                  onClick={() => addText()}
                />
                <AddBtn
                  icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5a059" strokeWidth="3" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>}
                  label="Ligne dorée"
                  onClick={addLine}
                />
              </div>
            </ToolSection>

            {/* Section : Fond */}
            {backgrounds.length > 0 && (
              <ToolSection title="Fond d'image">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {backgrounds.map(b => (
                    <button
                      key={b.url}
                      type="button"
                      onClick={() => setBgUrl(b.url)}
                      title={b.label || 'Sélectionner ce fond'}
                      style={{
                        position: 'relative',
                        height: 52,
                        padding: 0,
                        borderRadius: 7,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        backgroundImage: `url(${b.url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: bgUrl === b.url ? '2.5px solid #004a99' : '1.5px solid #e2e8f0',
                        outline: bgUrl === b.url ? '2px solid #93c5fd' : 'none',
                        transition: 'border-color .15s, outline .15s',
                      }}
                    >
                      {b.label && (
                        <span style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'rgba(0,0,0,.5)', color: 'white',
                          fontSize: 9, fontWeight: 700, padding: '2px 5px',
                          textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                        }}>
                          {b.label}
                        </span>
                      )}
                      {bgUrl === b.url && (
                        <span style={{
                          position: 'absolute', top: 3, right: 3,
                          background: '#004a99', borderRadius: '50%',
                          width: 16, height: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 10.5, color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.5 }}>
                  Changer le fond conserve tous les calques de texte.
                </p>
              </ToolSection>
            )}

            {/* Section : Calque sélectionné */}
            <ToolSection title={selectedIds.length > 0 ? `Calque${selectedIds.length > 1 ? 's' : ''} sélectionné${selectedIds.length > 1 ? 's' : ''}` : 'Propriétés'}>
              {isMultiSel ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 13, color: '#334155', fontWeight: 600, margin: 0 }}>{selectedIds.length} calques</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {canGroup && (
                      <button onClick={groupSelected} style={toolBtn(false)}>
                        <IcGroup size={13} /> Grouper
                      </button>
                    )}
                    <button onClick={duplicateSelected} style={toolBtn(false)}>
                      <IcDup size={13} /> Dupliquer
                    </button>
                    <button onClick={removeSelected} style={toolBtn(false, true)}>
                      <IcTrash size={13} /> Supprimer
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Shift+clic pour sélectionner plusieurs calques.</p>
                </div>
              ) : !selected ? (
                <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.8 }}>
                  Cliquez un calque pour le modifier.<br />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Clic droit → Grouper, Dupliquer, Supprimer…<br />Shift+clic → multi-sélection.</span>
                </p>
              ) : selected.type === 'group' ? (
                <GroupPanel group={selected as GroupNode} update={update} duplicate={duplicateSelected} remove={removeSelected} moveZ={moveZ} ungroup={ungroupSelected} />
              ) : selected.type === 'text' ? (
                <TextPanel node={selected as TextNode} update={update} duplicate={duplicateSelected} remove={removeSelected} moveZ={moveZ} alignSelected={alignSelected} />
              ) : (
                <LinePanel node={selected as LineNode} update={update} duplicate={duplicateSelected} remove={removeSelected} moveZ={moveZ} alignSelected={alignSelected} />
              )}
            </ToolSection>

          </div>
        </div>

        {/* ── Menu contextuel (clic droit) ── */}
        {ctxMenu && selectedIds.length > 0 && (
          <div
            style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, background: 'white', border: '1px solid #e2e8f0', borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,.14)', zIndex: 2000, padding: '4px 0', minWidth: 178 }}
            onClick={e => e.stopPropagation()}
          >
            <CtxItem icon={<IcDup size={13} />} label="Dupliquer" onClick={() => { duplicateSelected(); setCtxMenu(null); }} />
            {selectedIds.length === 1 && <>
              <CtxItem icon={<IcFront size={13} />} label="Premier plan" onClick={() => { moveZ('up'); setCtxMenu(null); }} />
              <CtxItem icon={<IcBack size={13} />} label="Arrière-plan" onClick={() => { moveZ('down'); setCtxMenu(null); }} />
            </>}
            {(canGroup || canUngroup) && <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />}
            {canGroup   && <CtxItem icon={<IcGroup size={13} />} label="Grouper" onClick={() => { groupSelected(); setCtxMenu(null); }} />}
            {canUngroup && <CtxItem icon={<IcUngroup size={13} />} label="Dégrouper" onClick={() => { ungroupSelected(); setCtxMenu(null); }} />}
            <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
            <CtxItem icon={<IcTrash size={13} />} label="Supprimer" danger onClick={() => { removeSelected(); setCtxMenu(null); }} />
          </div>
        )}

      </div>
    </div>
  );
}

// ── Section du panneau ────────────────────────────────────────────────────────
function ToolSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ padding: '7px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

// ── Bouton Ajouter ────────────────────────────────────────────────────────────
function AddBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 6px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', color: '#334155', fontWeight: 600, fontSize: 11.5, width: '100%' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#004a99'; e.currentTarget.style.color = '#004a99'; e.currentTarget.style.background = '#eff6ff'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#334155'; e.currentTarget.style.background = 'white'; }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Élément du menu contextuel ────────────────────────────────────────────────
function CtxItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 13px', border: 'none', background: 'transparent', cursor: 'pointer', color: danger ? '#dc2626' : '#1e293b', fontWeight: 500, fontSize: 13, textAlign: 'left', fontFamily: 'inherit' }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? '#fef2f2' : '#f8fafc'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: danger ? '#dc2626' : '#64748b' }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Icônes SVG ────────────────────────────────────────────────────────────────
function IcGroup({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"><rect x="2" y="2" width="20" height="20" rx="3"/></svg>;
}
function IcUngroup({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="11" height="11" rx="2"/><rect x="11" y="11" width="11" height="11" rx="2"/></svg>;
}
function IcDup({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
}
function IcTrash({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
function IcFront({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="13" height="13" rx="1.5" fill="#e2e8f0"/><rect x="3" y="3" width="13" height="13" rx="1.5"/></svg>;
}
function IcBack({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="13" height="13" rx="1.5"/><rect x="8" y="8" width="13" height="13" rx="1.5" fill="#e2e8f0"/></svg>;
}

// ── Panneaux de propriétés ────────────────────────────────────────────────────
function GroupPanel({ group, update, duplicate, remove, moveZ, ungroup }: {
  group: GroupNode;
  update: (id: string, patch: Partial<LayerNode>) => void;
  duplicate: () => void; remove: () => void;
  moveZ: (d: 'up' | 'down') => void;
  ungroup: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 13, color: '#334155', fontWeight: 600, margin: 0 }}>Groupe ({group.children.length} éléments)</p>
      <OpacitySlider node={group} update={update} />
      {panelActions(duplicate, remove, moveZ, ungroup)}
    </div>
  );
}

function TextPanel({ node, update, duplicate, remove, moveZ, alignSelected }: {
  node: TextNode;
  update: (id: string, patch: Partial<LayerNode>) => void;
  duplicate: () => void; remove: () => void;
  moveZ: (d: 'up' | 'down') => void;
  alignSelected: (h?: 'left'|'center'|'right', v?: 'top'|'middle'|'bottom') => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={lbl}>Texte</label>
      <textarea value={node.text} onChange={e => update(node.id, { text: e.target.value })} rows={2} style={inp} />

      <label style={lbl}>Police</label>
      <select value={node.fontFamily} onChange={e => update(node.id, { fontFamily: e.target.value })} style={inp}>
        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      <label style={lbl}>Taille : {node.fontSize}px</label>
      <input type="range" min={10} max={120} value={node.fontSize} onChange={e => update(node.id, { fontSize: Number(e.target.value) })} />

      <label style={lbl}>Couleur</label>
      <ColorPicker color={node.fill} onChange={c => update(node.id, { fill: c })} />

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button onClick={() => update(node.id, { bold: !node.bold })} style={toolBtn(node.bold)}>
          <strong>G</strong>
        </button>
        <button onClick={() => update(node.id, { italic: !node.italic })} style={toolBtn(node.italic)}>
          <em>I</em>
        </button>
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a} onClick={() => update(node.id, { align: a })} style={toolBtn(node.align === a)}>
            {a === 'left' ? <IcAlignLeft /> : a === 'center' ? <IcAlignCenter /> : <IcAlignRight />}
          </button>
        ))}
      </div>

      <OpacitySlider node={node} update={update} />

      <label style={lbl}>Aligner sur le canevas</label>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <button onClick={() => alignSelected('left')}   style={toolBtn(false)} title="Gauche"><IcAlLeft /></button>
        <button onClick={() => alignSelected('center')} style={toolBtn(false)} title="Centrer"><IcAlCenter /></button>
        <button onClick={() => alignSelected('right')}  style={toolBtn(false)} title="Droite"><IcAlRight /></button>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => alignSelected(undefined, 'top')}    style={toolBtn(false)} title="Haut"><IcAlTop /></button>
        <button onClick={() => alignSelected(undefined, 'middle')} style={toolBtn(false)} title="Milieu"><IcAlMiddle /></button>
        <button onClick={() => alignSelected(undefined, 'bottom')} style={toolBtn(false)} title="Bas"><IcAlBottom /></button>
      </div>

      {panelActions(duplicate, remove, moveZ)}
    </div>
  );
}

function LinePanel({ node, update, duplicate, remove, moveZ, alignSelected }: {
  node: LineNode;
  update: (id: string, patch: Partial<LayerNode>) => void;
  duplicate: () => void; remove: () => void;
  moveZ: (d: 'up' | 'down') => void;
  alignSelected: (h?: 'left'|'center'|'right', v?: 'top'|'middle'|'bottom') => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={lbl}>Couleur</label>
      <ColorPicker color={node.fill} onChange={c => update(node.id, { fill: c })} />

      <label style={lbl}>Épaisseur : {node.height}px</label>
      <input type="range" min={1} max={20} value={node.height} onChange={e => update(node.id, { height: Number(e.target.value) })} />

      <OpacitySlider node={node} update={update} />

      <label style={lbl}>Aligner sur le canevas</label>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <button onClick={() => alignSelected('left')}   style={toolBtn(false)} title="Gauche"><IcAlLeft /></button>
        <button onClick={() => alignSelected('center')} style={toolBtn(false)} title="Centrer"><IcAlCenter /></button>
        <button onClick={() => alignSelected('right')}  style={toolBtn(false)} title="Droite"><IcAlRight /></button>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => alignSelected(undefined, 'top')}    style={toolBtn(false)} title="Haut"><IcAlTop /></button>
        <button onClick={() => alignSelected(undefined, 'middle')} style={toolBtn(false)} title="Milieu"><IcAlMiddle /></button>
        <button onClick={() => alignSelected(undefined, 'bottom')} style={toolBtn(false)} title="Bas"><IcAlBottom /></button>
      </div>

      {panelActions(duplicate, remove, moveZ)}
    </div>
  );
}

// ── Icônes d'alignement ───────────────────────────────────────────────────────
function IcAlignLeft()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="2" rx="1"/><rect x="2" y="10" width="14" height="2" rx="1"/><rect x="2" y="16" width="18" height="2" rx="1"/></svg>; }
function IcAlignCenter() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="2" rx="1"/><rect x="5" y="10" width="14" height="2" rx="1"/><rect x="3" y="16" width="18" height="2" rx="1"/></svg>; }
function IcAlignRight()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="20" height="2" rx="1"/><rect x="8" y="10" width="14" height="2" rx="1"/><rect x="4" y="16" width="18" height="2" rx="1"/></svg>; }
function IcAlLeft()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="9 6 3 12 9 18"/></svg>; }
function IcAlCenter() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>; }
function IcAlRight()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="15 6 21 12 15 18"/></svg>; }
function IcAlTop()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="6 9 12 3 18 9"/></svg>; }
function IcAlMiddle() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>; }
function IcAlBottom() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="6 15 12 21 18 15"/></svg>; }

// ── Utilitaires de panneaux ───────────────────────────────────────────────────
function OpacitySlider({ node, update }: { node: BaseNode; update: (id: string, p: Partial<LayerNode>) => void }) {
  const pct = Math.round((node.opacity ?? 1) * 100);
  return (
    <>
      <label style={lbl}>Opacité : {pct}%</label>
      <input type="range" min={0} max={100} value={pct} onChange={e => update(node.id, { opacity: Number(e.target.value) / 100 })} />
    </>
  );
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)} title={c}
          style={{ width: 24, height: 24, borderRadius: 6, background: c, border: color === c ? '2px solid #004a99' : '1px solid #cbd5e1', cursor: 'pointer', flexShrink: 0 }} />
      ))}
      <input type="color"
        value={/^#[0-9a-f]{3,6}$/i.test(color) ? color : '#000000'}
        onChange={e => onChange(e.target.value)}
        title="Couleur personnalisée"
        style={{ width: 28, height: 28, border: '1px solid #cbd5e1', borderRadius: 6, padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
      />
    </div>
  );
}

function panelActions(dup: () => void, del: () => void, moveZ: (d: 'up'|'down') => void, ungroup?: () => void) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
      <button onClick={dup} style={toolBtn(false)}>
        <IcDup size={12} /> Dupliquer
      </button>
      <button onClick={() => moveZ('up')} style={toolBtn(false)}>
        <IcFront size={12} /> Avant
      </button>
      <button onClick={() => moveZ('down')} style={toolBtn(false)}>
        <IcBack size={12} /> Arrière
      </button>
      {ungroup && (
        <button onClick={ungroup} style={toolBtn(false)}>
          <IcUngroup size={12} /> Dégrouper
        </button>
      )}
      <button onClick={del} style={toolBtn(false, true)}>
        <IcTrash size={12} /> Supprimer
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function toolBtn(active: boolean, danger = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 9px', border: `1.5px solid ${danger ? '#fecaca' : active ? '#004a99' : '#e2e8f0'}`,
    borderRadius: 7, background: danger ? '#fef2f2' : active ? '#eff6ff' : 'white',
    color: danger ? '#dc2626' : active ? '#004a99' : '#334155',
    fontWeight: 600, fontSize: 12, cursor: 'pointer',
  };
}

function hdrIconBtn(disabled: boolean): React.CSSProperties {
  return { width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1.5px solid #e2e8f0', borderRadius: 8, background: disabled ? '#f8fafc' : 'white', color: disabled ? '#cbd5e1' : '#334155', cursor: disabled ? 'not-allowed' : 'pointer' };
}

function hdrBtn(bg: string): React.CSSProperties {
  return { padding: '8px 16px', border: 'none', borderRadius: 8, background: bg, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' };
}

const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em' };
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none', color: '#0f172a', background: 'white' };
