import { HIGHLIGHT_CONSTANTS } from '@torahmap/engine';
import {
  type Color,
  rgbToHsl,
  hslToRgb,
  colorToCss,
  brighten,
  escapeHtml,
  lingeringHover,
} from '@torahmap/utils';
import type {
  FitTo,
  Overlay,
  SettingsUpdate,
  UrlParamValues,
} from '@torahmap/shell/overlays/types.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { passageRef, verseId } from '@torahmap/link/tanakh';
import { DIMMED_GREY } from '@torahmap/shell/constants.ts';
import {
  deriveHaftarah,
  forEachVerseInRange,
  OCCASION_CATEGORIES,
  HAFTARAH_FILES,
  isParsha,
  type Custom,
  type HaftarahData,
  type HaftarahDerivation,
  type HaftarahItem,
  type OccasionCategory,
  type VerseRange,
} from './haftarah/readings.ts';
import { CONTROL } from '@torahmap/shell/panel.ts';
import { buildLegendGradient, legendCaption } from './legend.ts';
import { HAFTARAH, HAFTARAH_CUSTOMS } from '@torahmap/overlay-catalog';
import './haftarah.css';

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
 * Which custom's readings to show; the reading the pointer is over in the key;
 * and the pinned reading, which a story stop sets too. The custom and the
 * pinned reading go into a link. The app holds this; the overlay keeps none.
 */
export interface HaftarahSettings {
  readonly custom: Custom;
  readonly preview: string | null;
  readonly reading: string | null;
}

function isRelevantVerse(verse: TanakhLayout, derived: HaftarahDerivation): boolean {
  const key = verse.id;
  return derived.torahVerseToParsha.has(key) || derived.haftarahVerseToItem.has(key);
}

/** The verse's id if it is in any reading, else null: a verse outside every reading colours the map as no verse does. */
function relevantId(
  verse: TanakhLayout | null,
  settings: HaftarahSettings,
  data: HaftarahData,
): string | null {
  return verse && isRelevantVerse(verse, deriveHaftarah(data, settings.custom)) ? verse.id : null;
}

/** The readings verse `id` is in: a Torah verse is in its portion alone. */
function readingsOf(derived: HaftarahDerivation, id: string): readonly HaftarahItem[] {
  const parsha = derived.torahVerseToParsha.get(id);
  return parsha ? [parsha] : (derived.haftarahVerseToItem.get(id) ?? []);
}

/** The readings to light: whatever the hovered verse belongs to, or null when it belongs to none. */
function litByHover(
  derived: HaftarahDerivation,
  hovered: TanakhLayout | null,
): Set<HaftarahItem> | null {
  const items = hovered ? readingsOf(derived, hovered.id) : [];
  return items.length > 0 ? new Set(items) : null;
}

function readingNamed(
  data: HaftarahData,
  custom: Custom,
  name: string | null,
): HaftarahItem | undefined {
  return name === null ? undefined : deriveHaftarah(data, custom).itemByName.get(name);
}

/** The reading called `name` lit as a preview, or null when no reading has that name. */
function litByName(
  data: HaftarahData,
  custom: Custom,
  name: string | null,
): Set<HaftarahItem> | null {
  const item = readingNamed(data, custom, name);
  return item ? new Set([item]) : null;
}

/**
 * What the pointer is on wins — a reading in the key, then a verse of a
 * reading on the map — then the reading the settings name, if any, and last
 * the pinned verse's reading.
 */
function litFor(
  data: HaftarahData,
  settings: HaftarahSettings,
  hovered: TanakhLayout | null,
  pinned: TanakhLayout | null = null,
): Set<HaftarahItem> | null {
  const derived = deriveHaftarah(data, settings.custom);
  return (
    litByName(data, settings.custom, settings.preview) ??
    litByHover(derived, hovered) ??
    litByName(data, settings.custom, settings.reading) ??
    litByHover(derived, pinned)
  );
}

/**
 * A verse's colour, one band per reading it belongs to. While readings are
 * lit, a verse in one is brightened, a verse in another reading keeps a dark
 * tint of its colour, and a verse in none is grey.
 */
function colorAt(
  verse: TanakhLayout,
  derived: HaftarahDerivation,
  lit: Set<HaftarahItem> | null,
): Color | Color[] | null {
  const items = readingsOf(derived, verse.id);
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

/**
 * The two places a reading appears: its Torah portion, and its haftarah. An
 * occasion has only the second, so that is where jumping to it goes.
 */
interface Passage {
  readonly label: 'Torah' | 'Haftarah';
  readonly ranges: readonly VerseRange[];
}

function passagesOf(item: HaftarahItem, custom: Custom): Passage[] {
  const haftarah: Passage = { label: 'Haftarah', ranges: item.haftarah[custom] };
  return isParsha(item) ? [{ label: 'Torah', ranges: [item.torah] }, haftarah] : [haftarah];
}

function rangesText(ranges: readonly VerseRange[]): string {
  return ranges.map((r) => passageRef(r.book, r.start, r.end)).join(', ');
}

function passageIds(data: HaftarahData, passage: Passage): string[] {
  const ids: string[] = [];
  for (const range of passage.ranges) {
    forEachVerseInRange(data.structure, range, (book, ch, v) => ids.push(verseId(book, ch, v)));
  }
  return ids;
}

/** Pins the reading and fits one of its passages into view. */
function jumpTo(
  data: HaftarahData,
  item: HaftarahItem,
  passage: Passage,
  fitTo: FitTo,
  change: (update: SettingsUpdate<HaftarahSettings>) => void,
): void {
  change((current) => ({ ...current, reading: item.name }));
  fitTo(passageIds(data, passage));
}

function jumpLink(
  data: HaftarahData,
  item: HaftarahItem,
  passage: Passage,
  fitTo: FitTo,
  change: (update: SettingsUpdate<HaftarahSettings>) => void,
): HTMLElement {
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'haftarah-jump';
  link.textContent = `${passage.label} ${rangesText(passage.ranges)}`;
  link.addEventListener('click', () => jumpTo(data, item, passage, fitTo, change));
  return link;
}

/** The card for the pinned reading: its name, a link to each place it appears, and a way to clear it. */
function renderCard(
  card: HTMLElement,
  settings: HaftarahSettings,
  data: HaftarahData | null,
  fitTo: FitTo,
  change: (update: SettingsUpdate<HaftarahSettings>) => void,
): void {
  const item = data ? readingNamed(data, settings.custom, settings.reading) : undefined;
  card.hidden = !data || !item;
  card.replaceChildren();
  if (!data || !item) return;

  const title = document.createElement('div');
  title.className = 'haftarah-card-title';
  title.textContent = `${item.name} (${item.hebrewName})`;

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'haftarah-card-clear';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => change((current) => ({ ...current, reading: null })));

  const links = passagesOf(item, settings.custom).map((passage) =>
    jumpLink(data, item, passage, fitTo, change),
  );
  card.append(title, ...links, clear);
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
 * readings. Hovering one previews it; clicking one picks it. Its colours and
 * names are the same for both customs, so it is built once.
 */
function renderKey(
  container: HTMLElement,
  data: HaftarahData,
  custom: Custom,
  onPreview: (reading: string | null) => void,
  onPick: (item: HaftarahItem) => void,
): void {
  if (container.querySelector('.haftarah-key')) return;
  const derived = deriveHaftarah(data, custom);

  const byBook = groupBy(data.mappings.parshiot, (parsha) => parsha.torah.book);
  const byCategory = groupBy(data.mappings.specialOccasions, (occasion) => occasion.category);

  const row = (label: string, items: HaftarahItem[]) => {
    const swatches = items
      .map((item) => {
        const shape = isParsha(item) ? 'haftarah-key-segment' : 'haftarah-key-swatch';
        const color = derived.itemToColor.get(item);
        const background = color ? colorToCss(color) : 'transparent';
        return `<span class="${shape}" style="background: ${background}" title="${escapeHtml(item.name)}" data-reading="${escapeHtml(item.name)}"></span>`;
      })
      .join('');
    return `<div class="haftarah-key-row"><span class="haftarah-key-label">${escapeHtml(label)}</span><span class="haftarah-key-swatches">${swatches}</span></div>`;
  };

  const books = [...byBook].map(([book, parshiot]) => row(book, parshiot));
  const categories = OCCASION_CATEGORIES.filter((category) => byCategory.has(category)).map(
    (category) => row(CATEGORY_LABELS[category], byCategory.get(category)!),
  );

  const key = document.createElement('div');
  key.className = 'haftarah-key';
  key.innerHTML = books.join('') + categories.join('');
  container.appendChild(key);

  const preview = lingeringHover<string>(onPreview);
  key.addEventListener('pointerover', (e) => {
    const reading = (e.target as Element).closest<HTMLElement>('[data-reading]')?.dataset.reading;
    if (reading === undefined) preview.leave();
    else preview.enter(reading);
  });
  key.addEventListener('pointerleave', () => preview.leave());
  key.addEventListener('click', (e) => {
    const reading = (e.target as Element).closest<HTMLElement>('[data-reading]')?.dataset.reading;
    const item = reading === undefined ? undefined : derived.itemByName.get(reading);
    if (item) onPick(item);
  });
}

export const haftarahOverlay: Overlay<TanakhIdentity, HaftarahSettings, HaftarahData> = {
  ...HAFTARAH,
  data: HAFTARAH_FILES,
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

  hoverChangesColors(before, after, settings, data) {
    if (settings.preview !== null) return false;
    return relevantId(before, settings, data) !== relevantId(after, settings, data);
  },

  pinChangesColors(before, after, settings, data) {
    if (settings.preview !== null || litByName(data, settings.custom, settings.reading))
      return false;
    return relevantId(before, settings, data) !== relevantId(after, settings, data);
  },

  colorsFor({ items, settings, data, focus }) {
    const derived = deriveHaftarah(data, settings.custom);
    const lit = litFor(data, settings, focus.hovered, focus.pinned);
    return items.map((item) => colorAt(item, derived, lit));
  },

  renderControls(
    container: HTMLElement,
    settings: HaftarahSettings,
    onChange,
    data,
    _travelTo,
    fitTo = () => {},
  ) {
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
      const card = document.createElement('div');
      card.className = 'haftarah-card';
      card.hidden = true;
      container.appendChild(card);

      select = wrapper.querySelector('select')!;
      select.addEventListener('change', () => {
        const custom = select!.value as Custom;
        onChange((current) => ({ ...current, custom }));
      });
    }

    select.value = settings.custom;
    if (data) {
      renderKey(
        container,
        data,
        settings.custom,
        (preview) => onChange((current) => ({ ...current, preview })),
        // The key is built once, so the custom comes from the select, which every render sets.
        (item) => jumpTo(data, item, passagesOf(item, select!.value as Custom)[0], fitTo, onChange),
      );
    }
    renderCard(
      container.querySelector<HTMLElement>('.haftarah-card')!,
      settings,
      data,
      fitTo,
      onChange,
    );
    for (const swatch of container.querySelectorAll<HTMLElement>('.haftarah-key [data-reading]')) {
      swatch.classList.toggle('pinned', swatch.dataset.reading === settings.reading);
    }
  },

  renderLegend(container: HTMLElement, settings: HaftarahSettings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    const parshaCount = data.mappings.parshiot.length;
    const occasionCount = data.mappings.specialOccasions.length;

    const { items, itemToColor } = deriveHaftarah(data, settings.custom);
    const gradient = buildLegendGradient(items.length, (i) => itemToColor.get(items[i])!);

    container.innerHTML = `
      <div class="legend-row">
        <div class="haftarah-legend-swatch" style="background: ${gradient}"></div>
        <span>${parshaCount} Torah portions and ${occasionCount} special occasions</span>
      </div>
      <div class="haftarah-legend-notes">
        ${legendCaption(`A portion and its haftarah (${customLabel(settings.custom)}) share a colour`)}
        ${legendCaption('A verse in more than one reading is split corner to corner, one band each')}
      </div>
      ${legendCaption('Hover a reading to light it and its haftarah; click one to pin it')}
    `;
  },

  getHoverInfo(verse: TanakhLayout, settings: HaftarahSettings, data): string | null {
    const key = verse.id;
    const derived = deriveHaftarah(data, settings.custom);

    const parshaFromTorah = derived.torahVerseToParsha.get(key);
    if (parshaFromTorah) {
      const haftarahStr = rangesText(parshaFromTorah.haftarah[settings.custom]);
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

  settingsOnPin(verse, settings, data) {
    const items = readingsOf(deriveHaftarah(data, settings.custom), verse.id);
    return { ...settings, reading: items.length === 1 ? items[0].name : null };
  },

  renderSidebarInfo(verse, isPinned, settings, data, actions) {
    if (!isPinned || !actions) return null;
    const items = readingsOf(deriveHaftarah(data, settings.custom), verse.id);
    if (items.length === 0) return null;

    const box = document.createElement('div');
    for (const item of items) {
      const line = document.createElement('div');
      line.append(`${item.name}: `);
      passagesOf(item, settings.custom).forEach((passage, i) => {
        if (i > 0) line.append(' | ');
        line.append(jumpLink(data, item, passage, actions.fitTo, actions.change));
      });
      box.append(line);
    }
    return box;
  },

  settingsFromUrl(params: UrlParamValues<typeof HAFTARAH.urlParams>): HaftarahSettings {
    return { custom: params.custom, preview: null, reading: params.reading ?? null };
  },

  settingsToUrl(settings: HaftarahSettings): Record<string, string> {
    return settings.reading === null
      ? { custom: settings.custom }
      : { custom: settings.custom, reading: settings.reading };
  },
};
