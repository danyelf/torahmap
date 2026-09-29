import type { Overlay, Color, UrlParamValues } from './types.ts';
import type { TanakhIdentity } from '../types.ts';
import { tanakhKey } from '../types.ts';
import { HIGHLIGHT_CONSTANTS, DIMMED_GREY } from '../constants.ts';
import { rgbToHsl, hslToRgb, colorToCss, brighten } from '../utils/color.ts';
import { escapeHtml } from '../utils/html.ts';
import { lingeringHover } from '../utils/hover.ts';
import {
  deriveHaftarah,
  forEachVerseInRange,
  getItemColor,
  isParsha,
  loadReadings,
  mappings,
  type Custom,
  type HaftarahDerivation,
  type HaftarahItem,
  type OccasionCategory,
} from './haftarah/readings.ts';
import { CONTROL } from '../panel.ts';
import { buildLegendGradient, legendCaption } from './legend.ts';
import { memoBySettings } from './memo.ts';
import { HAFTARAH, HAFTARAH_CUSTOMS } from '@torahmap/overlay-catalog';
import './haftarah.css';

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

function customLabel(custom: Custom): string {
  return custom[0].toUpperCase() + custom.slice(1);
}

/**
 * A reading that is not hovered keeps a dark tint of its hue, so the pattern
 * stays faintly visible while the hovered reading stands out at any zoom.
 */
function darkTint(color: Color): Color {
  return hslToRgb({ h: rgbToHsl(color).h, s: 0.5, l: 0.2 });
}

/**
 * Which custom's readings to show; the reading the pointer is over in the key,
 * by its place in the list of readings; and a reading a story stop lights, by
 * name. Only the custom goes into a link, so leaving the story drops the
 * reading. The app holds this; the overlay keeps none.
 */
export interface HaftarahSettings {
  readonly custom: Custom;
  readonly preview: number | null;
  readonly reading: string | null;
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

function litByItem(
  settings: HaftarahSettings,
  find: (items: HaftarahItem[]) => HaftarahItem | undefined,
): Set<HaftarahItem> | null {
  const derived = deriveHaftarah(settings.custom);
  const item = find(derived.items);
  return item ? litByPreview(derived, item, settings.custom) : null;
}

const litByPreviewOf = memoBySettings((settings: HaftarahSettings) =>
  settings.preview === null ? null : litByItem(settings, (items) => items[settings.preview!]),
);

// No two readings share a name, so the first match is the only one.
const litByReadingOf = memoBySettings((settings: HaftarahSettings) =>
  settings.reading === null
    ? null
    : litByItem(settings, (items) => items.find((item) => item.name === settings.reading)),
);

/**
 * What the pointer is on wins — a reading in the key, then a verse of a
 * reading on the map — and otherwise the reading the settings name, if any.
 */
function litFor(
  settings: HaftarahSettings,
  hovered: TanakhIdentity | null,
): Set<HaftarahItem> | null {
  return (
    litByPreviewOf(settings) ??
    litByHover(deriveHaftarah(settings.custom), hovered) ??
    litByReadingOf(settings)
  );
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
      ? colors.map((c) => brighten(c, HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR))
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
function renderKey(
  container: HTMLElement,
  custom: Custom,
  onPreview: (reading: number | null) => void,
): void {
  const data = mappings();
  if (!data?.parshiot || container.querySelector('.haftarah-key')) return;
  const derived = deriveHaftarah(custom);
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
  ...HAFTARAH,
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
    await loadReadings();
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
    if (!mappings()) return null;
    return colorAt(verse, deriveHaftarah(settings.custom), litFor(settings, null));
  },

  colorsFor(items, settings, hovered) {
    if (!mappings()) return items.map(() => null);
    const derived = deriveHaftarah(settings.custom);
    const lit = litFor(settings, hovered);
    return items.map((item) => colorAt(item, derived, lit));
  },

  renderControls(container: HTMLElement, settings: HaftarahSettings, onChange) {
    let select = container.querySelector<HTMLSelectElement>('#custom-select');
    if (!select) {
      const wrapper = document.createElement('div');
      wrapper.className = 'haftarah-controls';
      wrapper.innerHTML = `
        <label for="custom-select">Custom:</label>
        <select id="custom-select" class="${CONTROL.select}">
          ${HAFTARAH_CUSTOMS.map((c) => `<option value="${c}">${customLabel(c)}</option>`).join('')}
        </select>
      `;
      container.appendChild(wrapper);

      select = wrapper.querySelector('select')!;
      select.addEventListener('change', () => {
        const custom = select!.value as Custom;
        onChange((current) => ({ ...current, custom }));
      });
    }

    select.value = settings.custom;
    renderKey(container, settings.custom, (preview) =>
      onChange((current) => ({ ...current, preview })),
    );
  },

  renderLegend(container: HTMLElement, settings: HaftarahSettings) {
    // The optional chain has to reach parshiot too: a failed or malformed
    // fetch leaves data as an object without it.
    const data = mappings();
    const parshaCount = data?.parshiot?.length || 54;
    const occasionCount = data?.specialOccasions?.length || 0;

    const totalItems = deriveHaftarah(settings.custom).items.length;
    const gradient = buildLegendGradient(10, (i) =>
      getItemColor(i * (totalItems / 10), totalItems || 81),
    );

    container.innerHTML = `
      <div class="legend-row">
        <div class="haftarah-legend-swatch" style="background: ${gradient}"></div>
        <span>${parshaCount} Torah portions and ${occasionCount} special occasions</span>
      </div>
      <div class="haftarah-legend-notes">
        ${legendCaption(`A portion and its haftarah (${customLabel(settings.custom)}) share a colour`)}
        ${legendCaption('A verse in more than one reading is split corner to corner, one band each')}
      </div>
      ${legendCaption('Hover a reading to light it and its haftarah; the rest darkens')}
    `;
  },

  getHoverInfo(verse: TanakhIdentity, settings: HaftarahSettings): string | null {
    if (!mappings()) return null;

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

  settingsFromUrl(params: UrlParamValues<typeof HAFTARAH.urlParams>): HaftarahSettings {
    return { custom: params.custom, preview: null, reading: params.reading ?? null };
  },

  settingsToUrl(settings: HaftarahSettings): Record<string, string> {
    return { custom: settings.custom };
  },
};
