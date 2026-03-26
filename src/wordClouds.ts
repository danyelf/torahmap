// Word frequency clouds per book, visible at low zoom levels
// Renders Hebrew words sized by frequency within each book's bounding box

import type { VerseLayout } from './types.ts';
import type { VerseTexts } from './verseTexts.ts';
import { stripNikkud } from './search.ts';

// Hebrew stop words to filter out (common grammatical particles)
const HEBREW_STOP_WORDS = new Set([
  'את', 'של', 'על', 'אל', 'לא', 'כי', 'אשר', 'הוא', 'היא',
  'הם', 'הן', 'אני', 'אנחנו', 'אתה', 'אתם', 'אתן',
  'זה', 'זאת', 'אלה', 'מה', 'מי', 'גם', 'כל', 'עם',
  'יש', 'אין', 'היה', 'להם', 'לו', 'לה', 'בו', 'בה',
  'ולא', 'ואת', 'כן', 'עד', 'אם', 'או', 'רק', 'בן',
  'לך', 'לי', 'בי', 'לנו', 'בם', 'בנו', 'להם',
  'ויאמר', 'אמר', 'ואמר',
]);

// Minimum word length to include
const MIN_WORD_LENGTH = 2;

// Number of top words per book
const TOP_WORDS_COUNT = 7;

// Zoom threshold: show word clouds below this zoom level
const SHOW_ZOOM_MAX = 1.2;
// Fade range: fully visible below this, fading from here to SHOW_ZOOM_MAX
const FADE_START = 0.8;

// Word cloud opacity range
const MAX_OPACITY = 0.20;

interface BookWordCloud {
  book: string;
  words: { text: string; frequency: number; normalizedSize: number }[];
  // Bounding box in world coordinates
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface WordPlacement {
  text: string;
  worldX: number;
  worldY: number;
  fontSize: number; // base font size in world units
  element: HTMLSpanElement;
}

interface BookCloudState {
  cloud: BookWordCloud;
  placements: WordPlacement[];
}

let cloudContainer: HTMLDivElement | null = null;
let bookClouds: BookCloudState[] = [];

/**
 * Compute word frequencies for each book from verse texts.
 */
function computeBookWordFrequencies(
  verses: VerseLayout[],
  verseTexts: VerseTexts,
): BookWordCloud[] {
  // Group verses by book and compute bounding boxes
  const bookData: Record<string, {
    freqs: Map<string, number>;
    minX: number; maxX: number; minY: number; maxY: number;
  }> = {};

  for (const v of verses) {
    if (!bookData[v.book]) {
      bookData[v.book] = {
        freqs: new Map(),
        minX: v.x, maxX: v.x + v.size,
        minY: v.y, maxY: v.y + v.size,
      };
    }
    const bd = bookData[v.book];
    bd.minX = Math.min(bd.minX, v.x);
    bd.maxX = Math.max(bd.maxX, v.x + v.size);
    bd.minY = Math.min(bd.minY, v.y);
    bd.maxY = Math.max(bd.maxY, v.y + v.size);

    // Get Hebrew text for this verse
    const text = verseTexts[v.book]?.[String(v.chapter)]?.[String(v.verse)]?.he;
    if (!text) continue;

    // Strip nikkud and split into words
    const stripped = stripNikkud(text);
    const words = stripped.split(/\s+/);

    for (const word of words) {
      // Clean: remove punctuation attached to words
      const clean = word.replace(/[^\u0590-\u05FF]/g, '');
      if (clean.length < MIN_WORD_LENGTH) continue;
      if (HEBREW_STOP_WORDS.has(clean)) continue;

      bd.freqs.set(clean, (bd.freqs.get(clean) || 0) + 1);
    }
  }

  // Build top words per book
  const results: BookWordCloud[] = [];

  for (const [book, bd] of Object.entries(bookData)) {
    const sorted = [...bd.freqs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_WORDS_COUNT);

    if (sorted.length === 0) continue;

    const maxFreq = sorted[0][1];
    const minFreq = sorted[sorted.length - 1][1];
    const range = maxFreq - minFreq || 1;

    const words = sorted.map(([text, frequency]) => ({
      text,
      frequency,
      // Normalized 0-1 where 1 is most frequent
      normalizedSize: (frequency - minFreq) / range,
    }));

    results.push({
      book,
      words,
      minX: bd.minX,
      maxX: bd.maxX,
      minY: bd.minY,
      maxY: bd.maxY,
    });
  }

  return results;
}

/**
 * Distribute words within the book's bounding box.
 * Uses a simple deterministic placement: spread words across the area.
 */
function placeWords(cloud: BookWordCloud): WordPlacement[] {
  const placements: WordPlacement[] = [];
  const width = cloud.maxX - cloud.minX;
  const height = cloud.maxY - cloud.minY;

  // Minimum font size in world units, largest is ~3.5x
  const minFontSize = Math.min(width * 0.08, height * 0.06);
  const maxFontSize = minFontSize * 3.5;

  const count = cloud.words.length;

  // Use a grid-like distribution with some variation
  // Arrange in rows, distributing words across the bounding box
  const cols = Math.min(count, 3);
  const rows = Math.ceil(count / cols);

  // Margins to keep words inside the box
  const marginX = width * 0.05;
  const marginY = height * 0.08;
  const usableW = width - marginX * 2;
  const usableH = height - marginY * 2;

  for (let i = 0; i < count; i++) {
    const word = cloud.words[i];
    const row = Math.floor(i / cols);
    const col = i % cols;

    // Position within the grid cell
    const cellW = usableW / cols;
    const cellH = usableH / rows;

    // Center of cell with slight deterministic offset based on index
    const offsetX = ((i * 7 + 3) % 11) / 11 * 0.4 - 0.2; // -0.2 to 0.2
    const offsetY = ((i * 13 + 5) % 11) / 11 * 0.3 - 0.15;

    const worldX = cloud.minX + marginX + cellW * (col + 0.5 + offsetX);
    const worldY = cloud.minY + marginY + cellH * (row + 0.5 + offsetY);

    const fontSize = minFontSize + (maxFontSize - minFontSize) * word.normalizedSize;

    const element = document.createElement('span');
    element.textContent = word.text;
    element.style.cssText = `
      position:absolute;
      pointer-events:none;
      font-family:"Noto Sans Hebrew",system-ui,sans-serif;
      font-weight:700;
      color:#c8d0e0;
      white-space:nowrap;
      transform:translate(-50%,-50%);
      text-shadow:0 0 8px rgba(0,0,0,0.5);
    `;

    placements.push({ text: word.text, worldX, worldY, fontSize, element });
  }

  return placements;
}

/**
 * Initialize word clouds. Call after verse texts are loaded.
 */
export function initWordClouds(
  verses: VerseLayout[],
  verseTexts: VerseTexts,
  container: HTMLElement,
): void {
  // Compute word frequencies
  const clouds = computeBookWordFrequencies(verses, verseTexts);

  // Create container behind the canvas
  cloudContainer = document.createElement('div');
  cloudContainer.id = 'word-clouds';
  // z-index: 2 puts it above the canvas but below UI controls (z-index: 10)
  cloudContainer.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:2;';

  // Place words for each book
  bookClouds = clouds.map(cloud => {
    const placements = placeWords(cloud);
    for (const p of placements) {
      cloudContainer!.appendChild(p.element);
    }
    return { cloud, placements };
  });

  container.appendChild(cloudContainer);
}

/**
 * Update word cloud positions based on current camera state.
 * Call on every render frame where pan/zoom changes.
 */
export function updateWordClouds(
  pan: { x: number; y: number },
  zoom: number,
): void {
  if (!cloudContainer || bookClouds.length === 0) return;

  // Determine visibility based on zoom
  let opacity: number;
  if (zoom > SHOW_ZOOM_MAX) {
    opacity = 0;
  } else if (zoom > FADE_START) {
    // Fade out linearly from FADE_START to SHOW_ZOOM_MAX
    opacity = MAX_OPACITY * (1 - (zoom - FADE_START) / (SHOW_ZOOM_MAX - FADE_START));
  } else {
    opacity = MAX_OPACITY;
  }

  // Hide container entirely when invisible
  if (opacity <= 0) {
    cloudContainer.style.display = 'none';
    return;
  }

  cloudContainer.style.display = '';
  cloudContainer.style.opacity = String(opacity);

  // Update each word's screen position
  for (const { placements } of bookClouds) {
    for (const p of placements) {
      const screenX = (p.worldX + pan.x) * zoom;
      const screenY = (p.worldY + pan.y) * zoom;
      const screenFontSize = p.fontSize * zoom;

      p.element.style.left = screenX + 'px';
      p.element.style.top = screenY + 'px';
      p.element.style.fontSize = screenFontSize + 'px';
    }
  }
}
