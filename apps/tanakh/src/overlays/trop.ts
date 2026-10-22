// The trop overlay: colours, the mark chart, and marking a mark inside a verse.
//
// The presentation half of the trop feature. What the marks are and which
// verses carry them is in trop/marks.ts.

import {
  type Color,
  lingeringHover,
  colorToCss,
  type ColorStop,
  scale,
  LINEAR,
  LOG,
  memoByValue,
  memoByValueAndKey,
  type Transform,
} from '@torahmap/utils';
import './trop.css';
import type { Overlay, UrlParamValues, SettingsUpdate } from '@torahmap/shell/overlays/types.ts';
import type { TanakhIdentity, TanakhLayout } from '../types.ts';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { verseId } from '@torahmap/link/tanakh';
import { isNikkud } from '@torahmap/hebrew';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import {
  buildTropIndex,
  getTropByFrequency,
  getRarityTier,
  type RarityTier,
  type TropIndexEntry,
} from './trop/marks.ts';
import { axisGradient, legendCaption, legendRow } from './legend.ts';
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

function tierOf(entry: TropIndexEntry): RarityTier {
  return getRarityTier(entry.totalCount);
}

export const RARE_MATCH_COLOR: Color = [1.0, 0.84, 0.0]; // Gold
// A verse without the mark, at every tier.
export const NO_MATCH_COLOR: Color = [0.25, 0.25, 0.25];

interface RareTier {
  label: string;
  match: Color;
}

interface CountedTier {
  label: string;
  transform: Transform;
  gradient: ColorStop[];
}

/** How each tier is drawn: a rare mark as present or absent, any other as a count, on a scale. */
const TIERS = {
  rare: { label: 'Rare', match: RARE_MATCH_COLOR },
  uncommon: {
    label: 'Uncommon',
    transform: LINEAR,
    gradient: [
      { t: 0, color: [0.4, 0.2, 0.6] }, // Dim purple
      { t: 1, color: [0.9, 0.4, 0.95] }, // Bright purple
    ],
  },
  // Common marks span a wide range of counts, so their scale is logarithmic.
  common: {
    label: 'Common',
    transform: LOG,
    gradient: [
      { t: 0, color: [0.2, 0.1, 0.3] }, // Dark purple
      { t: 0.33, color: [0.4, 0.2, 0.5] }, // Purple
      { t: 0.66, color: [0.7, 0.3, 0.7] }, // Magenta
      { t: 1.0, color: [0.95, 0.6, 0.9] }, // Pink
    ],
  },
} satisfies Record<RarityTier, RareTier | CountedTier>;

/** The key's colours, as CSS: "contains" and "does not" swatches, or one gradient. */
type TropLegend =
  { kind: 'swatches'; contains: string; without: string } | { kind: 'gradient'; gradient: string };

interface TropDerivation {
  entry: TropIndexEntry;
  tier: RarityTier;
  verseLookup: Map<string, number>;
  /** A verse's colour, from how many times it carries the mark. */
  colorOf: (count: number) => Color;
  legend: TropLegend;
}

/** The colours and lookup table for one trop mark, named by its URL slug. */
function deriveTrop(data: TropData, mark: string | null): TropDerivation | null {
  const entry = entryFor(data, mark);
  if (!entry) return null;

  const verseLookup = new Map<string, number>();
  for (const loc of entry.verses) {
    verseLookup.set(verseId(loc.book, loc.chapter, loc.verse), loc.count);
  }

  const tier = tierOf(entry);
  if (tier === 'rare') {
    const { match } = TIERS.rare;
    return {
      entry,
      tier,
      verseLookup,
      colorOf: (count) => (count ? match : NO_MATCH_COLOR),
      legend: {
        kind: 'swatches',
        contains: colorToCss(match),
        without: colorToCss(NO_MATCH_COLOR),
      },
    };
  }
  const { transform, gradient } = TIERS[tier];
  const maxCount = entry.verses.reduce((max, loc) => Math.max(max, loc.count), 1);
  const counts = scale(0, maxCount, transform, gradient);
  return {
    entry,
    tier,
    verseLookup,
    colorOf: (count) => (count ? counts.colorOf(count) : NO_MATCH_COLOR),
    legend: { kind: 'gradient', gradient: axisGradient(counts) },
  };
}

const derivationOf = memoByValueAndKey(deriveTrop);

function derivationFor(data: TropData, settings: TropSettings): TropDerivation | null {
  return derivationOf(data, shownMark(settings));
}

/** The "name (hebrew) · count · tier" line shown for a trop mark's info. */
function tropInfoLine(entry: TropIndexEntry, options?: { withOccurrencesWord?: boolean }): string {
  const count = options?.withOccurrencesWord
    ? `${entry.totalCount.toLocaleString()} occurrences`
    : entry.totalCount.toLocaleString();
  return `${entry.name} (${entry.hebrewName}) · ${count} · ${TIERS[tierOf(entry)].label}`;
}

function countAt(verse: TanakhLayout, derived: TropDerivation): number {
  return derived.verseLookup.get(verse.id) ?? 0;
}

function tropColorAt(verse: TanakhLayout, derived: TropDerivation | null): Color | null {
  return derived && derived.colorOf(countAt(verse, derived));
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
    chart.style.setProperty('--rare-marker', colorToCss(TIERS.rare.match));
    const preview = lingeringHover<string>((slug) =>
      onChange((current) => ({ ...current, preview: slug })),
    );

    for (const [slug, entry] of marksOf(data)) {
      const button = document.createElement('button');
      button.textContent = 'ב' + entry.unicode; // Show on a bet for visibility
      button.title = `${entry.name} (${entry.hebrewName})`;
      button.dataset.unicode = entry.unicode;
      button.dataset.slug = slug;

      if (tierOf(entry) === 'rare') {
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

  getItemColor(verse, settings, data) {
    return tropColorAt(verse, derivationFor(data, settings));
  },

  colorsFor(items, settings, _hovered, data) {
    const derived = derivationFor(data, settings);
    return items.map((item) => tropColorAt(item, derived));
  },

  standoutsFor(items, settings, data) {
    const derived = derivationFor(data, settings);
    if (derived?.tier !== 'rare') return items.map(() => false);
    return items.map((item) => countAt(item, derived) > 0);
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
    const derived = derivationFor(data, settings);
    if (!derived) {
      container.innerHTML = legendCaption('Select a trop mark above');
      return;
    }

    const { legend } = derived;
    if (legend.kind === 'swatches') {
      container.innerHTML =
        legendRow(legend.contains, `Contains ${derived.entry.name}`) +
        legendRow(legend.without, 'Does not contain');
    } else {
      container.innerHTML = `
        <div class="trop-gradient" style="background: ${legend.gradient}"></div>
        <div class="trop-gradient-labels">
          <span>0</span>
          <span>Count</span>
          <span>Max</span>
        </div>
      `;
    }
  },

  summary(settings, data) {
    const derived = derivationOf(data, settings.mark);
    if (!derived) return {};
    const detail = settings.mark ?? undefined;
    const { legend } = derived;
    return legend.kind === 'swatches'
      ? { detail, colors: [legend.contains] }
      : { detail, strip: { gradient: legend.gradient, ends: ['few', 'many'] } };
  },

  getHoverInfo(verse, settings, data) {
    const derived = derivationFor(data, settings);
    if (!derived) return null;
    const count = countAt(verse, derived);
    return count ? `${derived.entry.name} ×${count}` : null;
  },

  highlightItemText(
    _verse,
    text: string,
    language: TextLanguage,
    settings,
    data,
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const derived = derivationFor(data, settings);
    if (language !== HEBREW || !derived) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    const holder = document.createElement('div');
    holder.innerHTML = highlightTropInText(text, derived.entry.unicode);
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
