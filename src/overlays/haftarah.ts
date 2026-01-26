// src/overlays/haftarah.ts
import type { Overlay, Color } from './types.ts';
import type { Verse } from '../types.ts';
import { getVerseKey } from '../types.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';

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

type OccasionCategory = 'rosh-chodesh' | 'four-shabbatot' | 'high-holidays' | 'sukkot' | 'pesach' | 'shavuot' | 'fast-days' | 'other';

interface SpecialOccasionData {
  name: string;
  hebrewName: string;
  category: OccasionCategory;
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

// Union type for items that have haftarah readings
type HaftarahItem = ParshaData | SpecialOccasionData;

// Type guard to check if an item is a parsha (has torah property)
function isParsha(item: HaftarahItem): item is ParshaData {
  return 'torah' in item;
}

interface HaftarahMappings {
  parshiot: ParshaData[];
  specialOccasions: SpecialOccasionData[];
}

interface TanakhStructure {
  books: Array<{
    name: string;
    hebrewName: string;
    chapters: number[];
  }>;
}

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

// Generate rainbow color for an item index
function getItemColor(itemIndex: number, totalItemCount: number): Color {
  // Use full spectrum: 0° (red) → 360° (red again)
  const hue = (itemIndex / totalItemCount) * 360;
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
// Haftarah verses can belong to multiple items (parshiot or special occasions)
let haftarahVerseToItem: Map<string, HaftarahItem[]> = new Map();
let isTorahVerse: Set<string> = new Set();
let isHaftarahVerse: Set<string> = new Set();
let itemToColor: Map<HaftarahItem, Color> = new Map();
// Total count of all items (parshiot + special occasions) for color distribution
let totalItems: number = 0;

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
  haftarahVerseToItem.clear();
  isTorahVerse.clear();
  isHaftarahVerse.clear();
  itemToColor.clear();

  if (!data) return;

  // Calculate total items for color distribution
  const specialOccasions = data.specialOccasions || [];
  totalItems = data.parshiot.length + specialOccasions.length;

  // Index parshiot (indices 0 to parshiot.length - 1)
  for (let i = 0; i < data.parshiot.length; i++) {
    const parsha = data.parshiot[i];

    // Assign rainbow color to this parsha
    itemToColor.set(parsha, getItemColor(i, totalItems));

    // Index Torah verses
    forEachVerseInRange(parsha.torah, (book, ch, v) => {
      const key = getVerseKey(book, ch, v);
      torahVerseToParsha.set(key, parsha);
      isTorahVerse.add(key);
    });

    // Index haftarah verses for current custom
    // A verse can belong to multiple items, so we accumulate into an array
    const haftarahRanges = parsha.haftarah[currentCustom];
    for (const range of haftarahRanges) {
      forEachVerseInRange(range, (book, ch, v) => {
        const key = getVerseKey(book, ch, v);
        const existing = haftarahVerseToItem.get(key);
        if (existing) {
          existing.push(parsha);
        } else {
          haftarahVerseToItem.set(key, [parsha]);
        }
        isHaftarahVerse.add(key);
      });
    }
  }

  // Index special occasions (indices parshiot.length to totalItems - 1)
  for (let i = 0; i < specialOccasions.length; i++) {
    const occasion = specialOccasions[i];

    // Assign rainbow color to this special occasion (continuing from parshiot)
    itemToColor.set(occasion, getItemColor(data.parshiot.length + i, totalItems));

    // Index haftarah verses for current custom
    const haftarahRanges = occasion.haftarah[currentCustom];
    for (const range of haftarahRanges) {
      forEachVerseInRange(range, (book, ch, v) => {
        const key = getVerseKey(book, ch, v);
        const existing = haftarahVerseToItem.get(key);
        if (existing) {
          existing.push(occasion);
        } else {
          haftarahVerseToItem.set(key, [occasion]);
        }
        isHaftarahVerse.add(key);
      });
    }
  }
}

// Check if a verse is relevant to the overlay (Torah or haftarah)
function isRelevantVerse(verse: Verse): boolean {
  const key = getVerseKey(verse.book, verse.chapter, verse.verse);
  return torahVerseToParsha.has(key) || haftarahVerseToItem.has(key);
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

    // Only track relevant verses; treat non-relevant verses as empty space (null)
    // This prevents non-relevant verses from causing all relevant verses to be desaturated
    const effectiveVerse = isRelevant ? verse : null;

    // Quick check: if neither was nor is a relevant verse, no change needed
    if (!wasRelevant && !isRelevant) {
      hoveredVerse = null;
      return false;
    }

    const oldKey = hoveredVerse
      ? getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse)
      : null;
    const newKey = effectiveVerse
      ? getVerseKey(effectiveVerse.book, effectiveVerse.chapter, effectiveVerse.verse)
      : null;

    // If same effective verse, no change needed
    if (oldKey === newKey) {
      return false;
    }

    hoveredVerse = effectiveVerse;

    // Re-render if either old or new hover is relevant
    return wasRelevant || isRelevant;
  },

  getVerseColor(verse: Verse): Color | Color[] | null {
    if (!data) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);

    // Get the item(s) for this verse
    const parshaFromTorah = torahVerseToParsha.get(key);
    const itemsFromHaftarah = haftarahVerseToItem.get(key);

    // Torah verses belong to exactly one parsha
    if (parshaFromTorah) {
      const baseColor = itemToColor.get(parshaFromTorah);
      if (!baseColor) return null;

      if (!hoveredVerse) {
        return baseColor;
      }

      // Check if hovered verse belongs to the same parsha
      const hoverKey = getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse);
      const hoveredParshaTorah = torahVerseToParsha.get(hoverKey);
      const hoveredItemsHaftarah = haftarahVerseToItem.get(hoverKey);

      const isHoveredItem =
        hoveredParshaTorah === parshaFromTorah ||
        (hoveredItemsHaftarah && hoveredItemsHaftarah.includes(parshaFromTorah));

      if (isHoveredItem) {
        return adjustBrightness(baseColor, HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR);
      }
      return desaturate(baseColor, HIGHLIGHT_CONSTANTS.DESATURATE_FACTOR);
    }

    // Haftarah verses can belong to multiple items (parshiot or special occasions)
    if (itemsFromHaftarah && itemsFromHaftarah.length > 0) {
      // Get colors for all items this verse belongs to
      const colors = itemsFromHaftarah
        .map((item) => itemToColor.get(item))
        .filter((c): c is Color => c !== undefined);

      if (colors.length === 0) return null;

      if (!hoveredVerse) {
        // Return multiple colors for stipple effect, or single color
        return colors.length === 1 ? colors[0] : colors;
      }

      // Check if hovered verse shares any item with this verse
      const hoverKey = getVerseKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse);
      const hoveredParshaTorah = torahVerseToParsha.get(hoverKey);
      const hoveredItemsHaftarah = haftarahVerseToItem.get(hoverKey);

      const isHoveredItem =
        (hoveredParshaTorah && itemsFromHaftarah.includes(hoveredParshaTorah)) ||
        (hoveredItemsHaftarah &&
          hoveredItemsHaftarah.some((hi) => itemsFromHaftarah.includes(hi)));

      if (isHoveredItem) {
        const brightColors = colors.map((c) => adjustBrightness(c, HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR));
        return brightColors.length === 1 ? brightColors[0] : brightColors;
      }

      const desatColors = colors.map((c) => desaturate(c, HIGHLIGHT_CONSTANTS.DESATURATE_FACTOR));
      return desatColors.length === 1 ? desatColors[0] : desatColors;
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
    const parshaCount = data?.parshiot.length || 54;
    const occasionCount = data?.specialOccasions?.length || 0;

    // Generate a gradient showing the rainbow spectrum
    const gradientStops = [];
    const numStops = 10;
    for (let i = 0; i < numStops; i++) {
      const color = getItemColor(i * (totalItems / numStops), totalItems || 81);
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
        <span>${parshaCount} Parshiot + ${occasionCount} Special Occasions</span>
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; margin-left: 28px; line-height: 1.3;">
        Torah portion & haftarah (${customLabel}) use same color
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; margin-left: 28px; line-height: 1.3;">
        Includes holidays, fast days, special Shabbatot
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; margin-left: 28px; line-height: 1.3;">
        Multi-item verses show stippled pattern
      </div>
      <div style="color: #666; font-size: 10px; margin-top: 8px; line-height: 1.4;">
        Hover brightens the reading & its haftarah, desaturates others
      </div>
    `;
  },

  getHoverInfo(verse: Verse): string | null {
    if (!data) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);

    // Torah verses - show parsha and its haftarah
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

    // Haftarah verses - can belong to parshiot or special occasions
    const itemsFromHaftarah = haftarahVerseToItem.get(key);
    if (itemsFromHaftarah && itemsFromHaftarah.length > 0) {
      if (itemsFromHaftarah.length === 1) {
        const item = itemsFromHaftarah[0];
        if (isParsha(item)) {
          return `Haftarah for ${item.name} (${item.hebrewName})`;
        } else {
          // Special occasion
          return `Haftarah for ${item.name} (${item.hebrewName})`;
        }
      }
      // Multiple items - list them all
      const itemList = itemsFromHaftarah
        .map((item) => `${item.name} (${item.hebrewName})`)
        .join(', ');
      return `Haftarah for: ${itemList}`;
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
