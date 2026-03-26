// Book watermarks - layered text labels: book names, parsha/section names, chapter numbers
// Inspired by illuminated manuscript aesthetics with a visual hierarchy

import type { VerseLayout } from './types.ts';
import { BOOK_HEBREW_NAMES } from './constants/books.ts';
import { stripNikkud } from './search.ts';

interface BookBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Pan {
  x: number;
  y: number;
}

// ── Parsha data (54 weekly Torah portions) ──────────────────────────────

interface ParshaInfo {
  name: string;
  book: string;
  chapter: number;
  verse: number;
}

const PARSHIYOT: ParshaInfo[] = [
  // Genesis
  { name: 'בראשית', book: 'Genesis', chapter: 1, verse: 1 },
  { name: 'נח', book: 'Genesis', chapter: 6, verse: 9 },
  { name: 'לך לך', book: 'Genesis', chapter: 12, verse: 1 },
  { name: 'וירא', book: 'Genesis', chapter: 18, verse: 1 },
  { name: 'חיי שרה', book: 'Genesis', chapter: 23, verse: 1 },
  { name: 'תולדות', book: 'Genesis', chapter: 25, verse: 19 },
  { name: 'ויצא', book: 'Genesis', chapter: 28, verse: 10 },
  { name: 'וישלח', book: 'Genesis', chapter: 32, verse: 4 },
  { name: 'וישב', book: 'Genesis', chapter: 37, verse: 1 },
  { name: 'מקץ', book: 'Genesis', chapter: 41, verse: 1 },
  { name: 'ויגש', book: 'Genesis', chapter: 44, verse: 18 },
  { name: 'ויחי', book: 'Genesis', chapter: 47, verse: 28 },
  // Exodus
  { name: 'שמות', book: 'Exodus', chapter: 1, verse: 1 },
  { name: 'וארא', book: 'Exodus', chapter: 6, verse: 2 },
  { name: 'בא', book: 'Exodus', chapter: 10, verse: 1 },
  { name: 'בשלח', book: 'Exodus', chapter: 13, verse: 17 },
  { name: 'יתרו', book: 'Exodus', chapter: 18, verse: 1 },
  { name: 'משפטים', book: 'Exodus', chapter: 21, verse: 1 },
  { name: 'תרומה', book: 'Exodus', chapter: 25, verse: 1 },
  { name: 'תצוה', book: 'Exodus', chapter: 27, verse: 20 },
  { name: 'כי תשא', book: 'Exodus', chapter: 30, verse: 11 },
  { name: 'ויקהל', book: 'Exodus', chapter: 35, verse: 1 },
  { name: 'פקודי', book: 'Exodus', chapter: 38, verse: 21 },
  // Leviticus
  { name: 'ויקרא', book: 'Leviticus', chapter: 1, verse: 1 },
  { name: 'צו', book: 'Leviticus', chapter: 6, verse: 1 },
  { name: 'שמיני', book: 'Leviticus', chapter: 9, verse: 1 },
  { name: 'תזריע', book: 'Leviticus', chapter: 12, verse: 1 },
  { name: 'מצרע', book: 'Leviticus', chapter: 14, verse: 1 },
  { name: 'אחרי מות', book: 'Leviticus', chapter: 16, verse: 1 },
  { name: 'קדשים', book: 'Leviticus', chapter: 19, verse: 1 },
  { name: 'אמר', book: 'Leviticus', chapter: 21, verse: 1 },
  { name: 'בהר', book: 'Leviticus', chapter: 25, verse: 1 },
  { name: 'בחקתי', book: 'Leviticus', chapter: 26, verse: 3 },
  // Numbers
  { name: 'במדבר', book: 'Numbers', chapter: 1, verse: 1 },
  { name: 'נשא', book: 'Numbers', chapter: 4, verse: 21 },
  { name: 'בהעלתך', book: 'Numbers', chapter: 8, verse: 1 },
  { name: 'שלח', book: 'Numbers', chapter: 13, verse: 1 },
  { name: 'קרח', book: 'Numbers', chapter: 16, verse: 1 },
  { name: 'חקת', book: 'Numbers', chapter: 19, verse: 1 },
  { name: 'בלק', book: 'Numbers', chapter: 22, verse: 2 },
  { name: 'פנחס', book: 'Numbers', chapter: 25, verse: 10 },
  { name: 'מטות', book: 'Numbers', chapter: 30, verse: 2 },
  { name: 'מסעי', book: 'Numbers', chapter: 33, verse: 1 },
  // Deuteronomy
  { name: 'דברים', book: 'Deuteronomy', chapter: 1, verse: 1 },
  { name: 'ואתחנן', book: 'Deuteronomy', chapter: 3, verse: 23 },
  { name: 'עקב', book: 'Deuteronomy', chapter: 7, verse: 12 },
  { name: 'ראה', book: 'Deuteronomy', chapter: 11, verse: 26 },
  { name: 'שפטים', book: 'Deuteronomy', chapter: 16, verse: 18 },
  { name: 'כי תצא', book: 'Deuteronomy', chapter: 21, verse: 10 },
  { name: 'כי תבוא', book: 'Deuteronomy', chapter: 26, verse: 1 },
  { name: 'נצבים', book: 'Deuteronomy', chapter: 29, verse: 9 },
  { name: 'וילך', book: 'Deuteronomy', chapter: 31, verse: 1 },
  { name: 'האזינו', book: 'Deuteronomy', chapter: 32, verse: 1 },
  { name: 'וזאת הברכה', book: 'Deuteronomy', chapter: 33, verse: 1 },
];

// ── Section labels for Nevi'im and Ketuvim ──────────────────────────────

interface SectionInfo {
  name: string;
  books: string[];
}

const NEVIIM_SECTIONS: SectionInfo[] = [
  { name: 'נביאים ראשונים', books: ['Joshua', 'Judges', 'I Samuel', 'II Samuel', 'I Kings', 'II Kings'] },
  { name: 'נביאים אחרונים', books: ['Isaiah', 'Jeremiah', 'Ezekiel'] },
  { name: 'תרי עשר', books: ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
];

const KETUVIM_SECTIONS: SectionInfo[] = [
  { name: 'ספרי אמת', books: ['Psalms', 'Proverbs', 'Job'] },
  { name: 'חמש מגלות', books: ['Song of Songs', 'Ruth', 'Lamentations', 'Ecclesiastes', 'Esther'] },
  { name: 'כתובים אחרונים', books: ['Daniel', 'Ezra', 'Nehemiah', 'I Chronicles', 'II Chronicles'] },
];

// ── Visual hierarchy zoom thresholds ────────────────────────────────────

// Layer 1: Book names (largest, visible when most zoomed out)
const BOOK_FADE_IN = 1.8;    // start appearing
const BOOK_FADE_FULL = 0.6;  // fully visible
const BOOK_MAX_OPACITY = 0.28;

// Layer 2: Parsha/section names (medium zoom)
const PARSHA_FADE_IN = 1.5;
const PARSHA_FADE_FULL = 0.8;
const PARSHA_FADE_OUT_START = 0.25; // start fading out at very high zoom
const PARSHA_FADE_OUT_END = 0.15;
const PARSHA_MAX_OPACITY = 0.22;

// Layer 3: Chapter numbers (highest zoom)
const CHAPTER_FADE_IN = 2.5;
const CHAPTER_FADE_FULL = 4.0;
const CHAPTER_MAX_OPACITY = 0.18;

// ── Color palette (warm gold/amber for illuminated manuscript feel) ─────

const BOOK_COLOR = 'rgba(218, 175, 92, OPACITY)';      // warm gold
const PARSHA_COLOR = 'rgba(198, 160, 88, OPACITY)';     // slightly muted gold
const SECTION_COLOR = 'rgba(180, 145, 80, OPACITY)';    // amber
const CHAPTER_COLOR = 'rgba(180, 165, 120, OPACITY)';   // pale gold

// ── Opacity functions ───────────────────────────────────────────────────

function bookOpacity(zoom: number): number {
  if (zoom >= BOOK_FADE_IN) return 0;
  if (zoom <= BOOK_FADE_FULL) return BOOK_MAX_OPACITY;
  return BOOK_MAX_OPACITY * (BOOK_FADE_IN - zoom) / (BOOK_FADE_IN - BOOK_FADE_FULL);
}

function parshaOpacity(zoom: number): number {
  // Fade in
  if (zoom >= PARSHA_FADE_IN) return 0;
  let op: number;
  if (zoom <= PARSHA_FADE_FULL && zoom >= PARSHA_FADE_OUT_START) {
    op = PARSHA_MAX_OPACITY;
  } else if (zoom > PARSHA_FADE_FULL) {
    op = PARSHA_MAX_OPACITY * (PARSHA_FADE_IN - zoom) / (PARSHA_FADE_IN - PARSHA_FADE_FULL);
  } else if (zoom < PARSHA_FADE_OUT_START) {
    // Fade out at very high zoom
    if (zoom <= PARSHA_FADE_OUT_END) return 0;
    op = PARSHA_MAX_OPACITY * (zoom - PARSHA_FADE_OUT_END) / (PARSHA_FADE_OUT_START - PARSHA_FADE_OUT_END);
  } else {
    op = PARSHA_MAX_OPACITY;
  }
  return op;
}

function chapterOpacity(zoom: number): number {
  if (zoom <= CHAPTER_FADE_IN) return 0;
  if (zoom >= CHAPTER_FADE_FULL) return CHAPTER_MAX_OPACITY;
  return CHAPTER_MAX_OPACITY * (zoom - CHAPTER_FADE_IN) / (CHAPTER_FADE_FULL - CHAPTER_FADE_IN);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function colorWithOpacity(colorTemplate: string, opacity: number): string {
  return colorTemplate.replace('OPACITY', String(opacity));
}

function computeBookBounds(verses: VerseLayout[]): Record<string, BookBounds> {
  const books: Record<string, BookBounds> = {};
  for (const v of verses) {
    if (!books[v.book]) {
      books[v.book] = { minX: v.x, maxX: v.x + v.size, minY: v.y, maxY: v.y + v.size };
    }
    const b = books[v.book];
    b.minX = Math.min(b.minX, v.x);
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
    b.maxY = Math.max(b.maxY, v.y + v.size);
  }
  return books;
}

/** Compute bounding box for a set of verses filtered by predicate */
function computeBoundsForVerses(verses: VerseLayout[], predicate: (v: VerseLayout) => boolean): BookBounds | null {
  let bounds: BookBounds | null = null;
  for (const v of verses) {
    if (!predicate(v)) continue;
    if (!bounds) {
      bounds = { minX: v.x, maxX: v.x + v.size, minY: v.y, maxY: v.y + v.size };
    } else {
      bounds.minX = Math.min(bounds.minX, v.x);
      bounds.maxX = Math.max(bounds.maxX, v.x + v.size);
      bounds.minY = Math.min(bounds.minY, v.y);
      bounds.maxY = Math.max(bounds.maxY, v.y + v.size);
    }
  }
  return bounds;
}

// ── Parsha bounds computation ───────────────────────────────────────────

interface ParshaBounds {
  name: string;
  bounds: BookBounds;
}

function computeParshaBounds(verses: VerseLayout[]): ParshaBounds[] {
  // Build a sorted list of parsha starts so we can find each parsha's end
  const sortedParshiyot = [...PARSHIYOT];

  const results: ParshaBounds[] = [];

  for (let i = 0; i < sortedParshiyot.length; i++) {
    const parsha = sortedParshiyot[i];
    const next = sortedParshiyot[i + 1];

    const bounds = computeBoundsForVerses(verses, (v) => {
      if (v.book !== parsha.book) return false;

      // If next parsha is in the same book, this parsha ends before it
      if (next && next.book === parsha.book) {
        if (v.chapter > next.chapter) return false;
        if (v.chapter === next.chapter && v.verse >= next.verse) return false;
      }

      // Must be at or after the parsha start
      if (v.chapter < parsha.chapter) return false;
      if (v.chapter === parsha.chapter && v.verse < parsha.verse) return false;

      return true;
    });

    if (bounds) {
      results.push({ name: parsha.name, bounds });
    }
  }

  return results;
}

// ── Section bounds computation ──────────────────────────────────────────

interface SectionBounds {
  name: string;
  bounds: BookBounds;
}

function computeSectionBounds(verses: VerseLayout[], sections: SectionInfo[]): SectionBounds[] {
  const results: SectionBounds[] = [];
  for (const section of sections) {
    const bookSet = new Set(section.books);
    const bounds = computeBoundsForVerses(verses, (v) => bookSet.has(v.book));
    if (bounds) {
      results.push({ name: section.name, bounds });
    }
  }
  return results;
}

// ── Chapter bounds computation ──────────────────────────────────────────

interface ChapterBounds {
  book: string;
  chapter: number;
  bounds: BookBounds;
}

function computeChapterBounds(verses: VerseLayout[]): ChapterBounds[] {
  const chapters: Map<string, ChapterBounds> = new Map();
  for (const v of verses) {
    const key = `${v.book}:${v.chapter}`;
    const existing = chapters.get(key);
    if (!existing) {
      chapters.set(key, {
        book: v.book,
        chapter: v.chapter,
        bounds: { minX: v.x, maxX: v.x + v.size, minY: v.y, maxY: v.y + v.size },
      });
    } else {
      existing.bounds.minX = Math.min(existing.bounds.minX, v.x);
      existing.bounds.maxX = Math.max(existing.bounds.maxX, v.x + v.size);
      existing.bounds.minY = Math.min(existing.bounds.minY, v.y);
      existing.bounds.maxY = Math.max(existing.bounds.maxY, v.y + v.size);
    }
  }
  return Array.from(chapters.values());
}

// ── DOM element creation helpers ────────────────────────────────────────

function createWatermarkElement(text: string, layer: 'book' | 'parsha' | 'section' | 'chapter'): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `watermark watermark-${layer}`;
  el.textContent = text;
  return el;
}

// ── Main exports ────────────────────────────────────────────────────────

/**
 * Create watermark HTML elements for all layers:
 * - Book names (layer 1, largest)
 * - Parsha / section names (layer 2, medium)
 * - Chapter numbers (layer 3, smallest)
 */
export function createWatermarks(
  verses: VerseLayout[],
  container: HTMLElement,
): HTMLDivElement {
  const bookBounds = computeBookBounds(verses);
  const parshaBoundsList = computeParshaBounds(verses);
  const sectionBoundsList = [
    ...computeSectionBounds(verses, NEVIIM_SECTIONS),
    ...computeSectionBounds(verses, KETUVIM_SECTIONS),
  ];
  const chapterBoundsList = computeChapterBounds(verses);

  const watermarks = document.createElement('div');
  watermarks.id = 'book-watermarks';
  watermarks.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;overflow:hidden;width:100vw;height:100vh;z-index:1;';

  // Layer 1: Book names
  for (const [name, bounds] of Object.entries(bookBounds)) {
    const heName = BOOK_HEBREW_NAMES[name];
    const text = heName ? stripNikkud(heName) : name;
    const el = createWatermarkElement(text, 'book');
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    el.dataset.centerX = String(bounds.minX + bw / 2);
    el.dataset.centerY = String(bounds.minY + bh / 2);
    el.dataset.boundsW = String(bw);
    el.dataset.boundsH = String(bh);
    el.dataset.layer = 'book';
    watermarks.appendChild(el);
  }

  // Layer 2a: Parsha names (Torah only)
  for (const parsha of parshaBoundsList) {
    const bw = parsha.bounds.maxX - parsha.bounds.minX;
    const bh = parsha.bounds.maxY - parsha.bounds.minY;
    const el = createWatermarkElement(parsha.name, 'parsha');
    el.dataset.centerX = String(parsha.bounds.minX + bw / 2);
    el.dataset.centerY = String(parsha.bounds.minY + bh / 2);
    el.dataset.boundsW = String(bw);
    el.dataset.boundsH = String(bh);
    el.dataset.layer = 'parsha';
    watermarks.appendChild(el);
  }

  // Layer 2b: Section names (Nevi'im and Ketuvim)
  for (const section of sectionBoundsList) {
    const bw = section.bounds.maxX - section.bounds.minX;
    const bh = section.bounds.maxY - section.bounds.minY;
    const el = createWatermarkElement(section.name, 'section');
    el.dataset.centerX = String(section.bounds.minX + bw / 2);
    el.dataset.centerY = String(section.bounds.minY + bh / 2);
    el.dataset.boundsW = String(bw);
    el.dataset.boundsH = String(bh);
    el.dataset.layer = 'section';
    watermarks.appendChild(el);
  }

  // Layer 3: Chapter numbers
  for (const ch of chapterBoundsList) {
    const bw = ch.bounds.maxX - ch.bounds.minX;
    const bh = ch.bounds.maxY - ch.bounds.minY;
    // Use Hebrew numerals for chapters - just use the number for simplicity
    const el = createWatermarkElement(String(ch.chapter), 'chapter');
    el.dataset.centerX = String(ch.bounds.minX + bw / 2);
    el.dataset.centerY = String(ch.bounds.minY + bh / 2);
    el.dataset.boundsW = String(bw);
    el.dataset.boundsH = String(bh);
    el.dataset.layer = 'chapter';
    watermarks.appendChild(el);
  }

  container.appendChild(watermarks);
  return watermarks;
}

/**
 * Update watermark positions based on camera pan/zoom.
 * Handles per-layer opacity fading and world-to-screen coordinate transforms.
 */
export function updateWatermarkPositions(
  watermarksContainer: HTMLElement,
  pan: Pan,
  zoom: number,
): void {
  const bOp = bookOpacity(zoom);
  const pOp = parshaOpacity(zoom);
  const cOp = chapterOpacity(zoom);

  // Hide container entirely when all layers invisible
  if (bOp <= 0 && pOp <= 0 && cOp <= 0) {
    watermarksContainer.style.display = 'none';
    return;
  }
  watermarksContainer.style.display = '';

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  for (const el of watermarksContainer.children) {
    if (!(el instanceof HTMLElement)) continue;

    const layer = el.dataset.layer;
    let layerOpacity: number;
    let fontScale: number;
    let colorTemplate: string;
    let fontWeight: string;
    let shadow: string;

    switch (layer) {
      case 'book':
        layerOpacity = bOp;
        fontScale = 0.55;
        colorTemplate = BOOK_COLOR;
        fontWeight = '800';
        shadow = '0 0 30px rgba(218, 175, 92, 0.3), 0 0 60px rgba(218, 175, 92, 0.1)';
        break;
      case 'parsha':
        layerOpacity = pOp;
        fontScale = 0.4;
        colorTemplate = PARSHA_COLOR;
        fontWeight = '600';
        shadow = '0 0 15px rgba(198, 160, 88, 0.2)';
        break;
      case 'section':
        layerOpacity = pOp;
        fontScale = 0.3;
        colorTemplate = SECTION_COLOR;
        fontWeight = '600';
        shadow = '0 0 20px rgba(180, 145, 80, 0.15)';
        break;
      case 'chapter':
        layerOpacity = cOp;
        fontScale = 0.5;
        colorTemplate = CHAPTER_COLOR;
        fontWeight = '400';
        shadow = 'none';
        break;
      default:
        continue;
    }

    if (layerOpacity <= 0) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = '';

    const centerX = parseFloat(el.dataset.centerX || '0');
    const centerY = parseFloat(el.dataset.centerY || '0');
    const boundsW = parseFloat(el.dataset.boundsW || '0');
    const boundsH = parseFloat(el.dataset.boundsH || '0');

    // World-to-screen transform
    const screenCenterX = (centerX + pan.x) * zoom;
    const screenCenterY = (centerY + pan.y) * zoom;

    // Cull elements that are off-screen (with generous margin for large text)
    const margin = 400;
    if (screenCenterX < -margin || screenCenterX > viewW + margin ||
        screenCenterY < -margin || screenCenterY > viewH + margin) {
      el.style.display = 'none';
      continue;
    }

    // Font size proportional to bounds, capped
    const screenW = boundsW * zoom;
    const screenH = boundsH * zoom;
    const constraining = Math.min(screenW, screenH);
    let minSize: number, maxSize: number;
    switch (layer) {
      case 'book':
        minSize = 12;
        maxSize = 280;
        break;
      case 'parsha':
      case 'section':
        minSize = 8;
        maxSize = 120;
        break;
      case 'chapter':
        minSize = 6;
        maxSize = 40;
        break;
      default:
        minSize = 8;
        maxSize = 120;
    }
    const fontSize = Math.max(minSize, Math.min(maxSize, constraining * fontScale));

    el.style.position = 'absolute';
    el.style.left = screenCenterX + 'px';
    el.style.top = screenCenterY + 'px';
    el.style.fontSize = fontSize + 'px';
    el.style.fontWeight = fontWeight;
    el.style.color = colorWithOpacity(colorTemplate, layerOpacity);
    el.style.textShadow = shadow;
    el.style.transform = 'translate(-50%, -50%)';
    el.style.whiteSpace = 'nowrap';
    el.style.fontFamily = '"Noto Sans Hebrew", "Frank Ruhl Libre", system-ui, sans-serif';
    el.style.userSelect = 'none';
    el.style.letterSpacing = layer === 'book' ? '0.05em' : '0.02em';
    el.style.pointerEvents = 'none';
  }
}
