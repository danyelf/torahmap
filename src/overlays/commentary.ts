import '../styles/overlays/commentary.css';
import type { Overlay, Color, UrlParamSpec, UrlParamValues } from './types.ts';
import type { TanakhIdentity, TanakhLayout, CommentaryData } from '../types.ts';
import { heatmapColor } from '../utils/color.ts';
import { loadJson } from './loadJson.ts';

const URL_PARAMS = [
  { key: 'category', kind: 'category' },
] as const satisfies readonly UrlParamSpec[];

let data: CommentaryData = {};
let currentCategory = 'total';
let updateCallback: (() => void) | null = null;

// Cache max values per category to avoid recalculating
let cachedMaxValues: Record<string, number> = {};
let verses: TanakhLayout[] = [];

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
    // Store reference to verses for max calculation
    // This is a bit awkward - we'll improve this in integration
    const count = getCount(verse.book, verse.chapter, verse.verse);
    const maxValue = getMaxValue();
    return heatmapColor(count, maxValue);
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
    const logMax = Math.log(maxValue + 1);
    const position = (val: number) => (val === 0 ? 0 : (Math.log(val + 1) / logMax) * 100);

    const ticks: number[] = [0];
    for (let val = 1; val <= maxValue; val *= 10) {
      ticks.push(val);
    }

    // The top of the scale is worth naming, but on a log axis the last power of
    // ten often lands almost on it: Halakhah's 100 and 113 sit 2.6% apart, about
    // nine pixels, and the labels print over each other. Nearer than this and the
    // maximum takes that tick's place rather than crowding it.
    const MIN_LABEL_GAP_PERCENT = 10;
    const highestPower = ticks[ticks.length - 1];
    if (highestPower < maxValue) {
      if (position(maxValue) - position(highestPower) < MIN_LABEL_GAP_PERCENT) ticks.pop();
      ticks.push(maxValue);
    }

    container.innerHTML = `
      <div class="legend-gradient"></div>
      <div class="legend-ticks">
        ${ticks
          .map((val, i) => {
            const label = val >= 1000 ? `${val / 1000}k` : String(val);
            // Both ends sit on the edge of the scale, so a centred label there
            // falls half outside it. These two align inwards instead; the CSS
            // leaves their tick marks on the true position.
            const edge = i === 0 ? ' tick-start' : i === ticks.length - 1 ? ' tick-end' : '';
            return `<span class="tick${edge}" style="left: ${position(val)}%">${label}</span>`;
          })
          .join('')}
      </div>
    `;
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

// Get total linked texts count for a verse (used by sidebar)
export function getVerseLinkCount(book: string, chapter: number, verse: number): number | null {
  const verseData = data[book]?.[String(chapter)]?.[String(verse)];
  return verseData?.total ?? null;
}
