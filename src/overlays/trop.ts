import '../styles/overlays/trop.css';
import type { Overlay, Color, UrlParamSpec, UrlParamValues } from './types.ts';
import type { TanakhIdentity, TropIndex, TropIndexEntry } from '../types.ts';
import { tanakhKey, tanakhIdentitiesEqual } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import { buildTropIndex, getTropByFrequency, getRarityTier } from '../trop.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';
import { scaleToGradient, type ColorStop } from '../utils/color.ts';
import { legendRow } from './legend.ts';

let tropIndex: TropIndex = new Map();
let tropByFrequency: TropIndexEntry[] = [];
const URL_PARAMS = [{ key: 'trop', kind: 'token' }] as const satisfies readonly UrlParamSpec[];

let selectedTrop: TropIndexEntry | null = null;
let updateCallback: (() => void) | null = null;

// Computed once per trop selection, not per verse.
let cachedVerseLookup: Map<string, number> = new Map();
let cachedMaxCount = 1;
let cachedTier: 'rare' | 'uncommon' | 'common' = 'common';

const RARE_MATCH_COLOR: Color = [1.0, 0.84, 0.0]; // Gold

function updateCache(): void {
  cachedVerseLookup.clear();
  if (!selectedTrop) return;

  cachedTier = getRarityTier(selectedTrop.totalCount);

  for (const loc of selectedTrop.verses) {
    const key = tanakhKey(loc.book, loc.chapter, loc.verse);
    cachedVerseLookup.set(key, loc.count);
  }

  cachedMaxCount = 1;
  for (const loc of selectedTrop.verses) {
    if (loc.count > cachedMaxCount) cachedMaxCount = loc.count;
  }
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

function getTropVerseColor(verse: TanakhIdentity): Color | null {
  if (!selectedTrop) return null;

  // destroy() clears the cache; rebuild it lazily rather than on re-init.
  if (cachedVerseLookup.size === 0) {
    updateCache();
  }

  const key = tanakhKey(verse.book, verse.chapter, verse.verse);
  const count = cachedVerseLookup.get(key) || 0;

  if (cachedTier === 'rare') {
    // Binary: gold for a match, dim gray otherwise.
    return count > 0 ? RARE_MATCH_COLOR : HIGHLIGHT_CONSTANTS.RARE_NO_MATCH_COLOR;
  } else if (cachedTier === 'uncommon') {
    if (count === 0) {
      return [0.25, 0.25, 0.28];
    }
    return scaleToGradient(count, cachedMaxCount, UNCOMMON_TROP_GRADIENT);
  } else {
    // Common trop marks span a wide count range, so scale logarithmically.
    if (count === 0) {
      return [0.25, 0.23, 0.28];
    }
    return scaleToGradient(count, cachedMaxCount, COMMON_TROP_GRADIENT, { useLog: true });
  }
}

function createTropChart(container: HTMLElement): void {
  container.innerHTML = `
    <div class="trop-controls">
      <label style="margin-bottom: 8px;">Select Trop Mark</label>
      <div class="trop-chart"></div>
      <div class="trop-info"></div>
    </div>
  `;

  const chart = container.querySelector('.trop-chart') as HTMLElement;
  const info = container.querySelector('.trop-info') as HTMLElement;
  let selectedButton: HTMLButtonElement | null = null;

  for (const entry of tropByFrequency) {
    const button = document.createElement('button');
    button.textContent = 'ב' + entry.unicode; // Show on a bet for visibility
    button.title = `${entry.name} (${entry.hebrewName})`;

    const tier = getRarityTier(entry.totalCount);
    if (tier === 'rare') {
      button.classList.add('rare');
    }

    button.addEventListener('mouseenter', () => {
      info.textContent = tropInfoLine(entry, { withOccurrencesWord: true });
    });

    button.addEventListener('mouseleave', () => {
      if (!selectedButton) {
        info.textContent = '';
      } else {
        const selEntry = tropByFrequency.find((e) => e.unicode === selectedButton?.dataset.unicode);
        if (selEntry) {
          info.textContent = tropInfoLine(selEntry);
        }
      }
    });

    button.addEventListener('click', () => {
      if (selectedButton === button) {
        button.classList.remove('selected');
        selectedButton = null;
        selectedTrop = null;
        info.textContent = '';
      } else {
        if (selectedButton) selectedButton.classList.remove('selected');
        button.classList.add('selected');
        selectedButton = button;
        selectedTrop = entry;
      }
      updateCache(); // Rebuild lookup table once, not per-verse
      updateCallback?.();
    });

    button.dataset.unicode = entry.unicode;
    chart.appendChild(button);

    // Restore selection state if this trop was previously selected
    if (selectedTrop && entry.unicode === selectedTrop.unicode) {
      button.classList.add('selected');
      selectedButton = button;
      info.textContent = tropInfoLine(entry);
    }
  }
}

export const tropOverlay: Overlay = {
  id: 'trop',
  name: 'Trop',
  description:
    'The cantillation marks that say how the Hebrew is chanted, and where in the text ' +
    'they punctuate. Pick a mark to see which verses carry it, and how often.',

  destroy() {
    updateCallback = null;
    cachedVerseLookup.clear();
    cachedMaxCount = 1;
    cachedTier = 'common';
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  getVerseColor(verse: TanakhIdentity): Color | null {
    return getTropVerseColor(verse);
  },

  renderControls(container: HTMLElement) {
    createTropChart(container);
  },

  renderLegend(container: HTMLElement) {
    if (!selectedTrop) {
      container.innerHTML =
        '<div style="color: #666; font-size: 11px;">Select a trop mark above</div>';
      return;
    }

    const tier = getRarityTier(selectedTrop.totalCount);
    if (tier === 'rare') {
      container.innerHTML =
        legendRow('rgb(255, 214, 0)', `Contains ${selectedTrop.name}`) +
        legendRow('rgb(64, 64, 64)', 'Does not contain');
    } else {
      container.innerHTML = `
        <div class="legend-gradient" style="background: linear-gradient(to right, #3f3b47, #5a3f7a, #a060a0, #e090c0);"></div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888;">
          <span>0</span>
          <span>Count</span>
          <span>Max</span>
        </div>
      `;
    }
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    if (!selectedTrop) return null;

    const loc = selectedTrop.verses.find((v) => tanakhIdentitiesEqual(v, verse));
    return loc ? `${selectedTrop.name} ×${loc.count}` : null;
  },

  urlParams: URL_PARAMS,

  getUrlParams(): Record<string, string> {
    if (!selectedTrop) return {};
    return { trop: slugify(selectedTrop.name) };
  },

  applyUrlParams(params: UrlParamValues<typeof URL_PARAMS>): void {
    const slug = params.trop;
    if (slug) {
      const entry = tropByFrequency.find((t) => slugify(t.name) === slug);
      if (entry) {
        selectedTrop = entry;
        updateCache();
        updateCallback?.();
      }
    }
  },

  highlightVerseText(text: string, language: 'he' | 'en'): DocumentFragment {
    const fragment = document.createDocumentFragment();
    if (language !== 'he' || !selectedTrop) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    const holder = document.createElement('div');
    holder.innerHTML = highlightTropInText(text, selectedTrop.unicode);
    fragment.append(...holder.childNodes);
    return fragment;
  },
};

export function configure(config: { verseTexts: VerseTexts }): void {
  tropIndex = buildTropIndex(config.verseTexts);
  tropByFrequency = getTropByFrequency(tropIndex);
  // Reset to default state for testing
  selectedTrop = null;
  updateCache();
}

export function getSelectedTrop(): TropIndexEntry | null {
  return selectedTrop;
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
          if (lastCode >= 0x0591 && lastCode <= 0x05c7) {
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
