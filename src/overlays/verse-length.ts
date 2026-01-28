// Verse length overlay - visualizes word count per verse using square root scale
import type { Overlay, Color } from './types.ts';
import type { VerseIdentity } from '../types.ts';
import { getVerseKey } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';

// Viridis color palette (perceptually uniform, colorblind-friendly)
// Key stops from the viridis colormap
const VIRIDIS_STOPS: Array<[number, Color]> = [
  [0.0, [68/255, 1/255, 84/255]],      // dark purple
  [0.25, [59/255, 82/255, 139/255]],   // blue
  [0.5, [33/255, 145/255, 140/255]],   // teal
  [0.75, [94/255, 201/255, 98/255]],   // green
  [1.0, [253/255, 231/255, 37/255]],   // yellow
];

/**
 * Get a color from the viridis palette at position t ∈ [0, 1]
 * Uses linear interpolation between key stops
 */
function viridis(t: number): Color {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Find the two stops to interpolate between
  for (let i = 0; i < VIRIDIS_STOPS.length - 1; i++) {
    const [t0, color0] = VIRIDIS_STOPS[i];
    const [t1, color1] = VIRIDIS_STOPS[i + 1];

    if (t >= t0 && t <= t1) {
      // Linear interpolation between color0 and color1
      const localT = (t - t0) / (t1 - t0);
      return [
        color0[0] + (color1[0] - color0[0]) * localT,
        color0[1] + (color1[1] - color0[1]) * localT,
        color0[2] + (color1[2] - color0[2]) * localT,
      ];
    }
  }

  // Fallback to last color
  return VIRIDIS_STOPS[VIRIDIS_STOPS.length - 1][1];
}

// State
let verseTexts: VerseTexts | null = null;
let wordCountCache: Map<string, number> = new Map();
let minWordCount = 0;
let maxWordCount = 0;

/**
 * Count Hebrew words in a text by splitting on whitespace
 * Filters out punctuation-only tokens (e.g., em dashes)
 */
function countHebrewWords(text: string): number {
  if (!text) return 0;
  // Split on whitespace and filter out empty strings and punctuation-only tokens
  // A word must contain at least one letter character
  const words = text.trim().split(/\s+/).filter(w => /\p{L}/u.test(w));
  return words.length;
}

/**
 * Configure the overlay with verse texts
 * Builds word count cache and calculates min/max for scaling
 */
export function configure(config: { verseTexts: VerseTexts }): void {
  verseTexts = config.verseTexts;
  wordCountCache.clear();

  let min = Infinity;
  let max = 0;

  // Build word count cache for all verses
  for (const book in verseTexts) {
    for (const chapter in verseTexts[book]) {
      for (const verse in verseTexts[book][chapter]) {
        const verseText = verseTexts[book][chapter][verse];
        const hebrewText = verseText.he;
        const wordCount = countHebrewWords(hebrewText);

        const key = getVerseKey(book, parseInt(chapter), parseInt(verse));
        wordCountCache.set(key, wordCount);

        if (wordCount > 0) {
          min = Math.min(min, wordCount);
          max = Math.max(max, wordCount);
        }
      }
    }
  }

  minWordCount = min === Infinity ? 0 : min;
  maxWordCount = max;
}

/**
 * Get color for a verse based on its word count
 * Uses square root scale and viridis color palette
 */
function getVerseColorForWordCount(verse: VerseIdentity): Color | null {
  const key = getVerseKey(verse.book, verse.chapter, verse.verse);
  const wordCount = wordCountCache.get(key);

  if (wordCount === undefined || wordCount === 0) {
    // No data - return dark gray
    return [0.15, 0.15, 0.2];
  }

  // Square root scale: map word count to [0, 1]
  const sqrtMin = Math.sqrt(minWordCount);
  const sqrtMax = Math.sqrt(maxWordCount);
  const sqrtValue = Math.sqrt(wordCount);
  const t = (sqrtValue - sqrtMin) / (sqrtMax - sqrtMin);

  // Get color from viridis palette
  return viridis(t);
}

export const verseLengthOverlay: Overlay = {
  id: 'verse-length',
  name: 'Verse Length',

  getVerseColor(verse: VerseIdentity): Color | null {
    return getVerseColorForWordCount(verse);
  },

  renderLegend(container: HTMLElement): void {
    // Generate gradient using viridis palette
    const gradientStops = [];
    const numStops = 10;
    for (let i = 0; i < numStops; i++) {
      const t = i / (numStops - 1);
      const color = viridis(t);
      const rgb = color.map(c => Math.round(c * 255)).join(', ');
      const percent = (i / (numStops - 1)) * 100;
      gradientStops.push(`rgb(${rgb}) ${percent}%`);
    }
    const gradient = gradientStops.join(', ');

    container.innerHTML = `
      <div class="legend-row">
        <div style="
          width: 100%;
          height: 12px;
          background: linear-gradient(to right, ${gradient});
          border-radius: 2px;
          margin-bottom: 6px;
        "></div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888;">
          <span>${minWordCount} words</span>
          <span>${maxWordCount} words</span>
        </div>
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 8px; line-height: 1.3;">
        Purple/blue = shorter verses
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; line-height: 1.3;">
        Green/yellow = longer verses
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; line-height: 1.3;">
        Square root scale · Viridis palette
      </div>
    `;
  },

  getHoverInfo(verse: VerseIdentity): string | null {
    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const wordCount = wordCountCache.get(key);

    if (wordCount === undefined) return null;

    const plural = wordCount === 1 ? 'word' : 'words';
    return `${wordCount} ${plural}`;
  },

  renderSidebarInfo(verse: VerseIdentity): HTMLElement | string | null {
    const key = getVerseKey(verse.book, verse.chapter, verse.verse);
    const wordCount = wordCountCache.get(key);

    if (wordCount === undefined) return null;

    const plural = wordCount === 1 ? 'word' : 'words';

    const div = document.createElement('div');
    div.style.cssText = 'margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;';

    const label = document.createElement('div');
    label.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 4px;';
    label.textContent = 'Verse Length:';

    const value = document.createElement('div');
    value.style.cssText = 'font-size: 13px; color: #ddd;';
    value.textContent = `${wordCount} ${plural}`;

    div.appendChild(label);
    div.appendChild(value);

    return div;
  },
};
