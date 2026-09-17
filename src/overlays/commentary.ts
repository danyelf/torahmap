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
  { key: 'category', kind: 'category' },
] as const satisfies readonly UrlParamSpec[];

let data: CommentaryData = {};
let currentCategory = 'total';
let updateCallback: (() => void) | null = null;

// Cache max values per category to avoid recalculating
let cachedMaxValues: Record<string, number> = {};
let verses: TanakhLayout[] = [];

/** Rebuilt per call: the maximum moves when the category changes. */
function linkScale(): Scale {
  return scale(0, getMaxValue(), LOG, HEATMAP_STOPS);
}

function getCount(book: string, chapter: number, verse: number): number {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  if (!verseData) return 0;
  if (currentCategory === 'total') return verseData.total;
  return verseData.categories[currentCategory] || 0;
}

function getMaxValue(): number {
  if (cachedMaxValues[currentCategory] !== undefined) {
    return cachedMaxValues[currentCategory];
  }
  let max = 0;
  for (const v of verses) {
    const count = getCount(v.book, v.chapter, v.verse);
    if (count > max) max = count;
  }
  cachedMaxValues[currentCategory] = max;
  return max;
}

export const commentaryOverlay: Overlay = {
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
    updateCallback = null;
    // currentCategory intentionally persists across overlay switches, so the
    // user returns to their selected category.
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  getVerseColor(verse: TanakhIdentity): Color | null {
    const count = getCount(verse.book, verse.chapter, verse.verse);
    if (count === 0) return NO_LINKS;
    return linkScale().colorOf(count);
  },

  renderControls(container: HTMLElement) {
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
    const select = wrapper.querySelector('select')!;
    select.value = currentCategory;
    select.addEventListener('change', () => {
      currentCategory = select.value;
      cachedMaxValues = {}; // Clear cache on category change
      updateCallback?.();
    });
    container.appendChild(wrapper);
  },

  renderLegend(container: HTMLElement) {
    const maxValue = getMaxValue();

    const ticks: number[] = [0];
    for (let value = 1; value <= maxValue; value *= 10) {
      ticks.push(value);
    }
    if (ticks[ticks.length - 1] < maxValue) {
      ticks.push(maxValue);
    }

    container.innerHTML = renderAxis(linkScale(), ticks);
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    const verseData = data[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
    if (!verseData) return null;
    if (currentCategory === 'total') {
      return `${verseData.total} links`;
    }
    const count = verseData.categories[currentCategory];
    return count ? `${count} ${currentCategory}` : `no ${currentCategory}`;
  },

  urlParams: URL_PARAMS,

  getUrlParams(): Record<string, string> {
    // "total" is the default, so it stays out of the URL
    if (currentCategory === 'total') return {};
    return { category: currentCategory };
  },

  applyUrlParams(params: UrlParamValues<typeof URL_PARAMS>): void {
    const category = params.category;
    if (category) {
      currentCategory = category;
      cachedMaxValues = {};
      updateCallback?.();
    }
  },

  getSefariaConnectionParam(): string | null {
    return currentCategory === 'total' ? null : currentCategory;
  },
};

export function configure(config: { verses: TanakhLayout[] }): void {
  verses = config.verses;
  cachedMaxValues = {};
  // Reset to default state for testing
  currentCategory = 'total';
}
