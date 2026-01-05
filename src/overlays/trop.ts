// src/overlays/trop.ts
import type { Overlay, Color } from './types.ts';
import type { Verse } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import {
  buildTropIndex,
  getTropByFrequency,
  getRarityTier,
} from '../trop.ts';
import type { TropIndex, TropIndexEntry } from '../types.ts';

let tropIndex: TropIndex = new Map();
let tropByFrequency: TropIndexEntry[] = [];
let selectedTrop: TropIndexEntry | null = null;
let updateCallback: (() => void) | null = null;

// Colors for trop visualization
const RARE_MATCH_COLOR: Color = [1.0, 0.84, 0.0]; // Gold
const RARE_NO_MATCH_COLOR: Color = [0.15, 0.15, 0.15]; // Very dim

// Get verse color based on selected trop and rarity tier
function getTropVerseColor(verse: Verse): Color | null {
  if (!selectedTrop) return null;

  const key = `${verse.book}:${verse.chapter}:${verse.verse}`;
  const tier = getRarityTier(selectedTrop.totalCount);

  // Build verse lookup
  const verseLookup = new Map<string, number>();
  for (const loc of selectedTrop.verses) {
    const locKey = `${loc.book}:${loc.chapter}:${loc.verse}`;
    verseLookup.set(locKey, loc.count);
  }

  if (tier === 'rare') {
    // Binary highlight: bright gold for matches, dim gray for non-matches
    return verseLookup.has(key) ? RARE_MATCH_COLOR : RARE_NO_MATCH_COLOR;
  } else if (tier === 'uncommon') {
    // Gradient based on count (0 = dim, max = bright purple)
    const maxCount = Math.max(...selectedTrop.verses.map(v => v.count), 1);
    const count = verseLookup.get(key) || 0;
    if (count === 0) {
      return [0.12, 0.12, 0.15];
    }
    const t = count / maxCount;
    // Dim purple to bright purple
    return [0.4 + t * 0.5, 0.2 + t * 0.2, 0.6 + t * 0.35];
  } else {
    // Common: full heatmap like commentary
    const maxCount = Math.max(...selectedTrop.verses.map(v => v.count), 1);
    const count = verseLookup.get(key) || 0;
    if (count === 0) {
      return [0.12, 0.1, 0.15];
    }
    const logMax = Math.log(maxCount + 1);
    const t = Math.log(count + 1) / logMax;
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
      updateCallback?.();
    });

    button.dataset.unicode = entry.unicode;
    chart.appendChild(button);
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
    selectedTrop = null;
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
};

// Allow main.ts to pass verse texts for building trop index
export function setVerseTexts(verseTexts: VerseTexts): void {
  tropIndex = buildTropIndex(verseTexts);
  tropByFrequency = getTropByFrequency(tropIndex);
  console.log(`Built trop index: ${tropByFrequency.length} marks found`);
  console.log('Rarest trop:', tropByFrequency.slice(0, 5).map(t => `${t.name} (${t.totalCount})`).join(', '));
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
