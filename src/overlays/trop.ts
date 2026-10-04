// The trop overlay: colours, the mark chart, and marking a mark inside a verse.
//
// The presentation half of the trop feature. What the marks are and which
// verses carry them is in trop/marks.ts.

import './trop.css';
import type { Overlay, Color, UrlParamValues, SettingsUpdate } from './types.ts';
import type { TanakhIdentity, TextLanguage } from '../types.ts';
import { HEBREW } from '../types.ts';
import { verseToUrlFormat } from '@torahmap/link';
import { isNikkud } from '../hebrew.ts';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import {
  buildTropIndex,
  getTropByFrequency,
  getRarityTier,
  type TropIndexEntry,
} from './trop/marks.ts';
import { lingeringHover } from '../utils/hover.ts';
import { colorToCss, type ColorStop } from '../utils/color.ts';
import { scale, LINEAR, LOG, type Scale } from '../utils/scale.ts';
import { axisGradient, legendCaption, legendRow } from './legend.ts';
import { memoByValue } from '../utils/memo.ts';
import { TROP } from '@torahmap/overlay-catalog';

/**
 * The mark clicked, and the mark the pointer is over in the chart, each named
 * by its URL slug. The map shows the hovered mark while there is one; only the
 * clicked one goes into a link.
 */
export interface TropSettings {
  readonly mark: string | null;
  readonly preview: string | null;
}

function shownMark(settings: TropSettings): string | null {
  return settings.preview ?? settings.mark;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export interface TropData {
  texts: VerseTexts;
}

/** Every mark the text carries, by URL slug, rarest first; once per data value. */
const marksOf = memoByValue(
  (data: TropData): Map<string, TropIndexEntry> =>
    new Map(
      getTropByFrequency(buildTropIndex(data.texts)).map((entry) => [slugify(entry.name), entry]),
    ),
);

function entryFor(data: TropData, mark: string | null): TropIndexEntry | null {
  if (!mark) return null;
  return marksOf(data).get(mark) ?? null;
}

/** A rare mark's legend is two swatches, "contains" and "does not"; any other's a gradient. */
function markColors(entry: TropIndexEntry): string[] {
  const counts = countScale(entry);
  if (!counts) return [colorToCss(RARE_MATCH_COLOR), colorToCss(RARE_NO_MATCH_COLOR)];
  return [axisGradient(counts)];
}

interface TropDerivation {
  entry: TropIndexEntry;
  verseLookup: Map<string, number>;
  /** Null for a rare mark, which is drawn as present or absent. */
  counts: Scale | null;
  noMatch: Color;
}

const RARE_MATCH_COLOR: Color = [1.0, 0.84, 0.0]; // Gold
const RARE_NO_MATCH_COLOR: Color = [0.25, 0.25, 0.25];

/**
 * How many times a verse carries the mark, as a colour. Common marks span a
 * wide range of counts, so their scale is logarithmic. Null for a rare mark.
 */
function countScale(entry: TropIndexEntry): Scale | null {
  const tier = getRarityTier(entry.totalCount);
  if (tier === 'rare') return null;
  const maxCount = entry.verses.reduce((max, loc) => Math.max(max, loc.count), 1);
  return tier === 'uncommon'
    ? scale(0, maxCount, LINEAR, UNCOMMON_TROP_GRADIENT)
    : scale(0, maxCount, LOG, COMMON_TROP_GRADIENT);
}

/** The colours and lookup table for one trop mark, named by its URL slug. */
function deriveTrop(data: TropData, mark: string | null): TropDerivation | null {
  const entry = entryFor(data, mark);
  if (!entry) return null;

  const verseLookup = new Map<string, number>();
  for (const loc of entry.verses) {
    verseLookup.set(verseToUrlFormat(loc.book, loc.chapter, loc.verse), loc.count);
  }

  const tier = getRarityTier(entry.totalCount);
  const noMatch: Color =
    tier === 'rare'
      ? RARE_NO_MATCH_COLOR
      : tier === 'uncommon'
        ? [0.25, 0.25, 0.28]
        : [0.25, 0.23, 0.28];
  return { entry, verseLookup, counts: countScale(entry), noMatch };
}

// Per data value, then per settings value.
const derivationsOf = memoByValue((data: TropData) =>
  memoByValue((settings: TropSettings) => deriveTrop(data, shownMark(settings))),
);

function derivationFor(data: TropData, settings: TropSettings): TropDerivation | null {
  return derivationsOf(data)(settings);
}

const UNCOMMON_TROP_GRADIENT: ColorStop[] = [
  { t: 0, color: [0.4, 0.2, 0.6] }, // Dim purple
  { t: 1, color: [0.9, 0.4, 0.95] }, // Bright purple
];

const COMMON_TROP_GRADIENT: ColorStop[] = [
  { t: 0, color: [0.2, 0.1, 0.3] }, // Dark purple
  { t: 0.33, color: [0.4, 0.2, 0.5] }, // Purple
  { t: 0.66, color: [0.7, 0.3, 0.7] }, // Magenta
  { t: 1.0, color: [0.95, 0.6, 0.9] }, // Pink
];

function tierLabel(tier: 'rare' | 'uncommon' | 'common'): string {
  return tier === 'rare' ? 'Rare' : tier === 'uncommon' ? 'Uncommon' : 'Common';
}

/** The "name (hebrew) · count · tier" line shown for a trop mark's info. */
function tropInfoLine(entry: TropIndexEntry, options?: { withOccurrencesWord?: boolean }): string {
  const tier = getRarityTier(entry.totalCount);
  const count = options?.withOccurrencesWord
    ? `${entry.totalCount.toLocaleString()} occurrences`
    : entry.totalCount.toLocaleString();
  return `${entry.name} (${entry.hebrewName}) · ${count} · ${tierLabel(tier)}`;
}

function countAt(verse: TanakhIdentity, derived: TropDerivation): number {
  return derived.verseLookup.get(verseToUrlFormat(verse.book, verse.chapter, verse.verse)) ?? 0;
}

function tropColorAt(verse: TanakhIdentity, derived: TropDerivation | null): Color | null {
  if (!derived) return null;

  const count = countAt(verse, derived);
  if (count === 0) return derived.noMatch;
  return derived.counts ? derived.counts.colorOf(count) : RARE_MATCH_COLOR;
}

/**
 * Draw the mark chart for `settings`, or bring an already-drawn chart's
 * selection up to date. Built once per container; a redraw only toggles which
 * button is marked selected and what the info line says.
 */
function renderTropChart(
  container: HTMLElement,
  settings: TropSettings,
  onChange: (update: SettingsUpdate<TropSettings>) => void,
  data: TropData | null,
): void {
  if (!data) return;
  let chart = container.querySelector<HTMLElement>('.trop-chart');
  if (!chart) {
    container.innerHTML = `
      <div class="trop-controls">
        <label style="margin-bottom: 8px;">Select Trop Mark</label>
        <div class="trop-chart"></div>
        <div class="trop-info"></div>
      </div>
    `;
    chart = container.querySelector('.trop-chart') as HTMLElement;
    const preview = lingeringHover<string>((slug) =>
      onChange((current) => ({ ...current, preview: slug })),
    );

    for (const [slug, entry] of marksOf(data)) {
      const button = document.createElement('button');
      button.textContent = 'ב' + entry.unicode; // Show on a bet for visibility
      button.title = `${entry.name} (${entry.hebrewName})`;
      button.dataset.unicode = entry.unicode;
      button.dataset.slug = slug;

      if (getRarityTier(entry.totalCount) === 'rare') {
        button.classList.add('rare');
      }

      button.addEventListener('mouseenter', () => preview.enter(slug));
      button.addEventListener('mouseleave', () => preview.leave());

      button.addEventListener('click', () => {
        onChange((current) => ({ ...current, mark: current.mark === slug ? null : slug }));
      });

      chart.appendChild(button);
    }
  }

  chart.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.classList.toggle('selected', button.dataset.slug === settings.mark);
  });

  const info = container.querySelector('.trop-info') as HTMLElement;
  const previewed = entryFor(data, settings.preview);
  const selected = entryFor(data, settings.mark);
  info.textContent = previewed
    ? tropInfoLine(previewed, { withOccurrencesWord: true })
    : selected
      ? tropInfoLine(selected)
      : '';
}

export const tropOverlay: Overlay<TanakhIdentity, TropSettings, TropData> = {
  ...TROP,
  data: { texts: TEXTS_FILE },

  prebuild(data) {
    marksOf(data);
  },

  getVerseColor(verse, settings, data) {
    return tropColorAt(verse, derivationFor(data, settings));
  },

  colorsFor(items, settings, _hovered, data) {
    const derived = derivationFor(data, settings);
    return items.map((item) => tropColorAt(item, derived));
  },

  settingsFromUrl(params: UrlParamValues<typeof TROP.urlParams>): TropSettings {
    return { mark: params.trop ?? null, preview: null };
  },

  settingsToUrl(settings: TropSettings): Record<string, string> {
    return settings.mark ? { trop: settings.mark } : {};
  },

  renderControls(container, settings, onChange, data) {
    renderTropChart(container, settings, onChange, data);
  },

  renderLegend(container, settings, data) {
    if (!data) {
      container.innerHTML = '';
      return;
    }
    const entry = entryFor(data, shownMark(settings));
    if (!entry) {
      container.innerHTML = legendCaption('Select a trop mark above');
      return;
    }

    const colors = markColors(entry);
    if (colors.length === 2) {
      container.innerHTML =
        legendRow(colors[0], `Contains ${entry.name}`) + legendRow(colors[1], 'Does not contain');
    } else {
      container.innerHTML = `
        <div class="trop-gradient" style="background: ${colors[0]}"></div>
        <div class="trop-gradient-labels">
          <span>0</span>
          <span>Count</span>
          <span>Max</span>
        </div>
      `;
    }
  },

  summary(settings, data) {
    const entry = entryFor(data, settings.mark);
    return entry ? { detail: settings.mark ?? undefined, colors: markColors(entry) } : {};
  },

  getHoverInfo(verse, settings, data) {
    const derived = derivationFor(data, settings);
    if (!derived) return null;
    const count = countAt(verse, derived);
    return count ? `${derived.entry.name} ×${count}` : null;
  },

  highlightVerseText(
    _verse,
    text: string,
    language: TextLanguage,
    settings,
    data,
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const entry = entryFor(data, shownMark(settings));
    if (language !== HEBREW || !entry) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    const holder = document.createElement('div');
    holder.innerHTML = highlightTropInText(text, entry.unicode);
    fragment.append(...holder.childNodes);
    return fragment;
  },
};

// Wraps a trop mark together with its base letter and any other combining
// marks between them (Hebrew points/accents, U+0591-U+05C7), so the <mark>
// highlights a whole grapheme instead of just the trop character.
export function highlightTropInText(hebrewText: string, tropUnicode: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < hebrewText.length) {
    const char = hebrewText[i];

    if (char === tropUnicode) {
      if (result.length > 0) {
        const highlighted: string[] = [];
        while (result.length > 0) {
          const last = result[result.length - 1];
          const lastCode = last.codePointAt(0) || 0;
          if (isNikkud(lastCode)) {
            highlighted.unshift(result.pop()!);
          } else {
            highlighted.unshift(result.pop()!);
            break;
          }
        }
        highlighted.push(char);
        result.push(`<mark class="trop-highlight">${highlighted.join('')}</mark>`);
      } else {
        result.push(`<mark class="trop-highlight">${char}</mark>`);
      }
    } else {
      result.push(char);
    }
    i++;
  }

  return result.join('');
}
