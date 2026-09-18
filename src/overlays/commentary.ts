import type { Overlay, Color, UrlParamSpec, UrlParamValues } from './types.ts';
import type { TanakhIdentity, TanakhLayout, CommentaryData } from '../types.ts';
import type { ColorStop } from '../utils/color.ts';
import { scale, LOG, type Scale } from '../utils/scale.ts';
import { renderAxis } from './legend.ts';
import { loadJson } from './loadJson.ts';

const HEATMAP_STOPS: ColorStop[] = [
  { t: 0, color: [0.1, 0.13, 0.18] },
  { t: 0.25, color: [0.1, 0.23, 0.38] },
  { t: 0.5, color: [0.2, 0.43, 0.33] },
  { t: 0.75, color: [0.9, 0.33, 0.13] },
  { t: 1.0, color: [1.0, 0.23, 0.18] },
];

/** A verse nothing has been written about. */
const NO_LINKS: Color = [0.15, 0.15, 0.2];

const URL_PARAMS = [
  { key: 'category', kind: 'category', default: 'total' },
] as const satisfies readonly UrlParamSpec[];

export interface CommentarySettings {
  readonly category: string;
}

let data: CommentaryData = {};
let verses: TanakhLayout[] = [];

// Keyed on the category name, not the settings value, since the count behind
// a category never changes once the data is loaded.
let cachedMaxValues: Record<string, number> = {};

/** Rebuilt per call: the maximum moves when the category changes. */
function linkScale(category: string): Scale {
  return scale(0, getMaxValue(category), LOG, HEATMAP_STOPS);
}

function getCount(book: string, chapter: number, verse: number, category: string): number {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  if (!verseData) return 0;
  if (category === 'total') return verseData.total;
  return verseData.categories[category] || 0;
}

function getMaxValue(category: string): number {
  if (cachedMaxValues[category] !== undefined) {
    return cachedMaxValues[category];
  }
  let max = 0;
  for (const v of verses) {
    const count = getCount(v.book, v.chapter, v.verse, category);
    if (count > max) max = count;
  }
  cachedMaxValues[category] = max;
  return max;
}

function commentaryColorAt(verse: TanakhIdentity, category: string): Color | null {
  const count = getCount(verse.book, verse.chapter, verse.verse, category);
  if (count === 0) return NO_LINKS;
  return linkScale(category).colorOf(count);
}

export const commentaryOverlay: Overlay<TanakhIdentity, CommentarySettings> = {
  id: 'commentary',
  name: 'Commentary',
  description:
    'Shades each verse by how much has been written about it: the brighter the verse, ' +
    'the more commentary Sefaria records on it. Choose a kind of commentary to count ' +
    'only that one.',
  credits: [
    {
      source: 'Sefaria link exports',
      url: 'https://github.com/Sefaria/Sefaria-Export',
      collected: 'September 2026',
    },
  ],

  async init() {
    try {
      const result = await loadJson<CommentaryData>(
        'overlays/commentary/counts.json',
        'the commentary counts',
      );
      if (result) data = result;
    } catch (e) {
      console.error('Failed to parse the commentary counts:', e);
    }
  },

  destroy() {
    cachedMaxValues = {};
  },

  getVerseColor(verse, settings) {
    return commentaryColorAt(verse, settings.category);
  },

  colorsFor(items, settings, _hovered) {
    return items.map((item) => commentaryColorAt(item, settings.category));
  },

  defaultSettings() {
    return { category: 'total' };
  },

  urlParams: URL_PARAMS,

  settingsFromUrl(params: UrlParamValues<typeof URL_PARAMS>): CommentarySettings {
    return { category: params.category ?? 'total' };
  },

  settingsToUrl(settings): Record<string, string> {
    // "total" is the default, so it stays out of the URL.
    if (settings.category === 'total') return {};
    return { category: settings.category };
  },

  renderControls(container, settings, onChange) {
    let select = container.querySelector<HTMLSelectElement>('#category-select');
    if (!select) {
      const wrapper = document.createElement('div');
      wrapper.className = 'commentary-controls';
      wrapper.innerHTML = `
        <label for="category-select">Category:</label>
        <select id="category-select">
          <option value="total">All linked texts</option>
          <optgroup label="Verse commentary">
            <option value="Commentary">Commentary</option>
            <option value="Quoting Commentary">Quoting Commentary</option>
          </optgroup>
          <optgroup label="Rabbinic">
            <option value="Talmud">Talmud</option>
            <option value="Midrash">Midrash</option>
            <option value="Mishnah">Mishnah</option>
            <option value="Tosefta">Tosefta</option>
          </optgroup>
          <optgroup label="Law, thought and practice">
            <option value="Halakhah">Halakhah</option>
            <option value="Responsa">Responsa</option>
            <option value="Jewish Thought">Jewish Thought</option>
            <option value="Kabbalah">Kabbalah</option>
            <option value="Chasidut">Chasidut</option>
            <option value="Musar">Musar</option>
            <option value="Liturgy">Liturgy</option>
            <option value="Second Temple">Second Temple</option>
          </optgroup>
        </select>
      `;
      container.appendChild(wrapper);

      select = wrapper.querySelector('select')!;
      select.addEventListener('change', () => {
        const category = select!.value;
        onChange((current) => ({ ...current, category }));
      });
    }
    select.value = settings.category;
  },

  renderLegend(container, settings) {
    const maxValue = getMaxValue(settings.category);

    const ticks: number[] = [0];
    for (let value = 1; value <= maxValue; value *= 10) {
      ticks.push(value);
    }
    if (ticks[ticks.length - 1] < maxValue) {
      ticks.push(maxValue);
    }

    container.innerHTML = renderAxis(linkScale(settings.category), ticks);
  },

  getHoverInfo(verse, settings) {
    const verseData = data[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
    if (!verseData) return null;
    if (settings.category === 'total') {
      return `${verseData.total} links`;
    }
    const count = verseData.categories[settings.category];
    return count ? `${count} ${settings.category}` : `no ${settings.category}`;
  },

  getSefariaConnectionParam(settings) {
    return settings.category === 'total' ? null : settings.category;
  },
};

export function configure(config: { verses: TanakhLayout[] }): void {
  verses = config.verses;
  cachedMaxValues = {};
}
