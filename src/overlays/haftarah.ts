import type { Overlay, Color, UrlParamSpec, UrlParamValues } from './types.ts';
import type { TanakhIdentity } from '../types.ts';
import { tanakhKey } from '../types.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';
import { rgbToHsl, hslToRgb } from '../utils/color.ts';
import { fetchData } from '../constants/app.ts';

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

type OccasionCategory =
  | 'rosh-chodesh'
  | 'four-shabbatot'
  | 'high-holidays'
  | 'sukkot'
  | 'pesach'
  | 'shavuot'
  | 'fast-days'
  | 'other';

interface SpecialOccasionData {
  name: string;
  hebrewName: string;
  category: OccasionCategory;
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

type HaftarahItem = ParshaData | SpecialOccasionData;

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

function getItemColor(itemIndex: number, totalItemCount: number): Color {
  const hue = (itemIndex / totalItemCount) * 360;
  return hslToRgb({ h: hue, s: 0.8, l: 0.55 });
}

function adjustBrightness(color: Color, factor: number): Color {
  return [
    Math.min(1, color[0] * factor),
    Math.min(1, color[1] * factor),
    Math.min(1, color[2] * factor),
  ];
}

function desaturate(color: Color, factor: number): Color {
  const { h, s, l } = rgbToHsl(color);
  return hslToRgb({ h, s: s * factor, l });
}

const CUSTOMS = ['ashkenazi', 'sephardi'] as const;
type Custom = (typeof CUSTOMS)[number];

const URL_PARAMS = [
  { key: 'custom', kind: 'token', allowed: CUSTOMS },
] as const satisfies readonly UrlParamSpec[];

let data: HaftarahMappings | null = null;
let structure: TanakhStructure | null = null;
let currentCustom: Custom = 'ashkenazi';
let hoveredVerse: TanakhIdentity | null = null;
let updateCallback: (() => void) | null = null;

// Lookup indexes (built once on init, rebuilt on custom change)
let torahVerseToParsha: Map<string, ParshaData> = new Map();
// Haftarah verses can belong to multiple items (parshiot or special occasions)
let haftarahVerseToItem: Map<string, HaftarahItem[]> = new Map();
let isTorahVerse: Set<string> = new Set();
let isHaftarahVerse: Set<string> = new Set();
let itemToColor: Map<HaftarahItem, Color> = new Map();
let totalItems: number = 0; // parshiot + special occasions, for color distribution

function getVerseCount(book: string, chapter: number): number {
  if (!structure) return 200; // Safe fallback
  const bookData = structure.books.find((b) => b.name === book);
  if (!bookData || chapter < 1 || chapter > bookData.chapters.length) {
    return 200; // Safe fallback
  }
  return bookData.chapters[chapter - 1];
}

function forEachVerseInRange(
  range: VerseRange,
  callback: (book: string, chapter: number, verse: number) => void,
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

function buildIndexes(): void {
  torahVerseToParsha.clear();
  haftarahVerseToItem.clear();
  isTorahVerse.clear();
  isHaftarahVerse.clear();
  itemToColor.clear();

  if (!data) return;

  const specialOccasions = data.specialOccasions || [];
  totalItems = data.parshiot.length + specialOccasions.length;

  // Parshiot take color indices 0..parshiot.length-1; special occasions
  // continue from there, so the rainbow runs across both without repeats.
  for (let i = 0; i < data.parshiot.length; i++) {
    const parsha = data.parshiot[i];

    itemToColor.set(parsha, getItemColor(i, totalItems));

    forEachVerseInRange(parsha.torah, (book, ch, v) => {
      const key = tanakhKey(book, ch, v);
      torahVerseToParsha.set(key, parsha);
      isTorahVerse.add(key);
    });

    // A haftarah verse can belong to multiple items, so accumulate into an array.
    const haftarahRanges = parsha.haftarah[currentCustom];
    for (const range of haftarahRanges) {
      forEachVerseInRange(range, (book, ch, v) => {
        const key = tanakhKey(book, ch, v);
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

  for (let i = 0; i < specialOccasions.length; i++) {
    const occasion = specialOccasions[i];

    itemToColor.set(occasion, getItemColor(data.parshiot.length + i, totalItems));

    const haftarahRanges = occasion.haftarah[currentCustom];
    for (const range of haftarahRanges) {
      forEachVerseInRange(range, (book, ch, v) => {
        const key = tanakhKey(book, ch, v);
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

function isRelevantVerse(verse: TanakhIdentity): boolean {
  const key = tanakhKey(verse.book, verse.chapter, verse.verse);
  return torahVerseToParsha.has(key) || haftarahVerseToItem.has(key);
}

export const haftarahOverlay: Overlay = {
  id: 'haftarah',
  name: 'Haftarah',
  description:
    'The weekly Torah portion read in synagogue and the passage from the Prophets read ' +
    'after it, shown in the same colour so the pairing is visible. Ashkenazi and ' +
    'Sephardi custom differ, and you can switch between them.',
  credits: [
    {
      source: 'Hebcal leyning tables',
      url: 'https://github.com/hebcal/hebcal-leyning',
      license: 'BSD 2-Clause',
      licenseUrl: 'https://github.com/hebcal/hebcal-leyning/blob/main/LICENSE',
      collected: 'September 2026',
      note: 'Which passage is read on which occasion.',
    },
  ],

  async init() {
    try {
      const [haftarahRes, structureRes] = await Promise.all([
        fetchData('overlays/haftarah/mappings.json'),
        fetchData('tanakh-structure.json'),
      ]);

      if (!haftarahRes.ok) {
        console.error(`Failed to load overlays/haftarah/mappings.json: ${haftarahRes.status}`);
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
    // Only clear ephemeral UI state. Lookup indexes are derived from data
    // loaded once in init() (which doesn't re-run on re-activation), so clearing
    // them here would leave the overlay broken if it gets re-activated later.
    hoveredVerse = null;
    updateCallback = null;
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  setHoveredVerse(verse: TanakhIdentity | null): boolean {
    const wasRelevant = hoveredVerse ? isRelevantVerse(hoveredVerse) : false;
    const isRelevant = verse ? isRelevantVerse(verse) : false;

    // Track only relevant verses, so hovering empty space doesn't desaturate
    // every reading.
    const effectiveVerse = isRelevant ? verse : null;

    if (!wasRelevant && !isRelevant) {
      hoveredVerse = null;
      return false;
    }

    const oldKey = hoveredVerse
      ? tanakhKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse)
      : null;
    const newKey = effectiveVerse
      ? tanakhKey(effectiveVerse.book, effectiveVerse.chapter, effectiveVerse.verse)
      : null;

    if (oldKey === newKey) {
      return false;
    }

    hoveredVerse = effectiveVerse;
    return wasRelevant || isRelevant;
  },

  getVerseColor(verse: TanakhIdentity): Color | Color[] | null {
    if (!data) return null;

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);

    const parshaFromTorah = torahVerseToParsha.get(key);
    const itemsFromHaftarah = haftarahVerseToItem.get(key);

    // Torah verses belong to exactly one parsha.
    if (parshaFromTorah) {
      const baseColor = itemToColor.get(parshaFromTorah);
      if (!baseColor) return null;

      if (!hoveredVerse) {
        return baseColor;
      }

      const hoverKey = tanakhKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse);
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

    // Haftarah verses can belong to multiple items (parshiot or special occasions).
    if (itemsFromHaftarah && itemsFromHaftarah.length > 0) {
      const colors = itemsFromHaftarah
        .map((item) => itemToColor.get(item))
        .filter((c): c is Color => c !== undefined);

      if (colors.length === 0) return null;

      if (!hoveredVerse) {
        return colors.length === 1 ? colors[0] : colors;
      }

      const hoverKey = tanakhKey(hoveredVerse.book, hoveredVerse.chapter, hoveredVerse.verse);
      const hoveredParshaTorah = torahVerseToParsha.get(hoverKey);
      const hoveredItemsHaftarah = haftarahVerseToItem.get(hoverKey);

      const isHoveredItem =
        (hoveredParshaTorah && itemsFromHaftarah.includes(hoveredParshaTorah)) ||
        (hoveredItemsHaftarah && hoveredItemsHaftarah.some((hi) => itemsFromHaftarah.includes(hi)));

      if (isHoveredItem) {
        const brightColors = colors.map((c) =>
          adjustBrightness(c, HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
        );
        return brightColors.length === 1 ? brightColors[0] : brightColors;
      }

      const desatColors = colors.map((c) => desaturate(c, HIGHLIGHT_CONSTANTS.DESATURATE_FACTOR));
      return desatColors.length === 1 ? desatColors[0] : desatColors;
    }

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
    // The optional chain has to reach parshiot too: a failed or malformed
    // fetch leaves data as an object without it.
    const parshaCount = data?.parshiot?.length || 54;
    const occasionCount = data?.specialOccasions?.length || 0;

    const gradientStops = [];
    const numStops = 10;
    for (let i = 0; i < numStops; i++) {
      const color = getItemColor(i * (totalItems / numStops), totalItems || 81);
      const rgb = color.map((c) => Math.round(c * 255)).join(', ');
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

  getHoverInfo(verse: TanakhIdentity): string | null {
    if (!data) return null;

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);

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

    const itemsFromHaftarah = haftarahVerseToItem.get(key);
    if (itemsFromHaftarah && itemsFromHaftarah.length > 0) {
      if (itemsFromHaftarah.length === 1) {
        const item = itemsFromHaftarah[0];
        if (isParsha(item)) {
          return `Haftarah for ${item.name} (${item.hebrewName})`;
        } else {
          return `Haftarah for ${item.name} (${item.hebrewName})`;
        }
      }
      const itemList = itemsFromHaftarah
        .map((item) => `${item.name} (${item.hebrewName})`)
        .join(', ');
      return `Haftarah for: ${itemList}`;
    }

    return null;
  },

  urlParams: URL_PARAMS,

  getUrlParams(): Record<string, string> {
    // Ashkenazi is the default, so it stays out of the URL
    if (currentCustom === 'ashkenazi') return {};
    return { custom: currentCustom };
  },

  applyUrlParams(params: UrlParamValues<typeof URL_PARAMS>): void {
    const custom = params.custom;
    if (!custom || custom === currentCustom) return;

    currentCustom = custom;
    buildIndexes();
    // Update the dropdown if it exists
    const select = document.querySelector('#custom-select') as HTMLSelectElement | null;
    if (select) {
      select.value = currentCustom;
    }
  },
};
