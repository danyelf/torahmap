// Background Hebrew text: the pure part. Which verses to show, how large the
// text is at a given zoom, and where the layer's anchor point is. Nothing here
// touches the DOM; the layer module does that.

import { MIN_ZOOM, MAX_ZOOM, type Camera } from '../camera.ts';
import { screenToWorld } from '../hitDetection.ts';
import { stripNikkud } from '../hebrew.ts';
import { getVerseText, type VerseTexts } from '../verseTexts.ts';
import type { TanakhLayout } from '../types.ts';

export type Layer = 'behind' | 'above';
export type Anchor = 'viewport' | 'square';
export type Content = 'center' | 'window' | 'fill';
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
  /** The center verse alone, a window of neighbours around it, or enough verses to cover the viewport. */
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
  /** Shift a new passage so its lines land on the same rows as the old one. */
  snapLines: boolean;
}

// Danyel's pick after two rounds with the panel (2026-09-16): drifting at a
// third of the map's speed, very quiet, letters only, a slow dissolve between passages.
export const DEFAULT_SETTINGS: BackgroundTextSettings = {
  layer: 'above',
  parallax: 0.3,
  anchor: 'viewport',
  content: 'fill',
  neighbours: 17,
  widthEm: 35,
  minFont: 12,
  maxFont: 45,
  opacity: 0.1,
  blend: 'exclusion',
  font: 'david',
  marks: 'letters',
  hysteresis: 17,
  settleMs: 150,
  crossfadeMs: 1100,
  snapLines: true,
};

export const PRESETS = {
  A: { anchor: 'viewport', parallax: 0.3, content: 'fill' },
  B: { anchor: 'square', parallax: 1, content: 'center' },
  C: { anchor: 'square', parallax: 1, content: 'fill' },
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

export function passageForRange(
  verses: TanakhLayout[],
  texts: VerseTexts,
  range: { start: number; end: number },
  centerIndex: number,
  marks: Marks,
): Passage {
  const hebrew = (i: number): string => {
    const v = verses[i];
    const text = getVerseText(texts, v.book, v.chapter, v.verse);
    return text ? stripMarks(text.he, marks) : '';
  };
  const join = (from: number, to: number): string => {
    const parts: string[] = [];
    for (let i = from; i <= to; i++) parts.push(hebrew(i));
    return parts.join(' ');
  };

  return {
    before: range.start < centerIndex ? join(range.start, centerIndex - 1) : '',
    center: hebrew(centerIndex),
    after: range.end > centerIndex ? join(centerIndex + 1, range.end) : '',
  };
}

export function passageAround(
  verses: TanakhLayout[],
  texts: VerseTexts,
  centerIndex: number,
  settings: Pick<BackgroundTextSettings, 'content' | 'neighbours' | 'marks'>,
): Passage {
  const range =
    settings.content === 'center'
      ? { start: centerIndex, end: centerIndex }
      : windowAround(centerIndex, verses.length, settings.neighbours);
  return passageForRange(verses, texts, range, centerIndex, settings.marks);
}

/**
 * The smallest range around the center verse whose text runs to at least
 * `targetChars` characters, grown one verse at a time on alternating sides so
 * the center verse stays near the middle. Stops at the ends of the corpus.
 */
export function rangeToFill(
  verses: TanakhLayout[],
  texts: VerseTexts,
  centerIndex: number,
  targetChars: number,
): { start: number; end: number } {
  const length = (i: number): number => {
    const v = verses[i];
    return (getVerseText(texts, v.book, v.chapter, v.verse)?.he.length ?? 0) + 1;
  };
  let start = centerIndex;
  let end = centerIndex;
  let chars = length(centerIndex);
  let growBefore = true;
  while (chars < targetChars && (start > 0 || end < verses.length - 1)) {
    if (growBefore && start > 0) {
      start--;
      chars += length(start);
    } else if (end < verses.length - 1) {
      end++;
      chars += length(end);
    } else {
      start--;
      chars += length(start);
    }
    growBefore = !growBefore;
  }
  return { start, end };
}

/**
 * The smallest vertical shift that puts a new page's line grid on the same
 * rows as the old page's, given both pages' translations and the line pitch
 * on screen. Lines start at the top of each page, so they align exactly when
 * the translations differ by a whole number of pitches.
 */
export function lineGridSnap(oldY: number, newY: number, pitch: number): number {
  const diff = oldY - newY;
  return diff - Math.round(diff / pitch) * pitch;
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
 *
 * The anchor's screen movement since the build is kept in two parts: what
 * panning did and what zooming did. They are followed at different rates: a
 * pan slides the text by the parallax ratio, while a zoom about the mouse
 * moves the anchor a long way and a background should not chase that.
 */
export interface PagePlacement {
  anchorWorld: { x: number; y: number };
  anchorScreenAtBuild: { x: number; y: number };
  refOffset: { x: number; y: number };
  /** The page scale when it was built, so a large zoom change can trigger a rebuild. */
  scaleAtBuild: number;
  /** Where the anchor was on screen at the last update. */
  lastAnchorScreen: { x: number; y: number };
  panOffset: { x: number; y: number };
  zoomOffset: { x: number; y: number };
}

export function newPlacement(
  anchorWorld: { x: number; y: number },
  anchorScreenAtBuild: { x: number; y: number },
  refOffset: { x: number; y: number },
  scaleAtBuild: number,
): PagePlacement {
  return {
    anchorWorld,
    anchorScreenAtBuild,
    refOffset,
    scaleAtBuild,
    lastAnchorScreen: { ...anchorScreenAtBuild },
    panOffset: { x: 0, y: 0 },
    zoomOffset: { x: 0, y: 0 },
  };
}

/**
 * Attribute the anchor's screen movement since the last update to panning or
 * to zooming, depending on whether the zoom level changed.
 */
export function advancePlacement(
  placement: PagePlacement,
  camera: Camera,
  zoomChanged: boolean,
): PagePlacement {
  const now = worldToScreen(placement.anchorWorld.x, placement.anchorWorld.y, camera);
  const dx = now.x - placement.lastAnchorScreen.x;
  const dy = now.y - placement.lastAnchorScreen.y;
  const pan = placement.panOffset;
  const zoom = placement.zoomOffset;
  return {
    ...placement,
    lastAnchorScreen: now,
    panOffset: zoomChanged ? pan : { x: pan.x + dx, y: pan.y + dy },
    zoomOffset: zoomChanged ? { x: zoom.x + dx, y: zoom.y + dy } : zoom,
  };
}

/**
 * Translation for a page so that its reference point lands on the anchor,
 * with the pan part of the anchor's movement reduced by the parallax ratio
 * and the zoom part by `zoomFollow`. The page is scaled about its top-left
 * corner, so the reference offset scales too.
 */
export function pageTransform(
  placement: PagePlacement,
  parallax: number,
  zoomFollow: number,
  scale: number,
): { x: number; y: number } {
  const at = placement.anchorScreenAtBuild;
  const ax = at.x + parallax * placement.panOffset.x + zoomFollow * placement.zoomOffset.x;
  const ay = at.y + parallax * placement.panOffset.y + zoomFollow * placement.zoomOffset.y;
  return { x: ax - placement.refOffset.x * scale, y: ay - placement.refOffset.y * scale };
}
