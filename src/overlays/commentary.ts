import type { Overlay, Color, UrlParamValues } from './types.ts';
import type { TanakhIdentity } from '../types.ts';
import type { ColorStop } from '../utils/color.ts';
import { scale, LOG, type Scale } from '../utils/scale.ts';
import { axisGradient, renderAxisWithZero } from './legend.ts';
import { memoByValueAndKey } from './memo.ts';
import { CONTROL } from '../panel.ts';
import { MAP_BACKGROUND } from '../constants.ts';
import { COMMENTARY } from '@torahmap/overlay-catalog';

const HEATMAP_STOPS: ColorStop[] = [
  { t: 0, color: [0.14, 0.21, 0.33] },
  { t: 0.25, color: [0.1, 0.23, 0.38] },
  { t: 0.5, color: [0.2, 0.43, 0.33] },
  { t: 0.75, color: [0.9, 0.33, 0.13] },
  { t: 1.0, color: [1.0, 0.23, 0.18] },
];

// A verse no one has linked to sits one shade above the background: a hint of
// where the verse is, not a count.
const NEVER_LINKED = MAP_BACKGROUND.map((c) => c + 0.01) as Color;

/** How each category reads after "42 references in …". */
const WHERE: Record<string, string> = {
  'Commentary': 'commentaries',
  'Quoting Commentary': 'quoting commentaries',
  'Talmud': 'the Talmud',
  'Midrash': 'midrash',
  'Mishnah': 'the Mishnah',
  'Tosefta': 'the Tosefta',
  'Halakhah': 'works of halakhah',
  'Responsa': 'responsa',
  'Jewish Thought': 'Jewish thought',
  'Kabbalah': 'Kabbalah',
  'Chasidut': 'Chasidut',
  'Musar': 'Musar',
  'Liturgy': 'the liturgy',
  'Second Temple': 'Second Temple texts',
};

// Commentary counts from Sefaria
interface TanakhCommentary {
  total: number;
  categories: Record<string, number>;
}

/** { [book]: { [chapter]: { [verse]: TanakhCommentary } } } */
export type CommentaryCounts = Record<string, Record<string, Record<string, TanakhCommentary>>>;

export interface CommentaryData {
  counts: CommentaryCounts;
}

export interface CommentarySettings {
  readonly category: string;
}

/**
 * Rebuilt per call: the maximum moves when the category changes. Starts at 1:
 * zero is drawn apart, as `NEVER_LINKED`.
 */
function linkScale(data: CommentaryData, category: string): Scale {
  return scale(1, getMaxValue(data, category), LOG, HEATMAP_STOPS);
}

function countIn(entry: TanakhCommentary | undefined, category: string): number {
  if (!entry) return 0;
  if (category === 'total') return entry.total;
  return entry.categories[category] || 0;
}

function entryAt(data: CommentaryData, verse: TanakhIdentity): TanakhCommentary | undefined {
  return data.counts[verse.book]?.[String(verse.chapter)]?.[String(verse.verse)];
}

// Each category's highest count, worked out once per data value.
const getMaxValue = memoByValueAndKey((data: CommentaryData, category: string): number => {
  let max = 0;
  for (const chapters of Object.values(data.counts)) {
    for (const verses of Object.values(chapters)) {
      for (const entry of Object.values(verses)) max = Math.max(max, countIn(entry, category));
    }
  }
  return max;
});

function commentaryColorAt(
  data: CommentaryData,
  verse: TanakhIdentity,
  category: string,
): Color | null {
  const count = countIn(entryAt(data, verse), category);
  if (count === 0) return NEVER_LINKED;
  return linkScale(data, category).colorOf(count);
}

export const commentaryOverlay: Overlay<TanakhIdentity, CommentarySettings, CommentaryData> = {
  ...COMMENTARY,
  credits: [
    {
      source: 'Sefaria link exports',
      url: 'https://github.com/Sefaria/Sefaria-Export',
      collected: 'September 2026',
    },
  ],
  data: { counts: 'overlays/commentary/counts.json' },

  getVerseColor(verse, settings, data) {
    return commentaryColorAt(data, verse, settings.category);
  },

  colorsFor(items, settings, _hovered, data) {
    return items.map((item) => commentaryColorAt(data, item, settings.category));
  },

  settingsFromUrl(params: UrlParamValues<typeof COMMENTARY.urlParams>): CommentarySettings {
    return { category: params.category };
  },

  settingsToUrl(settings: CommentarySettings): Record<string, string> {
    return { category: settings.category };
  },

  renderControls(container, settings, onChange) {
    let select = container.querySelector<HTMLSelectElement>('#category-select');
    if (!select) {
      const wrapper = document.createElement('div');
      wrapper.className = 'commentary-controls';
      wrapper.innerHTML = `
        <label for="category-select">Category:</label>
        <select id="category-select" class="${CONTROL.select}">
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

  renderLegend(container, settings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    const maxValue = getMaxValue(data, settings.category);

    const ticks: number[] = [];
    for (let value = 1; value <= maxValue; value *= 10) {
      ticks.push(value);
    }
    if (ticks[ticks.length - 1] < maxValue) {
      ticks.push(maxValue);
    }

    container.innerHTML = renderAxisWithZero(
      NEVER_LINKED,
      linkScale(data, settings.category),
      ticks,
    );
  },

  summary(settings, data) {
    return {
      detail: settings.category === 'total' ? undefined : settings.category,
      colors: [axisGradient(linkScale(data, settings.category))],
    };
  },

  getHoverInfo(verse, settings, data) {
    const entry = entryAt(data, verse);
    if (!entry) return null;
    const count = countIn(entry, settings.category);
    const counted =
      count === 0
        ? 'no references'
        : `${count.toLocaleString()} reference${count === 1 ? '' : 's'}`;
    if (settings.category === 'total') return counted;
    return `${counted} in ${WHERE[settings.category] ?? settings.category}`;
  },

  getSefariaConnectionParam(settings) {
    return settings.category === 'total' ? null : settings.category;
  },
};
