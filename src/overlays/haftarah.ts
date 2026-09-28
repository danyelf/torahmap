import type { Overlay, Color, UrlParamSpec, UrlParamValues } from './types.ts';
import type { TanakhIdentity, TorahData } from '../types.ts';
import { tanakhKey } from '../types.ts';
import { HIGHLIGHT_CONSTANTS, DIMMED_GREY } from '../constants.ts';
import { rgbToHsl, hslToRgb, buildLegendGradient, colorToCss } from '../utils/color.ts';
import { escapeHtml } from '../utils/html.ts';
import { lingeringHover } from '../utils/hover.ts';
import { loadJson } from './loadJson.ts';
import { CONTROL } from '../panel.ts';
import { legendCaption } from './legend.ts';
import '../styles/overlays/haftarah.css';

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

// In the order the legend lists them.
const CATEGORY_LABELS: Record<OccasionCategory, string> = {
  'high-holidays': 'High Holidays',
  sukkot: 'Sukkot',
  'four-shabbatot': 'Four Shabbatot',
  pesach: 'Pesach',
  shavuot: 'Shavuot',
  'fast-days': 'Fast Days',
  'rosh-chodesh': 'Rosh Chodesh',
  other: 'Other',
};

type HaftarahItem = ParshaData | SpecialOccasionData;

function isParsha(item: HaftarahItem): item is ParshaData {
  return 'torah' in item;
}

interface HaftarahMappings {
  parshiot: ParshaData[];
  specialOccasions: SpecialOccasionData[];
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

/**
 * A reading that is not hovered keeps a dark tint of its hue, so the pattern
 * stays faintly visible while the hovered reading stands out at any zoom.
 */
function darkTint(color: Color): Color {
  return hslToRgb({ h: rgbToHsl(color).h, s: 0.5, l: 0.2 });
}

const CUSTOMS = ['ashkenazi', 'sephardi'] as const;
type Custom = (typeof CUSTOMS)[number];

const URL_PARAMS = [
  { key: 'custom', kind: 'token', allowed: CUSTOMS, default: 'ashkenazi' },
] as const satisfies readonly UrlParamSpec[];

/**
 * Which custom's readings to show, and the reading the pointer is over in the
 * key, by its place in the list of readings. Only the custom goes into a link.
 * The app holds this; the overlay keeps none.
 */
export interface HaftarahSettings {
  readonly custom: Custom;
  readonly preview: number | null;
}

let data: HaftarahMappings | null = null;
let structure: TorahData | null = null;

/** Everything about a custom's readings that a verse's color depends on. */
interface HaftarahDerivation {
  // Parshiot, then special occasions; a preview is a place in this list.
  items: HaftarahItem[];
  torahVerseToParsha: Map<string, ParshaData>;
  // Haftarah verses can belong to multiple items (parshiot or special occasions).
  haftarahVerseToItem: Map<string, HaftarahItem[]>;
  isTorahVerse: Set<string>;
  isHaftarahVerse: Set<string>;
  itemToColor: Map<HaftarahItem, Color>;
  totalItems: number; // parshiot + special occasions, for color distribution
}

// There are only two customs, so keyed derivations are cheap to keep around
// rather than rebuilding one on every call.
const derivationCache = new Map<Custom, HaftarahDerivation>();

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

/** The lookup indexes for one custom, from the loaded data. */
function deriveHaftarah(custom: Custom): HaftarahDerivation {
  const cached = derivationCache.get(custom);
  if (cached) return cached;

  const torahVerseToParsha = new Map<string, ParshaData>();
  const haftarahVerseToItem = new Map<string, HaftarahItem[]>();
  const isTorahVerse = new Set<string>();
  const isHaftarahVerse = new Set<string>();
  const itemToColor = new Map<HaftarahItem, Color>();
  let items: HaftarahItem[] = [];
  let totalItems = 0;

  if (data) {
    const specialOccasions = data.specialOccasions || [];
    items = [...data.parshiot, ...specialOccasions];
    totalItems = items.length;

    // Parshiot take color indices 0..parshiot.length-1; special occasions
    // continue from there, so the rainbow runs across both without repeats.
    items.forEach((item, i) => {
      itemToColor.set(item, getItemColor(i, totalItems));

      if (isParsha(item)) {
        forEachVerseInRange(item.torah, (book, ch, v) => {
          const key = tanakhKey(book, ch, v);
          torahVerseToParsha.set(key, item);
          isTorahVerse.add(key);
        });
      }

      // A haftarah verse can belong to multiple items, so accumulate into an array.
      const haftarahRanges = item.haftarah[custom];
      for (const range of haftarahRanges) {
        forEachVerseInRange(range, (book, ch, v) => {
          const key = tanakhKey(book, ch, v);
          const existing = haftarahVerseToItem.get(key);
          if (existing) {
            existing.push(item);
          } else {
            haftarahVerseToItem.set(key, [item]);
          }
          isHaftarahVerse.add(key);
        });
      }
    });
  }

  const derivation: HaftarahDerivation = {
    items,
    torahVerseToParsha,
    haftarahVerseToItem,
    isTorahVerse,
    isHaftarahVerse,
    itemToColor,
    totalItems,
  };
  derivationCache.set(custom, derivation);
  return derivation;
}

function isRelevantVerse(verse: TanakhIdentity, derived: HaftarahDerivation): boolean {
  const key = tanakhKey(verse.book, verse.chapter, verse.verse);
  return derived.torahVerseToParsha.has(key) || derived.haftarahVerseToItem.has(key);
}

/** The readings to light: whatever the hovered verse belongs to, or null when it belongs to none. */
function litByHover(
  derived: HaftarahDerivation,
  hovered: TanakhIdentity | null,
): Set<HaftarahItem> | null {
  if (!hovered) return null;
  const key = tanakhKey(hovered.book, hovered.chapter, hovered.verse);
  const parsha = derived.torahVerseToParsha.get(key);
  if (parsha) return new Set([parsha]);
  const items = derived.haftarahVerseToItem.get(key);
  return items ? new Set(items) : null;
}

/** A previewed reading, with every reading that shares any of its haftarah verses. */
function litByPreview(
  derived: HaftarahDerivation,
  item: HaftarahItem,
  custom: Custom,
): Set<HaftarahItem> {
  const lit = new Set([item]);
  for (const range of item.haftarah[custom]) {
    forEachVerseInRange(range, (book, ch, v) => {
      derived.haftarahVerseToItem.get(tanakhKey(book, ch, v))?.forEach((i) => lit.add(i));
    });
  }
  return lit;
}

// getVerseColor asks once per verse, so a preview's readings are found once per
// settings value. Settings are never edited in place, so a value is a sound key.
const previews = new WeakMap<HaftarahSettings, Set<HaftarahItem> | null>();

function litByPreviewOf(settings: HaftarahSettings): Set<HaftarahItem> | null {
  if (settings.preview === null) return null;
  if (!previews.has(settings)) {
    const derived = deriveHaftarah(settings.custom);
    const item = derived.items[settings.preview];
    previews.set(settings, item ? litByPreview(derived, item, settings.custom) : null);
  }
  return previews.get(settings) ?? null;
}

/** A preview from the key wins over the map's hover; the pointer is on one or the other. */
function litFor(
  settings: HaftarahSettings,
  hovered: TanakhIdentity | null,
): Set<HaftarahItem> | null {
  return litByPreviewOf(settings) ?? litByHover(deriveHaftarah(settings.custom), hovered);
}

/**
 * A verse's colour, one band per reading it belongs to. While readings are
 * lit, a verse in one is brightened, a verse in another reading keeps a dark
 * tint of its colour, and a verse in none is grey.
 */
function colorAt(
  verse: TanakhIdentity,
  derived: HaftarahDerivation,
  lit: Set<HaftarahItem> | null,
): Color | Color[] | null {
  const key = tanakhKey(verse.book, verse.chapter, verse.verse);
  const parsha = derived.torahVerseToParsha.get(key);
  const items = parsha ? [parsha] : (derived.haftarahVerseToItem.get(key) ?? []);
  if (items.length === 0) return lit ? DIMMED_GREY : null;

  const colors = items
    .map((item) => derived.itemToColor.get(item))
    .filter((c): c is Color => c !== undefined);
  if (colors.length === 0) return null;

  const shown = !lit
    ? colors
    : items.some((item) => lit.has(item))
      ? colors.map((c) => adjustBrightness(c, HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR))
      : colors.map(darkTint);
  return shown.length === 1 ? shown[0] : shown;
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * The key: each book by its portions, then each category of occasion by its
 * readings. Hovering one previews it. Its colours and names are the same for
 * both customs, so it is built once.
 */
function renderKey(container: HTMLElement, onPreview: (reading: number | null) => void): void {
  if (!data?.parshiot || container.querySelector('.haftarah-key')) return;
  const derived = deriveHaftarah('ashkenazi');
  const indexOf = new Map(derived.items.map((item, i) => [item, i]));

  const byBook = groupBy(data.parshiot, (parsha) => parsha.torah.book);
  const byCategory = groupBy(data.specialOccasions ?? [], (occasion) => occasion.category);

  const row = (label: string, items: HaftarahItem[]) => {
    const swatches = items
      .map((item) => {
        const shape = isParsha(item) ? 'haftarah-key-segment' : 'haftarah-key-swatch';
        const color = derived.itemToColor.get(item);
        const background = color ? colorToCss(color) : 'transparent';
        return `<span class="${shape}" style="background: ${background}" title="${escapeHtml(item.name)}" data-reading="${indexOf.get(item)}"></span>`;
      })
      .join('');
    return `<div class="haftarah-key-row"><span class="haftarah-key-label">${escapeHtml(label)}</span><span class="haftarah-key-swatches">${swatches}</span></div>`;
  };

  const books = [...byBook].map(([book, parshiot]) => row(book, parshiot));
  const categories = (Object.keys(CATEGORY_LABELS) as OccasionCategory[])
    .filter((category) => byCategory.has(category))
    .map((category) => row(CATEGORY_LABELS[category], byCategory.get(category)!));

  const key = document.createElement('div');
  key.className = 'haftarah-key';
  key.innerHTML = books.join('') + categories.join('');
  container.appendChild(key);

  const preview = lingeringHover<number>(onPreview);
  key.addEventListener('pointerover', (e) => {
    const reading = (e.target as Element).closest<HTMLElement>('[data-reading]')?.dataset.reading;
    if (reading === undefined) preview.leave();
    else preview.enter(Number(reading));
  });
  key.addEventListener('pointerleave', () => preview.leave());
}

export const haftarahOverlay: Overlay<TanakhIdentity, HaftarahSettings> = {
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
      const [haftarahData, structureData] = await Promise.all([
        loadJson<HaftarahMappings>('overlays/haftarah/mappings.json'),
        loadJson<TorahData>('tanakh-structure.json'),
      ]);
      if (!haftarahData || !structureData) return;

      data = haftarahData;
      structure = structureData;
      // Both customs' derivations were built (if at all) from data that no
      // longer applies.
      derivationCache.clear();
    } catch (e) {
      console.error('Failed to initialize haftarah overlay:', e);
    }
  },

  hoverChangesColors(before, after, settings) {
    if (settings.preview !== null) return false;
    // A verse outside every reading colours the map the same as no hover.
    const derived = deriveHaftarah(settings.custom);
    const keyIfRelevant = (verse: TanakhIdentity | null) =>
      verse && isRelevantVerse(verse, derived)
        ? tanakhKey(verse.book, verse.chapter, verse.verse)
        : null;
    return keyIfRelevant(before) !== keyIfRelevant(after);
  },

  /** The colour with nothing hovered on the map. The map asks colorsFor, which takes the hover. */
  getVerseColor(verse: TanakhIdentity, settings: HaftarahSettings): Color | Color[] | null {
    if (!data) return null;
    return colorAt(verse, deriveHaftarah(settings.custom), litFor(settings, null));
  },

  colorsFor(items, settings, hovered) {
    if (!data) return items.map(() => null);
    const derived = deriveHaftarah(settings.custom);
    const lit = litFor(settings, hovered);
    return items.map((item) => colorAt(item, derived, lit));
  },

  defaultSettings(): HaftarahSettings {
    return { custom: 'ashkenazi', preview: null };
  },

  renderControls(container: HTMLElement, settings: HaftarahSettings, onChange) {
    let select = container.querySelector<HTMLSelectElement>('#custom-select');
    if (!select) {
      const wrapper = document.createElement('div');
      wrapper.className = 'haftarah-controls';
      wrapper.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 10px;">
          <label for="custom-select" style="font-size: 12px; color: #aaa;">Custom:</label>
          <select id="custom-select" class="${CONTROL.select}" style="flex: 1;">
            <option value="ashkenazi">Ashkenazi</option>
            <option value="sephardi">Sephardi</option>
          </select>
        </div>
      `;
      container.appendChild(wrapper);

      select = wrapper.querySelector('select')!;
      select.addEventListener('change', () => {
        const custom = select!.value as Custom;
        onChange((current) => ({ ...current, custom }));
      });
    }

    select.value = settings.custom;
    renderKey(container, (preview) => onChange((current) => ({ ...current, preview })));
  },

  renderLegend(container: HTMLElement, settings: HaftarahSettings) {
    const customLabel = settings.custom === 'ashkenazi' ? 'Ashkenazi' : 'Sephardi';
    // The optional chain has to reach parshiot too: a failed or malformed
    // fetch leaves data as an object without it.
    const parshaCount = data?.parshiot?.length || 54;
    const occasionCount = data?.specialOccasions?.length || 0;

    const totalItems = deriveHaftarah(settings.custom).totalItems;
    const gradient = buildLegendGradient(10, (i) =>
      getItemColor(i * (totalItems / 10), totalItems || 81),
    );

    container.innerHTML = `
      <div class="legend-row">
        <div style="
          width: 20px;
          height: 12px;
          background: ${gradient};
          border-radius: 2px;
        "></div>
        <span>${parshaCount} Torah portions and ${occasionCount} special occasions</span>
      </div>
      ${legendCaption(`A portion and its haftarah (${customLabel}) share a colour`, { marginLeft: 28 })}
      ${legendCaption('A verse in more than one reading is split corner to corner, one band each', { marginLeft: 28 })}
      ${legendCaption('Hover a reading to light it and its haftarah; the rest darkens', { marginTop: 8, color: '#666', lineHeight: 1.4 })}
    `;
  },

  getHoverInfo(verse: TanakhIdentity, settings: HaftarahSettings): string | null {
    if (!data) return null;

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
    const derived = deriveHaftarah(settings.custom);

    const parshaFromTorah = derived.torahVerseToParsha.get(key);
    if (parshaFromTorah) {
      const haftarahRanges = parshaFromTorah.haftarah[settings.custom];
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

    const itemsFromHaftarah = derived.haftarahVerseToItem.get(key);
    if (itemsFromHaftarah && itemsFromHaftarah.length > 0) {
      if (itemsFromHaftarah.length === 1) {
        const item = itemsFromHaftarah[0];
        return `Haftarah for ${item.name} (${item.hebrewName})`;
      }
      const itemList = itemsFromHaftarah
        .map((item) => `${item.name} (${item.hebrewName})`)
        .join(', ');
      return `Haftarah for: ${itemList}`;
    }

    return null;
  },

  urlParams: URL_PARAMS,

  settingsFromUrl(params: UrlParamValues<typeof URL_PARAMS>): HaftarahSettings {
    return { custom: params.custom ?? 'ashkenazi', preview: null };
  },

  settingsToUrl(settings: HaftarahSettings): Record<string, string> {
    // Ashkenazi is the default, so it stays out of the URL.
    if (settings.custom === 'ashkenazi') return {};
    return { custom: settings.custom };
  },
};
