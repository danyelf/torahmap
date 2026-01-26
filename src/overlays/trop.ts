// src/overlays/trop.ts
import type { Overlay, Color } from './types.ts';
import type { Verse, TropIndex, TropIndexEntry } from '../types.ts';
import { getVerseKey } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import {
  buildTropIndex,
  getTropByFrequency,
  getRarityTier,
} from '../trop.ts';
import { HIGHLIGHT_CONSTANTS } from '../constants.ts';

// Colors for trop visualization
const RARE_MATCH_COLOR: Color = [1.0, 0.84, 0.0]; // Gold

export function createTropOverlay(): Overlay {
  // State - encapsulated in closure
  let tropIndex: TropIndex = new Map();
  let tropByFrequency: TropIndexEntry[] = [];
  let selectedTrop: TropIndexEntry | null = null;
  let updateCallback: (() => void) | null = null;

  // Cached values for performance (computed once per trop selection, not per verse)
  let cachedVerseLookup: Map<string, number> = new Map();
  let cachedMaxCount = 1;
  let cachedLogMax = 0;
  let cachedTier: 'rare' | 'uncommon' | 'common' = 'common';

  // Update cached values when trop selection changes
  function updateCache(): void {
  cachedVerseLookup.clear();
  if (!selectedTrop) return;

  cachedTier = getRarityTier(selectedTrop.totalCount);

  // Build verse lookup once
  for (const loc of selectedTrop.verses) {
    const key = getVerseKey(loc.book, loc.chapter, loc.verse);
    cachedVerseLookup.set(key, loc.count);
  }

  // Calculate max count once
  cachedMaxCount = 1;
  for (const loc of selectedTrop.verses) {
    if (loc.count > cachedMaxCount) cachedMaxCount = loc.count;
  }
  cachedLogMax = Math.log(cachedMaxCount + 1);
}

  // Get verse color based on selected trop and rarity tier
  function getTropVerseColor(verse: Verse): Color | null {
    if (!selectedTrop) return null;

    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const count = cachedVerseLookup.get(key) || 0;

    if (cachedTier === 'rare') {
      // Binary highlight: bright gold for matches, dim gray for non-matches
      return count > 0 ? RARE_MATCH_COLOR : HIGHLIGHT_CONSTANTS.RARE_NO_MATCH_COLOR;
    } else if (cachedTier === 'uncommon') {
      // Gradient based on count (0 = dim, max = bright purple)
      if (count === 0) {
        return [0.12, 0.12, 0.15];
      }
      const t = count / cachedMaxCount;
      // Dim purple to bright purple
      return [0.4 + t * 0.5, 0.2 + t * 0.2, 0.6 + t * 0.35];
    } else {
      // Common: full heatmap like commentary
      if (count === 0) {
        return [0.12, 0.1, 0.15];
      }
      const t = Math.log(count + 1) / cachedLogMax;
      // Purple spectrum: dark purple -> purple -> magenta -> pink
      if (t < 0.33) {
        const s = t / 0.33;
        return [0.2 + s * 0.2, 0.1 + s * 0.1, 0.3 + s * 0.2];
      } else if (t < 0.66) {
        const s = (t - 0.33) / 0.33;
        return [0.4 + s * 0.3, 0.2 + s * 0.1, 0.5 + s * 0.2];
      } else {
        const s = (t - 0.66) / 0.34;
        return [0.7 + s * 0.25, 0.3 + s * 0.3, 0.7 + s * 0.2];
      }
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

  // Public API for configuration
  function configure(config: { verseTexts: VerseTexts }): void {
    tropIndex = buildTropIndex(config.verseTexts);
    tropByFrequency = getTropByFrequency(tropIndex);
    console.log(`Built trop index: ${tropByFrequency.length} marks found`);
    console.log('Rarest trop:', tropByFrequency.slice(0, 5).map(t => `${t.name} (${t.totalCount})`).join(', '));
  }

  // Get selected trop for sidebar highlighting
  function getSelectedTrop(): TropIndexEntry | null {
    return selectedTrop;
  }

  // Highlight trop mark in Hebrew text for sidebar display
  function highlightTropInText(hebrewText: string, tropUnicode: string): string {
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

  const overlay: Overlay & {
    configure: typeof configure;
    getSelectedTrop: typeof getSelectedTrop;
    highlightTropInText: typeof highlightTropInText;
  } = {
  id: 'trop',
  name: 'Cantillation (Trop)',

  async init() {
    // Trop index is built from verse texts, not loaded from file
    // It will be built when setVerseTexts is called
  },

  destroy() {
    selectedTrop = null;
    updateCallback = null;
    cachedVerseLookup.clear();
    cachedMaxCount = 1;
    cachedLogMax = 0;
    cachedTier = 'common';
  },

  onUpdate(callback) {
    updateCallback = callback;
  },

  getVerseColor(verse: Verse): Color | null {
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
        <div class="legend-row"><span class="swatch" style="background: rgb(38, 38, 38)"></span><span>Does not contain</span></div>
      `;
    } else {
      container.innerHTML = `
        <div class="legend-gradient" style="background: linear-gradient(to right, #1f1a2e, #5a3f7a, #a060a0, #e090c0);"></div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888;">
          <span>0</span>
          <span>Count</span>
          <span>Max</span>
        </div>
      `;
    }
  },

  getHoverInfo(verse: Verse): string | null {
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

  // Expose configuration methods on overlay instance
  configure,
  getSelectedTrop,
  highlightTropInText,
  };

  return overlay;
}

// Create singleton instance
export const tropOverlay = createTropOverlay();

// Export helper methods for external use (sidebar, etc.)
export const configureTrop = tropOverlay.configure;
export const getSelectedTrop = tropOverlay.getSelectedTrop;
export const highlightTropInText = tropOverlay.highlightTropInText;
