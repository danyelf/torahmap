// The trop overlay: colours, the mark chart, and marking a mark inside a verse.
//
// The presentation half of the trop feature. What the marks are and which
// verses carry them is in src/trop.ts.

import '../styles/overlays/trop.css';
import type { Overlay, Color, UrlParamSpec, UrlParamValues, SettingsUpdate } from './types.ts';
import type { TanakhIdentity, TropIndex, TropIndexEntry, TextLanguage } from '../types.ts';
import { tanakhKey, tanakhIdentitiesEqual } from '../types.ts';
import { isNikkud } from '../hebrew.ts';
import type { VerseTexts } from '../verseTexts.ts';
import { buildTropIndex, getTropByFrequency, getRarityTier } from '../trop.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';
import { scaleToGradient, buildLegendGradient, interpolateGradient } from '../utils/color.ts';
import type { ColorStop } from '../utils/color.ts';
import { legendRow } from './legend.ts';

let tropIndex: TropIndex = new Map();
let tropByFrequency: TropIndexEntry[] = [];
const URL_PARAMS = [{ key: 'trop', kind: 'token' }] as const satisfies readonly UrlParamSpec[];

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

function entryFor(mark: string | null): TropIndexEntry | null {
  if (!mark) return null;
  return tropByFrequency.find((t) => slugify(t.name) === mark) ?? null;
}

interface TropDerivation {
  verseLookup: Map<string, number>;
  maxCount: number;
  tier: 'rare' | 'uncommon' | 'common';
}

const RARE_MATCH_COLOR: Color = [1.0, 0.84, 0.0]; // Gold

/** The colours and lookup table for one trop mark, named by its URL slug. */
function deriveTrop(mark: string | null): TropDerivation | null {
  const entry = entryFor(mark);
  if (!entry) return null;

  const verseLookup = new Map<string, number>();
  let maxCount = 1;
  for (const loc of entry.verses) {
    const key = tanakhKey(loc.book, loc.chapter, loc.verse);
    verseLookup.set(key, loc.count);
    if (loc.count > maxCount) maxCount = loc.count;
  }

  return { verseLookup, maxCount, tier: getRarityTier(entry.totalCount) };
}

// getVerseColor asks once per verse, 23,000 times a paint, so the derivation is
// built once per settings value and kept. Settings are never edited in place,
// so a value's identity is a sound key; the last one asked about is checked
// first, because a paint asks about the same one every time.
const derivations = new WeakMap<TropSettings, TropDerivation | null>();
let lastDerivation: { of: TropSettings; value: TropDerivation | null } | null = null;

function derivationFor(settings: TropSettings): TropDerivation | null {
  if (lastDerivation?.of === settings) return lastDerivation.value;

  let value: TropDerivation | null;
  if (derivations.has(settings)) {
    value = derivations.get(settings) ?? null;
  } else {
    value = deriveTrop(shownMark(settings));
    derivations.set(settings, value);
  }
  lastDerivation = { of: settings, value };
  return value;
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

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function tropColorAt(verse: TanakhIdentity, derived: TropDerivation | null): Color | null {
  if (!derived) return null;

  const key = tanakhKey(verse.book, verse.chapter, verse.verse);
  const count = derived.verseLookup.get(key) || 0;

  if (derived.tier === 'rare') {
    // Binary: gold for a match, dim gray otherwise.
    return count > 0 ? RARE_MATCH_COLOR : HIGHLIGHT_CONSTANTS.RARE_NO_MATCH_COLOR;
  } else if (derived.tier === 'uncommon') {
    if (count === 0) {
      return [0.25, 0.25, 0.28];
    }
    return scaleToGradient(count, derived.maxCount, UNCOMMON_TROP_GRADIENT);
  } else {
    // Common trop marks span a wide count range, so scale logarithmically.
    if (count === 0) {
      return [0.25, 0.23, 0.28];
    }
    return scaleToGradient(count, derived.maxCount, COMMON_TROP_GRADIENT, { useLog: true });
  }
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
): void {
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

    for (const entry of tropByFrequency) {
      const slug = slugify(entry.name);
      const button = document.createElement('button');
      button.textContent = 'ב' + entry.unicode; // Show on a bet for visibility
      button.title = `${entry.name} (${entry.hebrewName})`;
      button.dataset.unicode = entry.unicode;
      button.dataset.slug = slug;

      if (getRarityTier(entry.totalCount) === 'rare') {
        button.classList.add('rare');
      }

      button.addEventListener('mouseenter', () => {
        onChange((current) => ({ ...current, preview: slug }));
      });

      button.addEventListener('mouseleave', () => {
        onChange((current) => ({ ...current, preview: null }));
      });

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
  const previewed = entryFor(settings.preview);
  const selected = entryFor(settings.mark);
  info.textContent = previewed
    ? tropInfoLine(previewed, { withOccurrencesWord: true })
    : selected
      ? tropInfoLine(selected)
      : '';
}

export const tropOverlay: Overlay<TanakhIdentity, TropSettings> = {
  id: 'trop',
  name: 'Trop',
  description:
    'The cantillation marks that say how the Hebrew is chanted, and where in the text ' +
    'they punctuate. Pick a mark to see which verses carry it, and how often.',

  destroy() {
    lastDerivation = null;
  },

  getVerseColor(verse, settings) {
    return tropColorAt(verse, derivationFor(settings));
  },

  colorsFor(items, settings, _hovered) {
    const derived = derivationFor(settings);
    return items.map((item) => tropColorAt(item, derived));
  },

  defaultSettings() {
    return { mark: null, preview: null };
  },

  urlParams: URL_PARAMS,

  settingsFromUrl(params: UrlParamValues<typeof URL_PARAMS>): TropSettings {
    return { mark: params.trop ?? null, preview: null };
  },

  settingsToUrl(settings): Record<string, string> {
    return settings.mark ? { trop: settings.mark } : {};
  },

  renderControls(container, settings, onChange) {
    renderTropChart(container, settings, onChange);
  },

  renderLegend(container, settings) {
    const entry = entryFor(shownMark(settings));
    if (!entry) {
      container.innerHTML =
        '<div style="color: #666; font-size: 11px;">Select a trop mark above</div>';
      return;
    }

    const tier = getRarityTier(entry.totalCount);
    if (tier === 'rare') {
      container.innerHTML =
        legendRow('rgb(255, 214, 0)', `Contains ${entry.name}`) +
        legendRow('rgb(64, 64, 64)', 'Does not contain');
    } else {
      const stops = tier === 'uncommon' ? UNCOMMON_TROP_GRADIENT : COMMON_TROP_GRADIENT;
      const gradient = buildLegendGradient(10, (i) => interpolateGradient(i / 9, stops));

      container.innerHTML = `
        <div class="trop-gradient" style="background: ${gradient}"></div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888;">
          <span>0</span>
          <span>Count</span>
          <span>Max</span>
        </div>
      `;
    }
  },

  getHoverInfo(verse, settings) {
    const entry = entryFor(shownMark(settings));
    if (!entry) return null;

    const loc = entry.verses.find((v) => tanakhIdentitiesEqual(v, verse));
    return loc ? `${entry.name} ×${loc.count}` : null;
  },

  highlightVerseText(text: string, language: TextLanguage, settings): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const entry = entryFor(shownMark(settings));
    if (language !== 'he' || !entry) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    const holder = document.createElement('div');
    holder.innerHTML = highlightTropInText(text, entry.unicode);
    fragment.append(...holder.childNodes);
    return fragment;
  },
};

export function configure(config: { verseTexts: VerseTexts }): void {
  tropIndex = buildTropIndex(config.verseTexts);
  tropByFrequency = getTropByFrequency(tropIndex);
}

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
