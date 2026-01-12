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

// Brightness adjustment factor
const BRIGHTNESS_FACTOR = 1.5;  // Multiply by this to brighten
const DESATURATE_FACTOR = 0.2;  // Multiply saturation by this to desaturate

// Convert RGB to HSL (R, G, B: 0-1) -> (H: 0-360, S: 0-1, L: 0-1)
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l]; // achromatic
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return [h * 360, s, l];
}

// Convert HSL to RGB (H: 0-360, S: 0-1, L: 0-1) -> RGB (0-1)
function hslToRgb(h: number, s: number, l: number): Color {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h >= 60 && h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h >= 120 && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h >= 180 && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h >= 240 && h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }

  return [r + m, g + m, b + m];
}

// Generate rainbow color for a parsha index (0-53)
function getParshaColor(parshaIndex: number, totalParshiot: number): Color {
  // Use full spectrum: 0° (red) → 360° (red again)
  const hue = (parshaIndex / totalParshiot) * 360;
  // High saturation and medium-high lightness for vibrant colors
  return hslToRgb(hue, 0.8, 0.55);
}

// Adjust color brightness (multiply RGB values, clamping to [0, 1])
function adjustBrightness(color: Color, factor: number): Color {
  return [
    Math.min(1, color[0] * factor),
    Math.min(1, color[1] * factor),
    Math.min(1, color[2] * factor),
  ];
}

// Desaturate a color by reducing its saturation
function desaturate(color: Color, factor: number): Color {
  const [h, s, l] = rgbToHsl(color[0], color[1], color[2]);
  return hslToRgb(h, s * factor, l);
}

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
let parshaToColor: Map<ParshaData, Color> = new Map();

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
  parshaToColor.clear();

  if (!data) return;

  const totalParshiot = data.parshiot.length;

  for (let i = 0; i < data.parshiot.length; i++) {
    const parsha = data.parshiot[i];

    // Assign rainbow color to this parsha
    parshaToColor.set(parsha, getParshaColor(i, totalParshiot));

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

    // Re-render if either old or new hover is relevant
    return wasRelevant || isRelevant;
  },

  getVerseColor(verse: Verse): Color | null {
    if (!data) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);

    // Get the base parsha and color for this verse
    const parshaFromTorah = torahVerseToParsha.get(key);
    const parshaFromHaftarah = haftarahVerseToParsha.get(key);
    const parsha = parshaFromTorah || parshaFromHaftarah;

    if (!parsha) {
      // Verse is not part of any Torah portion or haftarah
      return null;
    }

    const baseColor = parshaToColor.get(parsha);
    if (!baseColor) return null;

    // If not hovering, return base color
    if (!hoveredVerse) {
      return baseColor;
    }

    // Determine which parsha is being hovered
    const hoverKey = getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse);
    const hoveredParshaTorah = torahVerseToParsha.get(hoverKey);
    const hoveredParshaHaftarah = haftarahVerseToParsha.get(hoverKey);
    const hoveredParsha = hoveredParshaTorah || hoveredParshaHaftarah;

    // Brighten if this verse belongs to the same parsha as the hovered verse
    if (hoveredParsha && hoveredParsha === parsha) {
      return adjustBrightness(baseColor, BRIGHTNESS_FACTOR);
    }

    // Desaturate all other verses
    return desaturate(baseColor, DESATURATE_FACTOR);
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

    // Generate a gradient showing the rainbow spectrum
    const gradientStops = [];
    const numStops = 10;
    for (let i = 0; i < numStops; i++) {
      const color = getParshaColor(i * (54 / numStops), 54);
      const rgb = color.map(c => Math.round(c * 255)).join(', ');
      const percent = (i / (numStops - 1)) * 100;
      gradientStops.push(`rgb(${rgb}) ${percent}%`);
    }
    const gradient = gradientStops.join(', ');

    container.innerHTML = `
      <div class="legend-row">
        <div style="
          width: 20px;
          height: 12px;
          background: linear-gradient(to right, ${gradient});
          border-radius: 2px;
        "></div>
        <span>54 Parshiot (rainbow spectrum)</span>
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; margin-left: 28px; line-height: 1.3;">
        Torah portion & haftarah (${customLabel}) use same color
      </div>
      <div style="color: #666; font-size: 10px; margin-top: 8px; line-height: 1.4;">
        Hover brightens the parsha & its haftarah, desaturates others
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
