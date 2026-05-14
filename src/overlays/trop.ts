// src/overlays/trop.ts
import '../styles/overlays/trop.css';
import type { Overlay, Color } from './types.ts';
import type { TanakhIdentity, TropIndex, TropIndexEntry } from '../types.ts';
import { tanakhKey } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import {
  buildTropIndex,
  getTropByFrequency,
  getRarityTier,
} from '../trop.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';
import { scaleToGradient, type ColorStop } from '../utils/color.ts';
import { pick, type ThemedTable } from '../themes.ts';

let tropIndex: TropIndex = new Map();
let tropByFrequency: TropIndexEntry[] = [];
let selectedTrop: TropIndexEntry | null = null;
let updateCallback: (() => void) | null = null;

// Cached values for performance (computed once per trop selection, not per verse)
let cachedVerseLookup: Map<string, number> = new Map();
let cachedMaxCount = 1;
let cachedTier: 'rare' | 'uncommon' | 'common' = 'common';

// Per-theme trop palette
interface TropPalette {
  defaultGradient: ColorStop[];
  selectedGradient: ColorStop[];
  rareMatch: Color;
  emptyUncommon: Color;     // returned when uncommon-tier count = 0
  emptyCommon: Color;       // returned when common-tier count = 0
}

const TROP: ThemedTable<TropPalette> = {
  byTheme: {
    'refined-grey': {
      defaultGradient: [
        { t: 0,    color: [0.4, 0.2, 0.6] },
        { t: 1,    color: [0.9, 0.4, 0.95] },
      ],
      selectedGradient: [
        { t: 0,    color: [0.2, 0.1, 0.3] },
        { t: 0.33, color: [0.4, 0.2, 0.5] },
        { t: 0.66, color: [0.7, 0.3, 0.7] },
        { t: 1.0,  color: [0.95, 0.6, 0.9] },
      ],
      rareMatch: [1.0, 0.84, 0.0],
      emptyUncommon: [0.25, 0.25, 0.28],
      emptyCommon:   [0.25, 0.23, 0.28],
    },
  },
  lightFallback: {
    defaultGradient: [
      { t: 0, color: [0.55, 0.35, 0.65] },
      { t: 1, color: [0.30, 0.10, 0.45] },
    ],
    selectedGradient: [
      { t: 0,    color: [0.75, 0.60, 0.80] },
      { t: 0.33, color: [0.55, 0.35, 0.65] },
      { t: 0.66, color: [0.35, 0.15, 0.50] },
      { t: 1.0,  color: [0.20, 0.05, 0.35] },
    ],
    rareMatch: [0.60, 0.40, 0.05],
    emptyUncommon: [0.78, 0.74, 0.68],
    emptyCommon:   [0.78, 0.72, 0.66],
  },
};

// Update cached values when trop selection changes
function updateCache(): void {
  cachedVerseLookup.clear();
  if (!selectedTrop) return;

  cachedTier = getRarityTier(selectedTrop.totalCount);

  // Build verse lookup once
  for (const loc of selectedTrop.verses) {
    const key = tanakhKey(loc.book, loc.chapter, loc.verse);
    cachedVerseLookup.set(key, loc.count);
  }

  // Calculate max count once
  cachedMaxCount = 1;
  for (const loc of selectedTrop.verses) {
    if (loc.count > cachedMaxCount) cachedMaxCount = loc.count;
  }
}

// Get verse color based on selected trop and rarity tier
function getTropVerseColor(verse: TanakhIdentity): Color | null {
  if (!selectedTrop) return null;

  // Rebuild cache if it was cleared (e.g., after destroy)
  if (cachedVerseLookup.size === 0) {
    updateCache();
  }

  const key = tanakhKey(verse.book, verse.chapter, verse.verse);
  const count = cachedVerseLookup.get(key) || 0;

  const trop = pick(TROP);
  if (cachedTier === 'rare') {
    // Binary highlight: bright gold for matches, dim gray for non-matches
    return count > 0 ? trop.rareMatch : HIGHLIGHT_CONSTANTS.RARE_NO_MATCH_COLOR;
  } else if (cachedTier === 'uncommon') {
    // Linear gradient based on count
    if (count === 0) {
      return trop.emptyUncommon;
    }
    return scaleToGradient(count, cachedMaxCount, trop.defaultGradient);
  } else {
    // Common: logarithmic heatmap
    if (count === 0) {
      return trop.emptyCommon;
    }
    return scaleToGradient(count, cachedMaxCount, trop.selectedGradient, { useLog: true });
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
      const tierLabel = tier === 'rare' ? 'Rare' : tier === 'uncommon' ? 'Uncommon' : 'Common';
      info.textContent = `${entry.name} (${entry.hebrewName}) · ${entry.totalCount.toLocaleString()} occurrences · ${tierLabel}`;
    });

    button.addEventListener('mouseleave', () => {
      if (!selectedButton) {
        info.textContent = '';
      } else {
        // Restore selected info
        const selEntry = tropByFrequency.find(e => e.unicode === selectedButton?.dataset.unicode);
        if (selEntry) {
          const selTier = getRarityTier(selEntry.totalCount);
          const tierLabel = selTier === 'rare' ? 'Rare' : selTier === 'uncommon' ? 'Uncommon' : 'Common';
          info.textContent = `${selEntry.name} (${selEntry.hebrewName}) · ${selEntry.totalCount.toLocaleString()} · ${tierLabel}`;
        }
      }
    });

    button.addEventListener('click', () => {
      // Toggle selection
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
      const tier = getRarityTier(entry.totalCount);
      const tierLabel = tier === 'rare' ? 'Rare' : tier === 'uncommon' ? 'Uncommon' : 'Common';
      info.textContent = `${entry.name} (${entry.hebrewName}) · ${entry.totalCount.toLocaleString()} · ${tierLabel}`;
    }
  }
}

export const tropOverlay: Overlay = {
  id: 'trop',
  name: 'Cantillation (Trop)',

  async init() {
    // Trop index is built from verse texts, not loaded from file
    // It will be built when setVerseTexts is called
  },

  destroy() {
    // Clear callback (to prevent stale references)
    updateCallback = null;
    // Clear cached values (will be recalculated when overlay is re-rendered)
    cachedVerseLookup.clear();
    cachedMaxCount = 1;
    cachedTier = 'common';
    // NOTE: We intentionally DO NOT reset selectedTrop here. It should persist
    // across overlay switches so the user can return to their selected trop mark.
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
      container.innerHTML = '<div style="color: #666; font-size: 11px;">Select a trop mark above</div>';
      return;
    }

    const tier = getRarityTier(selectedTrop.totalCount);
    if (tier === 'rare') {
      container.innerHTML = `
        <div class="legend-row"><span class="swatch" style="background: rgb(255, 214, 0)"></span><span>Contains ${selectedTrop.name}</span></div>
        <div class="legend-row"><span class="swatch" style="background: rgb(64, 64, 64)"></span><span>Does not contain</span></div>
      `;
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

    const loc = selectedTrop.verses.find(
      v => v.book === verse.book && v.chapter === verse.chapter && v.verse === verse.verse
    );
    return loc ? `${selectedTrop.name} ×${loc.count}` : null;
  },

  getUrlParams(): Record<string, string> {
    if (!selectedTrop) return {};
    // Use lowercase name with hyphens for URL-friendly format
    const slug = selectedTrop.name.toLowerCase().replace(/\s+/g, '-');
    return { trop: slug };
  },

  applyUrlParams(params: URLSearchParams): void {
    const slug = params.get('trop');
    if (slug) {
      // Match against slugified name
      const entry = tropByFrequency.find(t =>
        t.name.toLowerCase().replace(/\s+/g, '-') === slug
      );
      if (entry) {
        selectedTrop = entry;
        updateCache();
        updateCallback?.();
      }
    }
  },

  highlightVerseText(text: string, language: 'he' | 'en'): DocumentFragment | string {
    // Only highlight Hebrew text when trop is selected
    if (language !== 'he' || !selectedTrop) {
      return text;
    }
    return highlightTropInText(text, selectedTrop.unicode);
  },
};

export function configure(config: { verseTexts: VerseTexts }): void {
  tropIndex = buildTropIndex(config.verseTexts);
  tropByFrequency = getTropByFrequency(tropIndex);
  // Reset to default state for testing
  selectedTrop = null;
  updateCache();
}

// Get selected trop for sidebar highlighting
export function getSelectedTrop(): TropIndexEntry | null {
  return selectedTrop;
}

// Highlight trop mark in Hebrew text for sidebar display
export function highlightTropInText(hebrewText: string, tropUnicode: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < hebrewText.length) {
    const char = hebrewText[i];

    // Check if this is the target trop mark
    if (char === tropUnicode) {
      // Find the base letter (previous non-combining character)
      // Wrap from the last base letter through this trop
      if (result.length > 0) {
        // Pop characters back to the base letter
        const highlighted: string[] = [];
        while (result.length > 0) {
          const last = result[result.length - 1];
          const lastCode = last.codePointAt(0) || 0;
          // Keep popping combining characters
          if (lastCode >= 0x0591 && lastCode <= 0x05C7) {
            highlighted.unshift(result.pop()!);
          } else {
            // This is the base letter
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
