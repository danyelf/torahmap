import type { Overlay, Color, UrlParamSpec, UrlParamValues } from './types.ts';
import type { TanakhIdentity, TorahData } from '../types.ts';
import { tanakhKey } from '../types.ts';
import { HIGHLIGHT_CONSTANTS, DIMMED_GREY } from '../constants.ts';
import { rgbToHsl, hslToRgb, buildLegendGradient, colorToCss } from '../utils/color.ts';
import { escapeHtml } from '../utils/html.ts';
import { verseToUrlFormat } from '../urlState.ts';
import { loadJson } from './loadJson.ts';
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

/** Which custom's readings to show. The app holds this; the overlay keeps none. */
export interface HaftarahSettings {
  readonly custom: Custom;
}

let data: HaftarahMappings | null = null;
let structure: TorahData | null = null;

/** Everything about a custom's readings that a verse's color depends on. */
interface HaftarahDerivation {
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
  let totalItems = 0;

  if (data) {
    const specialOccasions = data.specialOccasions || [];
    const items: HaftarahItem[] = [...data.parshiot, ...specialOccasions];
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

/** What the hovered verse (if any) belongs to, within one custom's derivation. */
function getHoveredContext(
  derived: HaftarahDerivation,
  hovered: TanakhIdentity | null,
): {
  hoveredParshaTorah: ParshaData | undefined;
  hoveredItemsHaftarah: HaftarahItem[] | undefined;
} {
  if (!hovered) return { hoveredParshaTorah: undefined, hoveredItemsHaftarah: undefined };
  const hoverKey = tanakhKey(hovered.book, hovered.chapter, hovered.verse);
  return {
    hoveredParshaTorah: derived.torahVerseToParsha.get(hoverKey),
    hoveredItemsHaftarah: derived.haftarahVerseToItem.get(hoverKey),
  };
}

/** True if `item` is (or shares a haftarah verse with) whatever is hovered. */
function isHoveredItem(
  item: HaftarahItem,
  hoveredParshaTorah: ParshaData | undefined,
  hoveredItemsHaftarah: HaftarahItem[] | undefined,
): boolean {
  return hoveredParshaTorah === item || (hoveredItemsHaftarah?.includes(item) ?? false);
}

/**
 * Brightens `colors` if any of `items` is the hovered reading, darkens them
 * otherwise; unwraps to a single color when there's only one. Shared by the
 * Torah-verse (single item) and haftarah-verse (possibly multiple items)
 * branches of colorAt.
 */
function resolveHoverColors(
  colors: Color[],
  items: HaftarahItem[],
  hovered: TanakhIdentity | null,
  derived: HaftarahDerivation,
): Color | Color[] | null {
  if (colors.length === 0) return null;
  if (!hovered) return colors.length === 1 ? colors[0] : colors;

  const { hoveredParshaTorah, hoveredItemsHaftarah } = getHoveredContext(derived, hovered);
  const isHovered = items.some((item) =>
    isHoveredItem(item, hoveredParshaTorah, hoveredItemsHaftarah),
  );

  const resolved = colors.map((c) =>
    isHovered ? adjustBrightness(c, HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR) : darkTint(c),
  );
  return resolved.length === 1 ? resolved[0] : resolved;
}

/** The one rule for a verse's color, shared by getVerseColor and colorsFor. */
function colorAt(
  verse: TanakhIdentity,
  derived: HaftarahDerivation,
  hovered: TanakhIdentity | null,
): Color | Color[] | null {
  // A hovered verse outside every reading brightens nothing and darkens
  // nothing — the same as no hover at all. Filtered once, here, so neither
  // caller has to get this right on its own.
  const relevantHover = hovered && isRelevantVerse(hovered, derived) ? hovered : null;

  const key = tanakhKey(verse.book, verse.chapter, verse.verse);

  // Torah verses belong to exactly one parsha.
  const parshaFromTorah = derived.torahVerseToParsha.get(key);
  if (parshaFromTorah) {
    const baseColor = derived.itemToColor.get(parshaFromTorah);
    if (!baseColor) return null;
    return resolveHoverColors([baseColor], [parshaFromTorah], relevantHover, derived);
  }

  // Haftarah verses can belong to multiple items (parshiot or special occasions).
  const itemsFromHaftarah = derived.haftarahVerseToItem.get(key);
  if (itemsFromHaftarah && itemsFromHaftarah.length > 0) {
    const colors = itemsFromHaftarah
      .map((item) => derived.itemToColor.get(item))
      .filter((c): c is Color => c !== undefined);
    return resolveHoverColors(colors, itemsFromHaftarah, relevantHover, derived);
  }

  return relevantHover ? DIMMED_GREY : null;
}

/**
 * The verse that stands for `item` when its legend swatch is hovered, so the
 * map lights up as it would under the cursor: a portion's first Torah verse,
 * or an occasion's haftarah verse shared with the most other readings, which
 * lights up every one of them. Of two overlaps with different readings, the
 * longer wins; a verse can show only one.
 */
function standInVerse(item: HaftarahItem, custom: Custom, derived: HaftarahDerivation): string {
  if (isParsha(item)) {
    const { book, start } = item.torah;
    return verseToUrlFormat(book, start.chapter, start.verse);
  }

  // Verses grouped by the readings that share them.
  const overlaps = new Map<string, { sharers: number; verses: string[] }>();
  for (const range of item.haftarah[custom]) {
    forEachVerseInRange(range, (book, ch, v) => {
      const sharers = derived.haftarahVerseToItem.get(tanakhKey(book, ch, v)) ?? [item];
      const key = sharers.map((s) => s.name).join('|');
      const overlap = overlaps.get(key) ?? { sharers: sharers.length, verses: [] };
      overlap.verses.push(verseToUrlFormat(book, ch, v));
      overlaps.set(key, overlap);
    });
  }

  let best: { sharers: number; verses: string[] } | undefined;
  for (const overlap of overlaps.values()) {
    if (
      !best ||
      overlap.sharers > best.sharers ||
      (overlap.sharers === best.sharers && overlap.verses.length > best.verses.length)
    ) {
      best = overlap;
    }
  }
  return best?.verses[0] ?? '';
}

/** A row of the legend's key: a label and one hoverable swatch per reading. */
function keyRow(
  label: string,
  items: HaftarahItem[],
  custom: Custom,
  derived: HaftarahDerivation,
  swatchClass: string,
): string {
  const swatches = items
    .map((item) => {
      const color = derived.itemToColor.get(item);
      const background = color ? colorToCss(color) : 'transparent';
      return `<span class="${swatchClass}" style="background: ${background}" title="${escapeHtml(item.name)}" data-hover-verse="${escapeHtml(standInVerse(item, custom, derived))}"></span>`;
    })
    .join('');
  return `<div class="haftarah-key-row"><span class="haftarah-key-label">${escapeHtml(label)}</span><span class="haftarah-key-swatches">${swatches}</span></div>`;
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

/** Each book by its portions, then each category of occasion by its readings. */
function renderKey(custom: Custom): string {
  if (!data?.parshiot) return '';
  const derived = deriveHaftarah(custom);

  const byBook = groupBy(data.parshiot, (parsha) => parsha.torah.book);
  const byCategory = groupBy(data.specialOccasions ?? [], (occasion) => occasion.category);

  const books = [...byBook].map(([book, parshiot]) =>
    keyRow(book, parshiot, custom, derived, 'haftarah-key-segment'),
  );
  const categories = (Object.keys(CATEGORY_LABELS) as OccasionCategory[])
    .filter((category) => byCategory.has(category))
    .map((category) =>
      keyRow(
        CATEGORY_LABELS[category],
        byCategory.get(category)!,
        custom,
        derived,
        'haftarah-key-swatch',
      ),
    );

  return `<div class="haftarah-key">${books.join('')}${categories.join('')}</div>`;
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
    // A verse outside every reading colours the map the same as no hover.
    const derived = deriveHaftarah(settings.custom);
    const keyIfRelevant = (verse: TanakhIdentity | null) =>
      verse && isRelevantVerse(verse, derived)
        ? tanakhKey(verse.book, verse.chapter, verse.verse)
        : null;
    return keyIfRelevant(before) !== keyIfRelevant(after);
  },

  /** The colour with nothing hovered. The map asks colorsFor, which takes the hover. */
  getVerseColor(verse: TanakhIdentity, settings: HaftarahSettings): Color | Color[] | null {
    if (!data) return null;
    return colorAt(verse, deriveHaftarah(settings.custom), null);
  },

  colorsFor(items, settings, hovered) {
    if (!data) return items.map(() => null);
    const derived = deriveHaftarah(settings.custom);
    return items.map((item) => colorAt(item, derived, hovered));
  },

  defaultSettings(): HaftarahSettings {
    return { custom: 'ashkenazi' };
  },

  renderControls(container: HTMLElement, settings: HaftarahSettings, onChange) {
    let select = container.querySelector<HTMLSelectElement>('#custom-select');
    if (!select) {
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
      container.appendChild(wrapper);

      select = wrapper.querySelector('select')!;
      select.addEventListener('change', () => {
        const custom = select!.value as Custom;
        onChange((current) => ({ ...current, custom }));
      });
    }

    select.value = settings.custom;
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
        <span>${parshaCount} Parshiot + ${occasionCount} Special Occasions</span>
      </div>
      ${legendCaption(`Torah portion & haftarah (${customLabel}) use same color`, { marginLeft: 28 })}
      ${legendCaption('Includes holidays, fast days, special Shabbatot', { marginLeft: 28 })}
      ${legendCaption('Multi-item verses are split corner to corner, one band per item', { marginLeft: 28 })}
      ${legendCaption('Hover brightens the reading & its haftarah, darkens the rest', { marginTop: 8, color: '#666', lineHeight: 1.4 })}
      ${renderKey(settings.custom)}
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
    return { custom: params.custom ?? 'ashkenazi' };
  },

  settingsToUrl(settings: HaftarahSettings): Record<string, string> {
    // Ashkenazi is the default, so it stays out of the URL.
    if (settings.custom === 'ashkenazi') return {};
    return { custom: settings.custom };
  },
};
