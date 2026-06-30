import { getMedia } from './media';

// `sharp` est un module natif : on le charge en différé (dynamic import) pour que
// le simple fait d’importer le workflow (webhook Google Chat, etc.) ne charge
// jamais le binaire natif au démarrage de la route.
type SharpFn = typeof import('sharp');
let _sharp: SharpFn | null = null;
async function getSharp(): Promise<SharpFn> {
  if (!_sharp) _sharp = (await import('sharp')).default as unknown as SharpFn;
  return _sharp;
}

// Incrustation serveur du titre + sous-titre sur un fond prédéfini (sans IA).
// Rendu déterministe via sharp + un calque SVG.
//
// IMPORTANT : le moteur SVG de sharp (resvg) NE supporte PAS `textLength` /
// `lengthAdjust`. On ne peut donc pas compter dessus pour ajuster le texte —
// il faut calculer nous-mêmes une taille de police (et un passage à la ligne)
// qui garantit que le texte tient TOUJOURS dans l’image.

const W = 1280;
const H = 720; // 16:9

// Marges latérales : le texte ne dépasse jamais cette largeur utile.
const TITLE_MAX_W = W - 150; // 1130 px
const SUB_MAX_W   = W - 220; // 1060 px

// Facteurs de largeur moyenne d’un glyphe (≈ largeur/­hauteur) pour Montserrat.
// Légèrement sur-estimés → on tend vers une police un peu plus petite = garantie de tenir.
const TITLE_FACTOR = 0.62; // gras, MAJUSCULES
const SUB_FACTOR   = 0.54; // medium

const TITLE_BASE = 74, TITLE_MIN = 34, TITLE_COMFORT = 50;
const SUB_BASE   = 34, SUB_MIN   = 18;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Largeur estimée d’un texte à une taille donnée. */
function estWidth(text: string, size: number, factor: number): number {
  return text.length * factor * size;
}

/**
 * Détermine la mise en page du titre : 1 ou 2 lignes + taille de police, de sorte
 * que la ligne la plus large tienne dans `maxW`. On reste sur 1 ligne tant que la
 * taille reste confortable, sinon on coupe en 2 lignes équilibrées au mot.
 */
function layoutTitle(title: string, maxW: number): { lines: string[]; size: number } {
  // Tient déjà à la taille de base ?
  if (estWidth(title, TITLE_BASE, TITLE_FACTOR) <= maxW) {
    return { lines: [title], size: TITLE_BASE };
  }
  // Taille nécessaire pour tenir sur 1 ligne.
  const oneLineSize = Math.floor(maxW / (title.length * TITLE_FACTOR));
  // Si ça reste lisible sur 1 ligne (ou pas d’espace où couper) → on garde 1 ligne.
  if (oneLineSize >= TITLE_COMFORT || !title.includes(' ')) {
    return { lines: [title], size: Math.max(TITLE_MIN, oneLineSize) };
  }
  // Sinon, on coupe en 2 lignes au mot le plus proche du milieu (équilibrage).
  const words = title.split(/\s+/);
  let bestIdx = 1, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l = words.slice(0, i).join(' ').length;
    const r = words.slice(i).join(' ').length;
    const diff = Math.abs(l - r);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  const line1 = words.slice(0, bestIdx).join(' ');
  const line2 = words.slice(bestIdx).join(' ');
  const longest = Math.max(line1.length, line2.length);
  const size = Math.min(TITLE_BASE, Math.max(TITLE_MIN, Math.floor(maxW / (longest * TITLE_FACTOR))));
  return { lines: [line1, line2], size };
}

/** Taille de police du sous-titre pour qu’il tienne sur 1 ligne. */
function fitSubtitle(sub: string, maxW: number): number {
  if (estWidth(sub, SUB_BASE, SUB_FACTOR) <= maxW) return SUB_BASE;
  return Math.max(SUB_MIN, Math.floor(maxW / (sub.length * SUB_FACTOR)));
}

/** Récupère les octets du fond : /api/media/{id} (lecture base) ou URL externe. */
async function loadBackground(url: string): Promise<Buffer> {
  const m = url.match(/\/api\/media\/(\d+)/);
  if (m) {
    const media = await getMedia(parseInt(m[1], 10));
    if (!media?.data) throw new Error('Fond introuvable en base.');
    return Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data as Uint8Array);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fond inaccessible.');
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Compose l’image d’en-tête : fond (couvrant 1280×720) + titre + ligne dorée +
 * sous-titre, aux couleurs de la charte. Le texte est « vrai » (orthographe
 * parfaite) et sa taille est auto-ajustée (avec passage à la ligne) pour ne
 * JAMAIS déborder de l’image.
 */
export async function composeHeader(opts: {
  backgroundUrl: string;
  title: string;
  subtitle: string;
}): Promise<Buffer> {
  const sharp = await getSharp();
  const bg = await sharp(await loadBackground(opts.backgroundUrl))
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  const title = (opts.title || '').trim().toUpperCase().slice(0, 80);
  const subtitle = (opts.subtitle || '').trim().slice(0, 110);

  const fontStack = "Montserrat, 'Helvetica Neue', Arial, sans-serif";
  const NAVY = '#0a1a2f';
  const GOLD = '#c5a059';

  // ── Mise en page verticale (bloc centré : titre + ligne dorée + sous-titre) ──
  const { lines, size: tSize } = title ? layoutTitle(title, TITLE_MAX_W) : { lines: [], size: 0 };
  const subSize = subtitle ? fitSubtitle(subtitle, SUB_MAX_W) : 0;

  const lineH = tSize * 1.1;
  const GAP_TITLE_GOLD = 26;
  const GOLD_H = 4;
  const GAP_GOLD_SUB = subtitle ? 30 : 0;

  const titleBlockH = lines.length * lineH;
  const totalH = titleBlockH + GAP_TITLE_GOLD + GOLD_H + (subtitle ? GAP_GOLD_SUB + subSize : 0);

  let y = (H - totalH) / 2;

  // Titre (1 ou 2 lignes), centré horizontalement. Garde-fou textLength au cas où
  // l’estimation de largeur serait dépassée (compresse alors la ligne fautive).
  const titleSvg = lines.map((ln, i) => {
    const baseY = y + i * lineH + tSize * 0.8; // y = ligne de base approx.
    const over = estWidth(ln, tSize, TITLE_FACTOR) > TITLE_MAX_W;
    const safety = over ? ` textLength="${TITLE_MAX_W}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="${W / 2}" y="${baseY.toFixed(1)}" text-anchor="middle" class="title" font-size="${tSize}"${safety}>${escapeXml(ln)}</text>`;
  }).join('\n  ');

  y += titleBlockH + GAP_TITLE_GOLD;
  const goldY = y;
  y += GOLD_H + GAP_GOLD_SUB;
  const subBaseY = y + subSize * 0.8;

  const subSvg = subtitle
    ? `<text x="${W / 2}" y="${subBaseY.toFixed(1)}" text-anchor="middle" class="sub" font-size="${subSize}">${escapeXml(subtitle)}</text>`
    : '';

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: ${fontStack}; font-weight: 800; fill: ${NAVY}; }
    .sub   { font-family: ${fontStack}; font-weight: 500; fill: ${NAVY}; }
  </style>
  ${titleSvg}
  <rect x="${W / 2 - 90}" y="${goldY.toFixed(1)}" width="180" height="${GOLD_H}" fill="${GOLD}"/>
  ${subSvg}
</svg>`;

  return sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
