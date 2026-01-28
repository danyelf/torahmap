// Verse length overlay - visualizes word count per verse using square root scale
import type { Overlay, Color } from './types.ts';
import type { VerseIdentity } from '../types.ts';
import { getVerseKey } from '../types.ts';
import type { VerseTexts } from '../verseTexts.ts';
import { hslToRgb } from '../utils/color.ts';

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
 * Uses square root scale and cool-to-warm gradient
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

  // Cool-to-warm gradient: blue (240°) → cyan → green → yellow → orange → red (0°)
  // Hue goes from 240° (cool) down to 0° (warm)
  const hue = 240 - (t * 240);

  // High saturation and medium lightness for vibrant colors
  return hslToRgb({ h: hue, s: 0.8, l: 0.55 });
}

export const verseLengthOverlay: Overlay = {
  id: 'verse-length',
  name: 'Verse Length',

  getVerseColor(verse: VerseIdentity): Color | null {
    return getVerseColorForWordCount(verse);
  },

  renderLegend(container: HTMLElement): void {
    // Generate gradient from blue to red
    const gradientStops = [];
    const numStops = 10;
    for (let i = 0; i < numStops; i++) {
      const t = i / (numStops - 1);
      const hue = 240 - (t * 240); // Blue to red
      const color = hslToRgb({ h: hue, s: 0.8, l: 0.55 });
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
        Cool colors (blue) = shorter verses
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; line-height: 1.3;">
        Warm colors (red/orange) = longer verses
      </div>
      <div style="color: #888; font-size: 10px; margin-top: 4px; line-height: 1.3;">
        Square root scale
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
