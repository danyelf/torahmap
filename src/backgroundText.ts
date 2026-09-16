// Background Hebrew text: the pure part. Which verses to show, how large the
// text is at a given zoom, and where the layer's anchor point is. Nothing here
// touches the DOM; the layer module does that.

import { MIN_ZOOM, MAX_ZOOM, type Camera } from './camera.ts';
import { screenToWorld } from './hitDetection.ts';
import { stripNikkud } from './search.ts';
import { getVerseText, type VerseTexts } from './verseTexts.ts';
import type { TanakhLayout } from './types.ts';

export type Layer = 'behind' | 'above';
export type Anchor = 'viewport' | 'square';
export type Content = 'center' | 'window';
export type Marks = 'all' | 'no-trop' | 'letters';
export type Font = 'noto' | 'frank' | 'david';
export type Blend = 'normal' | 'difference' | 'exclusion' | 'overlay';

export interface BackgroundTextSettings {
  /** Under the canvas (squares occlude the text) or over it at low opacity. */
  layer: Layer;
  /** How much of the map's screen movement the text follows: 0 is fixed to the glass, 1 is glued to the map. */
  parallax: number;
  /** What the passage is pinned to: the point under the screen center, or the center verse's own square. */
  anchor: Anchor;
  /** The center verse alone, or a window of neighbours around it. */
  content: Content;
  /** Verses on each side of the center verse when content is 'window'. */
  neighbours: number;
  /** Width of the paragraph in em, so it scales with the font. */
  widthEm: number;
  /** Font size in CSS pixels at MIN_ZOOM and at MAX_ZOOM. */
  minFont: number;
  maxFont: number;
  opacity: number;
  /** How the text mixes with what is under it. 'difference' reads dark over light squares and light over the dark gaps. */
  blend: Blend;
  font: Font;
  marks: Marks;
  /** Keep the current passage until the center verse is more than this many verses away. */
  hysteresis: number;
  /** Regenerate only after the camera has been still this long. 0 means immediately. */
  settleMs: number;
  crossfadeMs: number;
}

export const DEFAULT_SETTINGS: BackgroundTextSettings = {
  layer: 'above',
  parallax: 0.3,
  anchor: 'viewport',
  content: 'window',
  neighbours: 6,
  widthEm: 30,
  minFont: 12,
  maxFont: 24,
  opacity: 0.25,
  blend: 'normal',
  font: 'frank',
  marks: 'no-trop',
  hysteresis: 3,
  settleMs: 150,
  crossfadeMs: 300,
};

export const PRESETS = {
  A: { anchor: 'viewport', parallax: 0.3, content: 'window' },
  B: { anchor: 'square', parallax: 1, content: 'center' },
  C: { anchor: 'square', parallax: 1, content: 'window' },
} as const satisfies Record<string, Partial<BackgroundTextSettings>>;

export const FONT_FAMILIES: Record<Font, string> = {
  noto: '"Noto Sans Hebrew", system-ui, sans-serif',
  frank: '"Frank Ruhl Libre", serif',
  david: '"David Libre", serif',
};

/**
 * Font size for a zoom level, interpolated on a log scale so that equal wheel
 * steps give equal font steps. Clamped to the zoom limits.
 */
export function fontSizeForZoom(zoom: number, minFont: number, maxFont: number): number {
  const t = Math.log(zoom / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM);
  const clamped = Math.max(0, Math.min(1, t));
  return minFont * Math.pow(maxFont / minFont, clamped);
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
): { x: number; y: number } {
  return { x: (worldX + camera.x) * camera.zoom, y: (worldY + camera.y) * camera.zoom };
}

/** Index of the verse whose square center is nearest the world point. Linear scan. */
export function nearestVerseIndex(verses: TanakhLayout[], worldX: number, worldY: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const dx = v.x + v.size / 2 - worldX;
    const dy = v.y + v.size / 2 - worldY;
    const d = dx * dx + dy * dy;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/** Inclusive index range of `neighbours` verses on each side of `center`, clamped to the corpus. */
export function windowAround(
  center: number,
  count: number,
  neighbours: number,
): { start: number; end: number } {
  return {
    start: Math.max(0, center - neighbours),
    end: Math.min(count - 1, center + neighbours),
  };
}

export function shouldRegenerate(
  builtAround: number | null,
  center: number,
  hysteresis: number,
): boolean {
  if (builtAround === null) return true;
  return Math.abs(center - builtAround) > hysteresis;
}

// Cantillation accents occupy U+0591 to U+05AF; the vowel points follow them.
const TROP_START = 0x0591;
const TROP_END = 0x05af;

export function stripMarks(text: string, marks: Marks): string {
  if (marks === 'all') return text;
  if (marks === 'letters') return stripNikkud(text);
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < TROP_START || code > TROP_END) out += ch;
  }
  return out;
}

/** The passage split in three so the layer can wrap the center verse in its own element. */
export interface Passage {
  before: string;
  center: string;
  after: string;
}

export function passageAround(
  verses: TanakhLayout[],
  texts: VerseTexts,
  centerIndex: number,
  settings: Pick<BackgroundTextSettings, 'content' | 'neighbours' | 'marks'>,
): Passage {
  const { start, end } =
    settings.content === 'center'
      ? { start: centerIndex, end: centerIndex }
      : windowAround(centerIndex, verses.length, settings.neighbours);

  const hebrew = (i: number): string => {
    const v = verses[i];
    const text = getVerseText(texts, v.book, v.chapter, v.verse);
    return text ? stripMarks(text.he, settings.marks) : '';
  };
  const join = (from: number, to: number): string => {
    const parts: string[] = [];
    for (let i = from; i <= to; i++) parts.push(hebrew(i));
    return parts.join(' ');
  };

  return {
    before: start < centerIndex ? join(start, centerIndex - 1) : '',
    center: hebrew(centerIndex),
    after: end > centerIndex ? join(centerIndex + 1, end) : '',
  };
}

/**
 * The world point a passage is pinned to. For the square anchor it is the
 * top-right corner of the center verse's square, where the first word of a
 * right-to-left paragraph naturally starts. For the viewport anchor it is
 * whatever world point lies under the screen center right now.
 */
export function anchorWorldPoint(
  anchor: Anchor,
  verse: TanakhLayout,
  camera: Camera,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  if (anchor === 'square') return { x: verse.x + verse.size, y: verse.y };
  return screenToWorld(viewport.width / 2, viewport.height / 2, camera);
}

/**
 * Where a built page is pinned. `refOffset` is the reference point (the
 * top-right of the center verse's first line) measured inside the page at its
 * base font size, before any scale is applied.
 */
export interface PagePlacement {
  anchorWorld: { x: number; y: number };
  anchorScreenAtBuild: { x: number; y: number };
  refOffset: { x: number; y: number };
}

/**
 * Translation for a page so that its reference point lands on the anchor,
 * with the anchor's screen movement since build time reduced by the parallax
 * ratio. The page is scaled about its top-left corner, so the reference offset
 * scales too.
 */
export function pageTransform(
  placement: PagePlacement,
  camera: Camera,
  parallax: number,
  scale: number,
): { x: number; y: number } {
  const now = worldToScreen(placement.anchorWorld.x, placement.anchorWorld.y, camera);
  const at = placement.anchorScreenAtBuild;
  const ax = at.x + parallax * (now.x - at.x);
  const ay = at.y + parallax * (now.y - at.y);
  return { x: ax - placement.refOffset.x * scale, y: ay - placement.refOffset.y * scale };
}
