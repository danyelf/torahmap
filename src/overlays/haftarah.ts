// src/overlays/haftarah.ts
import type { Overlay, Color } from './types.ts';
import type { Verse } from '../types.ts';
import { getVerseKey } from '../types.ts';

// Types for haftarah data
interface VerseRef {
  chapter: number;
  verse: number;
}

interface VerseRange {
  book: string;
  start: VerseRef;
  end: VerseRef;
}

interface ParshaData {
  name: string;
  hebrewName: string;
  torah: VerseRange;
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

interface HaftarahMappings {
  parshiot: ParshaData[];
}

interface TanakhStructure {
  books: Array<{
    name: string;
    hebrewName: string;
    chapters: number[];
  }>;
}

// Colors
const TORAH_PARSHA_COLOR: Color = [0.3, 0.5, 0.8];       // Blue for Torah portions
const HAFTARAH_COLOR: Color = [0.8, 0.5, 0.3];           // Orange for haftarah
const HIGHLIGHT_COLOR: Color = [0.2, 0.9, 0.6];          // Bright green for cross-highlight
const DIM_COLOR: Color = [0.2, 0.2, 0.2];                // Dim for non-related when hovering

type Custom = 'ashkenazi' | 'sephardi';

// Module state
let data: HaftarahMappings | null = null;
let structure: TanakhStructure | null = null;
let currentCustom: Custom = 'ashkenazi';
let hoveredVerse: Verse | null = null;
let updateCallback: (() => void) | null = null;

// Lookup indexes (built once on init, rebuilt on custom change)
let torahVerseToParsha: Map<string, ParshaData> = new Map();
let haftarahVerseToParsha: Map<string, ParshaData> = new Map();
let isTorahVerse: Set<string> = new Set();
let isHaftarahVerse: Set<string> = new Set();

// Cache for highlighted verses
let cachedHighlightedVerses: Set<string> | null = null;
let cachedHoverKey: string | null = null;

// Get verse count for a chapter from structure data
function getVerseCount(book: string, chapter: number): number {
  if (!structure) return 200; // Safe fallback
  const bookData = structure.books.find((b) => b.name === book);
  if (!bookData || chapter < 1 || chapter > bookData.chapters.length) {
    return 200; // Safe fallback
  }
  return bookData.chapters[chapter - 1];
}

// Iterate over all verses in a range, calling callback for each
function forEachVerseInRange(
  range: VerseRange,
  callback: (book: string, chapter: number, verse: number) => void
): void {
  for (let ch = range.start.chapter; ch <= range.end.chapter; ch++) {
    const startV = ch === range.start.chapter ? range.start.verse : 1;
    const maxV = getVerseCount(range.book, ch);
    const endV = ch === range.end.chapter ? Math.min(range.end.verse, maxV) : maxV;
    for (let v = startV; v <= endV; v++) {
      callback(range.book, ch, v);
    }
  }
}

// Build lookup indexes for efficient O(1) verse lookup
function buildIndexes(): void {
  torahVerseToParsha.clear();
  haftarahVerseToParsha.clear();
  isTorahVerse.clear();
  isHaftarahVerse.clear();
  cachedHighlightedVerses = null;
  cachedHoverKey = null;

  if (!data) return;

  for (const parsha of data.parshiot) {
    // Index Torah verses
    forEachVerseInRange(parsha.torah, (book, ch, v) => {
      const key = getVerseKey(book, ch, v);
      torahVerseToParsha.set(key, parsha);
      isTorahVerse.add(key);
    });

    // Index haftarah verses for current custom
    const haftarahRanges = parsha.haftarah[currentCustom];
    for (const range of haftarahRanges) {
      forEachVerseInRange(range, (book, ch, v) => {
        const key = getVerseKey(book, ch, v);
        haftarahVerseToParsha.set(key, parsha);
        isHaftarahVerse.add(key);
      });
    }
  }
}

// Get verses to highlight based on hovered verse
function getHighlightedVerses(): Set<string> {
  const currentKey = hoveredVerse
    ? getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse)
    : null;

  if (currentKey === cachedHoverKey && cachedHighlightedVerses) {
    return cachedHighlightedVerses;
  }

  cachedHoverKey = currentKey;
  cachedHighlightedVerses = new Set<string>();

  if (!hoveredVerse || !data) return cachedHighlightedVerses;

  const key = getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse);

  // Check if hovered verse is in Torah portion
  const parshaFromTorah = torahVerseToParsha.get(key);
  if (parshaFromTorah) {
    // Highlight corresponding haftarah
    const haftarahRanges = parshaFromTorah.haftarah[currentCustom];
    for (const range of haftarahRanges) {
      forEachVerseInRange(range, (book, ch, v) => {
        cachedHighlightedVerses!.add(getVerseKey(book, ch, v));
      });
    }
    return cachedHighlightedVerses;
  }

  // Check if hovered verse is in haftarah
  const parshaFromHaftarah = haftarahVerseToParsha.get(key);
  if (parshaFromHaftarah) {
    // Highlight corresponding Torah portion
    forEachVerseInRange(parshaFromHaftarah.torah, (book, ch, v) => {
      cachedHighlightedVerses!.add(getVerseKey(book, ch, v));
    });
    return cachedHighlightedVerses;
  }

  return cachedHighlightedVerses;
}

// Check if a verse is relevant to the overlay (Torah or haftarah)
function isRelevantVerse(verse: Verse): boolean {
  const key = getVerseKey(verse.book, verse.chapter, verse.verse);
  return torahVerseToParsha.has(key) || haftarahVerseToParsha.has(key);
}

export const haftarahOverlay: Overlay = {
  id: 'haftarah',
  name: 'Haftarah',

  async init() {
    try {
      // Load both data files in parallel
      const [haftarahRes, structureRes] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}data/haftarah-mappings.json`),
        fetch(`${import.meta.env.BASE_URL}data/tanakh-structure.json`),
      ]);

      if (!haftarahRes.ok) {
        console.error(`Failed to load haftarah-mappings.json: ${haftarahRes.status}`);
        return;
      }
      if (!structureRes.ok) {
        console.error(`Failed to load tanakh-structure.json: ${structureRes.status}`);
        return;
      }

      data = await haftarahRes.json();
      structure = await structureRes.json();
      buildIndexes();
    } catch (e) {
      console.error('Failed to initialize haftarah overlay:', e);
    }
  },

  destroy() {
    hoveredVerse = null;
    cachedHighlightedVerses = null;
    cachedHoverKey = null;
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  setHoveredVerse(verse: Verse | null): boolean {
    const wasRelevant = hoveredVerse ? isRelevantVerse(hoveredVerse) : false;
    const isRelevant = verse ? isRelevantVerse(verse) : false;

    // Quick check: if neither was nor is a relevant verse, no change needed
    if (!wasRelevant && !isRelevant) {
      hoveredVerse = verse;
      return false;
    }

    const oldKey = hoveredVerse
      ? getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse)
      : null;
    const newKey = verse
      ? getVerseKey(verse.book, verse.chapter, verse.verse)
      : null;

    // If same verse, no change needed
    if (oldKey === newKey) {
      return false;
    }

    hoveredVerse = verse;
    cachedHighlightedVerses = null; // Invalidate cache

    // Re-render if either old or new hover is relevant
    return wasRelevant || isRelevant;
  },

  getVerseColor(verse: Verse): Color | null {
    if (!data) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const highlightedVerses = getHighlightedVerses();

    // Check if this verse should be highlighted (cross-reference from hover)
    if (highlightedVerses.has(key)) {
      return HIGHLIGHT_COLOR;
    }

    const isHovering = hoveredVerse !== null;
    const hoverKey = hoveredVerse
      ? getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse)
      : null;

    // Check if this is a Torah portion verse
    if (isTorahVerse.has(key)) {
      // If we're hovering a haftarah verse, dim non-connected Torah
      if (isHovering && hoverKey && haftarahVerseToParsha.has(hoverKey)) {
        return DIM_COLOR;
      }
      return TORAH_PARSHA_COLOR;
    }

    // Check if this is a haftarah verse
    if (isHaftarahVerse.has(key)) {
      // If we're hovering a Torah verse, dim non-connected haftarah
      if (isHovering && hoverKey && torahVerseToParsha.has(hoverKey)) {
        return DIM_COLOR;
      }
      return HAFTARAH_COLOR;
    }

    // Verse is not part of any Torah portion or haftarah
    return null;
  },

  renderControls(container: HTMLElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'haftarah-controls';
    wrapper.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-top: 10px;">
        <label for="custom-select" style="font-size: 12px; color: #aaa;">Custom:</label>
        <select id="custom-select" style="flex: 1;">
          <option value="ashkenazi">Ashkenazi</option>
          <option value="sephardi">Sephardi</option>
        </select>
      </div>
    `;

    const select = wrapper.querySelector('select')!;
    select.value = currentCustom;
    select.addEventListener('change', () => {
      currentCustom = select.value as Custom;
      buildIndexes(); // Rebuild with new custom
      updateCallback?.();
    });

    container.appendChild(wrapper);
  },

  renderLegend(container: HTMLElement) {
    const customLabel = currentCustom === 'ashkenazi' ? 'Ashkenazi' : 'Sephardi';
    container.innerHTML = `
      <div class="legend-row">
        <span class="swatch" style="background: rgb(77, 128, 204)"></span>
        <span>Torah Portion</span>
      </div>
      <div class="legend-row">
        <span class="swatch" style="background: rgb(204, 128, 77)"></span>
        <span>Haftarah (${customLabel})</span>
      </div>
      <div class="legend-row">
        <span class="swatch" style="background: rgb(51, 230, 153)"></span>
        <span>Connected (hover)</span>
      </div>
      <div style="color: #666; font-size: 10px; margin-top: 8px; line-height: 1.4;">
        Hover Torah verse to highlight its haftarah, or vice versa
      </div>
    `;
  },

  getHoverInfo(verse: Verse): string | null {
    if (!data) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);

    const parshaFromTorah = torahVerseToParsha.get(key);
    if (parshaFromTorah) {
      const haftarahRanges = parshaFromTorah.haftarah[currentCustom];
      const haftarahStr = haftarahRanges
        .map((r) => {
          if (r.start.chapter === r.end.chapter) {
            return `${r.book} ${r.start.chapter}:${r.start.verse}-${r.end.verse}`;
          }
          return `${r.book} ${r.start.chapter}:${r.start.verse}-${r.end.chapter}:${r.end.verse}`;
        })
        .join(', ');
      return `${parshaFromTorah.name} (${parshaFromTorah.hebrewName}) → ${haftarahStr}`;
    }

    const parshaFromHaftarah = haftarahVerseToParsha.get(key);
    if (parshaFromHaftarah) {
      return `Haftarah for ${parshaFromHaftarah.name} (${parshaFromHaftarah.hebrewName})`;
    }

    return null;
  },

  getUrlParams(): Record<string, string> {
    if (currentCustom === 'ashkenazi') return {};
    return { custom: currentCustom };
  },

  applyUrlParams(params: URLSearchParams): void {
    const custom = params.get('custom');
    if (custom === 'sephardi') {
      currentCustom = 'sephardi';
      buildIndexes();
      // Update the dropdown if it exists
      const select = document.querySelector('#custom-select') as HTMLSelectElement | null;
      if (select) {
        select.value = currentCustom;
      }
    }
  },
};
